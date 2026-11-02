from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import time
import re
import os
import uuid
from datetime import datetime, timedelta
import psycopg2
import numpy as np
from psycopg2.extras import Json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI(title="Amora AI Service", version="1.0.0")

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

# Trọng số cho mỗi loại hành động khi tính vector người dùng (Stage 1 Personalized Feed)
INTERACTION_WEIGHTS = {
    "view": 1,
    "click": 2,
    "add_to_cart": 5,
    "purchase": 10,
}


def _vector_to_str(vec) -> str:
    """Chuyển vector numpy/sang chuỗi pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(str(float(x)) for x in vec) + "]"


def _parse_vector(v) -> np.ndarray:
    """pgvector voi psycopg2 tra ve vector chuoi '[x,y,...]'; phan tien thanh numpy array."""
    if isinstance(v, str):
        v = v.strip().strip("[]")
        if not v:
            return np.zeros(0, dtype=float)
        return np.array([float(x) for x in v.split(",")], dtype=float)
    return np.array(v, dtype=float)


def _explain_rule(brand, category_name, top_brand, top_category_name, price, avg_view_price):
    """Sinh explanation rule-based, KHÔNG gọi LLM."""
    if top_brand and brand and brand == top_brand:
        return f"Vì bạn quan tâm {top_brand}"
    if top_category_name and category_name and category_name == top_category_name:
        return f"Cùng danh mục {category_name}"
    if avg_view_price is not None and price is not None and price <= 1.2 * avg_view_price:
        return "Hợp ngân sách của bạn"
    return "Phù hợp với sở thích"


class InteractionItem(BaseModel):
    productId: str
    action: str


class RecommendRequest(BaseModel):
    userId: str
    interactions: List[InteractionItem]
    limit: int = 12


class RecommendProduct(BaseModel):
    id: str
    name: str
    basePrice: float | None
    imageUrl: str | None
    brand: str | None
    categoryName: str | None
    rating: float | None
    reviewCount: int | None
    originalPrice: float | None
    discountPercent: int | None
    stock: int | None
    explanation: str
    score: float


class RecommendResponse(BaseModel):
    products: List[RecommendProduct]
    count: int


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

    # Khởi tạo client OpenAI trỏ tới groq
    openai_client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.environ.get("GROQ_API_KEY")
    )

    # BƯỚC 4: Tạo System Prompt gửi LLM
    if is_greeting:
        system_prompt = (
            "Bạn là trợ lý AI tư vấn bán hàng của Amora. Amora là cửa hàng CHUYÊN BÁN ĐỒ CÔNG NGHỆ: Điện thoại, Laptop và Phụ kiện công nghệ. "
            "Tuyệt đối KHÔNG tư vấn, gợi ý hoặc nhắc đến các ngành hàng khác như: làm đẹp, sức khỏe, gia dụng, thời trang, thực phẩm... "
            "Khi chào hỏi, hãy giới thiệu bạn là trợ lý công nghệ của Amora và hỏi khách hàng đang tìm Điện thoại, Laptop hay Phụ kiện gì. "
        )
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
                "Bạn là trợ lý AI tư vấn bán hàng của Amora. Amora là cửa hàng CHUYÊN BÁN ĐỒ CÔNG NGHỆ: Điện thoại, Laptop và Phụ kiện công nghệ. "
                "Tuyệt đối KHÔNG tư vấn, gợi ý hoặc nhắc đến các ngành hàng khác như: làm đẹp, sức khỏe, gia dụng, thời trang, thực phẩm... "
                f"Khách hàng đang tìm: {search_intent}.\n\n"
                f"Dưới đây là danh sách sản phẩm tìm được trong hệ thống:\n{product_text}\n\n"
                "QUY TẮC QUAN TRỌNG:\n"
                "1. Khi trả lời câu hỏi về sản phẩm, CHỈ sử dụng thông tin trong phần Context trên. Không tự bịa ra sản phẩm.\n"
                "2. TUYỆT ĐỐI KHÔNG tự bịa thêm sản phẩm nào không có trong danh sách trên.\n"
                "3. Nếu không tìm thấy sản phẩm phù hợp, hãy trả lời: 'Dạ hiện tại shop không có sản phẩm nào phù hợp với tiêu chí này.'\n"
                "4. Hãy tư vấn nhiệt tình và tự nhiên cho khách hàng.\n"
                "TUYỆT ĐỐI KHÔNG dùng các câu rập khuôn như 'Dựa trên yêu cầu của bạn...', 'Theo thông tin bạn cung cấp...'."
            )
        else:
            system_prompt = (
                "Bạn là trợ lý AI tư vấn bán hàng của Amora. Amora là cửa hàng CHUYÊN BÁN ĐỒ CÔNG NGHỆ: Điện thoại, Laptop và Phụ kiện công nghệ. "
                "Tuyệt đối KHÔNG tư vấn, gợi ý hoặc nhắc đến các ngành hàng khác như: làm đẹp, sức khỏe, gia dụng, thời trang, thực phẩm... "
                "Hiện tại hệ thống không tìm thấy sản phẩm nào phù hợp với yêu cầu của khách hàng. "
                "BẠN PHẢI trả lời CHÍNH XÁC câu sau: 'Dạ hiện tại shop không có sản phẩm nào phù hợp với tiêu chí này.' "
                "Tuyệt đối KHÔNG tự bịa ra sản phẩm hoặc gợi ý các mặt hàng không liên quan."
            )

    answer = ""
    try:
        completion = openai_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
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
        print(f"[Chat RAG] LLM error with qwen/qwen3.8-27b: {err_msg}")
        answer = "Dạ hệ thống đang bận, bạn vui lòng thử lại sau ít phút."

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
    productId: str
    currentPrice: float


def _scale_linear(value: float, v_min: float, v_max: float, out_min: float, out_max: float) -> float:
    """Scale value tu [v_min, v_max] sang [out_min, out_max] tuyen tinh, clamp ngoai khoang."""
    if v_max == v_min:
        return out_max if value >= v_max else out_min
    if value <= v_min:
        return out_min
    if value >= v_max:
        return out_max
    return out_min + (value - v_min) / (v_max - v_min) * (out_max - out_min)


@app.post("/agent/score-deal")
def score_deal(req: ScoreDealRequest):
    """Tinh Deal Quality Score (DQS) 0-100 thong qua 3 thanh phan:
    - Discount Score (40 diem): % giam so voi originalPrice.
    - History Score (40 diem): vi tri cua currentPrice trong khoang [minPrice, maxPrice] 30 ngay qua.
    - Rating Score (20 diem): rating cua product.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Lay thong tin product: originalPrice, discountPercent, rating
        cur.execute(
            '''
            SELECT "originalPrice", "discountPercent", "rating"
            FROM "Product"
            WHERE "id" = %s
            ''',
            (req.productId,),
        )
        product_row = cur.fetchone()
        if product_row is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Product not found")

        original_price = float(product_row[0] or 0)
        discount_percent = float(product_row[1] or 0)
        rating = float(product_row[2] or 0)

        # --- Discount Score (40 diem) ---
        # Tinh % giam thuc su tu originalPrice (neu co) hoac discountPercent luu san
        if original_price > 0:
            actual_discount = max(0.0, (original_price - req.currentPrice) / original_price * 100.0)
        else:
            actual_discount = discount_percent

        # Discount >= 20% -> 40; Discount <= 5% -> 0; trung gian scale tuyen tinh
        discount_score = _scale_linear(actual_discount, 5.0, 20.0, 0.0, 40.0)

        # --- History Score (40 diem) ---
        # Query min/max PriceHistory cua product trong 30 ngay qua (qua Listing)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        cur.execute(
            '''
            SELECT MIN(ph."price"), MAX(ph."price")
            FROM "PriceHistory" ph
            JOIN "Listing" l ON l."id" = ph."listingId"
            WHERE l."productId" = %s
              AND ph."recordedAt" >= %s
            ''',
            (req.productId, thirty_days_ago),
        )
        hist_row = cur.fetchone()
        min_price = float(hist_row[0]) if hist_row and hist_row[0] is not None else None
        max_price = float(hist_row[1]) if hist_row and hist_row[1] is not None else None

        if min_price is not None and max_price is not None and max_price > min_price:
            # currentPrice <= minPrice*1.05 -> 40; currentPrice >= maxPrice -> 0; trung gian scale
            threshold_low = min_price * 1.05
            history_score = _scale_linear(req.currentPrice, threshold_low, max_price, 40.0, 0.0)
            history_score = max(0.0, min(40.0, history_score))
        else:
            # Khong co lich su gia -> trung binh 20 diem
            history_score = 20.0

        # --- Rating Score (20 diem) ---
        # Rating >= 4.5 -> 20; Rating <= 3.0 -> 0; trung gian scale tuyen tinh
        rating_score = _scale_linear(rating, 3.0, 4.5, 0.0, 20.0)

        dqs = round(discount_score + history_score + rating_score)
        dqs = max(0, min(100, int(dqs)))
        is_deal = dqs >= 70

        return {
            "dqs": dqs,
            "is_deal": is_deal,
            "breakdown": {
                "discount_score": round(discount_score),
                "history_score": round(history_score),
                "rating_score": round(rating_score),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Loi tinh DQS: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Khong the tinh DQS")
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


# --- Related Products Endpoint ---
class RelatedProduct(BaseModel):
    id: str
    name: str
    basePrice: float | None
    imageUrl: str | None
    images: list[str] | None
    brand: str | None
    categoryId: str | None
    categoryName: str | None
    rating: float | None
    reviewCount: int | None
    originalPrice: float | None
    discountPercent: int | None
    stock: int | None


@app.get("/products/{product_id}/related", response_model=List[RelatedProduct])
def get_related_products(product_id: str):
    """Lấy top 4 sản phẩm tương tự dựa trên cosine similarity của embedding."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Kiểm tra embedding của sản phẩm gốc tồn tại
        cur.execute(
            'SELECT "vector" FROM "Embedding" WHERE "productId" = %s',
            (product_id,),
        )
        row = cur.fetchone()
        if row is None:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Sản phẩm không có embedding")

        # Query top 4 sản phẩm gần nhất theo cosine distance, loại trừ chính nó
        sql = """
            SELECT p."id", p."name", p."basePrice", p."imageUrl", p."images",
                   p."brand", p."categoryId", c."name" AS "categoryName",
                   p."rating", p."reviewCount", p."originalPrice",
                   p."discountPercent", COALESCE(l.total_stock, 0) AS total_stock
            FROM "Product" p
            JOIN "Embedding" e ON p."id" = e."productId"
            JOIN "Category" c ON p."categoryId" = c."id"
            LEFT JOIN (
                SELECT "productId", COALESCE(SUM("stock"), 0) AS total_stock
                FROM "Listing" GROUP BY "productId"
            ) l ON l."productId" = p."id"
            WHERE p."id" <> %s
              AND p."name" <> (SELECT "name" FROM "Product" WHERE "id" = %s)
            ORDER BY e."vector" <=> (SELECT "vector" FROM "Embedding" WHERE "productId" = %s)
            LIMIT 4
        """
        cur.execute(sql, (product_id, product_id, product_id))
        rows = cur.fetchall()

        results = []
        for r in rows:
            results.append(
                RelatedProduct(
                    id=str(r[0]),
                    name=r[1],
                    basePrice=float(r[2]) if r[2] is not None else None,
                    imageUrl=r[3],
                    images=r[4] if isinstance(r[4], list) else None,
                    brand=r[5],
                    categoryId=str(r[6]) if r[6] is not None else None,
                    categoryName=r[7],
                    rating=float(r[8]) if r[8] is not None else None,
                    reviewCount=int(r[9]) if r[9] is not None else None,
                    originalPrice=float(r[10]) if r[10] is not None else None,
                    discountPercent=int(r[11]) if r[11] is not None else None,
                    stock=int(r[12]) if r[12] is not None else None,
                )
            )

        return results
    except HTTPException:
        raise
    except Exception as db_err:
        err_msg = str(db_err).encode("ascii", "replace").decode("ascii")
        print(f"[Related Products] Database error: {err_msg}")
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="Lỗi khi truy vấn sản phẩm tương tự")
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


# --- Personalized Feed (Stage 1) ---


@app.post("/recommendations", response_model=RecommendResponse)
def recommendations(req: RecommendRequest):
    """Gợi ý sản phẩm cá nhân hóa dựa trên weighted average embedding của các interaction."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if not req.interactions:
            return RecommendResponse(products=[], count=0)

        # 1. Lấy embedding của các sản phẩm đã tương tác
        interacted_ids = [it.productId for it in req.interactions]
        cur.execute(
            'SELECT "productId", "vector" FROM "Embedding" WHERE "productId" = ANY(%s)',
            (interacted_ids,),
        )
        embed_rows = cur.fetchall()
        embed_map = {r[0]: _parse_vector(r[1]) for r in embed_rows}

        # 2. Tính user vector = weighted average của các embedding sản phẩm
        vec_sum = None
        total_weight = 0.0
        weight_by_product: dict[str, float] = {}
        for it in req.interactions:
            vec = embed_map.get(it.productId)
            if vec is None:
                continue
            w = INTERACTION_WEIGHTS.get(it.action, 1)
            weight_by_product[it.productId] = weight_by_product.get(it.productId, 0.0) + w
            vec_sum = vec * w if vec_sum is None else vec_sum + vec * w
            total_weight += w

        if vec_sum is None or total_weight == 0:
            return RecommendResponse(products=[], count=0)

        user_vector = (vec_sum / total_weight).astype(float)
        user_vector_str = _vector_to_str(user_vector)

        # Sản phẩm user tương tác nhiều nhất (theo tổng trọng số)
        top_product_id = max(weight_by_product, key=weight_by_product.get)  # type: ignore[arg-type]

        # Brand của tất cả sản phẩm đã tương tác → aggregate weight theo brand.
        # (Tránh tie-break không ổn định khi nhiều product cùng weight cao nhất.)
        interacted_product_ids = list(weight_by_product.keys())
        cur.execute(
            'SELECT "id", "brand", "categoryId" FROM "Product" WHERE "id" = ANY(%s)',
            (interacted_product_ids,),
        )
        brand_of: dict[str, str | None] = {}
        category_of: dict[str, str | None] = {}
        for pid, brand, category_id in cur.fetchall():
            brand_of[pid] = brand
            category_of[pid] = category_id

        weight_by_brand: dict[str, float] = {}
        for pid, w in weight_by_product.items():
            b = brand_of.get(pid)
            if b:
                weight_by_brand[b] = weight_by_brand.get(b, 0.0) + w
        top_brand: str | None = max(weight_by_brand, key=weight_by_brand.get) if weight_by_brand else None

        # Category của top product (giữ nguyên logic cũ)
        top_category_id = category_of.get(top_product_id)

        top_category_name: str | None = None
        if top_category_id:
            cur.execute('SELECT "name" FROM "Category" WHERE "id" = %s', (top_category_id,))
            cat_row = cur.fetchone()
            top_category_name = cat_row[0] if cat_row else None

        # Giá trung bình các sản phẩm user đã view
        view_ids = [it.productId for it in req.interactions if it.action == "view"]
        avg_view_price: float | None = None
        if view_ids:
            cur.execute(
                'SELECT p."basePrice" FROM "Product" p WHERE p."id" = ANY(%s)',
                (view_ids,),
            )
            view_prices = [float(r[0]) for r in cur.fetchall() if r[0] is not None]
            if view_prices:
                avg_view_price = sum(view_prices) / len(view_prices)

        # 3. Query top limit sản phẩm cosine gần user vector nhất, loại trừ đã tương tác
        sql = """
            SELECT p."id", p."name", p."basePrice", p."imageUrl", p."brand", p."categoryId",
                   c."name" AS "categoryName",
                   p."rating", p."reviewCount", p."originalPrice", p."discountPercent",
                   COALESCE(l.total_stock, 0) AS total_stock,
                   1 - (e."vector" <=> %s::vector) AS score
            FROM "Product" p
            JOIN "Embedding" e ON p."id" = e."productId"
            JOIN "Category" c ON p."categoryId" = c."id"
            LEFT JOIN (
                SELECT "productId", COALESCE(SUM("stock"), 0) AS total_stock
                FROM "Listing" GROUP BY "productId"
            ) l ON l."productId" = p."id"
            WHERE p."id" <> ALL(%s)
            ORDER BY e."vector" <=> %s::vector
            LIMIT %s
        """
        cur.execute(sql, (user_vector_str, interacted_ids, user_vector_str, req.limit))
        rows = cur.fetchall()

        results = []
        for r in rows:
            price = float(r[2]) if r[2] is not None else None
            results.append(
                RecommendProduct(
                    id=str(r[0]),
                    name=r[1],
                    basePrice=price,
                    imageUrl=r[3],
                    brand=r[4],
                    categoryName=r[6],
                    rating=float(r[7]) if r[7] is not None else None,
                    reviewCount=int(r[8]) if r[8] is not None else None,
                    originalPrice=float(r[9]) if r[9] is not None else None,
                    discountPercent=int(r[10]) if r[10] is not None else None,
                    stock=int(r[11]) if r[11] is not None else None,
                    explanation=_explain_rule(
                        r[4],  # brand
                        r[6],  # categoryName
                        top_brand,
                        top_category_name,
                        price,
                        avg_view_price,
                    ),
                    score=float(r[12]),
                )
            )

        return RecommendResponse(products=results, count=len(results))
    except Exception as db_err:
        err_msg = str(db_err).encode("ascii", "replace").decode("ascii")
        print(f"[Recommendations] Database error: {err_msg}")
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="Lỗi khi gợi ý sản phẩm")
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
