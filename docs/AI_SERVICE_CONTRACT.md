# AI SERVICE CONTRACT (FastAPI)

## 1. Semantic Search
- `POST /embed` -> Input: text. Output: vector 768.
- `POST /search/vector` -> Input: query, top_k. Output: list[product_id, score]

## 2. RAG Assistant
- `POST /chat/rag` -> Input: query, history. 
  Output: { answer, retrieved_products, groundedness_score }

## 3. Price Agent
- `POST /agent/score-deal` -> Input: current_price, price_history.
  Output: { dqs_score, is_actionable }
- Background Task: `monitor_prices()` chạy mỗi 30 phút.
- Backend queue worker xử lý job sandbox theo FIFO khi được bật bằng `AUTO_BUY_WORKER_ENABLED=true` (mặc định tắt). Có thể cấu hình `AUTO_BUY_WORKER_INTERVAL_MS` (mặc định 10000, tối thiểu 1000) và `AUTO_BUY_WORKER_BATCH_SIZE` (mặc định 10, tối đa 100). Worker chỉ mô phỏng quyết định theo giá listing; không tạo đơn hàng hoặc thanh toán.

## 4. Related Products
- `GET /products/{product_id}/related` -> Input: `product_id` (path). Output: `List[RelatedProduct]` — top 4 sản phẩm gần nhất theo cosine similarity của embedding, loại trừ chính sản phẩm gốc và loại trừ các sản phẩm trùng tên.
  - `RelatedProduct`: `{ id, name, basePrice?, imageUrl?, images?, brand?, categoryId?, categoryName?, rating?, reviewCount?, originalPrice?, discountPercent?, stock? }`

## 5. Personalized Feed — Recommendations (Stage 1)
- `POST /recommendations` -> Input: `RecommendRequest`:
  ```json
  { "userId": "string", "interactions": [ { "productId": "string", "action": "view | click | add_to_cart | purchase" } ], "limit": 12 }
  ```
  Output: `RecommendResponse`:
  ```json
  { "products": [ { "id", "name", "basePrice?", "imageUrl?", "brand?", "categoryName?", "rating?", "reviewCount?", "originalPrice?", "discountPercent?", "stock?", "explanation": "string", "score": "float" } ], "count": "int" }
  ```
  - Weighted average embedding của các sản phẩm đã tương tác (trọng số: `view=1`, `click=2`, `add_to_cart=5`, `purchase=10`).
  - Cosine nearest, loại trừ các sản phẩm đã tương tác.
  - Explanation rule-based (KHÔNG gọi LLM): ưu tiên brand (`"Vì bạn quan tâm {brand}"`), sau đó category (`"Cùng danh mục {category}"`), sau đó giá (`"Hợp ngân sách của bạn"`), mặc định `"Phù hợp với sở thích"`.
  - Nếu `interactions` rỗng hoặc không có embedding nào khớp → trả về `products: [], count: 0`.