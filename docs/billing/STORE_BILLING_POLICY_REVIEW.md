# Đánh Giá Chính Sách Thanh Toán Đa Nền Tảng 2026 (Store Billing Policy Review)

**Tài liệu:** STORE_BILLING_POLICY_REVIEW.md  
**Phiên bản:** 1.0.0 (Cập nhật chuẩn chính sách App Store, Google Play, Microsoft Store 2026)  
**Vai trò:** Multi-Platform Compliance Lead & Subscription Architect  

---

## 1. Bối Cảnh & Ranh Giới Kỹ Thuật Đa Nền Tảng

FileTools Pro được thiết kế để phục vụ người dùng trên:
1. **Web / PWA (Trình duyệt máy tính & di động).**
2. **Windows Desktop App (Electron / MSIX).**
3. **Di động (Capacitor wrapper cho iOS & Android).**

Vì chính sách của các kho ứng dụng (App Store, Google Play) áp dụng các quy định nghiêm ngặt về phương thức thanh toán hàng hóa/dịch vụ kỹ thuật số (Digital Goods & Services), việc tích hợp trực tiếp Stripe Web Checkout vào ứng dụng di động sẽ dẫn tới nguy cơ **bị từ chối phát hành (App Rejection)** hoặc **gỡ bỏ khỏi cửa hàng**.

---

## 2. Ma Trận Chính Sách Kho Ứng Dụng Hiện Hành (Năm 2026)

| Nền Tảng Phát Hành | Cơ Chế Thanh Toán Bắt Buộc | Phí Hoa Hồng Kho (Commission) | Cho Phép Sử Dụng Cổng Riêng (Stripe)? | Quy Định Tiêu Thụ Chéo (Cross-Platform Consumption) |
|---|---|:---:|:---:|---|
| **Web & PWA** | Không ràng buộc (Tự do) | 2.9% + \$0.30 (Stripe) | **CÓ** | Hoàn toàn hợp lệ, là kênh phân phối chính không mất hoa hồng chợ. |
| **Apple App Store (iOS/iPadOS)** | Apple In-App Purchase (StoreKit 2) | 15% (Small Business) / 30% | **KHÔNG** (Trừ trường hợp tuân thủ DMA tại Liên minh Châu Âu) | **HỢP LỆ THEO NGUYÊN TẮC MULTI-PLATFORM:** Người dùng mua gói Pro trên Web được phép đăng nhập và sử dụng toàn bộ tính năng trên app iOS, miễn là không đặt nút link dẫn ra Web checkout để né tránh IAP. |
| **Google Play Store (Android)** | Google Play Billing System | 15% (cho \$1M đầu tiên/năm) | **KHÔNG** (Hỗ trợ User Choice Billing tại một số quốc gia) | Hợp lệ. Người dùng có thể đăng nhập tài khoản đã mua từ Web để sử dụng các tính năng nâng cao. |
| **Microsoft Store (Windows)** | Tự do chọn lựa (MS Commerce hoặc Cổng riêng) | 0% (với cổng riêng) / 12% | **CÓ** (Hoàn toàn được dùng Stripe trực tiếp trong ứng dụng desktop) | Không bị hạn chế. |

---

## 3. Kiến Trúc Lớp Trừu Tượng Hóa Đa Nhà Cung Cấp (Billing Provider Abstraction)

Hệ thống thiết kế giao diện đa nhà cung cấp chuẩn hóa:

```typescript
interface IBillingProvider {
  createSubscription(userId: string, plan: string, interval: string): Promise<PaymentSession>;
  verifyPurchase(receiptData: string): Promise<EntitlementResult>;
  handleWebhook(rawPayload: any, signature: string): Promise<WebhookResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
}
```

### Triển khai cụ thể:
1. `StripeWebProvider`: Xử lý thanh toán cho người dùng Web, PWA và Desktop Windows.
2. `AppleStoreKitProvider`: (Staged) Xử lý xác thực biên lai App Store qua App Store Server Notifications V2.
3. `GooglePlayBillingProvider`: (Staged) Xử lý xác thực Google Play Billing API qua Cloud Pub/Sub.

---

## 4. Giải Pháp Phòng Tránh Vi Phạm Chính Sách Chợ

1. **Nhận dạng môi trường chạy (Runtime Environment Detection):**
   - Nếu client chạy trên nền tảng Web hoặc Electron (Desktop): Hiển thị đầy đủ bảng giá Stripe Checkout.
   - Nếu client chạy bên trong ứng dụng đóng gói iOS / Android (Capacitor/Cordova):
     - **Ẩn hoàn toàn form thanh toán Stripe Web.**
     - Hiển thị thông báo: *"Bạn có thể kích hoạt gói Pro từ tài khoản Web hoặc đăng nhập tài khoản đã có sẵn."*
     - Không đặt liên kết ngoài (External Link) vi phạm Điều 3.1.1 của Apple App Store Guidelines.
2. **Không cấu hình mua hàng sản xuất (Production Purchases) tại thời điểm này:**
   - Cờ toàn cục `BILLING_ENABLED=false` giữ hệ thống ở chế độ mô phỏng an toàn.
   - Khi có quyết định mở rộng lên iOS/Android, tiến hành đăng ký mã IAP trên Apple Developer Program và Google Play Console độc lập.
