# API CONTRACT — Hệ thống Amora (Backend Express + FastAPI AI Service)

Tài liệu mô tả toàn bộ endpoint của Backend Express (cổng 4000) và AI Service FastAPI (cổng 8000). Trích xuất từ `backend/src/index.ts` và `AI_features/main.py`. Dùng cho viết Chương 3 (API Design) của báo cáo.

<!-- Source: backend/src/index.ts, AI_features/main.py -->

---

## 1. Cấu hình toàn cầu

### 1.1 Bảo mật & giới hạn (từ code)

- `JWT_SECRET`: bắt buộc trong production, ít nhất 32 bytes; development fallback `'dev-secret-change-me'`.
- `CORS_ORIGINS`: danh sách origins `http(s)://host[:port]`, cách nhau bởi dấu phẩy. Development cho phép tất cả khi chưa cấu hình.
- `TRUST_PROXY_HOPS`: mặc định `0`.
- JSON request body giới hạn 100 KB (`express.json({ limit: '100kb' })`).
- Rate limit: 300 request / 15 phút trên tất cả `/api`; 10 request / 15 phút cho register/login (`authRateLimiter`). Trả về 429.
- Auth: kiểm tra user hiện tại qua database trên mỗi request protected; fails closed (503) nếu database không sẵn sàng.
- Email tối đa 254 ký tự; mật khẩu 8–72 UTF-8 bytes.
- Pagination: `page` 1–1.000.000, `limit` 1–100.
- Price-history / agent queue / agent-history `limit`: chỉ nhận integer 1–100.
- `MOCK_BUYER_ID = 'mock-user-123'`: dùng cho anonymous interaction và order khi chưa đăng nhập.

### 1.2 Middleware bảo vệ

| Middleware | Dòng số | Mô tả |
|------------|---------|-------|
| `requireAuth` | 444 | Xác thực JWT HS256, tra cứu user trong DB, gán `req.user`. Trả về 401 nếu thiếu token / token hết hạn / user không tồn tại. |
| `optionalAuth` | 487 | Chỉ xác thực nếu có header `Authorization`; nếu không thì cho tiếp (dùng cho interaction, search session). |
| `requireRole([...])` | 494 | Kiểm tra `req.user.role` nằm trong danh sách roles được phép (`buyer`, `seller`). Trả về 403 nếu không khớp. |

<!-- Source: backend/src/index.ts dòng 444-506 -->

---

## 2. Auth & User (Backend)

### `POST /api/auth/register`
- Body: `{ email: string, password: string, role: 'buyer' | 'seller' }`
- Validation: email hợp lệ (tối đa 254 ký tự), password 8–72 bytes, role là `buyer` hoặc `seller`.
- Trả về `201`: `{ token: string, user: { id, email, role, createdAt } }`
- Lỗi: `400` (thiếu trường / email không hợp lệ / password sai độ dài / role không đúng), `409` (email đã tồn tại).

### `POST /api/auth/login`
- Body: `{ email: string, password: string }`
- Trả về `200`: `{ token: string, user: { id, email, role, createdAt } }`
- Lỗi: `401` (sai email/mật khẩu), `400` (email/password sai định dạng).

### `GET /api/auth/me` (requireAuth)
- Trả về `200`: `{ user: { id, email, role, createdAt } }`
- Lỗi: `401` (chưa xác thực / user không tồn tại), `503` (database không sẵn sàng).

<!-- Source: backend/src/index.ts dòng 557-666 -->

---

## 3. Core Marketplace (Backend)

### `GET /api/products`
- Query: `q` (tìm theo tên/thương hiệu/danh mục), `search` (ngôn ngữ tự nhiên Việt, ưu tiên hơn `q`), `category`, `brand`, `minPrice`, `maxPrice`, `page` (1–1.000.000), `limit` (1–100).
- Hỗ trợ tìm kiếm ngôn ngữ tự nhiên qua `parseNaturalLanguageSearch()` (bóc tách "dưới/trên X triệu", danh mục laptop/điện thoại, từ khoá còn lại).
- Trả về `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "brand": "string",
      "category": "string",
      "price": number,
      "originalPrice": number,
      "discountPercent": number,
      "stock": number,
      "rating": number,
      "reviewCount": number,
      "thumbnailUrl": "string",
      "images": ["string"],
      "isFeatured": boolean,
      "specs": {},
      "offers": [
        { "listingId": "string", "shopId": "string", "shopName": "string", "price": number, "stock": number }
      ]
    }
  ],
  "filterOptions": { "categories": ["string"], "brands": ["string"] },
  "pagination": { "currentPage": number, "totalPages": number, "totalItems": number, "limit": number }
}
```
- Lỗi: `400` (filter/pagination/price range không hợp lệ).

### `GET /api/products/:id`
- Trả về chi tiết sản phẩm kèm `offers` (danh sách listing có sẵn), `reviews` (chỉ trường `rating` để tính average rating).
- Trường trả về: `id`, `name`, `slug`, `brand`, `category`, `price`, `originalPrice`, `discountPercent`, `stock`, `rating`, `reviewCount`, `thumbnailUrl`, `images`, `specs`, `offers`.

### `GET /api/products/:id/price-history` (Public)
- Query: `limit` (1–100, mặc định 100).
- Lấy `PriceHistory` mới nhất của từng listing của sản phẩm, sắp xếp theo thời gian tăng dần.
- Trả về: `productId`, `currentPrice` (giá thấp nhất listing có stock > 0), `lowestPrice`, `highestPrice`, `priceTrend` (`stable`/`down`/`up`), `history: [{ id, listingId, shopName, price, date }]`, `recordedPoints`.

### `GET /api/products/:id/reviews` (Public)
- Trả về danh sách review (không có email người đánh giá).

### `POST /api/products/:id/reviews` (requireAuth, requireRole(['buyer']))
- Body: `{ rating: integer (1–5), comment?: string (tối đa 2000 ký tự) }`
- Trả về `201`: review đã tạo.

### `POST /api/orders` (Buyer)
- Body: `{ items: [{ listingId, quantity }], shipping_info: { fullName, phone, address, city }, payment_method?: 'cod' | 'vnpay' | 'credit_card' }`
- Validation: 1–50 line items, quantity là safe integer dương, shipping info đầy đủ và trong giới hạn độ dài (fullName 120, phone 32, address 500, city 120), tất cả listing phải thuộc cùng một shop.
- Tính `totalAmount` = tổng `price * quantity` + phí ship 30.000.
- Tạo `Order` với `buyerId = MOCK_BUYER_ID` (nếu anonymous) hoặc `req.user.id`, giảm stock từng listing.
- Trả về `201`: `{ success: true, data: order }`

### `GET /api/orders/me` (requireAuth, requireRole(['buyer']))
- Lịch sử đơn hàng của buyer, kèm `items`.

### `GET /api/orders/:id` (requireAuth)
- Buyer chỉ xem đơn của mình; seller xem đơn nếu sở hữu tất cả listing trong đơn.

### `PATCH /api/orders/:id/status` (requireAuth, requireRole(['seller']))
- Body: `{ status: string }`
- Các chuyển trạng thái cho phép: `pending → processing | cancelled`, `processing → shipped | cancelled`, `shipped → delivered`. Hủy đơn sẽ hoàn lại stock.

### `GET /api/orders` (không yêu cầu auth, lấy tất cả đơn)
- Trả về danh sách tất cả đơn hàng (dùng cho admin/xem tổng quan).

<!-- Source: backend/src/index.ts dòng 688-915 -->

---

## 4. Price Agent (tất cả requireAuth + requireRole(['buyer']))

### `POST /api/agent/watch`
- Body: `{ product_id: string, target_price: number (duyên > 0) }`
- Kiểm tra sản phẩm tồn tại.
- Tạo `Watchlist` (userId, productId, targetPrice, status='active').
- Trả về `201`: `{ success: true, data: watch }`

### `DELETE /api/agent/watch/:id`
- Xóa watchlist item nếu thuộc về user hiện tại.
- Trả về `200`: `{ success: true, message: 'Đã xoá sản phẩm khỏi danh sách theo dõi.' }`

### `GET /api/agent/rules`
- Trả về `200`: `{ success: true, data: { auto_buy: boolean } }`

### `PUT /api/agent/rules`
- Body: `{ auto_buy: boolean }`
- Cập nhật `User.autoBuyEnabled`.
- Trả về `200`: `{ success: true, data: { auto_buy: boolean } }`

### `POST /api/agent/queue`
- Body: `{ watch_id: string }`
- Yêu cầu `autoBuyEnabled = true` và watch đang `active` thuộc về user.
- Tạo `AutoBuyQueueItem` (status='pending'), de-duplicated nếu đã có item pending cho cùng watch.
- Trả về `201`: `{ success: true, data: queueItem }` hoặc `200` nếu deduplicated.

### `GET /api/agent/queue`
- Query: `limit` (1–100, mặc định 50).
- Trả về danh sách queue của buyer, sắp xếp FIFO (`createdAt asc`), kèm `watchlist` (targetPrice, product).
- Mỗi item có trường `result` (JSON) chứa `dqs`, `reason`, `evaluated_price`, `target_price`, `order_id`, `would_buy`, `sandbox`.

### `POST /api/agent/queue/:id/execute`
- Gọi `executeAutoBuySandboxJob(userId, queueItemId)` trong transaction Prisma:
  1. Kiểm tra queue item tồn tại, status `pending`, user `autoBuyEnabled = true`, watch `status = 'active'`.
  2. Đánh dấu `processing`.
  3. Lấy listing giá thấp nhất (stock > 0) → `currentPrice`.
  4. Gọi `getDealScore(productId, currentPrice)` → `POST http://localhost:8000/agent/score-deal` (timeout 3000ms).
  5. Nếu `dqs < 70` → `status='rejected'`, `result.reason='dqs_too_low'`.
  6. Nếu `currentPrice > targetPrice` → `status='rejected'`, `result.reason='over_budget'`.
  7. Nếu không có listing → `status='rejected'`, `result.reason='no_available_listing'`.
  8. Happy path: tạo `Order` (`status='sandbox'`, `paymentMethod='cod'`, `shippingInfo={autoBuy:true, watchlistId}`), tạo `OrderItem`, cập nhật queue item `status='completed'`, `result.order_id=order.id`.
- Trả về `200` kèm dữ liệu queue item đã xử lý. Lỗi `404` (không tìm thấy), `409` (không phải pending / auto-buy tắt / watch không active).

### `GET /api/agent/history`
- Query: `limit` (1–100, mặc định 50).
- Trả về `{ success: true, data: { watchlist: [...], orders: [...] } }`.
- Watchlist kèm `listings[].priceHistory` (giới hạn `limit` điểm, sắp xếp `recordedAt desc`).
- Orders kèm `items[]`.

### `DELETE /api/agent/cache` (buyer)
- Flush toàn bộ DQS cache (`dqsCache.flushAll()`).
- Trả về `200`: `{ success: true, message: 'DQS cache flushed' }`

<!-- Source: backend/src/index.ts dòng 1797-1988, 2201-2210, 2352-2408 -->

---

## 5. Search & Interaction (Backend)

### `POST /api/interactions` (optionalAuth)
- Body: `{ productId: string, action: 'view' | 'click' | 'add_to_cart' | 'purchase' }`
- Nếu không đăng nhập → dùng `MOCK_BUYER_ID` ('mock-user-123').
- Trả về `201`: `{ success: true, data: interaction }`

### `POST /api/search/sessions` (optionalAuth)
- Body: `{ queryText: string (tối đa 500 ký tự), filters?: JSON object }`
- Tạo `SearchSession`.

### `POST /api/search/sessions/:id/clicks` (optionalAuth)
- Body: `{ productId: string }`
- Tạo `SearchClick` cho session.

### `GET /api/search/hybrid` (Hybrid Search — Keyword + Vector)
- Query params:
  - `q` (string, bắt buộc): từ khóa tìm kiếm (hỗ trợ tiếng Việt, sai chính tả, không dấu).
  - `categoryId` (string, optional): lọc theo danh mục.
  - `brand` (string, optional): lọc theo thương hiệu (ILIKE).
  - `minPrice` (number, optional): lọc giá >=.
  - `maxPrice` (number, optional): lọc giá <=.
  - `limit` (number, default 12, max 100): số sản phẩm trả về.
  - `page` (number, default 1): trang phân trang.
- Mô tả: Tìm kiếm sản phẩm kết hợp từ khóa (Full-Text Search với `pg_trgm`/`unaccent`) và ngữ nghĩa (pgvector cosine similarity). Backend gọi AI Service `POST /search/encode` để sinh vector 768-dim từ query, sau đó chạy Raw SQL trên Postgres: lấy top 50 kết quả từ Keyword Search và top 50 từ Vector Search, gộp bằng thuật toán **RRF (Reciprocal Rank Fusion, k=60)** để xếp hạng cuối cùng.
- Trả về `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "brand": "string",
      "category": "string",
      "price": number,
      "originalPrice": number,
      "discountPercent": number,
      "stock": number,
      "rating": number,
      "reviewCount": number,
      "thumbnailUrl": "string",
      "images": ["string"],
      "isFeatured": boolean,
      "specs": {},
      "offers": [...],
      "fusedScore": "string"
    }
  ],
  "totalItems": number,
  "totalPages": number,
  "currentPage": number,
  "limit": number,
  "mode": "hybrid"
}
```
- Lỗi: `400` (query rỗng), `500` (lỗi truy vấn DB / AI service).
- Được cache bởi `node-cache` (stdTTL 300s) cho các request GET giống nhau.
- Giới hạn bởi `apiRateLimiter` (300 req/15 phút).

<!-- Source: backend/src/index.ts dòng 2410-2451, 2588-2642, 1205-1565 -->

---

## 6. Seller (Backend)

### `GET /api/seller/listings` (requireAuth, requireRole(['seller']))
- Danh sách listing của shop seller, kèm `totalSold` (đơn không cancelled) và `status` ('active' nếu stock > 0, ngược lại 'out_of_stock').

### `GET /api/seller/orders` (requireAuth, requireRole(['seller']))
- Đơn hàng chứa listing của seller, kèm tên sản phẩm và seller line-item subtotal.

### `GET /api/seller/stats` (requireAuth, requireRole(['seller']))
- Trả về: `listingCount`, `activeListingCount`, `orderCount`, `totalRevenue`, `unitsSold`, `ordersByStatus` (pending/processing/shipped/delivered/cancelled). Doanh thu và số lượng bán không tính đơn cancelled và phí ship.

<!-- Source: backend/src/index.ts dòng 917-1058 -->

---

## 7. AI Service Endpoints (FastAPI, port 8000)

### `GET /health`
- Trả về: `{ "status": "ok", "service": "AI Features" }`

### `POST /embed`
- Body: `{ texts: string[] }`
- Trả về: `{ embeddings: number[][] }` (vector 768-dim cho mỗi text qua Sentence-Transformers).

### `POST /search/encode`
- Body: `{ query: string }`
- Trả về: `{ vector: number[] }` (vector 768-dim cho query, dùng cho Hybrid Search RRF).

### `POST /search/parse`
- Body: `{ query: string }`
- Trả về filters: `{ category_id, min_price, max_price, brand, category, budget_min, budget_max, strict_budget }`.

### `POST /search/semantic`
- Body: `{ query: string }`
- Trả về: `{ query, embedding_length, filters, results: [{ id, name, price, description, imageUrl, brand, score }] }`.

### `POST /search/vector`
- Stub endpoint, trả về: `{ results: [{ productId: 1, score: 0.95 }] }`.

### `POST /chat/message` & `POST /chat/rag`
- Body: `{ sessionId: string, message: string }`
- Trả về: `{ answer: string, products: [...], groundedness_score: 0.95 }`.

### `POST /agent/score-deal`
- Body: `{ productId: string, currentPrice: float }`
- Trả về: `{ dqs: number, is_deal: boolean, breakdown: { discount_score, history_score, rating_score } }`.

### `GET /products/{product_id}/related`
- Trả về top 4 RelatedProduct (cosine similarity của embedding, loại trừ sản phẩm gốc).

### `POST /recommendations`
- Body: `{ userId: string, interactions: [{ productId, action }], limit: int }`
- Trả về: `{ products: [{ id, name, basePrice, imageUrl, brand, categoryName, rating, reviewCount, originalPrice, discountPercent, stock, explanation, score }], count: int }`.

<!-- Source: AI_features/main.py -->

---

## 8. Hệ thống & Worker

### `GET /health` (Backend)
- Kiểm tra kết nối database (`SELECT 1`).
- Trả về: `{ status: 'ok', db: 'connected' }` hoặc `{ status: 'error', db: 'disconnected' }`.

### Auto-buy Worker (`startAutoBuyWorker`, `runAutoBuyWorker`)
- Bật khi `AUTO_BUY_WORKER_ENABLED === 'true'`.
- Chạy `runAutoBuyWorker()` ngay khi khởi động, rồi mỗi `AUTO_BUY_WORKER_INTERVAL_MS` (mặc định 10000ms, tối thiểu 1000ms).
- Mỗi lần xử lý tối đa `AUTO_BUY_WORKER_BATCH_SIZE` (mặc định 10, tối đa 100) item `pending`, FIFO.
- Chỉ xử lý item có `watchlist.status='active'` và `user.autoBuyEnabled=true`.
- Gọi cùng hàm `executeAutoBuySandboxJob()` như endpoint execute.
- Log: `Auto-buy sandbox worker enabled (interval=..., batch=...)` và `Auto-buy sandbox worker completed N queue item(s).`.

### Swagger UI
- Tải từ `backend/openapi.yaml`, phục vụ tại `/docs`.

<!-- Source: backend/src/index.ts dòng 2339-2350, 545-546 -->