# API CONTRACT (Node.js Backend)

## 1. Auth & User
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password) -> { token, user }

## 2. Core Marketplace
- `GET /api/products` (optional query: `q` searches product name/brand/category, `category`, `brand`, `minPrice`, `maxPrice`, `page`, `limit`; returns `filterOptions` and pagination; invalid price ranges return 400)
- `GET /api/products/:id`
- `GET /api/products/:id/reviews` (Public; returns reviews without reviewer email)
- `POST /api/products/:id/reviews` (Buyer; body: integer `rating` from 1 to 5, optional `comment` up to 2000 characters)
- `POST /api/orders` (Buyer; body: `items: [{ listingId, quantity }]`, `shipping_info: { fullName, phone, address, city }`, optional `payment_method`; price and shipping fee are calculated by the server)
- `GET /api/orders/me` (Buyer; order history)
- `GET /api/orders/:id` (Buyer who placed the order or the seller who owns all its listings)
- `PATCH /api/orders/:id/status` (Seller who owns all order listings; status transitions: `pending -> processing -> shipped -> delivered`, or cancellation before shipping)
- `POST /api/interactions` (Buyer; body: `productId`, `action` in `view | click | cart | buy`)
- `POST /api/search/sessions` (Optional bearer auth; body: `queryText`, optional `filters` JSON object)
- `POST /api/search/sessions/:id/clicks` (Optional bearer auth; body: `productId`; authenticated sessions can only be updated by their owner)
- `GET /api/seller/listings` (Seller only; listing data includes `totalSold` excluding cancelled orders and `status` as `active` or `out_of_stock`)
- `GET /api/seller/orders` (Seller only; returns orders containing the seller's listings, with product names and seller line-item subtotal)
- `GET /api/seller/stats` (Seller only; returns `listingCount`, `activeListingCount`, `orderCount`, `totalRevenue`, `unitsSold`, and `ordersByStatus`; revenue and units sold exclude cancelled orders and shipping fees)

## 3. AI Features (Gọi sang FastAPI)
- `POST /api/search/semantic` -> { query, filters } 
  (Backend gọi AI lấy vector, query DB trả về kết quả)
- `POST /api/chat/message` -> { message, session_id } 
  (Backend gọi AI RAG, trả về text + products)
- `POST /api/agent/watch` -> { product_id, target_price }
- `PUT /api/agent/rules` -> { auto_buy: true/false }
- `GET /api/agent/history` -> Lịch sử giá & giao dịch tự động