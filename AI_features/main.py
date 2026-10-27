from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import time
import re

app = FastAPI(title="E-Amora AI Service", version="1.0.0")

# Khởi tạo model (Lần đầu chạy sẽ tự tải model về, hơi lâu)
print("Loading model keepitreal/vietnamese-sbert...")
model = SentenceTransformer('keepitreal/vietnamese-sbert')
print("Model loaded successfully!")

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
class ParseRequest(BaseModel):
    query: str

@app.post("/search/parse")
def parse_query(req: ParseRequest):
    text = req.query.lower()

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
