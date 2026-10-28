# API CONTRACT (Node.js Backend)

## 1. Auth & User
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password) -> { token, user }
- The frontend auth provider persists the backend JWT in `localStorage` under `eamora.auth.token`, restores the user through `GET /api/auth/me`, and shares the bearer token across authenticated API calls. The browser-side token is accessible to JavaScript; production deployments should consider HttpOnly cookie-based storage with corresponding CSRF protections.

## 2. Core Marketplace
- `GET /api/products` (optional query: `q` searches product name/brand/category, `category`, `brand`, `minPrice`, `maxPrice`, `page`, `limit`; returns `filterOptions`, pagination, and in-stock seller `offers` for each product; invalid price ranges return 400)
- `GET /api/products/:id` (includes in-stock seller `offers`: `listingId`, `shopId`, `shopName`, `price`, and `stock`)
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
- `POST /api/agent/watch` (Buyer; body: `product_id`, positive numeric `target_price`; saves a price watch)
- `GET /api/agent/rules` (Buyer; returns the persisted `{ auto_buy }` setting)
- `PUT /api/agent/rules` (Buyer; body: `{ auto_buy: boolean }`; persists the setting only and does not execute purchases)
- `POST /api/agent/queue` (Buyer; body: `{ watch_id }`; requires Auto-buy enabled and an active watch owned by the buyer; creates one pending item per watch)
- `GET /api/agent/queue` (Buyer; optional `limit` 1–100, default 50; returns the buyer's queue in FIFO order)
- `POST /api/agent/queue/:id/execute` (Buyer; sandbox-only evaluation of the cheapest in-stock listing against the watch target; stores result and completes the queue item without creating an order or charging payment; repeated execution returns the saved result)
- `GET /api/agent/history` (Buyer; optional `limit` 1–100, default 50; returns the buyer's watchlist with recorded listing price history and their orders. Price points appear only when recorded in `PriceHistory`; this API does not create price snapshots or run auto-buy.)

Queue items are persisted and de-duplicated while pending. Executing a queue item only simulates the purchase decision and never creates orders or charges payments.