"""
Evaluate search API quality across 3 modes (keyword / vector / hybrid).
Metrics: Hit Rate @10, MRR, NDCG @10, Avg Latency.
Reads eval/ground_truth.json, calls GET /api/search/hybrid?mode=... with nocache bypass,
writes detailed results to docs/eval/results/search_eval_results.json and prints a
Markdown comparison table.
"""

import json
import time
import math
import statistics
import sys
from pathlib import Path

# Đảm bảo stdout in UTF-8 để hỗ trợ tiếng Việt trên Windows console (cp1252).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests

BASE_URL = "http://localhost:4000"
API_PATH = "/api/search/hybrid"
LIMIT = 10
MODES = ["keyword", "vector", "hybrid"]

MODE_LABELS = {
    "keyword": "Keyword-only",
    "vector": "Vector-only",
    "hybrid": "Hybrid (RRF)",
}

GROUND_TRUTH_PATH = Path(__file__).resolve().parent / "ground_truth.json"
RESULTS_DIR = Path(__file__).resolve().parents[1] / "docs" / "eval" / "results"
RESULTS_PATH = RESULTS_DIR / "search_eval_results.json"


def dcg(relevance):
    """Discounted Cumulative Gain for a ranked list."""
    return sum(
        rel / math.log2(i + 2) for i, rel in enumerate(relevance)
    )


def compute_metrics(ranked_ids, expected_ids):
    """Compute Hit Rate @10, MRR, NDCG @10 for a single query."""
    expected_set = set(expected_ids)
    top10 = ranked_ids[:LIMIT]

    # Hit Rate @ 10
    hit = 1.0 if any(pid in expected_set for pid in top10) else 0.0

    # MRR: reciprocal rank of the first relevant item
    mrr = 0.0
    for i, pid in enumerate(top10):
        if pid in expected_set:
            mrr = 1.0 / (i + 1)
            break

    # NDCG @ 10 (binary relevance)
    relevance = [1 if pid in expected_set else 0 for pid in top10]
    # pad to 10
    relevance += [0] * (LIMIT - len(relevance))
    ideal = sorted(relevance, reverse=True)

    idcg = dcg(ideal)
    ndcg = dcg(relevance) / idcg if idcg > 0 else 0.0

    return hit, mrr, ndcg


def run_mode(mode):
    """Run every ground-truth query for a single mode. Returns (summary, rows)."""
    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
        ground_truth = json.load(f)

    rows = []
    latencies = []
    hits = []
    mrrs = []
    ndcgs = []

    for item in ground_truth:
        query = item["query"]
        expected_ids = item["expected_ids"]

        # Bỏ qua query không có expected_ids (không làm rớt điểm oan uổng)
        if not expected_ids:
            continue

        start = time.perf_counter()
        try:
            resp = requests.get(
                f"{BASE_URL}{API_PATH}",
                params={
                    "q": query,
                    "limit": LIMIT,
                    "mode": mode,
                    "nocache": time.time(),
                },
                timeout=30,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000

            if resp.status_code != 200:
                print(f"[ERROR] [{mode}] {query!r}: HTTP {resp.status_code} - {resp.text[:120]}")
                rows.append({
                    "query": query,
                    "expected_ids": expected_ids,
                    "returned_ids": [],
                    "hit_rate_10": 0.0,
                    "mrr": 0.0,
                    "ndcg_10": 0.0,
                    "latency_ms": round(elapsed_ms, 2),
                    "status": f"HTTP {resp.status_code}",
                })
                latencies.append(elapsed_ms)
                hits.append(0.0); mrrs.append(0.0); ndcgs.append(0.0)
                continue

            data = resp.json().get("data", [])
            returned_ids = [p.get("id") for p in data if p.get("id")]
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            print(f"[EXCEPTION] [{mode}] {query!r}: {exc}")
            rows.append({
                "query": query,
                "expected_ids": expected_ids,
                "returned_ids": [],
                "hit_rate_10": 0.0,
                "mrr": 0.0,
                "ndcg_10": 0.0,
                "latency_ms": round(elapsed_ms, 2),
                "status": f"EXCEPTION: {exc}",
            })
            latencies.append(elapsed_ms)
            hits.append(0.0); mrrs.append(0.0); ndcgs.append(0.0)
            continue

        hit, mrr, ndcg = compute_metrics(returned_ids, expected_ids)
        hits.append(hit); mrrs.append(mrr); ndcgs.append(ndcg); latencies.append(elapsed_ms)

        rows.append({
            "query": query,
            "expected_ids": expected_ids,
            "returned_ids": returned_ids,
            "hit_rate_10": round(hit, 4),
            "mrr": round(mrr, 4),
            "ndcg_10": round(ndcg, 4),
            "latency_ms": round(elapsed_ms, 2),
            "status": "OK",
        })
        print(
            f"[{mode}] {query!r:24} | hit={hit} | mrr={mrr:.3f} | ndcg@10={ndcg:.3f} | "
            f"latency={elapsed_ms:.1f}ms | returned={len(returned_ids)}"
        )

    summary = {
        "mode": mode,
        "total_queries": len(ground_truth),
        "evaluated_queries": len(hits),
        "hit_rate_10": round(statistics.mean(hits), 4) if hits else 0.0,
        "mrr": round(statistics.mean(mrrs), 4) if mrrs else 0.0,
        "ndcg_10": round(statistics.mean(ndcgs), 4) if ndcgs else 0.0,
        "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else 0.0,
        "p95_latency_ms": round(
            sorted(latencies)[int(math.ceil(0.95 * len(latencies))) - 1], 2
        ) if latencies else 0.0,
    }
    return summary, rows


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    all_summaries = {}
    all_rows = {}

    for mode in MODES:
        print(f"\n========== MODE: {mode.upper()} ==========")
        summary, rows = run_mode(mode)
        all_summaries[mode] = summary
        all_rows[mode] = rows

    # --- Markdown comparison table ---
    print("\n========== SO SANH 3 MODE (MARKDOWN) ==========")
    print("| Mode | Hit Rate | MRR | NDCG@10 | Avg Latency |")
    print("|------|----------|-----|---------|-------------|")
    for mode in MODES:
        s = all_summaries[mode]
        print(
            f"| {MODE_LABELS[mode]} | {s['hit_rate_10']} | {s['mrr']} | "
            f"{s['ndcg_10']} | {s['avg_latency_ms']}ms |"
        )

    # --- Save detailed results (all 3 modes) ---
    results = {
        "modes": MODES,
        "limit": LIMIT,
        "ground_truth_path": str(GROUND_TRUTH_PATH),
        "summaries": all_summaries,
        "per_query": all_rows,
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n========== TOM TAT ==========")
    for mode in MODES:
        s = all_summaries[mode]
        print(f"[{MODE_LABELS[mode]}] hit_rate={s['hit_rate_10']} | mrr={s['mrr']} | "
              f"ndcg@10={s['ndcg_10']} | avg_latency={s['avg_latency_ms']}ms | "
              f"evaluated={s['evaluated_queries']}/{s['total_queries']}")
    print(f"\nResults saved to: {RESULTS_PATH}")


if __name__ == "__main__":
    main()
