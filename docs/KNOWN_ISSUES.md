# Known Issues & Tech Debt

Danh sách các vấn đề kỹ thuật còn tồn tại (chưa fix) để theo dõi sau này.

## Diversity của Recommendation bị lệch brand
- Recommendation từ AI service bị lệch nặng về một số brand (ví dụ toàn Redmi) do dữ liệu kiểm thử tập trung.
- Cần cân bằng trọng số hoặc diversify kết quả khi triển khai production.

## Data sản phẩm bị trùng embedding
- File `convert_data.py` truncate tên sản phẩm xuống 8 chữ → nhiều sản phẩm khác có cùng tên cắt ngắn → embedding trùng nhau.
- Cần xem xét lại pipeline tạo embedding để tránh va chạm.

## Anonymous user không được log interaction
- Anonymous buyer (`mock-user-123`) không được ghi interaction (để tránh nhiễm dữ liệu training).
- Cần giải pháp session-based / device-based cho khách vãng lai trong giai đoạn sau.

## Chưa có E2E Test / CI/CD
- Hiện chỉ kiểm tra thủ công qua curl + browser.
- Chưa có bộ test E2E tự động và chưa có pipeline CI/CD.
