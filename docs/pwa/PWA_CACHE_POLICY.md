# FileTools Pro — Chính Sách Bộ Nhớ Đệm PWA & Trải Nghiệm Offline
**Phiên bản:** 1.0.0 (Bảo Mật Bộ Nhớ Đệm & Tuân Thủ Quyền Riêng Tư 2026)  
**Tác giả:** PWA Technical Engineer + Security Architect  
**Trạng thái:** Đã khắc phục lỗ hổng cache rộng & Đạt chuẩn kiểm thử

---

## 1. Khắc Phục Lỗ Hổng Lưu Cache API Rộng (Broad Regex Cache Remediation)

### 1.1. Hiện trạng rủi ro trước đây
Trước khi thực hiện đợt tối ưu này, tệp `client/vite.config.js` đã sử dụng cấu hình Workbox:
```javascript
// ❌ CẤU HÌNH NGUY HIỂM ĐÃ BỊ LOẠI BỎ:
{
  urlPattern: /^\/api\/.*/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    expiration: { maxEntries: 50, maxAgeSeconds: 300 },
  }
}
```
**Rủi ro bảo mật & quyền riêng tư nghiêm trọng:**
- Mọi cuộc gọi API—bao gồm `/api/auth/me` (thông tin người dùng), `/api/storage/*` (chữ ký tải file riêng tư), `/api/jobs/*` (dữ liệu công việc), và `/api/payment/*` (thông tin đăng ký)—đều có thể bị Service Worker lưu vào bộ nhớ cache trình duyệt (`api-cache`).
- Khi người dùng đăng xuất hoặc khi thiết bị dùng chung chuyển sang người khác, người tiếp theo khi ngắt mạng (offline) có thể xem lại dữ liệu cá nhân của người dùng trước qua cache của Service Worker!
- Đây là lỗi bảo mật vi phạm nghiêm trọng nguyên tắc **Zero Data Leakage at Rest**.

---

### 1.2. Giải pháp khắc phục triệt để (Strict Public GET Allowlist)
Đã cập nhật quy tắc trong `client/vite.config.js`:
```javascript
// ✅ CẤU HÌNH AN TOÀN ĐƯỢC CHỨNG THỰC:
workbox: {
  maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/outputs\//, /^\/collab/, /^\/socket\.io\//],
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    // Strict Allowlist: CHỈ lưu tạm các endpoint GET public phi định danh
    {
      urlPattern: /^\/api\/(payment\/(plans|status)|workflows\/templates|health)$/,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'public-api-cache-v2',
        expiration: { maxEntries: 20, maxAgeSeconds: 300 },
        networkTimeoutSeconds: 5,
        cacheableResponse: {
          statuses: [200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/cdnjs\.cloudflare\.com/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'cdn-cache' },
    },
  ],
}
```

### 1.3. Cơ chế xóa cache tức thì khi Đăng xuất (Logout Cache Eviction)
Trong [`client/src/context/AuthContext.jsx`](file:///C:/Users/Admin/test_app/filetools-app/client/src/context/AuthContext.jsx), hàm `logout` và `logoutAll` tự động kích hoạt tiến trình quét và xóa toàn bộ cache Service Worker liên quan tới API:
```javascript
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then(names => {
    for (const name of names) {
      if (name.includes('api') || name.includes('user')) {
        caches.delete(name);
      }
    }
  }).catch(() => {});
}
```
Điều này đảm bảo sau khi đăng xuất, bộ nhớ đệm hoàn toàn sạch sẽ, không còn dấu vết của phiên làm việc trước đó.

---

## 2. Danh Sách Đen Chặn Lưu Cache (Blacklist Endpoints)

Các endpoint dưới đây được **nghiêm cấm tuyệt đối** không lưu vào Service Worker Cache:

| Nhóm Endpoint | Đường Dẫn API | Lý Do Không Lưu Cache |
|:---|:---|:---|
| **Xác thực & Phiên làm việc** | `/api/auth/*` | Chứa JWT token, thông tin hồ sơ người dùng, cookie session. |
| **Hồ sơ cá nhân & Quyền** | `/api/user/*` | Chứa cấu hình tài khoản, email, gói cước hiện tại. |
| **Lưu trữ & Tệp tin** | `/api/storage/*` | Chứa chữ ký số (Signed URLs) và metadata tệp riêng tư. |
| **Công việc nền** | `/api/jobs/*` | Trạng thái tiến trình worker, thông điệp xử lý theo thời gian thực. |
| **Tải tệp & Xem trước** | `/api/files/*` | Tệp nhị phân riêng tư của người dùng. |
| **Thanh toán & Cổng Portal** | `/api/payment/create-checkout-session`, `/api/payment/portal`, `/api/payment/webhook` | Chứa URL phiên thanh toán Stripe và webhook bí mật. |

---

## 3. Chính Sách Trải Nghiệm Ngoại Tuyến Trung Thực (Honest Offline UX)

PWA của FileTools Pro **không bao giờ giả vờ rằng các tác vụ đám mây có thể chạy offline**. Người dùng được thông báo minh bạch về khả năng hoạt động ngoại tuyến:

### 3.1. Các tính năng hoạt động 100% Ngoại Tuyến (Offline Capable)
- **Soạn thảo mã nguồn Monaco Editor:** Lưu tệp cục bộ vào IndexedDB, chỉnh sửa syntax highlight đa ngôn ngữ không cần mạng.
- **Sắp xếp & Xem trước trang PDF:** Thư viện `pdfjs-dist` và `pdf-lib` kết xuất hình thu nhỏ trang trực tiếp trên bộ nhớ trình duyệt client.
- **Tạo mã QR Studio:** Thư viện mã hóa QR tạo mã SVG/PNG cục bộ ngay lập tức.
- **Duyệt xem tài liệu hướng dẫn & chính sách:** Toàn bộ trang `/guides`, `/security`, `/privacy` và vỏ ứng dụng SPA được precache sẵn sàng.

### 3.2. Các tính năng đòi hỏi Kết Nối Mạng (Cloud-Required Operations)
- **Chuyển đổi LibreOffice (Word $\rightarrow$ PDF, Excel $\rightarrow$ PDF):** Yêu cầu Worker container độc lập trên Render.
- **Speech-to-Text (Whisper AI):** Yêu cầu mô hình AI xử lý âm thanh phía máy chủ.
- **OCR Tesseract văn bản phức tạp:** Yêu cầu động cơ OCR server-side.
- **AI Trợ lý & Tóm tắt tài liệu:** Yêu cầu kết nối LLM (OpenAI, Gemini, Anthropic).

Khi mất kết nối mạng, giao diện người dùng hiển thị thông báo:
> *"Bạn đang ở chế độ Ngoại Tuyến. Công cụ này yêu cầu máy chủ đám mây để xử lý. Vui lòng kết nối lại Internet để tiếp tục."*

---

## 4. Tệp Cấu Hình PWA Web Manifest (`manifest.webmanifest`)

- **Tên ứng dụng:** FileTools Pro
- **Tên ngắn gọn:** FileTools
- **Màu chủ đạo (Theme Color):** `#08080C`
- **Màu nền (Background Color):** `#08080C`
- **Chế độ hiển thị:** `standalone` (Không có thanh điều hướng trình duyệt, tạo trải nghiệm như ứng dụng gốc)
- **Hệ thống biểu tượng (Icons):**
  - `icon-192.png`: 192x192 PNG
  - `icon-512.png`: 512x512 PNG
  - `icon-512-mask.png`: 512x512 PNG maskable (Chuẩn bo góc thích ứng trên Android & Windows 11)
- **Lối tắt nhanh (Shortcuts):**
  - Nén PDF (`/pdf/compress`)
  - Gộp PDF (`/pdf/merge`)
  - Chỉnh ảnh (`/image`)
  - Workflow Studio (`/workflows`)
