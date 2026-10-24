# Quy Trình Khẩn Cấp & Kế Hoạch Hoàn Tác Thanh Toán (Billing Rollback & Kill Switches)

**Tài liệu:** BILLING_ROLLBACK.md  
**Phiên bản:** 1.0.0  
**Vai trò:** Site Reliability Engineer & Subscription Platform Lead  
**Trạng thái:** Active Operational Runbook  

---

## 1. Công Tắc Ngắt Khẩn Cấp (Global Emergency Kill Switches)

Trong trường hợp phát hiện bất kỳ sự cố tính phí bất thường, rò rỉ khóa hoặc lỗi vòng lặp webhook, quản trị viên kích hoạt ngay công tắc ngắt toàn cục:

```env
# Render Environment Variables
BILLING_ENABLED=false
```

### Tác động tức thì khi chuyển `BILLING_ENABLED=false`:
1. Mọi endpoint tạo Checkout Session (`POST /api/payment/create-checkout-session`) lập tức bị khóa, trả về:
   ```json
   {
     "status": "disabled",
     "code": "BILLING_DISABLED_BY_ADMIN",
     "error": "Cổng thanh toán đang tạm dừng để bảo trì định kỳ. Quý khách vui lòng thử lại sau."
   }
   ```
2. Giao diện người dùng tự động chuyển các nút "Nâng cấp gói" sang trạng thái *"Sắp ra mắt / Coming Soon"*.
3. Các quyền hạn (Entitlements) hiện hữu của người dùng vẫn được duy trì bình thường dựa trên thời hạn `planExpiresAt`, không gây gián đoạn công việc của khách hàng.

---

## 2. Kịch Bản Xử Lý Sự Cố Khẩn Cấp (Emergency Playbooks)

### Kịch Bản 1: Phát Hiện Sự Kiện Webhook Bị Gửi Lặp (Webhook Replay Loop)
- **Triệu chứng:** Người dùng phản ánh bị trừ tiền nhiều lần hoặc nhận nhiều email hóa đơn.
- **Biện pháp xử lý:**
  1. Kiểm tra bảng `StripeEvent` trong database xem các `eventId` có bị trùng lặp không.
  2. Nếu phát hiện Stripe gửi lại liên tục: Endpoint webhook luôn trả về HTTP 200 `{ received: true, duplicate: true }` cho các event đã có trong bảng `StripeEvent` để Stripe đánh dấu đã hoàn thành và ngừng thử lại.
  3. Chạy script đối soát hoàn tiền tự động qua Stripe API cho các giao dịch trùng lặp:
     ```javascript
     await stripe.refunds.create({ charge: duplicateChargeId, reason: 'duplicate' });
     ```

### Kịch Bản 2: Lộ Khóa Bí Mật Webhook (Compromised Webhook Secret)
- **Triệu chứng:** Phát hiện các payload webhook không hợp lệ gửi tới hệ thống.
- **Biện pháp xử lý:**
  1. Truy cập Stripe Dashboard $\rightarrow$ Webhooks $\rightarrow$ Chọn Endpoint $\rightarrow$ Bấm **Rotate Secret**.
  2. Stripe cho phép thời gian chuyển tiếp (Grace Period) 24h hỗ trợ cả 2 secret cũ và mới.
  3. Cập nhật ngay biến `STRIPE_WEBHOOK_SECRET` trên Render Environment và trigger deploy lại.

### Kịch Bản 3: Cơ Sở Dữ Liệu Bị Mất Kết Nối Trong Lúc Webhook Đang Gửi
- **Triệu chứng:** AuthDB hoặc DataDB bị ngắt kết nối đúng thời điểm khách hàng vừa thanh toán thành công.
- **Biện pháp xử lý:**
  1. Middleware kiểm tra kết nối DB. Nếu không kết nối được, webhook trả về mã **HTTP 503 Service Unavailable**.
  2. Stripe có cơ chế lưu giữ hàng đợi và tự động gửi lại sự kiện (Automatic Retry) theo luật lũy thừa trong tối đa **72 giờ** (thử lại sau 5m, 15m, 30m, 1h, 2h, 4h,...).
  3. Khi cơ sở dữ liệu phục hồi, các sự kiện webhook đang chờ sẽ được xử lý tuần tự và kích hoạt tài khoản cho người dùng chính xác.

---

## 3. Checklist Hoàn Tác Bản Phát Hành (Release Rollback Checklist)

Nếu cần hoàn tác hoàn toàn mã nguồn hệ thống thanh toán:
- [ ] Chuyển `BILLING_ENABLED=false` trong cài đặt môi trường Render.
- [ ] Xóa cache Stripe customer ID nếu có lỗi gán nhầm tenant.
- [ ] Khôi phục commit Git ổn định trước đó:
  ```powershell
  git revert <commit_hash>
  git push origin main
  ```
- [ ] Kiểm tra lại toàn bộ quyền hạn người dùng bằng lệnh kiểm thử an toàn:
  ```powershell
  npm run test:all
  ```
