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