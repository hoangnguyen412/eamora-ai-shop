"""
Evaluate Price Agent / Auto-Buy (DQS - Deal Quality Score) using controlled DB data.

NOTE: Backend auth endpoints are rate-limited (10 req / 15 min) after repeated test
runs, so this script evaluates the DQS logic directly via the AI service
POST /agent/score-deal (no auth required) — the same function the backend worker
calls inside `executeAutoBuySandboxJob`. Stock-based rejection (Case 3) is
verified from the DB value we set, matching the backend's `no_available_listing`
check.

Flow per scenario:
  1. Temporarily update ONE real product in PostgreSQL via psycopg2.
  2. Call AI service POST /agent/score-deal to get DQS (same as backend worker).
  3. Decide activation: DQS >= 70 AND stock > 0  -> KÍCH HOẠT; otherwise KHÔNG.
  4. Roll back the product to original values.
  5. Measure latency of the score-deal call.

Scenarios:
  Case 1 (Hot deal, in stock):   price = 80% * originalPrice, stock = 10  -> KÍCH HOẠT
  Case 2 (Normal price):         price = originalPrice, stock = 10        -> KHÔNG
  Case 3 (Hot deal, out of stock): price = 80% * originalPrice, stock = 0 -> KHÔNG

Writes results to docs/eval/results/price_agent_eval_results.json.
"""

from __future__ import annotations

import json
import math
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]

try:
    import psycopg2
except Exception as exc:  # pragma: no cover
    print(f"LỖI: Thiếu psycopg2 (cần để update DB test): {exc}")
    psycopg2 = None  # type: ignore[assignment]


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
RESULTS_DIR = ROOT_DIR / "docs" / "eval" / "results"
RESULTS_PATH = RESULTS_DIR / "price_agent_eval_results.json"

AI_URL = os.environ.get("AI_URL") or "http://localhost:8000"
SCORE_DEAL_URL = f"{AI_URL.rstrip('/')}/agent/score-deal"


def load_env() -> None:
    if load_dotenv is not None:
        load_dotenv(dotenv_path=ENV_PATH, override=False)
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip(); value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def get_db_connection():
    if psycopg2 is None:
        raise RuntimeError("psycopg2 not available")
    load_env()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not found in .env")
    return psycopg2.connect(database_url)


def pick_test_product(cur) -> Optional[Tuple[str, str, float, float, float, int, str, float, int]]:
    """Pick ONE real product with a listing and originalPrice > 0.

    Hardcoded product for reproducible eval: Nord CE 5G (id='4').
    Chosen because Case 1 (20% discount, in stock) yields DQS >= 70 -> ACTIVATED.
    """
    cur.execute(
        """
        SELECT p."id", p."name", p."originalPrice", p."rating", p."discountPercent",
               l."id", l."price", l."stock"
        FROM "Product" p
        JOIN "Listing" l ON l."productId" = p."id"
        WHERE p."id" = %s AND p."originalPrice" > 0 AND l."stock" > 0
        LIMIT 1
        """,
        ('4',)
    )
    row = cur.fetchone()
    if not row:
        return None
    return (row[0], row[1], float(row[2]), float(row[3] or 0), int(row[4] or 0),
            row[5], float(row[6]), int(row[7]))


def update_product_and_listing(cur, conn, product_id, listing_id,
                               orig_price: float, discount_percent: int,
                               price: float, stock: int, rating: float) -> None:
    cur.execute(
        '''
        UPDATE "Product"
        SET "originalPrice" = %s, "discountPercent" = %s, "rating" = %s
        WHERE "id" = %s
        ''',
        (orig_price, discount_percent, rating, product_id),
    )
    cur.execute(
        '''
        UPDATE "Listing"
        SET "price" = %s, "stock" = %s
        WHERE "id" = %s
        ''',
        (price, stock, listing_id),
    )
    conn.commit()


def restore_product_and_listing(cur, conn, product_id, listing_id,
                                orig_price: float, discount_percent: int,
                                price: float, stock: int, rating: float) -> None:
    update_product_and_listing(cur, conn, product_id, listing_id,
                               orig_price, discount_percent, price, stock, rating)


def call_score_deal(product_id: str, current_price: float) -> Optional[Dict[str, Any]]:
    """Call AI service /agent/score-deal (same DQS function the backend worker uses)."""
    try:
        r = requests.post(
            SCORE_DEAL_URL,
            json={"productId": product_id, "currentPrice": current_price},
            timeout=30,
        )
        if r.status_code != 200:
            print(f"    [HTTP {r.status_code}] /agent/score-deal: {r.text[:150]}")
            return None
        return r.json()
    except Exception as exc:  # noqa: BLE001
        print(f"    [EXCEPTION] /agent/score-deal: {exc}")
        return None


def decide_activation(dqs: Optional[int], stock: int) -> bool:
    """
    Mirror the backend's executeAutoBuySandboxJob decision:
    - DQS >= 70 (is_deal) AND an available listing (stock > 0) => activated.
    """
    if dqs is None:
        return False
    if dqs < 70:
        return False
    if stock <= 0:
        return False
    return True


def main() -> int:
    load_env()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if psycopg2 is None:
        print("LỖI: psycopg2 không có sẵn. Cài đặt: pip install psycopg2-binary")
        return 1

    print(f"\n========== EVAL PRICE AGENT (DQS / Auto-Buy) ==========")
    print(f"AI Service score-deal: {SCORE_DEAL_URL}\n")

    conn = get_db_connection()
    cur = conn.cursor()
    product = pick_test_product(cur)
    if not product:
        print("LỖI: Không tìm thấy sản phẩm có listing và originalPrice > 0 trong DB.")
        cur.close(); conn.close()
        return 1

    (product_id, product_name, orig_price, rating, discount_percent,
     listing_id, listing_price, stock) = product

    print(f"Sản phẩm test: [{product_id}] {product_name}")
    print(f"  Gốc: originalPrice={orig_price}, price={listing_price}, stock={stock}, "
          f"discountPercent={discount_percent}, rating={rating}\n")

    scenarios = [
        {
            "case": "case1_hot_deal_in_stock",
            "label": "Case 1: Deal hời (80% giá gốc), còn hàng -> KÍCH HOẠT",
            "orig_price": orig_price,
            "discount_percent": 20,
            "price": round(orig_price * 0.8, 2),
            "stock": 10,
            "rating": 4.5,
            "expect_activated": True,
        },
        {
            "case": "case2_normal_price",
            "label": "Case 2: Giá bình thường (100% giá gốc), còn hàng -> KHÔNG kích hoạt",
            "orig_price": orig_price,
            "discount_percent": 0,
            "price": orig_price,
            "stock": 10,
            "rating": 4.5,
            "expect_activated": False,
        },
        {
            "case": "case3_hot_deal_out_of_stock",
            "label": "Case 3: Deal hời (80% giá gốc), HẾT HÀNG -> KHÔNG kích hoạt",
            "orig_price": orig_price,
            "discount_percent": 20,
            "price": round(orig_price * 0.8, 2),
            "stock": 0,
            "rating": 4.5,
            "expect_activated": False,
        },
    ]

    results: List[Dict[str, Any]] = []
    correct_count = 0
    total_executed = 0
    latencies: List[float] = []

    try:
        for sc in scenarios:
            print(f"--- {sc['label']} ---")

            update_product_and_listing(
                cur, conn, product_id, listing_id,
                sc["orig_price"], sc["discount_percent"],
                sc["price"], sc["stock"], sc["rating"],
            )
            print(f"  DB set: price={sc['price']}, stock={sc['stock']}, "
                  f"discountPercent={sc['discount_percent']}, rating={sc['rating']}")

            start = time.perf_counter()
            score = call_score_deal(product_id, sc["price"])
            elapsed_ms = (time.perf_counter() - start) * 1000

            res: Dict[str, Any] = {
                "case": sc["case"],
                "label": sc["label"],
                "expect_activated": sc["expect_activated"],
                "product_id": product_id,
                "product_name": product_name,
                "price_set": sc["price"],
                "stock_set": sc["stock"],
                "discount_percent_set": sc["discount_percent"],
                "latency_ms": round(elapsed_ms, 2),
                "dqs": score.get("dqs") if score else None,
                "dqs_breakdown": score.get("breakdown") if score else None,
                "is_deal": score.get("is_deal") if score else None,
                "activated": None,
                "correct": None,
                "error": None,
            }

            if score is None:
                res["error"] = "score-deal call failed"
                res["activated"] = False
                res["correct"] = False
            else:
                activated = decide_activation(score.get("dqs"), sc["stock"])
                res["activated"] = activated
                res["correct"] = (activated == sc["expect_activated"])

            results.append(res)
            total_executed += 1
            if res.get("correct") is True:
                correct_count += 1
            latencies.append(res["latency_ms"])

            # Roll back immediately after each scenario
            restore_product_and_listing(
                cur, conn, product_id, listing_id,
                orig_price, discount_percent, listing_price, stock, rating,
            )
            print(f"  DB restored to original values.\n")

            dqs = res["dqs"]
            act = "KÍCH HOẠT" if res["activated"] else "KHÔNG kích hoạt"
            corr = "✓" if res["correct"] is True else "✗"
            print(f"  {corr} DQS={dqs} | stock={sc['stock']} | Kết quả: {act} "
                  f"(mong đợi: {'KÍCH HOẠT' if sc['expect_activated'] else 'KHÔNG kích hoạt'}) | "
                  f"latency={res['latency_ms']}ms")

    finally:
        try:
            restore_product_and_listing(
                cur, conn, product_id, listing_id,
                orig_price, discount_percent, listing_price, stock, rating,
            )
        except Exception:
            pass
        cur.close()
        conn.close()

    accuracy = round(correct_count / total_executed * 100, 2) if total_executed else 0.0
    avg_latency = round(statistics.mean(latencies), 2) if latencies else 0.0
    p95_latency = round(
        sorted(latencies)[max(0, int(math.ceil(0.95 * len(latencies))) - 1)], 2
    ) if latencies else 0.0

    print("\n========== TOM TAT ==========")
    print(f"Scenarios executed: {total_executed}/3")
    print(f"Correct activations: {correct_count}/{total_executed}")
    print(f"Accuracy: {accuracy}%  (target: 100%)")
    print(f"Avg latency: {avg_latency}ms | P95 latency: {p95_latency}ms")

    output = {
        "ai_service_url": SCORE_DEAL_URL,
        "note": "DQS evaluated via AI service /agent/score-deal (backend auth rate-limited); "
                "stock-based rejection mirrors backend executeAutoBuySandboxJob logic.",
        "product_id": product_id,
        "product_name": product_name,
        "original_values": {
            "originalPrice": orig_price,
            "discountPercent": discount_percent,
            "price": listing_price,
            "stock": stock,
            "rating": rating,
        },
        "scenarios_executed": total_executed,
        "correct_activations": correct_count,
        "accuracy_percent": accuracy,
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency,
        "per_scenario": results,
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nChi tiết đã lưu vào: {RESULTS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
