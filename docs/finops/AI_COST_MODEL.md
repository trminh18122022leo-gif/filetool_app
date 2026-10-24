# Mô Hình Chi Phí & Quản Trị Tài Chính AI (FinOps & AI Cost Model)

**Tài liệu:** AI_COST_MODEL.md  
**Phiên bản:** 1.0.0  
**Vai trò:** Cost Optimization Lead & FinOps Architect  

---

## 1. Cơ Cấu Sổ Cái 4 Thành Phần (4-Tier Cost Ledger)

Nhằm đảm bảo tính minh bạch tài chính và kiểm soát ngân sách vận hành, mỗi yêu cầu AI trong FileTools Pro được ghi nhận với cấu trúc 4 chiều độc lập:

$$\text{Tổng Chi Phí} = \text{Chi Phí Mô Hình (Provider)} + \text{Chi Phí Hạ Tầng (Infra)} + \text{Hạn Mức Trừ (Credits)}$$

| Thành Phần | Định Nghĩa & Đơn Vị | Nguồn Tiêu Thụ | Cách Tính Toán |
|---|---|---|---|
| **`providerCostUSD`** | Chi phí trả trực tiếp cho nhà cung cấp mô hình AI (USD). | Token Input & Token Output của mô hình (Gemini, Groq, Cerebras). | $$\frac{\text{PromptTokens} \times \text{Rate}_{\text{in}} + \text{CompTokens} \times \text{Rate}_{\text{out}}}{1,000,000}$$ |
| **`infrastructureCostUSD`** | Chi phí máy chủ Render, CPU, RAM, băng thông và lưu trữ tệp (USD). | Sandbox đĩa đệm, phân tích cú pháp PDF, CPU trích xuất văn bản. | Cố định \$0.00015 mỗi request + \$0.00005 mỗi MB tài liệu tải lên. |
| **`includedCredit`** | Số điểm hạn mức tiêu thụ trừ vào gói dịch vụ người dùng. | Gói Free (15/ngày), Pro (200/ngày), Business (10,000/ngày). | Tóm tắt (1), Dịch (1), Chat/Hỏi đáp (1), Code Audit (2). |
| **`isBYOK`** | Cờ chỉ định người dùng tự mang khóa API cá nhân (Boolean). | Khóa API riêng của người dùng. | Khi `isBYOK = true`: `providerCostUSD = 0` (người dùng tự thanh toán với nhà cung cấp); hệ thống chỉ tính chi phí hạ tầng. |

---

## 2. Bảng Giá Mô Hình Hiện Hành (Model Pricing Benchmark)

| Nhà Cung Cấp & Mô Hình | Giá Input / 1M Tokens | Giá Output / 1M Tokens | Chi Phí Trung Bình 1 Tài Liệu 10 Trang (~4,000 tokens) |
|---|:---:|:---:|:---:|
| **Gemini 2.0 Flash / 1.5 Flash** | \$0.075 | \$0.300 | ~\$0.00045 (Rất thấp) |
| **Gemini 1.5 Pro** | \$1.250 | \$5.000 | ~\$0.00750 (Trung bình) |
| **Groq LPU (Llama 3.3 70B)** | \$0.590 | \$0.790 | ~\$0.00280 (Tốc độ cao) |
| **Cerebras LPU (70B)** | \$0.600 | \$0.600 | ~\$0.00240 (Cực nhanh) |
| **OpenRouter Free Tier** | \$0.000 | \$0.000 | \$0.00000 |
| **Mistral Small Latest** | \$0.200 | \$0.600 | ~\$0.00110 |

---

## 3. Trần Ngân Sách & Chốt Chặn Tránh Thất Thoát (Safety Budget Caps)

Nhằm ngăn chặn rủi ro vượt ngưỡng ngân sách (Runaway Billing) do vòng lặp vô hạn, tấn công DDoS hoặc tài liệu độc hại:

1. **Trần Ngân Sách Nền Tảng (Global Platform Hard Cap):**
   - Đặt mức trần \$50.00 USD/ngày cho toàn bộ hệ thống sử dụng khóa công cộng chung.
   - Khi tổng `providerCostUSD` trong ngày đạt 90% trần (\$45), hệ thống chuyển cảnh báo qua Slack/Telegram.
   - Khi đạt 100%, hệ thống tự động ngắt kết nối với các mô hình trả phí và chỉ cho phép chuyển sang **Cerebras Free / OpenRouter Free Tier** hoặc yêu cầu người dùng sử dụng **BYOK**.
2. **Trần Theo Người Dùng (Per-User Daily Quota):**
   - **Gói Free:** Tối đa 15 yêu cầu AI / ngày; tối đa 12,000 ký tự đầu vào / yêu cầu.
   - **Gói Pro:** Tối đa 200 yêu cầu AI / ngày; tối đa 100,000 ký tự đầu vào / yêu cầu.
   - **Gói Business:** Không giới hạn cứng, áp dụng giới hạn mềm tự điều tiết.
3. **Chống Tính Phí Trùng Lặp (Idempotency Replay Guard):**
   - Mọi yêu cầu sinh AI gửi kèm `Idempotency-Key` (Header).
   - Nếu client bị ngắt mạng và gửi lại cùng key trong 15 phút, hệ thống trả về kết quả đã lưu trong bộ nhớ đệm mà không gọi lại API nhà cung cấp và không trừ thêm phí.
