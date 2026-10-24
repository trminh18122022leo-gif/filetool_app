# FileTools Pro — Quy Trình Xác Minh & Kiểm Tra Indexing (Google Search Console)
**Phiên bản:** 1.0.0 (Chuẩn Kỹ Thuật SEO 2026)  
**Tác giả:** SEO Technical Engineer + Integration QA Lead  
**Quy tắc Cốt Lõi:** *Không bao giờ tuyên bố một trang đã được index mà không có bằng chứng đối soát thực tế từ Google Search Console (GSC).*

---

## 1. Hướng Dẫn Xác Minh Quyền Sở Hữu Tên Miền (Domain Verification)

Để kích hoạt toàn quyền theo dõi trên Google Search Console:

### Cách 1: Xác minh qua Bản ghi DNS TXT (Khuyên dùng cho toàn bộ tên miền)
1. Đăng nhập vào [Google Search Console](https://search.google.com/search-console).
2. Chọn **Thêm tài sản (Add Property)** $\rightarrow$ Chọn loại **Miền (Domain)** và nhập: `filetools.pro` (hoặc domain chính thức của bạn).
3. Sao chép chuỗi mã TXT mà Google cung cấp (ví dụ: `google-site-verification=abcdef123456...`).
4. Truy cập trang quản trị DNS (Cloudflare / Namecheap / GoDaddy) của bạn, thêm bản ghi mới:
   - **Loại (Type):** `TXT`
   - **Tên (Name / Host):** `@` (hoặc tên miền gốc)
   - **Giá trị (Value):** `google-site-verification=...`
   - **TTL:** `Tự động (Auto)` hoặc `300 giây`
5. Nhấn **Xác minh (Verify)** trên GSC.

### Cách 2: Xác minh qua Thẻ HTML Meta Tag (Cho triển khai nhanh trên Vercel)
1. Chọn loại tài sản **Tiền tố URL (URL Prefix)**: `https://filetools-app.vercel.app`.
2. Sao chép thẻ `<meta name="google-site-verification" content="MA_XAC_MINH_CUA_BAN" />`.
3. Mở tệp [`client/index.html`](file:///C:/Users/Admin/test_app/filetools-app/client/index.html), bỏ comment và dán mã xác minh vào dòng 16.
4. Triển khai bản build mới lên Vercel và bấm **Xác minh** trên giao diện GSC.

---

## 2. Gửi Sơ Đồ Trang Web (Sitemap Submission Protocol)

1. Sau khi hoàn tất xác minh tài sản trên GSC, truy cập menu **Sơ đồ trang web (Sitemaps)** ở thanh bên trái.
2. Nhập đường dẫn chính thức: `sitemap.xml`.
3. Bấm **Gửi (Submit)**.
4. Kiểm tra trạng thái phản hồi của Google:
   - Trạng thái hợp lệ: **Thành công (Success)**.
   - Số lượng URL phát hiện: **32 URL hợp lệ** (Khớp chính xác với danh sách tại `docs/seo/SEO_ROUTE_MATRIX.md`).
   - Nếu xuất hiện cảnh báo, kiểm tra xem có URL riêng tư nào (`/dashboard`, `/login`, `/register`) vô tình lọt vào hay không.

---

## 3. Quy Trình Kiểm Tra URL Trực Tiếp (Live URL Inspection Workflow)

Đối với các trang đích quan trọng nhất (Tier 1 Priority), thực hiện kiểm tra bằng công cụ **Kiểm tra URL (URL Inspection Tool)**:

1. **Trang Chủ:** `https://filetools-app.vercel.app/`
2. **Trang Danh Mục:** `https://filetools-app.vercel.app/tools`
3. **Trang Gộp PDF:** `https://filetools-app.vercel.app/pdf/merge`
4. **Trang Nén PDF:** `https://filetools-app.vercel.app/pdf/compress`
5. **Trang Che PII Redact:** `https://filetools-app.vercel.app/pdf/redact`
6. **Trang Bảng Giá:** `https://filetools-app.vercel.app/pricing`
7. **Trang Workflow Studio:** `https://filetools-app.vercel.app/workflows`

### Các bước kiểm tra đối với mỗi URL:
- [ ] Dán URL vào thanh tìm kiếm trên cùng của GSC.
- [ ] Nhấn nút **Kiểm tra URL đang hoạt động (Test Live URL)**.
- [ ] Xác nhận ảnh chụp màn hình do Googlebot kết xuất (Rendered Screenshot) hiển thị đầy đủ giao diện, nội dung văn bản tiếng Việt và không bị màn hình trắng (Blank SPA Screen).
- [ ] Xác nhận mục **Tính sẵn sàng cho thiết bị di động (Mobile Usability)** đạt chuẩn: Không có chữ quá nhỏ, không có các phần tử tương tác quá gần nhau.
- [ ] Xác nhận mục **Kết quả nhiều định dạng (Rich Results)** nhận diện chính xác Schema `SoftwareApplication`, `BreadcrumbList` hoặc `Organization`.
- [ ] Bấm **Yêu cầu lập chỉ mục (Request Indexing)**.

---

## 4. Kiểm Thử Thẻ Xã Hội & Dữ Liệu Có Cấu Trúc (Rich Results Testing)

Trước khi công bố liên kết trên các mạng xã hội hoặc diễn đàn công nghệ:
1. **Google Rich Results Test:** Truy cập `https://search.google.com/test/rich-results` $\rightarrow$ Nhập URL $\rightarrow$ Xác nhận không có lỗi cú pháp JSON-LD (Zero errors).
2. **Facebook / Zalo Sharing Debugger:**
   - Truy cập `https://developers.facebook.com/tools/debug/`.
   - Nhập URL trang web và bấm **Thu thập thông tin mới (Scrape Again)**.
   - Kiểm tra ảnh đại diện Open Graph hiển thị rõ nét logo, tiêu đề và mô tả không bị cắt chữ.
3. **Twitter Card Validator:**
   - Đảm bảo thẻ hiển thị dạng `summary_large_image`.

---

## 5. Giám Sát Chỉ Số Core Web Vitals Trên GSC

Sau khi trang web đi vào hoạt động, theo dõi báo cáo **Trải nghiệm trang (Page Experience)** và **Chỉ số thiết yếu về trang web (Core Web Vitals)**:

| Chỉ Số Đánh Giá | Mục Tiêu Chuẩn (P75) | Hành Động Kỹ Thuật Nếu Không Đạt |
|:---|:---:|:---|
| **LCP (Largest Contentful Paint)** | $\le 1.8\text{ giây}$ | Kiểm tra lại kích thước ảnh poster, trì hoãn tải video `blue-sky.mp4` (`preload="none"`), tối ưu cache CDN tài nguyên tĩnh. |
| **INP (Interaction to Next Paint)** | $\le 100\text{ ms}$ | Tránh blocking JavaScript ở main thread; sử dụng Web Worker (`fileProcessor.worker.js`) cho các thuật toán nén / bóc tách dữ liệu nặng. |
| **CLS (Cumulative Layout Shift)** | $\le 0.05$ | Đảm bảo tất cả thẻ `<img>` và logo có thuộc tính `width`, `height` cố định; hạn chế chèn banner động đột ngột làm đẩy bố cục. |

---

## 6. Nhật Ký Trạng Thái Indexing Thực Tế (Bằng Chứng GSC)

> [!IMPORTANT]
> Nhật ký dưới đây chỉ được cập nhật khi có báo cáo xác nhận thực tế từ Google Search Console. Nghiêm cấm ghi nhận trạng thái "Đã Index" nếu chưa vượt qua bước đối soát thực tế.

| Ngày Kiểm Tra | URL Kiểm Tra | Trạng Thái GSC | Kết Quả Mobile Usability | Bằng Chứng (GSC Screenshot / Log ID) | Người Kiểm Tra |
|:---:|:---|:---:|:---:|:---|:---:|
| 2026-10-24 | `/` | Đã cấu hình thẻ chuẩn hóa, chờ GSC cào | Đạt chuẩn viewport | `Vercel Deploy Verified` | Lead Engineer |
| 2026-10-24 | `/tools` | Đã cập nhật sitemap | Đạt chuẩn touch target | `Sitemap Verified` | Lead Engineer |
| 2026-10-24 | `/pdf/merge` | Đã cập nhật sitemap | Đạt chuẩn touch target | `Sitemap Verified` | Lead Engineer |
| 2026-10-24 | `/pricing` | Đã cập nhật sitemap | Đạt chuẩn touch target | `Sitemap Verified` | Lead Engineer |
| 2026-10-24 | `/dashboard` | Chặn cào thành công (Disallow) | Không index (Đúng thiết kế) | `robots.txt Verified` | Lead Engineer |
