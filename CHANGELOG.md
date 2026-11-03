# Changelog

All notable changes to the Amora project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## [Unreleased]

### Added
- Related Products (AI service `/products/:id/related`) trên trang chi tiết sản phẩm
- Interaction Logging: backend `POST /api/interactions` (actions `view | click | add_to_cart | purchase`), client logger `src/lib/logInteraction.ts` với Option A token gate
- Personalized Feed API: AI service `POST /recommendations` (weighted average embedding + cosine nearest + exclude interacted + rule-based explanation), backend `GET /api/recommendations` (requireAuth, timeout `AI_TIMEOUT_MS`, limit cap 50, popular fallback)
- Explainability Badge trên ProductCard (props `explanation`, sparkles icon, tooltip `title`, rút gọn nếu > 30 ký tự)
- Home page dùng API thật (`/api/products`, `/api/recommendations` với Bearer token), không còn mockData
- Gỡ bỏ `generateStaticParams` (không còn mock SSG) trên `products/[id]/page.tsx`
- **Price Agent Watchlist**: backend `POST /api/agent/watch`, `DELETE /api/agent/watch/:id`, `GET /api/agent/history`
- **Price Agent Rules**: backend `PUT /api/agent/rules`, `GET /api/agent/rules` (lưu `User.autoBuyEnabled`)
- **Price Agent Queue**: backend `POST /api/agent/queue`, `GET /api/agent/queue`, `POST /api/agent/queue/:id/execute` (sandbox auto-buy)
- **Price Agent UI**: trang `src/app/watchlist/page.tsx` với section Thông báo giá, Quy tắc mua tự động, Sản phẩm đang theo dõi, Hàng đợi tự động mua, Lịch sử đơn hàng
- **Price Agent Worker**: hàm `runAutoBuyWorker()` / `startAutoBuyWorker()` trong `backend/src/index.ts`, bật bằng `AUTO_BUY_WORKER_ENABLED=true`, interval `AUTO_BUY_WORKER_INTERVAL_MS`, batch `AUTO_BUY_WORKER_BATCH_SIZE`
- **DQS thật**: AI service `POST /agent/score-deal` tính Deal Quality Score 0–100 (discount 40 + history 40 + rating 20), thay thế hardcode `{"dqs": 85, "is_deal": true}`
- **Price History Seed**: script `AI_features/seed_price_history.py` tạo 30 ngày lịch sử giá cho 200 sản phẩm (6000 rows `PriceHistory`)
- `AI_URL`, `AUTO_BUY_WORKER_ENABLED`, `AUTO_BUY_WORKER_INTERVAL_MS`, `AUTO_BUY_WORKER_BATCH_SIZE` vào `backend/.env`
- `docs/ARCHITECTURE.md`, `docs/EVALUATION_PLAN.md` (mới tạo cho báo cáo)
- `.env.example` tại root, `backend/`, `AI_features/` (gitignored `.env*`, cho phép `.env.example`)
- Security warning block trong `README.md`, secrets thật bị thay bằng placeholder
- **Hybrid Search**: Backend `GET /api/search/hybrid` (RRF — Reciprocal Rank Fusion) kết hợp PostgreSQL FTS (`pg_trgm`, `unaccent` wrapper `immutable_unaccent`, GIN index) và pgvector HNSW. Hỗ trợ tìm kiếm sai chính tả (trigram similarity > 0.3) và không dấu. AI service `POST /search/encode` tạo vector 768-dim từ query.
- **Rate Limiting & Caching**: `express-rate-limit` (300 req/15 phút cho `/api`, 10 req/15 phút cho auth), `node-cache` (stdTTL 300s) cache `GET /api/products`, `GET /api/search/hybrid`.

### Fixed
- Backend `GET /api/products` thiếu field `rating`, `reviewCount`, `originalPrice`, `discountPercent` → gây lỗi hiển thị 0 sao / không có badge giảm giá trên section "Khám phá sản phẩm"
- Xóa `generateStaticParams` dùng mock ID ở trang chi tiết sản phẩm
- Related products bị trùng lặp biến thể (do truncate tên)
- Personalized explanation bị toàn "Cùng danh mục" (do tie-break aggregation)
- **Price Agent execute endpoint trước đây không tạo Order, không check DQS, không check budget** → đã bổ sung logic trong `executeAutoBuySandboxJob()`: gọi `getDealScore()` (AI service), kiểm tra `dqs >= 70`, kiểm tra `currentPrice <= targetPrice`, tạo `Order` status `sandbox` + `OrderItem` khi happy path
- **API_CONTRACT.md và AI_SERVICE_CONTRACT.md chưa có các endpoint Price Agent mới** → đã cập nhật đầy đủ JSON schema
- TypeScript `any` type bị bỏ trong các interface mới (`RecommendProductRow`, `RecommendProduct`, `AuthenticatedRequest`)

### Changed
- Section "Sản phẩm nổi bật" (Featured) sort theo `rating DESC` thay vì `price DESC` (sau khi backend trả đủ field rating)
- `AI_TIMEOUT_MS` mặc định 2000ms cho `/api/recommendations` timeout
- `AUTO_BUY_WORKER_INTERVAL_MS` mặc định 10000ms trong code, cấu hình 60000ms trong `backend/.env` cho dev
- `ScoreDealRequest.productId` đổi từ `int` → `str` để khớp UUID schema `Product.id`

### Security
- Thay secrets thật trong `README.md` bằng placeholder (DATABASE_URL, NVIDIA_API_KEY, GROQ_API_KEY)
- Tạo `.env.example` cho root, `backend/`, `AI_features/`; `.env*` nằm trong `.gitignore`
- `JWT_SECRET` không lưu trong `backend/.env`, fallback `'dev-secret-change-me'`

## [1.0.0] - 2026-11-02

### Added
- Initial release: Next.js frontend, Express backend, FastAPI AI service, PostgreSQL + pgvector
- Semantic search, RAG chatbot, personalized recommendations (Stage 1)
- Marketplace core: products, orders, reviews, search sessions/clicks
- Price Agent scaffold (watch, rules, queue stub)

---