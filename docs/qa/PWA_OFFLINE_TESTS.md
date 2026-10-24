# FileTools Pro — Kế Hoạch & Ma Trận Kiểm Thử PWA Ngoại Tuyến (Offline QA)
**Phiên bản:** 1.0.0 (Bộ Tiêu Chuẩn Kiểm Thử PWA & Độ Tin Cậy 2026)  
**Tác giả:** PWA QA Lead + Security Compliance Engineer  
**Trạng thái:** Sẵn sàng thực thi kiểm thử hồi quy

---

## 1. Mục Tiêu & Tiêu Chí Chấp Nhận (Acceptance Criteria)

Bộ kiểm thử này nhằm bảo đảm:
1. PWA cài đặt trơn tru, hiển thị độc lập (`display: standalone`) trên Windows 11, macOS, Android và iOS.
2. Service Worker đăng ký thành công, precache đầy đủ vỏ ứng dụng SPA (`index.html`, CSS, icons, font chữ).
3. **Tiêu chí an ninh tuyệt đối:** Không có bất kỳ dữ liệu nhạy cảm hay endpoint API cá nhân (`/api/auth/*`, `/api/storage/*`, `/api/jobs/*`) nào bị lưu vào bộ nhớ cache của Service Worker.
4. Khi người dùng đăng xuất, toàn bộ cache API trong trình duyệt được dọn dẹp sạch sẽ.
5. Khi mất kết nối mạng, các công cụ ngoại tuyến (Monaco, sắp xếp trang PDF, QR) hoạt động bình thường; các công cụ đám mây (LibreOffice, Whisper STT) hiển thị thông báo trung thực, không giả lập thành công ảo.

---

## 2. Ma Trận Kiểm Thử Thiết Bị & Trình Duyệt (Test Environment Matrix)

| Môi Trường / Nền Tảng | Trình Duyệt | Mục Tiêu Kiểm Thử |
|:---|:---|:---|
| **Windows 11 Desktop** | Google Chrome (Latest) | Cài đặt PWA, kiểm tra phím tắt Shortcut, Service Worker DevTools |
| **Windows 11 Desktop** | Microsoft Edge (Chromium) | Huy hiệu cài đặt App, kiểm tra ngắt mạng DevTools Offline mode |
| **macOS Sequoia** | Apple Safari 18+ | Web App on Mac, chia sẻ toàn màn hình, kiểm tra theme color |
| **Android 14 (Pixel / Samsung)** | Chrome for Android | Thêm vào màn hình chính (A2HS), icon thích ứng Maskable, thông báo Offline |
| **iOS 18 (iPhone 15 / 16)** | Mobile Safari | Add to Home Screen, kiểm tra thanh trạng thái `status-bar` |

---

## 3. Danh Sách Các Kịch Bản Kiểm Thử (Test Cases)

### Kịch bản 1: Kiểm thử Cài đặt PWA & Web App Manifest
- **Mục tiêu:** Xác nhận `manifest.webmanifest` hợp lệ 100% theo tiêu chuẩn W3C.
- **Thao tác:**
  1. Mở trang web trên Google Chrome Desktop.
  2. Quan sát thanh địa chỉ (Omnibox).
- **Kết quả mong đợi:**
  - Biểu tượng nút **Cài đặt FileTools Pro (Install app)** xuất hiện rõ ràng.
  - Sau khi cài đặt, ứng dụng mở trong cửa sổ độc lập không có thanh URL trình duyệt (`display: standalone`).
  - Màu nền thanh tiêu đề khớp với `theme_color: #08080C`.

---

### Kịch bản 2: Kiểm thử Loại Trừ Lưu Cache API Riêng Tư (Negative API Cache Test)
- **Mục tiêu:** Đảm bảo lỗ hổng broad regex cache đã được khắc phục hoàn toàn.
- **Thao tác:**
  1. Đăng nhập vào tài khoản trên FileTools Pro.
  2. Mở Chrome DevTools $\rightarrow$ Thẻ **Application** $\rightarrow$ **Cache Storage**.
  3. Quan sát các tệp tin được lưu trong `public-api-cache-v2` và `workbox-precache`.
- **Kết quả mong đợi:**
  - `public-api-cache-v2` CHỈ chứa các endpoint công khai: `/api/payment/plans`, `/api/payment/status`, `/api/workflows/templates`.
  - **TUYỆT ĐỐI KHÔNG CÓ:** `/api/auth/me`, `/api/user/profile`, `/api/storage/*`, `/api/jobs/*`.

---

### Kịch bản 3: Kiểm thử Dọn Dẹp Cache Khi Đăng Xuất (Logout Eviction Test)
- **Mục tiêu:** Xác minh toàn bộ cache API bị tiêu hủy ngay khi bấm Đăng xuất.
- **Thao tác:**
  1. Đăng nhập và tạo một số truy vấn.
  2. Mở DevTools $\rightarrow$ **Application** $\rightarrow$ **Cache Storage**.
  3. Bấm **Đăng xuất (Logout)** hoặc **Đăng xuất tất cả thiết bị (Logout All)**.
- **Kết quả mong đợi:**
  - Hàm `caches.delete` thực thi thành công.
  - Các kho cache `api-cache` và `public-api-cache-v2` bị xóa hoặc làm trống tức thì.
  - Thử ngắt mạng $\rightarrow$ Truy cập `/dashboard` $\rightarrow$ Trình duyệt điều hướng về `/login` thay vì hiển thị dữ liệu cũ.

---

### Kịch bản 4: Kiểm thử Trải Nghiệm Ngoại Tuyến Trung Thực (Honest Offline Experience)
- **Mục tiêu:** Đảm bảo không giả lập kết quả thành công cho các tác vụ cần worker đám mây.
- **Thao tác:**
  1. Mở Chrome DevTools $\rightarrow$ Thẻ **Network** $\rightarrow$ Chọn trạng thái **Offline**.
  2. Thử truy cập trang `/tools`, `/guides`, `/security`.
  3. Thử mở công cụ Monaco Code Editor (`/editor`).
  4. Thử tải file Word lên công cụ Chuyển đổi Word sang PDF (`/convert/word-to-pdf`) và bấm Chuyển đổi.
- **Kết quả mong đợi:**
  - Các trang `/tools`, `/guides`, `/security` hiển thị bình thường từ precache.
  - Trình soạn thảo Monaco Editor mở bình thường và cho phép soạn thảo mã nguồn cục bộ.
  - Công cụ Word sang PDF hiển thị thông báo lỗi mạng rõ ràng: *"Không thể kết nối máy chủ. Tính năng này yêu cầu kết nối mạng để render"* (Không có tình trạng treo vô tận hay giả lập file PDF trắng).

---

### Kịch bản 5: Kiểm thử Đóng Băng Animation & Không Preload Video
- **Mục tiêu:** Bảo vệ pin và tiết kiệm dung lượng mạng người dùng.
- **Thao tác:**
  1. Tải lại trang chủ khi bật DevTools thẻ **Network**.
  2. Lọc theo định dạng **Media** / **Img**.
  3. Chuyển sang tab khác trong trình duyệt (kích hoạt `document.hidden`).
- **Kết quả mong đợi:**
  - Tệp `blue-sky.mp4` (18.2 MB) **KHÔNG** tự động tải về khi người dùng chưa bật chế độ Light Solitude (`preload="none"` hoạt động).
  - Tệp ảnh poster `blue-sky-poster.webp` tải về siêu nhẹ (**65.5 kB**).
  - Vòng lặp vẽ cực quang Canvas trên `NorthernLightsBackground` dừng lại ngay khi tab bị ẩn, mức sử dụng CPU của tab giảm về xấp xỉ 0%.
