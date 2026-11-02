# Known Issues & Tech Debt

Danh sách các vấn đề kỹ thuật còn tồn tại (chưa fix) để theo dõi sau này.

## 1. Diversity của Recommendation bị lệch brand
- Recommendation từ AI service bị lệch nặng về một số brand (ví dụ toàn Redmi) do dữ liệu kiểm thử tập trung.
- Cần cân bằng trọng số hoặc diversify kết quả khi triển khai production.

## 2. Data sản phẩm bị trùng embedding
- File `convert_data.py` truncate tên sản phẩm xuống 8 chữ → nhiều sản phẩm khác có cùng tên cắt ngắn → embedding trùng nhau.
- Cần xem xét lại pipeline tạo embedding để tránh va chạm.

## 3. Anonymous user không được log interaction
- Anonymous buyer (`mock-user-123`) không được ghi interaction (để tránh nhiễm dữ liệu training).
- Cần giải pháp session-based / device-based cho khách vãng lai trong giai đoạn sau.

## 4. Chưa có E2E Test / CI/CD
- Hiện chỉ kiểm tra thủ công qua curl + browser.
- Chưa có bộ test E2E tự động và chưa có pipeline CI/CD.

## 5. Notification bell chưa có (Price Agent)
- Trang `src/app/watchlist/page.tsx` có card "Quy tắc mua tự động" với mô tả "Worker chỉ mô phỏng quyết định trong sandbox, không đặt đơn hoặc thanh toán."
- Chưa có UI chuông thông báo (notification bell), chưa có trạng thái read/unread, chưa có push delivery khi giá chạm mục tiêu.
- Được đánh giá là P2, để triển khai trong giai đoạn sau.

## 6. Auto-buy worker interval dài ở môi trường dev
- `AUTO_BUY_WORKER_INTERVAL_MS` mặc định trong code là 10000ms, nhưng `backend/.env` cấu hình 60000ms (1 phút) để tránh spam DB khi phát triển.
- Khi kiểm thử happy path / over_budget / dqs_too_low, tester phải đợi tới 1 phút cho worker tự chạy, hoặc gọi thủ công `POST /api/agent/queue/:id/execute`.
- Không có endpoint dev `/api/agent/worker/trigger` (đã xem xét nhưng chưa thêm do constraint "không thêm middleware mới").

## 7. DQS groundedness_score hardcode trong RAG
- Endpoint `POST /chat/rag` trả về `groundedness_score: 0.95` (hardcode, dòng 623 `AI_features/main.py`).
- Chưa có công cụ tính groundedness thật từ câu trả lời LLM so với `products[]` trả kèm.

## 8. Order history API không lọc theo status sandbox
- `GET /api/agent/history` trả về tất cả `Order` của buyer, bao gồm cả `status='sandbox'` từ Price Agent.
- Trang `src/app/watchlist/page.tsx` hiển thị đơn sandbox trong section "Lịch sử đơn hàng" với badge `sandbox`.
- Có thể gây nhầm lẫn cho người dùng giữa đơn thật và đơn mô phỏng.

## 9. Related products có thể trả ít hơn 4 nếu thiếu embedding
- Endpoint `GET /products/{product_id}/related` trả 404 nếu sản phẩm gốc không có embedding.
- Nếu có ít hơn 4 sản phẩm khác có embedding cùng danh mục, kết quả trả về ít hơn 4.

---