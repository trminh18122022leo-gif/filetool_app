# Kịch Bản Kiểm Thử Cổng Thanh Toán Stripe Sandbox (Stripe Sandbox Tests)

**Tài liệu:** STRIPE_SANDBOX_TESTS.md  
**Phiên bản:** 1.0.0  
**Môi trường:** Stripe Test Mode (Sandbox API keys `pk_test_...` / `sk_test_...`)  
**Nguyên tắc vận hành:** Mọi sự kiện Webhook đều được kiểm tra chữ ký mật mã học, đối soát trùng lặp thông qua mã sự kiện duy nhất (`StripeEvent`) và bảo đảm tính lũy thừa (Idempotency).

---

## 1. Cấu Hình Khóa & Chữ Ký Webhook

Hệ thống yêu cầu các biến môi trường sau cho chế độ thử nghiệm:
```env
BILLING_ENABLED=false              # Cờ an toàn bảo vệ, chỉ bật khi có lệnh phê duyệt
STRIPE_SECRET_KEY=sk_test_...      # Khóa bí mật Stripe Test Mode
STRIPE_WEBHOOK_SECRET=whsec_test_... # Khóa ký bí mật Webhook Endpoint
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
```

### Xử lý Raw Body bắt buộc:
Route webhook tại `server/index.js` được bọc bằng `express.raw({ type: 'application/json' })` trước các middleware `express.json()` thông thường nhằm giữ nguyên vẹn mảng byte gốc phục vụ việc xác thực HMAC SHA-256 (`stripe.webhooks.constructEvent`).

---

## 2. Ma Trận Kịch Bản Kiểm Thử Thanh Toán (QA Test Matrix)

| Mã Kịch Bản | Tên Kịch Bản Kiểm Thử | Dữ Liệu Thẻ Test | Sự Kiện Webhook Nhận Được | Kết Quả Mong Đợi (Expected Outcome) |
|---|---|---|---|---|
| **ST-01** | Đăng ký mới gói Plus thành công | `4242 4242 4242 4242`<br>(Thẻ hợp lệ) | `checkout.session.completed` | Tạo `stripeCustomerId`, gán `plan: 'plus'`, cập nhật `planExpiresAt` đúng 30 ngày. |
| **ST-02** | Đăng ký mới gói Pro thành công | `4242 4242 4242 4242` | `checkout.session.completed` | Gán `plan: 'pro'`, nâng dung lượng R2 lên 50GB, cấp 500 AI credits. |
| **ST-03** | Thanh toán thất bại (Thẻ hết tiền) | `4000 0000 0000 0002`<br>(Declined: Insufficient Funds) | `invoice.payment_failed` | Không nâng cấp gói, tài khoản giữ nguyên `free`, cảnh báo người dùng trên giao diện. |
| **ST-04** | Gia hạn định kỳ thành công | N/A (Gia hạn tự động) | `invoice.payment_succeeded` | Cộng thêm 30 ngày/365 ngày vào `planExpiresAt`, làm mới hạn mức AI credits tháng mới. |
| **ST-05** | Gia hạn định kỳ thất bại (Hết hạn thẻ) | `4000 0000 0000 0003`<br>(Expired Card) | `invoice.payment_failed` | Đặt trạng thái `GRACE_PERIOD` (3 ngày), gửi cảnh báo nhắc nhở cập nhật thẻ. |
| **ST-06** | Nâng cấp tức thì (Plus → Pro) | `4242 4242 4242 4242` | `customer.subscription.updated` | Nâng cấp ngay lập tức sang `pro`, Stripe tự động tính chênh lệch theo ngày (proration). |
| **ST-07** | Hạ cấp gói (Pro → Plus) | N/A (Qua Portal) | `customer.subscription.updated` | Duy trì quyền `pro` đến hết chu kỳ đã trả tiền, sau đó tự động chuyển sang `plus`. |
| **ST-08** | Hủy gia hạn gói (Cancellation) | N/A (Qua Portal) | `customer.subscription.deleted` | Gán `plan: 'free'`, dọn dẹp `stripeSubscriptionId`, hạ trần dung lượng R2. |
| **ST-09** | Hoàn tiền giao dịch (Refund) | N/A (Admin Refund) | `charge.refunded` | Ghi log kiểm toán `AuditLog`, thu hồi hạn mức dịch vụ đã cấp tương ứng. |
| **ST-10** | Tấn công gửi lặp Webhook (Replay Attack) | Replay cùng 1 `eventId` | `checkout.session.completed` (Lặp) | Nhận dạng `StripeEvent.eventId` đã xử lý; trả về HTTP 200 `{ received: true, replayed: true }` mà không cộng dồn hạn mức. |
| **ST-11** | Sự kiện Webhook đến sai thứ tự | `sub.deleted` đến trước `sub.updated` | Lỗi mạng mạng phân tán | So sánh dấu thời gian `event.created`; bỏ qua sự kiện cũ hơn trạng thái hiện hành. |
| **ST-12** | AuthDB tạm thời mất kết nối | N/A (Mô phỏng DB đứt) | Bất kỳ sự kiện Webhook | Webhook trả về HTTP 503 để Stripe giữ hàng đợi và thử lại (Retry Backoff), không fail-open. |

---

## 3. Cơ Chế Chống Gửi Lặp Sự Kiện (Stripe Event Idempotency)

Mỗi sự kiện Stripe được lưu vết tại bảng `StripeEvent`:
```javascript
const processed = await StripeEvent.findOne({ eventId: event.id });
if (processed) {
  logger.info(`[Stripe] Bỏ qua sự kiện trùng lặp: ${event.id}`);
  return res.status(200).json({ received: true, duplicate: true });
}

// Thực thi nghiệp vụ...
await StripeEvent.create({
  eventId: event.id,
  type: event.type,
  processedAt: new Date(),
});
```
Điều này loại trừ hoàn toàn rủi ro trừ tiền nhiều lần hoặc nhân bản thời hạn gói khi mạng gửi lại webhook.
