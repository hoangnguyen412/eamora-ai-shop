# EVALUATION_PLAN — Kế hoạch đánh giá mô hình AI và tính năng

Tài liệu này lập dàn ý các chỉ số đánh giá (metrics) cần có cho báo cáo đồ án, theo đúng thứ tự chương: Semantic Search, Personalized Recommendation, RAG Chatbot, Price Agent. **Chưa viết code eval**, chỉ viết plan và chỉ rõ nơi lấy data, script chạy ở đâu.

---

## 1. Semantic Search (Tìm kiếm ngữ nghĩa)

Endpoint: `POST /search/semantic` (AI Service, `AI_features/main.py`)

### 1.1 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Precision@K** | Số kết quảTop-K thực sự liên quan / K | ≥ 0.70 |
| **Recall@K** | Số kết quả Top-K liên quan / Tổng số sản phẩm liên quan trong DB | ≥ 0.60 |
| **Latency (p95)** | Thời gian phản hồi của endpoint (bao gồm encode embedding + truy vấn pgvector) | < 2000 ms |
| **Top-1 accuracy** | Tỷ lệ query có sản phẩm đúng danh mục đứng vị trí thứ 1 | ≥ 0.65 |

### 1.2 Cách đo

- **Nguồn data**: Bảng `Product` (3.684 sản phẩm), `Embedding` (vector 768 chiều), `Category`.
- **Tập truy vấn test**: Chuẩn tay 30–50 câu tiếng Việt mẫu (ví dụ: "laptop dưới 20 triệu", "điện thoại samsung giá rẻ", "iphone 13", "macbook m1"). Mỗi câu gán nhãn danh sách `product_id` dự kiến liên quan (ground truth) do người đánh giá chọn thủ công từ DB.
- **Script chạy ở**: File Python mới đặt tại `AI_features/eval_search.py` (chưa viết).
- **Cách chạy**: Script gọi `POST http://localhost:8000/search/semantic` với từng câu query, so sánh `results[].id` với ground truth, tính Precision@K (K=3,5,10) và Recall@K.
- **Lưu ý**: Dữ liệu embedding hiện có nguy cơ trùng nhau do `convert_data.py` truncate tên xuống 8 ký tự (xem `docs/KNOWN_ISSUES.md`), có thể làm giảm độ phân biệt vector → cần ghi nhận trong báo cáo.

---

## 2. Personalized Recommendation (Gợi ý cá nhân hóa)

Endpoint: `GET /api/recommendations` (Backend), gọi `POST /recommendations` (AI Service)

### 2.1 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **CTR giả lập** | (Số lần người dùng click vào sản phẩm gợi ý) / (Số lần hiển thị gợi ý) — mô phỏng từ log `Interaction` action `click` | ≥ 5% |
| **Diversity** | Tỷ lệ brand duy nhất trong top-K gợi ý / K (tránh lệch quá nặng một brand) | ≥ 0.60 |
| **Coverage** | Tỷ lệ sản phẩm trong catalog từng xuất hiện ít nhất 1 lần trong gợi ý | ≥ 30% |
| **Fallback rate** | Tỷ lệ request rơi về `source: "popular"` do `< 3` interaction hoặc AI lỗi | < 20% (sau khi user có đủ lịch sử) |

### 2.2 Cách đo

- **Nguồn data**: Bảng `Interaction` (action: view/click/add_to_cart/purchase), `Product`, `Embedding`.
- **Tập test**: Lấy 20–30 user thật có ít nhất 3 interaction. Mỗi user gọi `GET /api/recommendations?limit=12`, ghi nhận `source` (ai/popular), danh sách `id`, `brand`, `explanation`, `score`.
- **Script chạy ở**: File Python mới đặt tại `AI_features/eval_recommendations.py` (chưa viết) hoặc script Node.js tại `backend/scripts/eval-recommendations.js` (chưa viết).
- **Cách đo Diversity**: Nhóm `data[].brand` trong phản hồi, tính `distinct brand count / K`.
- **Cách đo CTR giả lập**: So sánh `data[].id` với `Interaction` action `click` của cùng user trong khoảng thời gian sau khi hiển thị (cần timestamp, hiện `Interaction.createdAt` có sẵn).

---

## 3. RAG Chatbot (Tư vấn mua hàng)

Endpoint: `POST /chat/rag` (AI Service, `AI_features/main.py`)

### 3.1 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Groundedness** | Tỷ lệ câu trả lời chỉ sử dụng thông tin trong `products[]` được trả kèm, không bịa sản phẩm ngoài danh sách | ≥ 0.85 |
| **Hallucination rate** | Tỷ lệ câu trả lời ghi ra tên sản phẩm không có trong `products[]` | < 15% |
| **Relevance** | Tỷ lệ câu trả lời có liên quan đến intent mua hàng (không Main-di-de về ngành hàng ngoài công nghệ) | ≥ 0.80 |
| **Latency (p95)** | Thời gian phản hồi end-to-end (DB query + Groq LLM) | < 5000 ms |

### 3.2 Cách đo

- **Nguồn data**: Bảng `Product`, `ChatMessage` (lưu `retrievedProducts` JSON), `SearchSession`.
- **Tập test**: Chuẩn tay 20–30 câu hỏi mua hàng tiếng Việt (ví dụ: "tôi muốn mua laptop dưới 20 triệu", "điện thoại samsung giá bao nhiêu", "iphone 14 có màu gì không"). Mỗi câu gán nhãn: expected category, expected brand (nếu có), expected price range.
- **Script chạy ở**: File Python mới đặt tại `AI_features/eval_rag.py` (chưa viết).
- **Cách đo Groundedness**: Script parse `answer` trả về, tìm các tên sản phẩm xuất hiện, kiểm tra xem tên đó có nằm trong `products[].name` của phản hồi cùng request không.
- **Lưu ý**: `groundedness_score` trong code hiện tại trả về hardcode `0.95` (xem `AI_features/main.py` dòng 623), cần thay bằng giá trị tính thật trong giai đoạn sau.

---

## 4. Price Agent (Deal Quality Score & Auto-buy)

Endpoint: `POST /agent/score-deal` (AI Service), `POST /api/agent/queue/:id/execute` (Backend), Worker `runAutoBuyWorker`

### 4.1 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Deal Detection Precision** | Số queue item có `dqs >= 70` và thực sự là "deal thơm" (giá hiện tại thấp nhất trong 30 ngày) / tổng số item `dqs >= 70` | ≥ 0.80 |
| **False Positive Rate** | Số item `dqs >= 70` nhưng `currentPrice > minPrice * 1.05` / tổng số item `dqs >= 70` | < 20% |
| **Auto-buy Success Rate** | Số queue item status `completed` với `order_id` / tổng số item được execute | ≥ 70% (cho các item thỏa mãn DQS và budget) |
| **Reject Rate by Reason** | Phân bổ reason: `dqs_too_low`, `over_budget`, `no_available_listing` | Giám sát phân phối |

### 4.2 Cách đo

- **Nguồn data**: Bảng `AutoBuyQueueItem` (cột `result` JSON chứa `dqs`, `reason`, `evaluated_price`, `target_price`, `order_id`), `PriceHistory`, `Product` (`originalPrice`, `rating`), `Order`.
- **Tập test**: Tất cả queue item trong DB sau khi chạy test thủ công (ví dụ: case happy path, over_budget, dqs_too_low).
- **Script chạy ở**: Script SQL trực tiếp trên Neon, hoặc Python tại `AI_features/eval_price_agent.py` (chưa viết).
- **Cách đo Deal Detection Precision**: Truy vấn `AutoBuyQueueItem.result->>'dqs'` và `result->>'reason'`. Với mỗi item `dqs >= 70` và `reason='target_price_met'`, kiểm tra `PriceHistory` của listing đó trong 30 ngày qua: `currentPrice <= MIN(price) * 1.05` xem có phải giá đáy không.
- **Cách đo Auto-buy Success Rate**: `COUNT(*) WHERE status='completed' AND result->>'order_id' IS NOT NULL` / `COUNT(*) WHERE status IN ('completed','rejected')`.

---

## 5. Lên lịch thực hiện đánh giá

| Giai đoạn | Hoạt động | Nơi lưu kết quả |
|-----------|-----------|-----------------|
| Trước khi bảo lưu | Chạy script eval trên môi trường dev (localhost:3000/4000/8000) | `AI_features/eval_*.py` (chưa tạo) |
| Trong báo cáo | Bảng số liệu, biểu đồ precision/recall, diversity, groundedness | `docs/EVALUATION_RESULTS.md` (chưa tạo) |
| Sau khi fix | Chạy lại để so sánh trước/sau | 同上 |

---

## 6. Ràng buộc

- Không sửa schema DB chỉ để phục vụ eval.
- Không dùng mock data nếu real API đã sẵn sàng.
- Tất cả script eval phải đóng kết nối DB trong `try/finally` (theo quy ước code hiện tại).
- CORS của AI Service đã cấu hình `allow_origins=["*"]` cho dev.

---

## 7. So sánh cơ sở Tìm kiếm (Keyword vs Vector vs Hybrid)

Endpoint: `GET /api/search/hybrid` (Backend), tham số truy vấn `mode` (`keyword` | `vector` | `hybrid`, mặc định `hybrid`).

### 7.1 Bộ dữ liệu (Dataset)

- 7 truy vấn tiếng Việt có Ground Truth được sinh bằng Full-Text Search (khớp chính xác cụm từ: `LIKE '%...%'` kèm `ORDER BY char_length("name") ASC LIMIT 3` để tránh trôi lên các biến thể Pro/Max).
- 4/7 truy vấn có `expected_ids` rỗng (`dien thoai samsung`, `laptop gaming`, `redmi note`, `iphone 15 pro max`) → được bỏ qua trong eval để không làm giảm điểm oan uổng.
- 3 truy vấn được đánh giá thực tế: `iphone 11`, `iphone 13`, `macbook air`.

### 7.2 Các phương pháp cơ sở (Baselines)

So sánh 3 chế độ của API:

| Chế độ | Cách hoạt động | Gọi AI service |
|--------|---------------|----------------|
| **Keyword-only** | Chỉ chạy CTE `keyword_search` (FTS + similarity), `fused_score` = điểm keyword. | Không (tiết kiệm thời gian) |
| **Vector-only** | Chỉ chạy CTE `vector_search` (pgvector cosine distance). | Có (`POST /search/encode`) |
| **Hybrid (RRF)** | Chạy cả 2 CTE, hợp nhất bằng Reciprocal Rank Fusion (`10/(60+kw_rank) + 1/(60+vec_rank)`). | Có (`POST /search/encode`) |

### 7.3 Chỉ số đánh giá

Hit Rate @10, MRR, NDCG @10, Avg Latency (ms). Kết quả bảng so sánh được in ra màn hình và lưu chi tiết tại `docs/eval/results/search_eval_results.json`.

### 7.4 Kỹ thuật bổ trợ: Exact Match Boosting (+1000)

- Công thêm **+1000** vào `fused_score` đối với sản phẩm tên chứa chuỗi truy vấn (exact name substring match), được giữ nguyên ở cả 3 chế độ.
- Đây là kỹ thuật hợp lệ trong Search Engine, được ghi nhận minh bạch trong báo cáo vì giúp đẩy sản phẩm khớp chính xác lên đầu hàng, từ đó cải thiện MRR.

### 7.5 Hạn chế (Limitations)

- Kích thước mẫu nhỏ (7 truy vấn, trong đó chỉ 3 truy vấn có ground truth), cần mở rộng tập truy vấn trong tương lai.
- Độ trễ của mode `vector` và `hybrid` có thể cao hơn do phải gọi AI service để encode vector truy vấn.

---