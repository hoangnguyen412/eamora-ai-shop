"""
Evaluate RAG Chatbot quality using LLM-as-a-judge (Groq / Llama 3).

Metrics: Faithfulness (độ trung thực) & Answer Relevancy (độ liên quan), thang 1-5.

Reads eval/rag_questions.json, calls POST <AI_URL>/chat/rag for each question,
extracts answer + retrieved products (context), asks Groq to score each answer,
prints a Markdown summary table and writes detailed results to
docs/eval/results/rag_eval_results.json.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Đảm bảo stdout UTF-8 trên Windows console (cp1252) để in tiếng Việt.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - fallback when python-dotenv is missing
    load_dotenv = None  # type: ignore[assignment]


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
QUESTIONS_PATH = Path(__file__).resolve().parent / "rag_questions.json"
RESULTS_DIR = ROOT_DIR / "docs" / "eval" / "results"
RESULTS_PATH = RESULTS_DIR / "rag_eval_results.json"

# Lưu ý: `llama3-8b-8192` / `llama3-70b-8192` đã bị GroQ decommissioned (HTTP 400).
# Dùng model GroQ hiện hành và ổn định (cùng model mà AI service của dự án đang dùng).
GROQ_JUDGE_MODEL = "qwen/qwen3.8-27b"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def load_env() -> None:
    """Load GROQ_API_KEY (and other vars) from project .env file."""
    if load_dotenv is not None:
        load_dotenv(dotenv_path=ENV_PATH, override=False)
    # Fallback: parse .env manually so the script still works without python-dotenv.
    if ENV_PATH.exists() and os.environ.get("GROQ_API_KEY") is None:
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def format_context(products: List[Dict[str, Any]]) -> str:
    """Chuyển danh sách sản phẩm retrieve được thành chuỗi context cho giám khảo."""
    if not products:
        return "(không có sản phẩm nào được retrieve)"
    lines: List[str] = []
    for i, p in enumerate(products, 1):
        name = p.get("name") or p.get("product_name") or "Không rõ"
        pid = p.get("id") or p.get("productId") or "?"
        price = p.get("price")
        brand = p.get("brand") or "Không rõ"
        category = p.get("category") or p.get("categoryId") or ""
        price_str = f"{price:,.0f} VND" if isinstance(price, (int, float)) else "Liên hệ"
        extra = f" | Danh mục: {category}" if category else ""
        lines.append(f"{i}. [{pid}] {name} | Thương hiệu: {brand} | Giá: {price_str}{extra}")
    return "\n".join(lines)


def call_chat_api(base_url: str, question: str, session_id: str) -> Dict[str, Any]:
    """Gọi API Chatbot RAG. Trả về dict có answer, products, status, error."""
    url = f"{base_url.rstrip('/')}/chat/rag"
    payload = {"sessionId": session_id, "message": question}
    try:
        resp = requests.post(url, json=payload, timeout=60)
        if resp.status_code != 200:
            return {"answer": "", "products": [], "status": f"HTTP {resp.status_code}",
                    "error": resp.text[:200]}
        data = resp.json()
        return {
            "answer": data.get("answer", ""),
            "products": data.get("products", []) or [],
            "status": "OK",
            "error": None,
            "groundedness_score": data.get("groundedness_score"),
        }
    except Exception as exc:  # noqa: BLE001 - report connection errors gracefully
        return {"answer": "", "products": [], "status": "EXCEPTION", "error": str(exc)}


def extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Trích xuất object JSON từ text (loại bỏ code fence ```json ... ``` nếu có)."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(cleaned[start:end + 1])
    except json.JSONDecodeError:
        return None


def call_groq_judge(groq_api_key: str, context: str, question: str, answer: str) -> Optional[Dict[str, Any]]:
    """Gọi GroQ LLM-as-a-judge để chấm Faithfulness & Answer Relevancy (thang 1-5)."""
    prompt = (
        "Bạn là giám khảo khó tính. Hãy chấm điểm câu trả lời của Chatbot dựa trên 2 tiêu chí (thang 1-5):\n"
        "1. Faithfulness (Độ trung thực): Câu trả lời có bám sát vào Context sản phẩm được cung cấp không? "
        "(Không bịa ra thông số không có trong Context). Nếu Context rỗng mà Bot vẫn trả lời -> Cho 1 điểm.\n"
        "2. Answer Relevancy (Độ liên quan): Câu trả lời có trả lời đúng câu hỏi của user không?\n\n"
        f"Context: {context}\n"
        f"Câu hỏi: {question}\n"
        f"Câu trả lời: {answer}\n\n"
        'CHỈ TRẢ VỀ ĐỊNH DẠNG JSON: {"faithfulness": <điểm>, "relevancy": <điểm>, "reason": "<lý do ngắn gọn>"}'
    )
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": GROQ_JUDGE_MODEL,
        "messages": [
            {"role": "system", "content": "Bạn là giám khảo đánh giá chất lượng chatbot, chỉ trả về JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "max_tokens": 400,
    }
    try:
        resp = requests.post(GROQ_CHAT_URL, headers=headers, json=body, timeout=60)
        if resp.status_code != 200:
            print(f"[GroQ] HTTP {resp.status_code}: {resp.text[:200]}")
            return None
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return extract_json(content)
    except Exception as exc:  # noqa: BLE001
        print(f"[GroQ] EXCEPTION: {exc}")
        return None


def main() -> int:
    load_env()
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        print("LỖI: Thiếu GROQ_API_KEY trong .env (hoặc biến môi trường).")
        return 1

    # Base URL cho AI Service (chứa RAG chat). Ưu tiên CHAT_BASE_URL, sau đó AI_URL.
    base_url = os.environ.get("CHAT_BASE_URL") or os.environ.get("AI_URL") or "http://localhost:8000"

    if not QUESTIONS_PATH.exists():
        print(f"LỖI: Không tìm thấy file {QUESTIONS_PATH}")
        return 1

    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions: List[Dict[str, Any]] = json.load(f)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    rows: List[Dict[str, Any]] = []
    faith_scores: List[float] = []
    relev_scores: List[float] = []

    print(f"\n========== EVAL RAG CHATBOT (LLM-as-a-judge: {GROQ_JUDGE_MODEL}) ==========")
    print(f"Chat API base: {base_url}\n")

    for item in questions:
        qid = item.get("id")
        question = item.get("question", "")
        expected_pid = item.get("expected_product_id")

        chat_result = call_chat_api(base_url, question, session_id=f"eval-{qid}")
        answer = chat_result.get("answer", "")
        products = chat_result.get("products", [])
        context = format_context(products)

        judge = call_groq_judge(groq_api_key, context, question, answer)

        if (judge
                and isinstance(judge.get("faithfulness"), (int, float))
                and isinstance(judge.get("relevancy"), (int, float))):
            faithfulness = float(judge["faithfulness"])
            relevancy = float(judge["relevancy"])
            reason = str(judge.get("reason", ""))
            faith_scores.append(faithfulness)
            relev_scores.append(relevancy)
            status = chat_result.get("status", "OK")
        else:
            faithfulness = 0.0
            relevancy = 0.0
            reason = "Không chấm được (GroQ lỗi hoặc trả về không hợp lệ)"
            status = chat_result.get("status", "JUDGE_ERROR")

        rows.append({
            "id": qid,
            "question": question,
            "expected_product_id": expected_pid,
            "answer": answer,
            "context": context,
            "retrieved_product_count": len(products),
            "retrieved_products": products,
            "chat_status": status,
            "chat_error": chat_result.get("error"),
            "faithfulness": round(faithfulness, 2),
            "relevancy": round(relevancy, 2),
            "reason": reason,
        })

        print(
            f"[Q{qid}] {question!r:40} | F={faithfulness} | R={relevancy} | "
            f"products={len(products)} | {status}"
        )

    avg_faith = round(sum(faith_scores) / len(faith_scores), 2) if faith_scores else 0.0
    avg_relev = round(sum(relev_scores) / len(relev_scores), 2) if relev_scores else 0.0
    avg_overall = round((avg_faith + avg_relev) / 2, 2)

    # --- Markdown summary table ---
    md_lines: List[str] = []
    md_lines.append("# Kết quả đánh giá RAG Chatbot (LLM-as-a-judge)")
    md_lines.append("")
    md_lines.append(f"- Judge model: `{GROQ_JUDGE_MODEL}`")
    md_lines.append(f"- Chat API: `{base_url}/chat/rag`")
    md_lines.append(f"- Tổng số câu hỏi: {len(questions)}")
    md_lines.append(f"- Điểm trung bình Faithfulness: **{avg_faith} / 5**")
    md_lines.append(f"- Điểm trung bình Answer Relevancy: **{avg_relev} / 5**")
    md_lines.append(f"- Điểm trung bình tổng hợp: **{avg_overall} / 5**")
    md_lines.append("")
    md_lines.append("| ID | Câu hỏi | Faithfulness | Relevancy | Lý do |")
    md_lines.append("|----|---------|--------------|-----------|-------|")
    for row in rows:
        md_lines.append(
            f"| {row['id']} | {row['question']} | {row['faithfulness']} | {row['relevancy']} | {row['reason']} |"
        )
    md_lines.append("")
    md_lines.append(f"| **Trung bình** | | **{avg_faith}** | **{avg_relev}** | |")
    md_lines.append("")
    md_lines.append("## Chi tiết từng câu hỏi")
    for row in rows:
        md_lines.append(f"### Câu {row['id']}: {row['question']}")
        md_lines.append(f"- expected_product_id: {row['expected_product_id']}")
        md_lines.append(f"- Chat status: {row['chat_status']}")
        if row.get("chat_error"):
            md_lines.append(f"- Chat error: {row['chat_error']}")
        md_lines.append(f"- Retrieved products: {row['retrieved_product_count']}")
        md_lines.append(f"- Context: {row['context']}")
        md_lines.append(f"- Answer: {row['answer']}")
        md_lines.append(f"- Faithfulness: {row['faithfulness']} | Relevancy: {row['relevancy']}")
        md_lines.append(f"- Lý do: {row['reason']}")
        md_lines.append("")

    print("\n========== BẢNG TỔNG KẾT (MARKDOWN) ==========")
    print("\n".join(md_lines[:14]))

    results = {
        "judge_model": GROQ_JUDGE_MODEL,
        "chat_api": f"{base_url}/chat/rag",
        "total_questions": len(questions),
        "average_faithfulness": avg_faith,
        "average_relevancy": avg_relev,
        "average_overall": avg_overall,
        "per_question": rows,
        "markdown_summary": "\n".join(md_lines),
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n========== TOM TAT ==========")
    print(f"Faithfulness trung bình: {avg_faith} / 5")
    print(f"Answer Relevancy trung bình: {avg_relev} / 5")
    print(f"Tổng hợp trung bình: {avg_overall} / 5")
    print(f"\nChi tiết đã lưu vào: {RESULTS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
