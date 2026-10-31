from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import time
import re
import os
import uuid
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
from openai import OpenAI

app = FastAPI(title="E-Amora AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo model (Lần đầu chạy sẽ tự tải model về, hơi lâu)
print("Loading model keepitreal/vietnamese-sbert...")
model = SentenceTransformer('keepitreal/vietnamese-sbert')
print("Model loaded successfully!")

load_dotenv()

# Cấu hình kết nối PostgreSQL (pgvector)
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LOI: DATABASE_URL khong duoc tim thay trong bien moi truong. Vui long kiem tra file .env")
    exit(1)


def get_db_connection():
    """Trả về một connection tới PostgreSQL dùng psycopg2."""
    return psycopg2.connect(DATABASE_URL)


# 1. Task T3-1-1: Health Check
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AI Features"}

# 2. Task T3-2-1: Embedding Service
class EmbedRequest(BaseModel):
    texts: List[str]

@app.post("/embed")
def embed_texts(req: EmbedRequest):
    start_time = time.time()
    # Tạo embedding
    embeddings = model.encode(req.texts)
    # Chuyển numpy array sang list
    embeddings_list = embeddings.tolist()

    elapsed_time = time.time() - start_time
    print(f"Embedded {len(req.texts)} texts in {elapsed_time:.2f} seconds")

    return {"embeddings": embeddings_list}

# 3. Task T3-2-3: Constraint Parser
PRICE_UNIT_MULTIPLIERS = {
    "triệu": 1_000_000,
    "tr": 1_000_000,
    "củ": 1_000_000,
    "k": 1_000,
    "nghìn": 1_000,
    "ngàn": 1_000,
}

# LƯU Ý: id danh mục thực tế trong DB là "cat-phone" / "cat-laptop"
# (xem AI_features/seed_db.py). Dùng "cat-mobile" sẽ không khớp bản ghi nào.
CATEGORY_KEYWORDS = {
    "cat-laptop": ["laptop", "macbook", "thinkpad", "ideapad", "zenbook", "máy tính xách tay"],
    "cat-phone": [
        "mobile", "điện thoại", "smartphone", "iphone", "samsung", "oppo",
        "redmi", "oneplus", "infinix", "vivo", "realme",
    ],
}

CATEGORY_LABELS = {
    "cat-laptop": "Laptop",
    "cat-phone": "Điện thoại",
}


def _parse_price_to_vnd(val_str: Optional[str], unit: Optional[str]) -> Optional[int]:
    """Chuẩn hoá số tiền người dùng nhập (VD: "20 triệu", "1,5tr", "500k") sang VND."""
    if not val_str:
        return None
    num = float(val_str.replace(',', '.'))
    if unit in PRICE_UNIT_MULTIPLIERS:
        return int(num * PRICE_UNIT_MULTIPLIERS[unit])
    clean_num = int(val_str.replace('.', '').replace(',', ''))
    return clean_num if clean_num >= 100000 else int(num * 1_000_000)


def _detect_category_id(text: str) -> Optional[str]:
    """Trả về id danh mục nếu câu văn bản có chứa từ khoá danh mục."""
    lowered = (text or "").lower()
    for category_id, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return category_id
    return None


def parse_filters(text: str, chat_history: Optional[List[str]] = None) -> dict:
    """Bóc tách hard filter (min_price, max_price, category_id, brand) từ câu query.

    chat_history: danh sách tin nhắn cũ của user, sắp xếp theo thứ tự thời gian
    (cũ -> mới). Dùng để kế thừa danh mục khi câu hỏi hiện tại không nêu danh mục.
    """
    text = (text or "").lower()

    min_price = None
    max_price = None
    category_id = None
    brand = None
    strict_budget = False

    # 1. Price Detection: Range "từ X đến Y", "X đến Y", "X - Y triệu"
    range_match = re.search(r'(?:từ\s*)?(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn)?\s*(?:đến|tới|-)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn)?\b', text)
    if range_match:
        val1_str, unit1, val2_str, unit2 = range_match.groups()
        unit1 = unit1 or unit2
        unit2 = unit2 or unit1

        min_price = _parse_price_to_vnd(val1_str, unit1)
        max_price = _parse_price_to_vnd(val2_str, unit2)
    else:
        # Min price: "trên", "lớn hơn", "cao hơn", "từ", ">=", ">"
        min_match = re.search(r'(?:trên|lớn hơn|cao hơn|từ|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn)?\b', text)
        if min_match:
            val_str, unit = min_match.groups()
            min_price = _parse_price_to_vnd(val_str, unit)

        # Max price: "dưới", "nhỏ hơn", "ít hơn", "bé hơn", "đến", "tới", "<=", "<"
        max_match = re.search(r'(?:dưới|nhỏ hơn|ít hơn|bé hơn|đến|tới|<=|<)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn)?\b', text)
        if max_match:
            val_str, unit = max_match.groups()
            max_price = _parse_price_to_vnd(val_str, unit)

        # Ngưỡng giá tường minh theo đúng đơn vị "triệu":
        # "dưới 20 triệu" -> max_price = 20_000_000, "trên 10 triệu" -> min_price = 10_000_000
        if max_price is None:
            under_trieu = re.search(r'dưới\s*(\d+(?:[.,]\d+)?)\s*triệu', text)
            if under_trieu:
                max_price = _parse_price_to_vnd(under_trieu.group(1), "triệu")

        if min_price is None:
            over_trieu = re.search(r'trên\s*(\d+(?:[.,]\d+)?)\s*triệu', text)
            if over_trieu:
                min_price = _parse_price_to_vnd(over_trieu.group(1), "triệu")

        # Approx price: "tầm", "khoảng", "mức", "giá"
        if min_price is None and max_price is None:
            approx_match = re.search(r'(?:tầm|khoảng|mức|giá)?\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn)\b', text)
            if approx_match:
                val_str, unit = approx_match.groups()
                if unit in ['triệu', 'tr', 'củ']:
                    max_price = _parse_price_to_vnd(val_str, unit)
                elif unit in ['k', 'nghìn', 'ngàn']:
                    max_price = _parse_price_to_vnd(val_str, unit)

    if max_price is not None and ("dưới" in text or "nhỏ hơn" in text or "<" in text):
        strict_budget = True

    # 2. Category Detection (câu hiện tại trước)
    category_id = _detect_category_id(text)

    # 2b. Context retention: kế thừa danh mục từ tin nhắn gần nhất trong lịch sử chat.
    # chat_history theo thứ tự cũ -> mới, nên reversed() duyệt từ mới nhất trở về trước.
    if category_id is None and chat_history:
        for previous_message in reversed(chat_history):
            historical_category_id = _detect_category_id(previous_message)
            if historical_category_id:
                category_id = historical_category_id
                break

    # 3. Brand Detection
    if "iphone" in text or "apple" in text:
        brand = "Apple"
    elif "samsung" in text:
        brand = "Samsung"
    elif "oppo" in text:
        brand = "Oppo"

    return {
        "category_id": category_id,
        "min_price": min_price,
        "max_price": max_price,
        "brand": brand,
        "category": CATEGORY_LABELS.get(category_id) if category_id else None,
        "budget_min": min_price,
        "budget_max": max_price,
        "strict_budget": strict_budget,
    }

class ParseRequest(BaseModel):
    query: str

@app.post("/search/parse")
def parse_query(req: ParseRequest):
    return parse_filters(req.query)

class SemanticSearchRequest(BaseModel):
    query: str

@app.post("/search/semantic")
def semantic_search(req: SemanticSearchRequest):
    start_time = time.time()

    # Bóc tách bộ lọc (hard filter) từ câu query
    filters = parse_filters(req.query)

    # Tạo embedding cho câu query (vector 768 chiều)
    embedding = model.encode(req.query)
    vector_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

    # Kết nối DB và thực hiện vector search
    conn = get_db_connection()
    cur = conn.cursor()

    # Xây dựng câu SQL chuẩn DBA:
    # - Khớp tên cột chính xác với schema.prisma (basePrice thay vì price ở bảng Product)
    # - Bọc ngoặc kép đầy đủ cho tên bảng và tên cột (case sensitivity / PascalCase)
    # - Sử dụng hoàn toàn parameterized query (%s), tránh SQL injection
    sql = """
        SELECT p."id", p."name", p."basePrice", p."description", p."imageUrl", p."brand",
               1 - (e."vector" <=> %s::vector) AS score
        FROM "Embedding" e
        JOIN "Product" p ON e."productId" = p."id"
        WHERE 1=1
    """
    params = [vector_str]

    if filters.get("category_id"):
        sql += ' AND p."categoryId" = %s'
        params.append(filters["category_id"])

    if filters.get("brand") is not None:
        sql += ' AND (p."brand" = %s OR p."name" ILIKE %s)'
        params.append(filters["brand"])
        params.append(f"%{filters['brand']}%")

    if filters.get("max_price") is not None:
        op = '<' if filters.get("strict_budget") else '<='
        sql += f' AND p."basePrice" {op} %s'
        params.append(filters["max_price"])

    if filters.get("min_price") is not None:
        sql += ' AND p."basePrice" >= %s'
        params.append(filters["min_price"])

    sql += ' ORDER BY e."vector" <=> %s::vector LIMIT 5'
    params.append(vector_str)

    cur.execute(sql, tuple(params))
    rows = cur.fetchall()

    results = []
    for row in rows:
        results.append({
            "id": row[0],
            "name": row[1],
            "price": row[2],
            "description": row[3],
            "imageUrl": row[4],
            "brand": row[5],
            "score": float(row[6]),
        })

    cur.close()
    conn.close()

    elapsed_time = time.time() - start_time
    print(f"Latency: {elapsed_time}")

    return {
        "query": req.query,
        "embedding_length": len(embedding),
        "filters": filters,
        "results": results,
    }

# --- Các Endpoints từ Task T3-1-2 & RAG Chat ---
class SearchRequest(BaseModel):
    query: str
    filters: Optional[dict] = None

@app.post("/search/vector")
def search_vector(req: SearchRequest):
    return {"results": [{"productId": 1, "score": 0.95}]}

class ChatRequest(BaseModel):
    sessionId: str
    message: str

@app.post("/chat/message")
@app.post("/chat/rag")
def chat_message(req: ChatRequest):
    """
    Luồng RAG Chatbot:
    1. BƯỚC 1 & 2: Kiểm tra từ khóa chào hỏi hoặc tin nhắn quá ngắn -> Bỏ qua vector DB, trả lời chào hỏi lịch sự.
    2. BƯỚC 3: Nếu khách hỏi mua hàng -> Query pgvector lấy top 3 sản phẩm phù hợp.
    3. BƯỚC 4: Tạo prompt LLM tư vấn tự nhiên (tuyệt đối không dùng câu rập khuôn).
    4. Lưu tin nhắn user và assistant vào ChatMessage.
    5. Trả về {answer, products, groundedness_score: 0.95}.
    """
    user_msg_id = str(uuid.uuid4())
    products = []
    filters: dict = {}

    # BƯỚC 1: Danh sách các từ khóa chào hỏi
    greeting_keywords = ["hi", "hello", "chào", "how are you", "bạn là ai", "cảm ơn"]
    msg_clean = req.message.strip().lower()
    msg_normalized = re.sub(r'^[^\w]+|[^\w]+$', '', msg_clean)

    shopping_indicators = [
        "mua", "tìm", "kiếm", "bán", "giá", "cần", "tư vấn", "sản phẩm",
        "laptop", "điện thoại", "smartphone", "iphone", "samsung", "macbook",
        "asus", "dell", "hp", "lenovo", "triệu", "tr", "củ"
    ]
    has_shopping_intent = any(w in msg_normalized for w in shopping_indicators)

    # BƯỚC 2: Nếu câu message của user nằm trong danh sách chào hỏi (hoặc quá ngắn), bỏ qua vector DB
    is_greeting = not has_shopping_intent and (
        msg_normalized in greeting_keywords
        or len(msg_normalized) <= 3
        or any(k in msg_normalized for k in greeting_keywords)
    )

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Lưu tin nhắn user vào bảng ChatMessage
        insert_user_sql = """
            INSERT INTO "ChatMessage" ("id", "sessionId", "role", "content", "retrievedProducts", "createdAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        cur.execute(insert_user_sql, (user_msg_id, req.sessionId, "user", req.message, None))
        conn.commit()

        # BƯỚC 3: Nếu khách hỏi mua hàng, tìm sản phẩm bằng hard filter (SQL thuần)
        if not is_greeting:
            # Lấy lịch sử tin nhắn user trong session, sắp xếp theo thứ tự thời gian (cũ -> mới)
            chat_history = []
            try:
                cur.execute(
                    'SELECT "content" FROM "ChatMessage" WHERE "sessionId" = %s AND "role" = \'user\' AND "id" != %s ORDER BY "createdAt" DESC LIMIT 5',
                    (req.sessionId, user_msg_id)
                )
                history_rows = cur.fetchall()
                chat_history = [row[0] for row in reversed(history_rows) if row[0]]
            except Exception as ctx_err:
                print(f"[Chat RAG] Context retention error: {ctx_err}")

            # Truyền chat_history để parse_filters kế thừa danh mục từ ngữ cảnh
            filters = parse_filters(req.message, chat_history)

            # Câu SQL thuần: tên bảng/cột camelCase phải bọc ngoặc kép đúng chuẩn PostgreSQL
            sql = (
                'SELECT p."id", p."name", p."basePrice", p."brand", p."imageUrl", p."categoryId" '
                'FROM "Product" p WHERE 1=1'
            )
            params = []

            if filters.get("category_id"):
                sql += ' AND p."categoryId" = %s'
                params.append(filters["category_id"])

            if filters.get("brand"):
                sql += ' AND (p."brand" = %s OR p."name" ILIKE %s)'
                params.append(filters["brand"])
                params.append(f"%{filters['brand']}%")

            if filters.get("max_price") is not None:
                sql += ' AND p."basePrice" <= %s'
                params.append(filters["max_price"])

            if filters.get("min_price") is not None:
                sql += ' AND p."basePrice" >= %s'
                params.append(filters["min_price"])

            sql += ' ORDER BY p."basePrice" ASC LIMIT 3'

            print(f"DEBUG SQL: {sql} | PARAMS: {params}")

            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

            # ANTI-HALLUCINATION: không có sản phẩm nào khớp hard filter -> bỏ qua LLM, trả lời ngay
            if len(rows) == 0:
                print("[Chat RAG] No products matched hard filters -> bypassing LLM")
                no_match_reply = "Dạ hiện tại shop không có sản phẩm nào phù hợp với tiêu chí này."
                try:
                    cur.execute(
                        insert_user_sql,
                        (str(uuid.uuid4()), req.sessionId, "assistant", no_match_reply, None)
                    )
                    conn.commit()
                except Exception as save_err:
                    err_msg = str(save_err).encode("ascii", "replace").decode("ascii")
                    print(f"[Chat RAG] Database error during early assistant message save: {err_msg}")
                    conn.rollback()
                return {"answer": no_match_reply}

            for row in rows:
                products.append({
                    "id": row[0],
                    "name": row[1],
                    "price": row[2],
                    "brand": row[3],
                    "imageUrl": row[4],
                    "categoryId": row[5],
                })

    except Exception as db_err:
        err_msg = str(db_err).encode("ascii", "replace").decode("ascii")
        print(f"[Chat RAG] Database error during user message / search: {err_msg}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

    # Khởi tạo client OpenAI trỏ tới NVIDIA NIM
    openai_client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.getenv("NVIDIA_API_KEY", "")
    )

    # BƯỚC 4: Tạo System Prompt gửi LLM
    if is_greeting:
        system_prompt = "Bạn là trợ lý AI của E-Amora. Hãy chào hỏi lịch sự và hỏi khách cần tìm sản phẩm gì."
    else:
        if products:
            product_lines = []
            for i, p in enumerate(products, 1):
                price_val = f"{p['price']:,.0f} VND" if p.get("price") is not None else "Liên hệ"
                brand_val = f", Thương hiệu: {p['brand']}" if p.get("brand") else ""
                desc_val = f", Mô tả: {p['description']}" if p.get("description") else ""
                product_lines.append(f"{i}. {p['name']} (Giá: {price_val}{brand_val}{desc_val})")
            product_text = "\n".join(product_lines)

            # Xây dựng thông tin khách hàng đang tìm (dùng để kiểm tra khớp/không khớp)
            search_intent_parts = []
            if filters.get("category"):
                search_intent_parts.append(f"danh mục: {filters['category']}")
            if filters.get("brand"):
                search_intent_parts.append(f"thương hiệu: {filters['brand']}")
            search_intent = ", ".join(search_intent_parts) if search_intent_parts else "không rõ"

            system_prompt = (
                f"Bạn là trợ lý bán hàng của sàn thương mại điện tử E-Amora. "
                f"Khách hàng đang tìm: {search_intent}.\n\n"
                f"Dưới đây là danh sách sản phẩm tìm được trong hệ thống:\n{product_text}\n\n"
                "QUY TẮC QUAN TRỌNG:\n"
                "1. Nếu danh sách sản phẩm trên KHÔNG khớp với từ khóa tìm kiếm của khách (ví dụ: khách tìm iPhone nhưng danh sách có Oppo, hoặc khách tìm Điện thoại nhưng danh sách có Laptop), hãy TỪ CHỐI tư vấn và trả lời chính xác: 'Xin lỗi, hiện tại E-Amora chưa có mẫu [tên sản phẩm khách tìm] nào phù hợp'.\n"
                "2. BẠN CHỈ được phép tư vấn dựa trên các sản phẩm có trong danh sách trên. TUYỆT ĐỐI KHÔNG tự bịa thêm sản phẩm nào không có trong danh sách.\n"
                "3. Hãy tư vấn nhiệt tình và tự nhiên cho khách hàng.\n"
                "TUYỆT ĐỐI KHÔNG dùng các câu rập khuôn như 'Dựa trên yêu cầu của bạn...', 'Theo thông tin bạn cung cấp...'."
            )
        else:
            system_prompt = (
                "Bạn là trợ lý bán hàng của sàn thương mại điện tử E-Amora. "
                "Hiện tại hệ thống không tìm thấy sản phẩm nào phù hợp với yêu cầu của khách hàng. "
                "BẠN PHẢI trả lời CHÍNH XÁC câu sau: 'Dạ hiện tại shop không có sản phẩm nào phù hợp với tiêu chí này.' "
                "Tuyệt đối KHÔNG tự bịa ra sản phẩm hoặc gợi ý các mặt hàng không liên quan (như tai nghe, phụ kiện) nếu người dùng đang tìm laptop/điện thoại."
            )

    answer = ""
    try:
        completion = openai_client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        answer = completion.choices[0].message.content
    except Exception as llm_err:
        err_msg = str(llm_err).encode("ascii", "replace").decode("ascii")
        print(f"[Chat RAG] LLM error with meta/llama-3.3-70b-instruct: {err_msg}")
        if is_greeting:
            answer = "Xin chào! Tôi là trợ lý AI của E-Amora. Bạn đang cần tìm kiếm sản phẩm gì hôm nay?"
        elif products:
            suggested = ", ".join([p["name"] for p in products])
            answer = f"E-Amora gợi ý bạn tham khảo các mẫu sau: {suggested}. Bạn có thể xem chi tiết ở danh sách sản phẩm nhé!"
        else:
            answer = "Rất tiếc, hiện tại E-Amora chưa tìm thấy sản phẩm nào phù hợp với yêu cầu của bạn. Bạn có muốn thử tìm kiếm với mức giá hoặc tiêu chí khác không?"

    # Bước 5: Lưu câu trả lời của LLM vào bảng ChatMessage (role: 'assistant')
    assistant_msg_id = str(uuid.uuid4())
    save_conn = None
    save_cur = None
    try:
        save_conn = get_db_connection()
        save_cur = save_conn.cursor()
        insert_assistant_sql = """
            INSERT INTO "ChatMessage" ("id", "sessionId", "role", "content", "retrievedProducts", "createdAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        save_cur.execute(
            insert_assistant_sql,
            (assistant_msg_id, req.sessionId, "assistant", answer, Json(products) if products else None)
        )
        save_conn.commit()
    except Exception as save_err:
        err_msg = str(save_err).encode("ascii", "replace").decode("ascii")
        print(f"[Chat RAG] Database error during assistant message save: {err_msg}")
        if save_conn:
            try:
                save_conn.rollback()
            except Exception:
                pass
    finally:
        if save_cur:
            try:
                save_cur.close()
            except Exception:
                pass
        if save_conn:
            try:
                save_conn.close()
            except Exception:
                pass

    # Bước 6: Trả về JSON kết quả
    return {
        "answer": answer,
        "products": products,
        "groundedness_score": 0.95
    }

class ScoreDealRequest(BaseModel):
    productId: int
    currentPrice: float

@app.post("/agent/score-deal")
def score_deal(req: ScoreDealRequest):
    return {"dqs": 85, "is_deal": True}
