from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import time
import re
import os
import psycopg2
from dotenv import load_dotenv

app = FastAPI(title="E-Amora AI Service", version="1.0.0")

# Khởi tạo model (Lần đầu chạy sẽ tự tải model về, hơi lâu)
print("Loading model keepitreal/vietnamese-sbert...")
model = SentenceTransformer('keepitreal/vietnamese-sbert')
print("Model loaded successfully!")

load_dotenv()

# Cấu hình kết nối PostgreSQL (pgvector)
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LỖI: DATABASE_URL không được tìm thấy trong biến môi trường. Vui lòng kiểm tra file .env")
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
        SELECT p."id", p."name", p."basePrice", p."imageUrl", p."description", p."brand",
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
            "imageUrl": row[3],
            "description": row[4],
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

# --- Các Mock Endpoints từ Task T3-1-2 (Giữ nguyên để M2 test) ---
class SearchRequest(BaseModel):
    query: str
    filters: Optional[dict] = None

@app.post("/search/vector")
def search_vector(req: SearchRequest):
    return {"results": [{"productId": 1, "score": 0.95}]}

class ChatRequest(BaseModel):
    sessionId: str
    message: str

@app.post("/chat/rag")
def chat_rag(req: ChatRequest):
    return {"answer": "Mock trả lời", "products": [1, 2], "groundedness": 0.98}

class ScoreDealRequest(BaseModel):
    productId: int
    currentPrice: float

@app.post("/agent/score-deal")
def score_deal(req: ScoreDealRequest):
    return {"dqs": 85, "is_deal": True}