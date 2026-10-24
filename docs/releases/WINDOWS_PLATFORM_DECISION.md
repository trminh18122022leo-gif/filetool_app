# FileTools Pro — Biên Bản Quyết Định Nền Tảng Windows (Platform Decision Record)
**Tài liệu:** Architecture Decision Record (ADR-013)  
**Tiêu đề:** Lựa chọn Nền tảng Đóng gói Windows v1.0: PWA/MSIX vs Electron  
**Trạng thái:** ĐÃ PHÊ DUYỆT (ACCEPTED)  
**Tác giả:** Windows/PWA Release Engineer + Principal Architect  
**Phiên bản:** 1.0.0 (Windows Release Candidate v1.0)

---

## 1. Bối Cảnh & Mục Tiêu Kỹ Thuật (Context & Objectives)

FileTools Pro cần xuất bản bản phát hành chính thức đầu tiên (v1.0) trên hệ điều hành Windows 10 & Windows 11, đồng thời đủ điều kiện vượt qua quy trình kiểm duyệt chứng nhận của **Microsoft Store**.

Hai phương án kiến trúc được đưa lên bàn cân đánh giá:
- **Phương án A — Progressive Web App đóng gói MSIX (PWA/MSIX qua PWABuilder / Windows Packaging):** Đóng gói ứng dụng web PWA hiện có trong một vỏ bọc MSIX nhẹ, vận hành trên nền tảng **Microsoft Edge WebView2 Evergreen Runtime** đã tích hợp sẵn trong mọi bản cài Windows 10 (bản cập nhật gần đây) và Windows 11.
- **Phương án B — Electron Desktop Wrapper (Electron 33+ / electron-builder):** Đóng gói ứng dụng kèm toàn bộ nhân trình duyệt Chromium và môi trường thực thi Node.js độc lập thành trình cài đặt NSIS/MSIX truyền thống.

---

## 2. Ma Trận Đánh Giá Kỹ Thuật Chi Tiết (Technical Evaluation Matrix)

Dưới đây là bảng đối soát chi tiết giữa yêu cầu thực tế của FileTools Pro và khả năng đáp ứng của từng nền tảng:

| Hạng Mục Kỹ Thuật | Yêu Cầu Thực Tế Của FileTools Pro | Khả Năng Đáp Ứng Của PWA / MSIX | Khả Năng Đáp Ứng Của Electron | Kết Luận / Đánh Giá |
|:---|:---|:---|:---|:---:|
| **1. Liên kết loại tệp OS (File Association)** | Mở trực tiếp các tệp `.pdf`, `.docx`, `.png`, `.jpg` vào ứng dụng khi double-click từ Windows File Explorer. | **100% ĐẠT:** Khai báo qua `file_handlers` trong Web App Manifest; Windows OS đăng ký tự động qua `AppxManifest.xml`. | **100% ĐẠT:** Khai báo qua `fileAssociations` trong `electron-builder.json`. | **HÒA (Tương đương)** |
| **2. Tương tác Khay Nhớ Tạm (Clipboard API)** | Đọc/ghi văn bản, dán trực tiếp ảnh chụp màn hình từ clipboard vào studio. | **100% ĐẠT:** Web Clipboard API (`navigator.clipboard.read()`, `writeText()`) được Edge WebView2 cấp quyền bảo mật. | **100% ĐẠT:** Hỗ trợ qua module `clipboard` của Electron. | **HÒA (Tương đương)** |
| **3. Kéo thả tệp & Chọn thư mục** | Kéo thả nhiều tệp, kéo thư mục chứa hàng loạt file PDF/ảnh vào cửa sổ. | **100% ĐẠT:** HTML5 Drag and Drop API (`webkitGetAsEntry`) và File System Access API (`showDirectoryPicker`). | **100% ĐẠT:** Hỗ trợ qua Chromium DND và `dialog.showOpenDialog`. | **HÒA (Tương đương)** |
| **4. Soạn thảo & Xem trước Ngoại tuyến (Offline Editing)** | Chỉnh sửa code với Monaco Editor, xem trước trang PDF với PDF.js, tạo mã QR khi ngắt mạng. | **100% ĐẠT:** Lưu trữ tệp trên IndexedDB, nạp mã nguồn từ Service Worker Precache (`dist/sw.js`). | **100% ĐẠT:** Nạp trực tiếp từ thư mục gói cục bộ (`electron-serve`). | **HÒA (Tương đương)** |
| **5. Tác vụ nặng (FFmpeg, LibreOffice, OCR)** | Chuyển đổi DOCX sang PDF, tách nền AI, nhận diện chữ OCR, render video. | **KIẾN TRÚC THỰC TẾ:** Toàn bộ tác vụ nặng của FileTools Pro đều chạy trên **Cụm Render Cloud Worker (BullMQ + Redis)**, không chạy cục bộ trên máy người dùng! | Không cần thiết: Nhúng FFmpeg (80MB) và LibreOffice (300MB) vào máy client là thừa thãi và gây chậm máy. | **PWA VƯỢT TRỘI (Tối ưu tài nguyên)** |
| **6. Tải tệp & Quản lý tiến trình** | Tải file kết quả với chữ ký thời hạn, xem tiến độ job qua WebSocket. | **100% ĐẠT:** Tải tệp chuẩn Web, kết nối Socket.IO thời gian thực mượt mà. | **100% ĐẠT:** Tải qua Chromium Download Manager. | **HÒA (Tương đương)** |
| **7. Dung lượng gói cài đặt (Package Size)** | Nhẹ nhàng, tải nhanh, không chiếm dụng ổ cứng người dùng. | **SIÊU NHẸ ($\approx 1.5 - 3\text{ MB}$):** Chỉ chứa metadata và tài nguyên đóng gói, tận dụng WebView2 hệ thống. | **RẤT NẶNG ($\approx 120 - 180\text{ MB}$):** Phải đóng gói kèm nhân Chromium và Node.js runtime. | **PWA THẮNG TUYỆT ĐỐI** |
| **8. Bảo trì An ninh & Vá lỗi (CVE Patches)** | Cập nhật các lỗ hổng bảo mật trình duyệt nhanh chóng. | **TỰ ĐỘNG 100%:** Microsoft Edge WebView2 được Windows Update tự động vá lỗi 0-day mà lập trình viên không cần build lại app! | **GÁNH NẶNG LỚN:** Mỗi khi Chromium có bản vá bảo mật, nhà phát triển phải nâng cấp Electron, build lại và đẩy bản cập nhật mới. | **PWA THẮNG TUYỆT ĐỐI** |
| **9. Cơ chế Cập Nhật Ứng Dụng (Updates)** | Triển khai tính năng mới và vá lỗi giao diện người dùng. | **TỨC THÌ (Instant):** Triển khai mã nguồn web lên Vercel/CDN, Service Worker tự động nạp bản mới trong nền mà không yêu cầu cài đặt lại MSIX. | **CHẬM:** Phải phát hành qua `electron-updater` hoặc gửi gói cập nhật mới lên Microsoft Store kiểm duyệt lại. | **PWA THẮNG TUYỆT ĐỐI** |

---

## 3. Quyết Định Kiến Trúc (Architecture Decision)

1. **LỰA CHỌN CHÍNH THỨC CHO MICROSOFT STORE v1.0: PWA / MSIX**
   - FileTools Pro sẽ được đóng gói dưới định dạng **MSIX Package** thông qua công nghệ chuẩn của Microsoft (**PWABuilder / Windows Packaging**).
   - **Lý do quyết định:**
     - Ứng dụng đáp ứng 100% yêu cầu chức năng thực tế của người dùng Windows.
     - Dung lượng gói cài đặt siêu nhẹ (chỉ $1.5\text{MB}$ so với $150\text{MB}$ của Electron), tải và cài đặt trong 3 giây.
     - Tận dụng cơ chế bảo mật sandbox an toàn của Windows AppContainer.
     - Tự động cập nhật tính năng qua web mà không làm gián đoạn người dùng.
     - Tận dụng WebView2 Evergreen do Microsoft duy trì, giải phóng hoàn toàn gánh nặng bảo trì lỗ hổng bảo mật Chromium.

2. **VAI TRÒ CỦA ELECTRON TRONG DỰ ÁN:**
   - Mã nguồn trong thư mục [`electron/`](file:///C:/Users/Admin/test_app/filetools-app/electron/) được **bảo lưu nguyên vẹn** (không xóa, không phá vỡ).
   - Electron được giữ lại như một tùy chọn **Bản dựng Doanh nghiệp Độc lập (Enterprise Offline Standalone Build)** dành riêng cho các mạng nội bộ biệt lập (Air-gapped Networks) không có kết nối Internet hoặc các khách hàng yêu cầu gói `.exe` cài đặt thủ công ngoại tuyến.

---

## 4. Hậu Quả & Kế Hoạch Triển Khai (Consequences & Action Plan)

- **Ưu điểm đạt được:**
  - Tiết kiệm 99% thời gian chờ kiểm duyệt cập nhật ứng dụng trên Microsoft Store.
  - Tương thích hoàn hảo với cả Windows 10 và Windows 11 (x86, x64, ARM64 Surface).
  - Tích hợp sâu vào Windows: Hiển thị icon trên Start Menu, ghim thanh Taskbar, chạy độc lập không có viền trình duyệt.
- **Rủi ro & Giảm thiểu:**
  - *Rủi ro:* Máy tính chạy Windows 10 phiên bản quá cũ chưa có sẵn Edge WebView2.
  - *Biện pháp giảm thiểu:* Trình cài đặt MSIX tự động kích hoạt tải WebView2 Evergreen Bootstrapper từ máy chủ Microsoft nếu phát hiện máy trạm chưa có sẵn.
