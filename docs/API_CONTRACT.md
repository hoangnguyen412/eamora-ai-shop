# API CONTRACT (Node.js Backend)

## Security Configuration
- `JWT_SECRET` is required in production and must contain at least 32 bytes; development retains the local fallback.
- `CORS_ORIGINS` is a comma-separated allowlist of exact `http(s)://host[:port]` origins. It is unrestricted in development only when unset; production denies browser origins unless explicitly listed.
- `TRUST_PROXY_HOPS` defaults to `0`; configure it only to the exact number of trusted reverse-proxy hops so client IP headers cannot be spoofed.
- JSON request bodies are limited to 100 KB. Authentication checks the current user against the database on every protected request and fails closed if the database is unavailable.
- Internal exception details are logged by the backend and are not returned in HTTP 500 responses.
- Rate limits are per source IP and use an in-memory store: 300 requests per 15 minutes across `/api`, with a shared 10-request per 15-minute limit for register/login. Rejected requests return 429 with `Retry-After` and standard rate-limit headers. Multiple backend instances need a shared rate-limit store for cluster-wide enforcement.
- Auth requires a valid email address (maximum 254 characters); passwords must contain at least 8 characters and at most 72 UTF-8 bytes. Product pagination accepts `page` 1–1,000,000 and `limit` 1–100; malformed/repeated filters and out-of-range values return 400 instead of silently falling back.
- Orders accept 1–50 line items with positive safe-integer quantities; shipping fields have per-field length limits. Price-history, agent queue and agent-history limits accept only integers from 1–100 (defaults: 100, 50 and 50).

## 1. Auth & User
- `POST /api/auth/register` (body: email, password, role)
- `POST /api/auth/login` (body: email, password) -> { token, user }
- The frontend auth provider persists the backend JWT in `localStorage` under `eamora.auth.token`, restores the user through `GET /api/auth/me`, and shares the bearer token across authenticated API calls. The browser-side token is accessible to JavaScript; production deployments should consider HttpOnly cookie-based storage with corresponding CSRF protections.

## 2. Core Marketplace
- `GET /api/products` (optional query: `q` searches product name/brand/category, `category`, `brand`, `minPrice`, `maxPrice`, `page` 1–1,000,000, `limit` 1–100; returns `filterOptions`, pagination, and in-stock seller `offers` for each product; invalid/repeated filters, pagination or price ranges return 400)
- `GET /api/products/:id` (includes in-stock seller `offers`: `listingId`, `shopId`, `shopName`, `price`, and `stock`)
- `GET /api/products/:id/price-history` (Public; optional `limit` 1–100 per listing, default 100; returns the most recent recorded `PriceHistory` snapshots in chronological order plus current listing price and historical low/high/trend; does not create snapshots)
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

## 3. Price Agent
- Price Agent routes below are implemented by the Express backend. Semantic search and RAG chat are not exposed as Express endpoints yet.
- `POST /api/agent/watch` (Buyer; body: `product_id`, positive numeric `target_price`; saves a price watch)
- `GET /api/agent/rules` (Buyer; returns the persisted `{ auto_buy }` setting)
- `PUT /api/agent/rules` (Buyer; body: `{ auto_buy: boolean }`; persists the setting only and does not execute purchases)
- `POST /api/agent/queue` (Buyer; body: `{ watch_id }`; requires Auto-buy enabled and an active watch owned by the buyer; creates one pending item per watch)
- `GET /api/agent/queue` (Buyer; optional `limit` 1–100, default 50; returns the buyer's queue in FIFO order)
- `POST /api/agent/queue/:id/execute` (Buyer; sandbox-only evaluation of the cheapest in-stock listing against the watch target; stores result and completes the queue item without creating an order or charging payment; repeated execution returns the saved result)
- `GET /api/agent/history` (Buyer; optional `limit` 1–100, default 50; returns the buyer's watchlist with current listing prices, stock and recorded price history, plus their orders. Price points appear only when recorded in `PriceHistory`; this API does not create price snapshots or run auto-buy.)

Queue items are persisted and de-duplicated while pending. The optional backend worker (disabled unless `AUTO_BUY_WORKER_ENABLED=true`) processes eligible queue items in FIFO batches, only for buyers with Auto-buy enabled and active watches. Both the worker and execute endpoint only simulate the purchase decision and never create orders or charge payments.

The Watchlist UI derives non-persistent price alerts from current in-stock listing prices returned by `GET /api/agent/history`. Alerts are recalculated when the page loads and have no read/unread state or push delivery.