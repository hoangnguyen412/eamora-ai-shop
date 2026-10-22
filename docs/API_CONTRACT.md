# API CONTRACT (Node.js Backend)

## 1. Auth & User
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password) -> { token, user }

## 2. Core Marketplace
- `GET /api/products` (query: category, brand, page)
- `GET /api/products/:id`
- `POST /api/orders` (body: items, shipping_info)
- `GET /api/seller/listings` (Seller only)

## 3. AI Features (Gọi sang FastAPI)
- `POST /api/search/semantic` -> { query, filters } 
  (Backend gọi AI lấy vector, query DB trả về kết quả)
- `POST /api/chat/message` -> { message, session_id } 
  (Backend gọi AI RAG, trả về text + products)
- `POST /api/agent/watch` -> { product_id, target_price }
- `PUT /api/agent/rules` -> { auto_buy: true/false }
- `GET /api/agent/history` -> Lịch sử giá & giao dịch tự động