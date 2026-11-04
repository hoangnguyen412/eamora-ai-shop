# EVALUATION_PLAN — Kế hoạch đánh giá mô hình AI và tính năng

Tài liệu này ghi nhận phương pháp test, mock data và số liệu thực tế mới nhất trích xuất trực tiếp từ các file kết quả đánh giá tại `docs/eval/results/*.json`. Mọi con số trong docs này được lấy từ file JSON thực tế, không bịa số liệu.

<!-- Source: docs/eval/results/search_eval_results.json, recommendation_eval_results.json, rag_eval_results.json, price_agent_eval_results.json -->

---

## 1. Semantic Search (Tìm kiếm ngữ nghĩa)

### 1.1 Endpoint
- Endpoint: `GET /api/search/hybrid` (Backend), tham số truy vấn `mode` (`keyword` | `vector` | `hybrid`, mặc định `hybrid`).

### 1.2 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Hit Rate @10** | Tỷ lệ query có ít nhất 1 sản phẩm ground truth trong top-10 | ≥ 0.70 |
| **MRR** | Mean Reciprocal Rank của vị trí sản phẩm ground truth đầu tiên | ≥ 0.60 |
| **NDCG @10** | Normalized Discounted Cumulative Gain tại cắt ngang 10 | ≥ 0.60 |
| **Avg Latency (ms)** | Thời gian phản hồi trung bình của endpoint | < 2000 ms |
| **p95 Latency (ms)** | Thời gian phản hồi tại phần trăm thứ 95 | < 2000 ms |

### 1.3 Số liệu thực tế (từ `docs/eval/results/search_eval_results.json`)

| Chế độ | Total queries | Evaluated queries | Hit Rate @10 | MRR | NDCG @10 | Avg Latency (ms) | p95 Latency (ms) |
|--------|---------------|-------------------|--------------|-----|----------|------------------|------------------|
| Keyword | 8 | 7 | 0.4286 (42.86%) | 0.4286 | 0.4286 | 318.68 | 569.31 |
| Vector | 8 | 7 | 0.1429 (14.29%) | 0.0179 | 0.0451 | 217.96 | 286.58 |
| Hybrid (RRF) | 8 | 7 | 0.5714 (57.14%) | 0.2798 | 0.3687 | 424.46 | 464.07 |

**Bảng so sánh 3 chế độ cơ sở:**

| Chế độ | Cách hoạt động | Gọi AI service |
|--------|---------------|----------------|
| **Keyword-only** | Chỉ chạy CTE `keyword_search` (FTS + similarity), `fused_score` = điểm keyword. | Không |
| **Vector-only** | Chỉ chạy CTE `vector_search` (pgvector cosine distance). | Có (`POST /search/encode`) |
| **Hybrid (RRF)** | Chạy cả 2 CTE, hợp nhất bằng Reciprocal Rank Fusion (`10/(60+kw_rank) + 1/(60+vec_rank)`). | Có (`POST /search/encode`) |

### 1.4 Kỹ thuật bổ trợ: Exact Match Boosting (+1000)
- Công thêm **+1000** vào `fused_score` đối với sản phẩm tên chứa chuỗi truy vấn (exact name substring match), được giữ nguyên ở cả 3 chế độ.
- Đây là kỹ thuật hợp lệ trong Search Engine, giúp đẩy sản phẩm khớp chính xác lên đầu hàng, từ đó cải thiện MRR.

### 1.5 Cách đo
- **Nguồn data**: Bảng `Product`, `Embedding` (vector 768 chiều), `Category`.
- **Tập truy vấn test**: 8 truy vấn tiếng Việt chia làm 2 nhóm:
  - **Nhóm Exact Match (3 câu):** `iphone 11`, `iphone 13`, `macbook air`.
  - **Nhóm Semantic/Descriptive (5 câu):** `laptop mỏng nhẹ cho sinh viên`, `điện thoại chụp ảnh đêm đẹp`, `điện thoại pin trâu giá rẻ`, `laptop chơi game màn hình lớn`, `máy tính bảng đọc sách`.
- **Ground truth**: Gán nhãn thủ công bằng ID sản phẩm thật từ bảng `Product`. 1/8 truy vấn (`máy tính bảng đọc sách`) có `expected_ids` rỗng vì DB không có sản phẩm máy tính bảng/iPad → được bỏ qua trong eval. 7 truy vấn được đánh giá thực tế.
- **Script chạy ở**: `docs/eval/results/search_eval_results.json` lưu kết quả chi tiết per-query.

### 1.6 Hạn chế (Limitations)
- Kích thước mẫu nhỏ (8 truy vấn, trong đó 7 truy vấn có ground truth và được đánh giá).
- Độ trễ của mode `vector` và `hybrid` cao hơn do phải gọi AI service để encode vector truy vấn.
- Chất lượng embedding bị suy giảm do `convert_data.py` truncate tên xuống 8 ký tự (xem `docs/KNOWN_ISSUES.md`), dẫn đến `vector-only` chỉ cứu được một phần nhóm Semantic/Descriptive.

<!-- Source: docs/eval/results/search_eval_results.json; AI_features/main.py; backend/src/index.ts -->

---

## 2. Personalized Recommendation (Gợi ý cá nhân hóa)

### 2.1 Endpoint
- Endpoint: `GET /api/recommendations` (Backend), gọi `POST /recommendations` (AI Service).

### 2.2 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Category Diversity** | Tỷ lệ danh mục duy nhất trong top-K gợi ý / K | ≥ 0.60 |
| **Brand Novelty** | Tỷ lệ brand mới so với các brand đã tương tác | ≥ 0.30 |
| **Fallback rate** | Tỷ lệ request rơi về `source: "popular"` do `< 3` interaction hoặc AI lỗi | < 20% |

### 2.3 Số liệu thực tế (từ `docs/eval/results/recommendation_eval_results.json`)

| Chỉ số | Giá trị |
|--------|---------|
| Users evaluated | 1 |
| Personalized count | 1 |
| Average category diversity | 0.1 |
| Average brand novelty | 0.3 |
| Diversity target met | false |
| Categories in DB | Điện thoại: 1000 |
| Source | ai |
| Is personalized | true |
| Interactions created | 8 |
| Returned count | 10 |
| Distinct categories | 1 |
| Distinct brands | 3 |
| Category diversity | 0.1 |
| Brand novelty | 0.3 |

**Lý do Diversity thấp:** DB chỉ có 1 danh mục ('Điện thoại'), nên max diversity = 0.1 (target > 0.3 không thể đạt được với data hiện tại).

### 2.4 Cách đo
- **Nguồn data**: Bảng `Interaction` (action: view/click/add_to_cart/purchase), `Product`, `Embedding`.
- **Tập test**: Lấy user thật có ít nhất 3 interaction. Mỗi user gọi `GET /api/recommendations?limit=12`, ghi nhận `source` (ai/popular), danh sách `id`, `brand`, `explanation`, `score`.
- **Cách đo Diversity**: Nhóm `data[].brand` trong phản hồi, tính `distinct brand count / K`.
- **Cách đo CTR giả lập**: So sánh `data[].id` với `Interaction` action `click` của cùng user trong khoảng thời gian sau khi hiển thị.

<!-- Source: docs/eval/results/recommendation_eval_results.json; AI_features/main.py; backend/src/index.ts -->

---

## 3. RAG Chatbot (Tư vấn mua hàng)

### 3.1 Endpoint
- Endpoint: `POST /chat/rag` (AI Service, `AI_features/main.py`).

### 3.2 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Faithfulness** | Tỷ lệ câu trả lời chỉ sử dụng thông tin trong `products[]` được trả kèm, không bịa sản phẩm ngoài danh sách | ≥ 0.85 |
| **Answer Relevancy** | Tỷ lệ câu trả lời có liên quan đến intent mua hàng | ≥ 0.80 |
| **Overall** | Điểm trung bình tổng hợp | ≥ 4.0/5 |

### 3.3 Số liệu thực tế (từ `docs/eval/results/rag_eval_results.json`)

| Chỉ số | Giá trị |
|--------|---------|
| Judge model | qwen/qwen3.8-27b |
| Chat API | http://localhost:8000/chat/rag |
| Total questions | 5 |
| Average faithfulness | 4.6 / 5 |
| Average relevancy | 4.4 / 5 |
| Average overall | 4.5 / 5 |

**Bảng chi tiết từng câu hỏi:**

| ID | Câu hỏi | Faithfulness | Relevancy | Lý do |
|----|---------|--------------|-----------|-------|
| 1 | iPhone 13 pin có trâu không và chụp ảnh thế nào? | 5.0 | 5.0 | Context chỉ chứa thông tin về iPhone 14 Pro/Pro Max, không có iPhone 13. Bot từ chối trả lời do không có dữ liệu phù hợp, đây là hành vi trung thực và liên quan đúng ngữ cảnh (không bịa đặt thông số pin/chụp ảnh). |
| 2 | Laptop nào phù hợp cho sinh viên IT, mỏng nhẹ? | 3.0 | 4.0 | Bot chọn đúng sản phẩm có trong Context (Lenovo IdeaPad Slim 3) và giá chính xác. Tuy nhiên, Bot đã bịa ra thông tin 'thiết kế khá gọn gàng' và 'mỏng nhẹ' dù Context không cung cấp thông số kích thước/trọng lượng. |
| 3 | Redmi Note 12 Pro 5G có tốt không? | 5.0 | 4.0 | Bot trả lời trung thực dựa trên Context (không có Redmi Note 12 Pro 5G trong danh sách). Tuy nhiên, việc tự động đề xuất iPhone 14 Pro Max (giá ~2 triệu) như một lựa chọn thay thế cho Redmi Note 12 Pro 5G là không hợp lý về mặt phân khúc sản phẩm. |
| 4 | So sánh iPhone 13 và MacBook Air | 5.0 | 4.0 | Câu trả lời bám sát hoàn toàn Context: không bịa đặt thông số, xác nhận đúng việc không có iPhone 13 trong dữ liệu và liệt kê chính xác giá/mã sản phẩm MacBook Air M3 và MacBook Pro. |
| 5 | Cửa hàng có bán tai nghe bluetooth không? | 5.0 | 5.0 | Context chỉ chứa thông tin về điện thoại (Spark Go, iPhone 14 Pro Max), không có tai nghe. Bot trả lời trung thực là không có sản phẩm phù hợp, không bịa đặt thông tin và trả lời đúng trọng tâm câu hỏi. |

### 3.5 Phương pháp LLM-as-a-judge
- Sử dụng model `qwen/qwen3.8-27b` làm judge để đánh giá faithfulness và relevancy của từng câu trả lời chat.
- Mỗi câu hỏi được gán điểm từ 1–5 cho faithfulness và relevancy, kèm lý do chi tiết.

### 3.6 Lưu ý
- `groundedness_score` trong code hiện tại trả về hardcode `0.95` (`AI_features/main.py` dòng 633), cần thay bằng giá trị tính thật trong giai đoạn sau.

<!-- Source: docs/eval/results/rag_eval_results.json; AI_features/main.py -->

---

## 4. Price Agent (Deal Quality Score & Auto-buy)

### 4.1 Endpoint
- Endpoint: `POST /agent/score-deal` (AI Service), `POST /api/agent/queue/:id/execute` (Backend), Worker `runAutoBuyWorker`.

### 4.2 Chỉ số cần đo

| Chỉ số | Công thức / Mô tả | Mục tiêu đề xuất |
|--------|-------------------|------------------|
| **Accuracy** | Tỷ lệ kịch bản được kích hoạt/từ chối đúng như mong đợi | ≥ 80% |
| **DQS threshold** | Ngưỡng để xem là deal: `dqs >= 70` | 70 |
| **Avg Latency (ms)** | Thời gian phản hồi trung bình của `/agent/score-deal` | < 3000 ms |
| **p95 Latency (ms)** | Thời gian phản hồi tại phần trăm thứ 95 | < 3000 ms |

### 4.3 Số liệu thực tế (từ `docs/eval/results/price_agent_eval_results.json`)

| Trường | Giá trị |
|--------|---------|
| AI service URL | http://localhost:8000/agent/score-deal |
| Product id | 4 |
| Product name | Nord CE 5G |
| Scenarios executed | 3 |
| Correct activations | 3 |
| Accuracy percent | 100.0% |
| Avg latency (ms) | 2332.59 |
| p95 latency (ms) | 2382.44 |

**Giá trị gốc của sản phẩm:**
- `originalPrice`: 8.382.000
- `discountPercent`: 21
- `price`: 6.599.700
- `stock`: 35
- `rating`: 4.3

**Bảng chi tiết 3 kịch bản:**

| Case | Nhãn | Giá đặt | Stock | Discount | DQS | Breakdown (discount/history/rating) | is_deal | Kích hoạt | Đúng |
|------|------|---------|-------|----------|-----|-------------------------------------|---------|-----------|------|
| Case 1: Deal hời, còn hàng | KÍCH HOẠT | 6.705.600 | 10 | 20 | 80 | 40 / 20 / 20 | true | true | true |
| Case 2: Giá bình thường, còn hàng | KHÔNG kích hoạt | 8.382.000 | 10 | 0 | 40 | 0 / 20 / 20 | false | false | true |
| Case 3: Deal hời, HẾT HÀNG | KHÔNG kích hoạt | 6.705.600 | 0 | 20 | 80 | 40 / 20 / 20 | true | false | true |

### 4.4 Giải thích 3 kịch bản

**Kịch bản 1: Deal hời (80% giá gốc), còn hàng → KÍCH HOẠT**
- Giá đặt 6.705.600 VND (giảm 20% so với originalPrice 8.382.000).
- Discount score = 40 (giảm ≥ 20%), History score = 20, Rating score = 20 (rating 4.3).
- DQS = 80 ≥ 70 → `is_deal = true` → Kích hoạt auto-buy.

**Kịch bản 2: Giá bình thường (100% giá gốc), còn hàng → KHÔNG kích hoạt**
- Giá đặt 8.382.000 VND (không giảm giá).
- Discount score = 0 (giảm 0% ≤ 5%), History score = 20, Rating score = 20.
- DQS = 40 < 70 → `is_deal = false` → Từ chối do `dqs_too_low`.

**Kịch bản 3: Deal hời (80% giá gốc), HẾT HÀNG → KHÔNG kích hoạt**
- Giá đặt 6.705.600 VND, stock = 0.
- DQS = 80 ≥ 70 (deal tốt), nhưng không có listing có stock > 0.
- Từ chối do `no_available_listing` (backend kiểm tra stock trong `executeAutoBuySandboxJob`).

### 4.5 Công thức DQS (Deal Quality Score)

Tính trong `AI_features/main.py` dòng 652-735:

- **Discount Score (40 điểm)**: `% giảm so với originalPrice`. Discount ≥ 20% → 40; Discount ≤ 5% → 0; trung gian scale tuyến tính qua `_scale_linear(actual_discount, 5.0, 20.0, 0.0, 40.0)`.
- **History Score (40 điểm)**: Vị trí của `currentPrice` trong khoảng `[minPrice, maxPrice]` 30 ngày qua (qua `PriceHistory` JOIN `Listing`). `currentPrice ≤ minPrice * 1.05` → 40; `currentPrice ≥ maxPrice` → 0; trung gian scale. Không có lịch sử giá → trung bình 20 điểm.
- **Rating Score (20 điểm)**: Rating của product. Rating ≥ 4.5 → 20; Rating ≤ 3.0 → 0; trung gian scale tuyến tính qua `_scale_linear(rating, 3.0, 4.5, 0.0, 20.0)`.
- `dqs = round(discount_score + history_score + rating_score)`, clamp 0-100.
- `is_deal = dqs >= 70`.

<!-- Source: docs/eval/results/price_agent_eval_results.json; AI_features/main.py -->

---

## 5. Lên lịch thực hiện đánh giá

| Giai đoạn | Hoạt động | Nơi lưu kết quả |
|-----------|-----------|-----------------|
| Trước khi bảo lưu | Chạy script eval trên môi trường dev (localhost:3000/4000/8000) | `docs/eval/results/*.json` |
| Trong báo cáo | Bảng số liệu, biểu đồ precision/recall, diversity, groundedness | `docs/EVALUATION_PLAN.md` |
| Sau khi fix | Chạy lại để so sánh trước/sau | `docs/eval/results/*.json` |

---

## 6. Ràng buộc đánh giá

- Không sửa schema DB chỉ để phục vụ eval.
- Không dùng mock data nếu real API đã sẵn sàng.
- Tất cả script eval phải đóng kết nối DB trong `try/finally` (theo quy ước code hiện tại).
- CORS của AI Service đã cấu hình `allow_origins=["*"]` cho dev.

<!-- Source: docs/EVALUATION_PLAN.md (hiện có), AI_features/main.py -->