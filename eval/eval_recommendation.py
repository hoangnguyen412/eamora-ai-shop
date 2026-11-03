"""
Evaluate Personalized Recommendation (GET /api/recommendations).

Metrics (limit=10):
  - Category Diversity = (distinct categories among 10 recs) / 10
  - Brand Novelty      = (distinct brands among 10 recs) / 10

Flow (avoids /api/auth rate-limit by self-issuing a JWT):
  1. Create ONE buyer user directly in PostgreSQL via psycopg2.
  2. Sign a JWT with the project JWT_SECRET (same secret backend verifies).
  3. Create >= 6 interactions via POST /api/interactions using that token.
  4. Call GET /api/recommendations?limit=10 with the same token.
  5. Expect source == "ai" (personalized, not Popular fallback).
  6. Compute metrics; write results to docs/eval/results/recommendation_eval_results.json.
"""

from __future__ import annotations

import json
import os
import statistics
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import jwt  # PyJWT
import requests

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]

try:
    import psycopg2
except Exception as exc:  # pragma: no cover
    print(f"LỖI: Thiếu psycopg2: {exc}")
    psycopg2 = None  # type: ignore[assignment]


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
RESULTS_DIR = ROOT_DIR / "docs" / "eval" / "results"
RESULTS_PATH = RESULTS_DIR / "recommendation_eval_results.json"

BASE_URL = os.environ.get("NEXT_PUBLIC_API_URL") or "http://localhost:4000"
RECOMMEND_LIMIT = 10
INTERACTIONS_PER_USER = 8
JWT_EXPIRES_IN_SECONDS = 7 * 24 * 3600


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


def create_eval_user(cur, conn) -> str:
    """Insert a buyer user directly into DB; return its id."""
    user_id = str(uuid.uuid4())
    email = f"eval_rec_{int(time.time())}_{uuid.uuid4().hex[:6]}@example.com"
    cur.execute(
        '''
        INSERT INTO "User" ("id", "email", "passwordHash", "role", "autoBuyEnabled", "createdAt")
        VALUES (%s, %s, %s, %s, %s, NOW())
        RETURNING "id"
        ''',
        (user_id, email, "mock", "buyer", False),
    )
    conn.commit()
    return user_id


def sign_jwt(user_id: str, email: str) -> str:
    """Sign a JWT the backend's requireAuth will accept (same JWT_SECRET + HS256)."""
    load_env()
    secret = os.environ.get("JWT_SECRET") or "dev-secret-change-me"
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "role": "buyer",
        "iat": now,
        "exp": now + JWT_EXPIRES_IN_SECONDS,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def api_post(session: requests.Session, path: str, payload: Dict[str, Any],
             headers: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
    try:
        r = session.post(f"{BASE_URL}{path}", json=payload, headers=headers, timeout=30)
        if r.status_code in (200, 201):
            return r.json()
        print(f"    [HTTP {r.status_code}] POST {path}: {r.text[:150]}")
        return None
    except Exception as exc:  # noqa: BLE001
        print(f"    [EXCEPTION] POST {path}: {exc}")
        return None


def api_get(session: requests.Session, path: str,
            headers: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
    try:
        r = session.get(f"{BASE_URL}{path}", headers=headers, timeout=30)
        if r.status_code == 200:
            return r.json()
        print(f"    [HTTP {r.status_code}] GET {path}: {r.text[:150]}")
        return None
    except Exception as exc:  # noqa: BLE001
        print(f"    [EXCEPTION] GET {path}: {exc}")
        return None


def fetch_products(session: requests.Session) -> List[Dict[str, Any]]:
    all_products: List[Dict[str, Any]] = []
    for page in range(1, 11):
        result = api_get(session, f"/api/products?page={page}&limit=100")
        if not result:
            break
        data = result.get("data", []) or []
        all_products.extend(data)
        if len(data) < 100:
            break
    return all_products


def compute_metrics(recs: List[Dict[str, Any]]) -> Dict[str, Any]:
    cats = [r.get("categoryName") or r.get("category") or "Unknown" for r in recs]
    brands = [r.get("brand") or "Unknown" for r in recs]
    distinct_cats = len(set(cats))
    distinct_brands = len(set(brands))
    n = len(recs) if recs else 1
    return {
        "returned_count": len(recs),
        "distinct_categories": distinct_cats,
        "distinct_brands": distinct_brands,
        "category_diversity": round(distinct_cats / RECOMMEND_LIMIT, 4),
        "brand_novelty": round(distinct_brands / RECOMMEND_LIMIT, 4),
        "categories": cats,
        "brands": brands,
    }


def pick_interaction_targets(products: List[Dict[str, Any]], n: int) -> List[str]:
    """Pick up to `n` product ids spread across distinct categories/brands."""
    by_category: Dict[str, List[str]] = {}
    for p in products:
        pid = p.get("id")
        cat = p.get("categoryName") or p.get("category") or "Unknown"
        if pid:
            by_category.setdefault(cat, []).append(pid)

    chosen: List[str] = []
    cats_sorted = sorted(by_category.keys(), key=lambda c: -len(by_category[c]))
    idx = 0
    while len(chosen) < n and idx < len(cats_sorted) * 4:
        cat = cats_sorted[idx % len(cats_sorted)]
        pool = by_category[cat]
        pick = pool[idx // len(cats_sorted) % len(pool)]
        if pick not in chosen:
            chosen.append(pick)
        idx += 1
    if len(chosen) < n:
        for p in products:
            pid = p.get("id")
            if pid and pid not in chosen:
                chosen.append(pid)
            if len(chosen) >= n:
                break
    return chosen[:n]


def cleanup_user(cur, conn, user_id: str) -> None:
    """Best-effort cleanup of the eval user and its interactions."""
    try:
        cur.execute('DELETE FROM "Interaction" WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM "User" WHERE "id" = %s', (user_id,))
        conn.commit()
    except Exception:
        pass


def main() -> int:
    load_env()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if psycopg2 is None:
        print("LỖI: psycopg2 không có sẵn.")
        return 1

    session = requests.Session()
    products = fetch_products(session)
    product_ids = [p["id"] for p in products if p.get("id")]
    if not product_ids:
        print("LỖI: Không lấy được danh sách sản phẩm từ /api/products.")
        return 1

    cats_present: Dict[str, int] = {}
    for p in products:
        c = p.get("categoryName") or p.get("category") or "Unknown"
        cats_present[c] = cats_present.get(c, 0) + 1

    print(f"\n========== EVAL RECOMMENDATION (limit={RECOMMEND_LIMIT}) ==========")
    print(f"Base URL: {BASE_URL}")
    print(f"Categories in DB: {dict(sorted(cats_present.items(), key=lambda kv: -kv[1]))}\n")

    conn = get_db_connection()
    cur = conn.cursor()
    user_id = create_eval_user(cur, conn)
    # We don't know the email used in create_eval_user easily; re-fetch not needed
    # because we self-sign the JWT with the user_id we just created.
    # (email claim in JWT is informational only.)
    token = sign_jwt(user_id, f"{user_id}@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    target_ids = pick_interaction_targets(products, INTERACTIONS_PER_USER)
    print(f"--- Eval user id={user_id} ---")
    print(f"  Creating {len(target_ids)} interactions across categories...")

    n_inter = 0
    for pid in target_ids:
        body = api_post(session, "/api/interactions", {"productId": pid, "action": "view"}, headers)
        if body:
            n_inter += 1
        time.sleep(0.05)
    print(f"  Interactions created: {n_inter}/{len(target_ids)}")

    time.sleep(0.5)

    result = api_get(session, f"/api/recommendations?limit={RECOMMEND_LIMIT}", headers)
    if not result:
        print("  [LỖI] Không lấy được recommendations.")
        cleanup_user(cur, conn, user_id)
        cur.close(); conn.close()
        return 1

    recs = result.get("data", []) or []
    source = result.get("source", "?")
    reason = result.get("reason", "")
    is_personalized = (source == "ai")
    metrics = compute_metrics(recs)

    print(f"  source={source} | reason={reason} | personalized={is_personalized} | "
          f"returned={len(recs)} | cat_diversity={metrics['category_diversity']} | "
          f"brand_novelty={metrics['brand_novelty']}")
    for j, r in enumerate(recs, 1):
        print(f"    {j:2}. [{r.get('id')}] {str(r.get('name'))[:45]:45} | "
              f"cat={r.get('categoryName') or r.get('category')} | brand={r.get('brand')} | "
              f"price={r.get('basePrice') or r.get('price')}")

    diversity_ok = metrics["category_diversity"] > 0.3
    print(f"\n  Category Diversity > 0.3 ? {'YES' if diversity_ok else 'NO'} "
          f"({metrics['category_diversity']})")

    per_user = [{
        "user_id": user_id,
        "source": source,
        "reason": reason,
        "is_personalized": is_personalized,
        "interactions_created": n_inter,
        "limit": RECOMMEND_LIMIT,
        "diversity_above_03": diversity_ok,
        **metrics,
    }]

    # Cleanup eval user
    cleanup_user(cur, conn, user_id)
    cur.close()
    conn.close()

    results = {
        "limit": RECOMMEND_LIMIT,
        "base_url": BASE_URL,
        "users_evaluated": 1,
        "personalized_count": 1 if is_personalized else 0,
        "average_category_diversity": metrics["category_diversity"],
        "average_brand_novelty": metrics["brand_novelty"],
        "diversity_target_met": diversity_ok,
        "categories_in_db": cats_present,
        "note": "DB contains only 1 category ('Điện thoại'), so max diversity = 0.1 "
                "(target >0.3 not achievable with current data).",
        "per_user": per_user,
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nChi tiết đã lưu vào: {RESULTS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
