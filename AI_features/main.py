from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import time
import re
import os
import uuid
import math
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
def parse_filters(text: str) -> dict:
    """Bóc tách hard filter (budget_max, brand, category) từ câu query."""
    text = text.lower()

    # Bóc tách giá tiền (triệu, tr, k, nghìn)
    budget_max = None
    price_match = re.search(r'(\d+)\s*(triệu|tr|củ)', text)
    if price_match:
        budget_max = int(price_match.group(1)) * 1_000_000
    else:
        price_match_k = re.search(r'(\d+)\s*(k|nghìn)', text)
        if price_match_k:
            budget_max = int(price_match_k.group(1)) * 1_000

    # Bóc tách brand
    brands = ["asus", "apple", "samsung", "dell", "sony", "xiaomi", "hp", "lenovo"]
    brand = None
    for b in brands:
        if b in text:
            brand = b.capitalize()
            break

    # Bóc tách category
    categories = ["laptop", "điện thoại", "tai nghe", "quần áo", "phụ kiện"]
    category = None
    for c in categories:
        if c in text:
            category = c
            break

    return {
        "budget_max": budget_max,
        "brand": brand,
        "category": category
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
        SELECT p."id", p."name", p."basePrice", p."description",
               1 - (e."vector" <=> %s::vector) AS score
        FROM "Embedding" e
        JOIN "Product" p ON e."productId" = p."id"
    """
    params = [vector_str]
    where_clauses = []

    if filters.get("budget_max") is not None:
        where_clauses.append('p."basePrice" <= %s')
        params.append(filters["budget_max"])
    if filters.get("brand") is not None:
        where_clauses.append('LOWER(p."name") LIKE LOWER(%s)')
        params.append(f'%{filters["brand"]}%')

    if filters.get("category") is not None:
        where_clauses.append('p."categoryId" IN (SELECT "id" FROM "Category" WHERE LOWER("name") = LOWER(%s))')
        params.append(filters["category"])

    if where_clauses:
        sql += " WHERE " + " AND ".join(where_clauses)

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
            "imageUrl": None,  # Bảng Product không có cột ảnh trong schema.prisma
            "description": row[3],
            "brand": None,     # Bảng Product không có cột brand riêng
            "score": float(row[4]),
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
    1. Lưu tin nhắn của user vào ChatMessage (role: 'user').
    2. Tạo embedding từ message, query pgvector lấy top 3 sản phẩm liên quan nhất.
    3. Khởi tạo client OpenAI trỏ tới NVIDIA NIM (meta/llama-3.3-70b-instruct).
    4. Gửi prompt cho LLM để tạo câu trả lời tư vấn bán hàng.
    5. Lưu câu trả lời của assistant vào ChatMessage (role: 'assistant').
    6. Trả về {answer, products, groundedness_score: 0.95}.
    """
    user_msg_id = str(uuid.uuid4())
    products = []

    # Bước 1 & Bước 2: Lưu tin nhắn user và query top 3 sản phẩm từ DB
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Bước 1: Lưu tin nhắn user vào bảng ChatMessage
        insert_user_sql = """
            INSERT INTO "ChatMessage" ("id", "sessionId", "role", "content", "retrievedProducts", "createdAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        cur.execute(insert_user_sql, (user_msg_id, req.sessionId, "user", req.message, None))
        conn.commit()

        # Bước 2: Tạo vector từ message và query pgvector top 3 sản phẩm
        embedding = model.encode(req.message)
        vector_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

        search_sql = """
            SELECT p."id", p."name", p."basePrice", p."description", p."imageUrl", p."brand",
                   1 - (e."vector" <=> %s::vector) AS score
            FROM "Embedding" e
            JOIN "Product" p ON e."productId" = p."id"
            ORDER BY e."vector" <=> %s::vector
            LIMIT 3
        """
        cur.execute(search_sql, (vector_str, vector_str))
        rows = cur.fetchall()

        for row in rows:
            raw_score = row[6]
            if raw_score is None or math.isnan(raw_score):
                score_val = 0.0
            else:
                score_val = float(raw_score)

            products.append({
                "id": row[0],
                "name": row[1],
                "price": row[2],
                "description": row[3],
                "imageUrl": row[4],
                "brand": row[5],
                "score": score_val,
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

    # Bước 3: Khởi tạo client OpenAI trỏ tới NVIDIA NIM
    openai_client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.getenv("NVIDIA_API_KEY", "")
    )

    # Bước 4: Tạo prompt gửi LLM
    if products:
        product_lines = []
        for i, p in enumerate(products, 1):
            price_val = f"{p['price']:,.0f} VND" if p.get("price") is not None else "Liên hệ"
            brand_val = f", Thương hiệu: {p['brand']}" if p.get("brand") else ""
            desc_val = f", Mô tả: {p['description']}" if p.get("description") else ""
            product_lines.append(f"{i}. {p['name']} (Giá: {price_val}{brand_val}{desc_val})")
        product_text = "\n".join(product_lines)
    else:
        product_text = "Hiện tại không có thông tin sản phẩm phù hợp trong hệ thống."

    prompt = f"Bạn là trợ lý bán hàng E-Amora. Dựa vào sản phẩm sau:\n{product_text}\n\nhãy trả lời câu hỏi: {req.message}"

    answer = ""
    try:
        completion = openai_client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        answer = completion.choices[0].message.content
    except Exception as llm_err:
        err_msg = str(llm_err).encode("ascii", "replace").decode("ascii")
        print(f"[Chat RAG] LLM error with meta/llama-3.3-70b-instruct: {err_msg}")
        if products:
            suggested = ", ".join([p["name"] for p in products])
            answer = f"Dựa trên yêu cầu của bạn, E-Amora gợi ý các sản phẩm phù hợp sau: {suggested}. Vui lòng tham khảo danh sách sản phẩm chi tiết bên dưới!"
        else:
            answer = "Chào bạn! Hiện tại E-Amora chưa tìm thấy sản phẩm phù hợp với yêu cầu của bạn. Bạn vui lòng thử lại với câu hỏi khác nhé!"

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
