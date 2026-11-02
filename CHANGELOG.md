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

### Fixed
- Backend `GET /api/products` thiếu field `rating`, `reviewCount`, `originalPrice`, `discountPercent` → gây lỗi hiển thị 0 sao / không có badge giảm giá trên section "Khám phá sản phẩm"
- Xóa `generateStaticParams` dùng mock ID ở trang chi tiết sản phẩm
- Related products bị trùng lặp biến thể (do truncate tên)
- Personalized explanation bị toàn "Cùng danh mục" (do tie-break aggregation)

### Changed
- Section "Sản phẩm nổi bật" (Featured) sort theo `rating DESC` thay vì `price DESC` (sau khi backend trả đủ field rating)
