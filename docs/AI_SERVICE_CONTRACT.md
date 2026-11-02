# AI SERVICE CONTRACT (FastAPI — cổng 8000)

Tài liệu mô tả toàn bộ endpoint của AI Service FastAPI, trích xuất từ `AI_features/main.py`. Dùng cho viết Chương 3 (AI Service Design) của báo cáo.

---

## Cấu hình chung

- Model embedding: `keepitreal/vietnamese-sbert` (vector 768 chiều).
- Kết nối PostgreSQL (pgvector) qua `psycopg2`, hàm `get_db_connection()` (dòng 41).
- Tất cả truy vấn SQL dùng parameterized query `%s`, tên bảng/cột camelCase bọc ngoặc kép `""` (chuẩn PostgreSQL).
- Kết nối DB và LLM được bọc trong `try/except/finally`, đóng `cur` và `conn` trong `finally`.
- CORS: `allow_origins=["*"]` (dev).
- LLM: Groq API, model `qwen/qwen3.8-27b`, qua OpenAI client với `base_url="https://api.groq.com/openai/v1"` và `GROQ_API_KEY`.
- Trọng số tương tác (`INTERACTION_WEIGHTS`, dòng 94): `view=1`, `click=2`, `add_to_cart=5`, `purchase=10`.

---

## 1. Health Check

### `GET /health`
- Trả về: `{ "status": "ok", "service": "AI Features" }`

---

## 2. Embedding Service

### `POST /embed`
- Request (`EmbedRequest`): `{ "texts": List[str] }`
- Response: `{ "embeddings": List[List[float]] }` (mỗi vector 768 phần tử)
- Hàm helper: `_vector_to_str(vec)` chuyển numpy array sang chuỗi pgvector `[0.1,0.2,...]`; `_parse_vector(v)` ngược lại.

---

## 3. Constraint Parser (Hard filter từ văn bản tiếng Việt)

### `POST /search/parse`
- Request (`ParseRequest`): `{ "query": str }`
- Response: `{ "category_id", "min_price", "max_price", "brand", "category", "budget_min", "budget_max", "strict_budget" }`
- Hàm chính: `parse_filters(text, chat_history)` (dòng 180).
- Đơn vị tiền tệ hỗ trợ: `triệu`, `tr`, `củ` (= 1.000.000); `k`, `nghìn`, `ngàn` (= 1.000). Hàm `_parse_price_to_vnd(val_str, unit)`.
- Phát hiện khoảng giá: "từ X đến Y", "X - Y", "dưới X", "trên X", "khoảng X triệu".
- Phát hiện danh mục: `cat-laptop` (laptop/macbook/...), `cat-phone` (điện thoại/smartphone/iphone/...). Nhãn: `CATEGORY_LABELS`.
- Phát hiện thương hiệu: iphone→Apple, samsung→Samsung, oppo→Oppo.
- Context retention: nếu câu hiện tại không có danh mục, kế thừa từ tin nhắn gần nhất trong `chat_history` (duyệt ngược từ mới nhất).

---

## 4. Semantic Search

### `POST /search/semantic`
- Request (`SemanticSearchRequest`): `{ "query": str }`
- Response:
```json
{
  "query": "string",
  "embedding_length": 768,
  "filters": { ... },
  "results": [
    { "id": "string", "name": "string", "price": number, "description": "string", "imageUrl": "string", "brand": "string", "score": number }
  ],
  "latency": number
}
```
- Luồng: encode query → vector 768 → truy vấn pgvector `SELECT ... FROM "Embedding" e JOIN "Product" p ON e."productId" = p."id" WHERE ... ORDER BY e."vector" <=> %s::vector LIMIT 5`.
- Áp dụng hard filter: `categoryId`, `brand` (ILIKE), `basePrice` (< hoặc <= tuỳ `strict_budget`), `basePrice >= min_price`.

### `POST /search/vector` (stub)
- Request (`SearchRequest`): `{ "query": str, "filters?": dict }`
- Response stub: `{ "results": [ { "productId": 1, "score": 0.95 } ] }`

---

## 5. RAG Chatbot

### `POST /chat/rag` (cùng xử lý `POST /chat/message`)
- Request (`ChatRequest`): `{ "sessionId": str, "message": str }`
- Response: `{ "answer": str, "products": List[dict], "groundedness_score": float }`
- Luồng (dòng 362-624):
  1. Lưu tin nhắn user vào `ChatMessage` (role='user').
  2. Kiểm tra greeting (từ khóa chào hoặc độ dài ≤ 3) → `is_greeting`.
  3. Nếu không phải greeting: truy vấn `Product` với hard filter (category, brand, price), `LIMIT 3`.
  4. Nếu không có sản phẩm khớp → trả lời ngay: "Dạ hiện tại shop không có sản phẩm nào phù hợp với tiêu chí này." (bỏ qua LLM, anti-hallucination).
  5. Nếu có sản phẩm: xây dựng system prompt kèm danh sách sản phẩm + search intent, gọi Groq LLM (`qwen/qwen3.8-27b`, temperature 0.7, max_tokens 1024).
  6. Lưu câu trả lời LLM vào `ChatMessage` (role='assistant', `retrievedProducts` = Json(products)).
  7. Trả về `groundedness_score = 0.95` (hardcode, cần thay bằng giá trị tính thật trong giai đoạn sau).
- Lưu ý: system prompt cấm tư vấn ngành ngoài công nghệ (làm đẹp, sức khỏe, gia dụng, thời trang, thực phẩm), cấm câu rập khuôn.

---

## 6. Personalized Feed — Recommendations (Stage 1)

### `POST /recommendations`
- Request (`RecommendRequest`):
```json
{
  "userId": "string",
  "interactions": [
    { "productId": "string", "action": "view | click | add_to_cart | purchase" }
  ],
  "limit": 12
}
```
- Response (`RecommendResponse`):
```json
{
  "products": [
    {
      "id": "string",
      "name": "string",
      "basePrice": number | null,
      "imageUrl": "string | null",
      "brand": "string | null",
      "categoryName": "string | null",
      "rating": number | null,
      "reviewCount": int | null,
      "originalPrice": number | null,
      "discountPercent": int | null,
      "stock": int | null,
      "explanation": "string",
      "score": number
    }
  ],
  "count": int
}
```
- Luồng (dòng 848-981):
  1. Nếu `interactions` rỗng → trả về `products: [], count: 0`.
  2. Lấy embedding của các sản phẩm đã tương tác từ `Embedding`.
  3. Tính `user_vector = weighted average` theo `INTERACTION_WEIGHTS` (view=1, click=2, add_to_cart=5, purchase=10).
  4. Xác định `top_product_id` (tương tác nhiều nhất), `top_brand` (aggregate weight theo brand), `top_category_name`, `avg_view_price` (trung bình giá các sản phẩm đã view).
  5. Truy vấn `Product JOIN Embedding` cosine nearest, `WHERE p."id" <> ALL(interactedIds)`, `ORDER BY e."vector" <=> %s::vector`, `LIMIT limit`.
  6. Sinh `explanation` qua `_explain_rule(brand, categoryName, top_brand, top_category_name, price, avg_view_price)`:
     - Nếu brand khớp `top_brand`: `"Vì bạn quan tâm {brand}"`
     - Nếu category khớp `top_category_name`: `"Cùng danh mục {category}"`
     - Nếu giá ≤ 1.2 × `avg_view_price`: `"Hợp ngân sách của bạn"`
     - Mặc định: `"Phù hợp với sở thích"`
  7. Nếu không có embedding khớp hoặc vector_sum rỗng → `products: [], count: 0`.

### Hàm `_explain_rule(brand, category_name, top_brand, top_category_name, price, avg_view_price)` (dòng 117)
- Sinh explanation rule-based, KHÔNG gọi LLM.

---

## 7. Price Agent — Deal Quality Score (DQS)

### `POST /agent/score-deal`
- Request (`ScoreDealRequest`): `{ "productId": str, "currentPrice": float }`
- Response:
```json
{
  "dqs": int,                    // 0-100, đã làm tròn và clamp
  "is_deal": boolean,            // true nếu dqs >= 70
  "breakdown": {
    "discount_score": int,       // 0-40
    "history_score": int,        // 0-40
    "rating_score": int          // 0-20
  }
}
```
- Luồng tính toán (dòng 642-742):
  1. Lấy `Product.originalPrice`, `discountPercent`, `rating`.
  2. **Discount Score (40 điểm)**: `actual_discount = (originalPrice - currentPrice) / originalPrice × 100`. Nếu `originalPrice = 0` dùng `discountPercent` lưu sẵn. Scale tuyến tính: `discount >= 20%` → 40, `discount <= 5%` → 0, giữa scale tuyến tính (`_scale_linear(actual_discount, 5.0, 20.0, 0.0, 40.0)`).
  3. **History Score (40 điểm)**: Truy vấn `MIN(price)`, `MAX(price)` từ `PriceHistory JOIN Listing` WHERE `productId` và `recordedAt >= now() - 30 days`. Nếu có dữ liệu: `currentPrice <= minPrice × 1.05` → 40, `currentPrice >= maxPrice` → 0, giữa scale tuyến tính ngược. Nếu không có lịch sử giá → 20 (trung bình).
  4. **Rating Score (20 điểm)**: `rating >= 4.5` → 20, `rating <= 3.0` → 0, giữa scale tuyến tính (`_scale_linear(rating, 3.0, 4.5, 0.0, 20.0)`).
  5. `dqs = round(discount_score + history_score + rating_score)`, clamp 0–100. `is_deal = dqs >= 70`.
- Hàm helper: `_scale_linear(value, v_min, v_max, out_min, out_max)` (dòng 631).

---

## 8. Related Products

### `GET /products/{product_id}/related`
- Path param: `product_id` (string).
- Response: `List[RelatedProduct]` (top 4).
- `RelatedProduct`: `{ id, name, basePrice?, imageUrl?, images?, brand?, categoryId?, categoryName?, rating?, reviewCount?, originalPrice?, discountPercent?, stock? }`
- Luồng (dòng 762-842):
  1. Kiểm tra `Embedding` của sản phẩm gốc tồn tại (nếu không → 404 "Sản phẩm không có embedding").
  2. Truy vấn top 4 sản phẩm theo cosine distance: `ORDER BY e."vector" <=> (SELECT "vector" FROM "Embedding" WHERE "productId" = %s)`.
  3. Loại trừ chính sản phẩm gốc (`p."id" <> %s`) và loại trừ sản phẩm trùng tên (`p."name" <> (SELECT "name" FROM "Product" WHERE "id" = %s)`).
  4. Join `Category` để lấy `categoryName`; left join tổng `stock` từ `Listing`.

---

## 9. Xử lý lỗi chung

- Tất cả endpoint truy vấn DB bọc trong `try/except/finally`.
- Lỗi `HTTPException` được ném lại ngay (không bị swallow).
- Lỗi DB khác được log rồi ném `HTTPException(status_code=500, detail="...")`.
- Cursor và connection luôn được đóng trong `finally`.

---