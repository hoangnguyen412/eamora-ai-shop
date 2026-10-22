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
- Background Task: `execute_auto_buy()` xử lý priority queue.