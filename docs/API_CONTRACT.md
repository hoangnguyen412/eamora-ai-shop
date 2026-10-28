# API CONTRACT (Node.js Backend)

## 1. Auth & User
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password) -> { token, user }

## 2. Core Marketplace
- `GET /api/products` (query: category, brand, page)
- `GET /api/products/:id`
- `GET /api/products/:id/reviews` (Public; returns reviews without reviewer email)
- `POST /api/products/:id/reviews` (Buyer; body: integer `rating` from 1 to 5, optional `comment` up to 2000 characters)
- `POST /api/orders` (Buyer; body: `items: [{ listingId, quantity }]`, `shipping_info: { fullName, phone, address, city }`, optional `payment_method`; price and shipping fee are calculated by the server)
- `GET /api/orders/me` (Buyer; order history)
- `GET /api/orders/:id` (Buyer who placed the order or the seller who owns all its listings)
- `PATCH /api/orders/:id/status` (Seller who owns all order listings; status transitions: `pending -> processing -> shipped -> delivered`, or cancellation before shipping)
- `POST /api/interactions` (Buyer; body: `productId`, `action` in `view | click | cart | buy`)
- `GET /api/seller/listings` (Seller only)

## 3. AI Features (Gọi sang FastAPI)
- `POST /api/search/semantic` -> { query, filters } 
  (Backend gọi AI lấy vector, query DB trả về kết quả)
- `POST /api/chat/message` -> { message, session_id } 
  (Backend gọi AI RAG, trả về text + products)
- `POST /api/agent/watch` -> { product_id, target_price }
- `PUT /api/agent/rules` -> { auto_buy: true/false }
- `GET /api/agent/history` -> Lịch sử giá & giao dịch tự động