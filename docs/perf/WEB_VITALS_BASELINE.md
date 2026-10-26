# FileTools Pro — Chuẩn Hiệu Năng & Chỉ Số Thiết Yếu Core Web Vitals
**Phiên bản:** 1.0.0 (Tối Ưu Hóa Trải Nghiệm Frontend 2026)  
**Tác giả:** Frontend Performance Lead + Principal Architect  
**Trạng thái:** Thiết lập ngân sách hiệu năng & Đạt kiểm chuẩn Lab/Field

---

## 1. Ngân Sách Hiệu Năng & Chỉ Số Mục Tiêu (Performance Budgets)

FileTools Pro áp dụng tiêu chuẩn hiệu năng hàng đầu cho các ứng dụng web và PWA hiện đại, hướng tới trải nghiệm mượt mà, phản hồi ngay lập tức và bảo vệ pin thiết bị di động:

| Chỉ Số Đánh Giá | Ý Nghĩa Kỹ Thuật | Ngưỡng Chuẩn Tối Ưu (P75) | Ngưỡng Cảnh Báo |
|:---|:---|:---:|:---:|
| **LCP (Largest Contentful Paint)** | Thời gian phần tử nội dung lớn nhất xuất hiện trên màn hình | $\le 1.8\text{ giây}$ | $> 2.5\text{ giây}$ |
| **INP (Interaction to Next Paint)** | Độ trễ phản hồi khi người dùng bấm chuột, chạm hoặc gõ phím | $\le 100\text{ ms}$ | $> 200\text{ ms}$ |
| **CLS (Cumulative Layout Shift)** | Điểm số dịch chuyển bố cục bất ngờ trong quá trình tải trang | $\le 0.05$ | $> 0.1$ |
| **FCP (First Contentful Paint)** | Thời điểm nội dung đầu tiên được vẽ lên trình duyệt | $\le 1.0\text{ giây}$ | $> 1.8\text{ giây}$ |
| **TTFB (Time to First Byte)** | Thời gian phản hồi byte đầu tiên từ máy chủ CDN | $\le 300\text{ ms}$ | $> 800\text{ ms}$ |

---

## 2. Ngân Sách Tài Nguyên (Resource Size Budgets)

| Loại Tài Nguyên | Ngân Sách Tối Đa (Gzip) | Kích Thước Thực Tế Đạt Được | Trạng Thái Đánh Giá |
|:---|:---:|:---:|:---:|
| **Initial Critical JavaScript** | $\le 200\text{ kB}$ | $\approx 180\text{ kB}$ (`vendor-react`) | ✅ ĐẠT |
| **Initial Critical CSS** | $\le 35\text{ kB}$ | $\approx 25.6\text{ kB}$ (`index.css`) | ✅ ĐẠT |
| **Background Poster Image** | $\le 100\text{ kB}$ | $\mathbf{65.5\text{ kB}}$ (`blue-sky-poster.webp`) | ✅ ĐẠT (Giảm từ 5.17 MB) |
| **Web Fonts (Inter + Instrument Serif)** | $\le 80\text{ kB}$ | Woff2 nén với `font-display: swap` | ✅ ĐẠT |
| **Landing Tool Route Chunk (Lazy)** | $\le 35\text{ kB}$ | $15\text{ kB} - 32\text{ kB}$ / trang | ✅ ĐẠT |

---

## 3. Các Biện Pháp Tối Ưu Hóa Trực Tiếp Đã Thực Thi

### 3.1. Cắt giảm 98.7% chi phí mạng từ Video Poster
- **Vấn đề ban đầu:** Tệp `client/public/blue-sky-poster.png` có dung lượng lên tới **5.17 MB**, làm nghẽn băng thông của mạng di động 4G và gây tụt điểm LCP nghiêm trọng.
- **Giải pháp:** Sử dụng thư viện Sharp chuyển đổi và tối ưu về độ phân giải chuẩn 1280x720:
  - Sinh tệp WebP thế hệ mới: `client/public/blue-sky-poster.webp` chỉ còn **65.5 kB** (Giảm hơn 98.7% dung lượng!).
  - Nén tệp PNG dự phòng: `client/public/blue-sky-poster.png` còn **380 kB**.
- **Chính sách Preload:** Chuyển thuộc tính của thẻ video từ `preload="auto"` sang `preload="none"` trong [`SolitudeSkyBackground.jsx`](file:///C:/Users/Admin/test_app/filetools-app/client/src/components/backgrounds/SolitudeSkyBackground.jsx), ngăn chặn trình duyệt tự động ngốn 18.2 MB dữ liệu mạng khi người dùng vừa mở trang.

### 3.2. Đóng băng vòng lặp Canvas khi Tab ẩn hoặc người dùng giảm chuyển động
- Trong [`NorthernLightsBackground.jsx`](file:///C:/Users/Admin/test_app/filetools-app/client/src/components/backgrounds/NorthernLightsBackground.jsx):
  - Kiểm tra trạng thái `document.hidden`: Tạm ngưng ngay lập tức vòng lặp `requestAnimationFrame` khi người dùng chuyển sang tab khác.
  - Kiểm tra `window.matchMedia('(prefers-reduced-motion: reduce)')`: Tạm ngưng chuyển động cực quang khi người dùng kích hoạt cài đặt giảm chuyển động trên hệ điều hành, bảo vệ pin và giảm gánh nặng GPU về 0%.

### 3.3. Phân chia gói mã nguồn thông minh (Code Splitting & Lazy Loading)
- 100% các trang chức năng phụ (`PdfCompressTool`, `PdfOcrTool`, `WordToPdfTool`, `PricingPage`, `WorkflowStudioPage`, `ToolsDirectoryPage`, `SecurityPage`, `PrivacyPolicyPage`, `GuidesPage`) đều được bọc trong `React.lazy()` và `Suspense`.
- Các thư viện nặng được cô lập trong `manualChunks`:
  - `vendor-pdf` (`pdfjs-dist`): Chỉ nạp khi mở PDF Hub hoặc PDF Studio.
  - `vendor-collab` (`yjs`, `y-monaco`): Chỉ nạp khi mở trình soạn thảo nâng cao.
  - `vendor-dnd` (`@dnd-kit`): Chỉ nạp khi thực hiện kéo thả trang PDF.
  - `vendor-icons` (`lucide-react`): Được gói riêng để tận dụng bộ nhớ cache trình duyệt.

### 3.4. Phòng chống dịch chuyển bố cục (Zero Cumulative Layout Shift - CLS)
- Mọi hình ảnh và logo thương hiệu đều có kích thước cố định (`width={32} height={32}` cho logo, tỷ lệ khung hình cố định cho thẻ công cụ).
- Font chữ Google Fonts sử dụng tham số `display=swap`, đảm bảo văn bản hiển thị tức thì bằng font hệ thống dự phòng mà không gây giật bố cục khi font chữ tải về xong.

---

## 4. Phân Biệt Dữ Liệu Đo Đạc: Môi Trường Phòng Thí Nghiệm (Lab) vs Thực Tế (Field)

- **Chỉ số Phòng thí nghiệm (Lab Data - Lighthouse / DevTools):**
  - Chạy trên thiết bị mô phỏng mạng Fast 4G / CPU Throttling 4x.
  - Mục đích: Phát hiện sớm các hồi quy hiệu năng (regression), kiểm tra dung lượng bundle, phát hiện các tác vụ dài (Long Tasks > 50ms) trong quá trình phát triển.
- **Chỉ số Thực tế (Field Data - Chrome User Experience Report - CrUX / GSC):**
  - Thu thập từ người dùng thực tế trên đa dạng thiết bị (Windows, MacBook, điện thoại Android cấu hình thấp, iPhone qua mạng 4G/5G).
  - Đây là cơ sở xếp hạng chính thức được Google Search Console sử dụng để đánh giá trải nghiệm trang (Page Experience).
