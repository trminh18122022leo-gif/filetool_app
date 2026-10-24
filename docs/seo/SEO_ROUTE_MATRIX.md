# FileTools Pro — SEO Route Matrix & URL Architecture Map
**Phiên bản:** 1.0.0 (Giai đoạn Tối ưu hóa SEO, PWA & Hiệu năng Frontend 2026)  
**Tác giả:** SEO Technical Engineer + Frontend Performance Lead  
**Trạng thái:** Triển khai hoàn tất & Sẵn sàng Indexing

---

## 1. Tổng Quan Kiến Trúc Điều Hướng & Phân Tuyến URL (Architecture Overview)

Hệ thống FileTools Pro duy trì mô hình kiến trúc **Single-Page Application (SPA)** hiện đại sử dụng React 18, Vite và React Router 7. Thay vì tái cấu trúc toàn diện sang Next.js (gây phân mảnh mã nguồn và chậm trễ tiến độ), kiến trúc của FileTools Pro áp dụng giải pháp tối ưu hóa SEO lai:

1. **Phân tách rạch ròi 2 miền không gian URL:**
   - **Public SEO Landing URLs:** Các trang giới thiệu, bảng giá, danh mục công cụ, hướng dẫn, chính sách bảo mật và từng trang công cụ chuyên dụng. Các trang này được cấu hình thẻ chuẩn hóa Canonical, thẻ Meta Title/Description chuyên biệt, thẻ Open Graph / Twitter Card và dữ liệu có cấu trúc Schema.org JSON-LD.
   - **Private Application URLs:** Các trang khu vực người dùng, quản lý tài khoản, đăng nhập/đăng ký, bảng điều khiển công việc (Dashboard) và các liên kết chứa tham số xác thực (`?token=...`, `?session_id=...`). Các trang này được cấu hình chặn cào dữ liệu qua `robots.txt` và gắn thẻ `<meta name="robots" content="noindex, nofollow" />`.

2. **Khắc phục lỗi Reverse Proxy / Rewrite trên Staging (Vercel & Cloudflare):**
   - *Vấn đề đã xác thực:* Cấu hình `client/vercel.json` trước đây sử dụng quy tắc bắt tất cả `/(.*) -> /index.html`. Khi client hoặc đối tác gọi endpoint `/api/payment/plans` hoặc `/api/auth/me`, Vercel lập tức trả về mã HTML của SPA (`<!doctype html>`) với mã 200 thay vì dữ liệu JSON từ API Render!
   - *Giải pháp triệt để:* Viết lại quy tắc rewrite trong `client/vercel.json` theo đúng thứ tự ưu tiên:
     1. `/api/(.*)` chuyển tiếp sang `https://filetools-api.onrender.com/api/$1` kèm tiêu đề chống cache CDN (`Cache-Control: no-store, no-cache, must-revalidate`).
     2. `/socket.io/(.*)` chuyển tiếp sang máy chủ WebSocket Render.
     3. `/(.*)` chuyển tiếp về `/index.html` cho các tuyến đường client-side SPA.
     4. Áp dụng tương tự cho `client/public/_redirects` đối với triển khai Netlify / Cloudflare Pages.

---

## 2. Ma Trận Chi Tiết Toàn Bộ Tuyến Đường (Crawlable Route Matrix)

### 2.1. Nhóm Tuyến Đường Công Khai (Public SEO Indexable URLs)

| STT | Tuyến Đường (Route) | Tiêu Đề Trang (Title) | Thẻ Canonical | Trạng Thái Index | Ưu Tiên (Priority) | Tần Suất Cào (Changefreq) | Schema.org Type |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|
| 1 | `/` | FileTools Pro — Nền Tảng Xử Lý Tệp Tốc Độ Cao & Bảo Mật | `https://filetools-app.vercel.app/` | `index, follow` | 1.0 | Daily | `SoftwareApplication`, `Organization` |
| 2 | `/tools` | Danh Mục Tất Cả Công Cụ Trực Tuyến — FileTools Pro | `https://filetools-app.vercel.app/tools` | `index, follow` | 0.9 | Daily | `CollectionPage`, `BreadcrumbList` |
| 3 | `/pdf` | PDF Studio Pro — Bộ Công Cụ Xử Lý PDF Đa Năng Trực Tuyến | `https://filetools-app.vercel.app/pdf` | `index, follow` | 0.9 | Weekly | `SoftwareApplication` |
| 4 | `/pdf/merge` | Gộp PDF Trực Tuyến — Ghép Nhiều File PDF Thành Một | `https://filetools-app.vercel.app/pdf/merge` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 5 | `/pdf/split` | Tách PDF Trực Tuyến — Chia Nhỏ & Trích Xuất Dải Trang | `https://filetools-app.vercel.app/pdf/split` | `index, follow` | 0.8 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 6 | `/pdf/compress` | Nén PDF Trực Tuyến — Giảm Dung Lượng Giữ Nguyên Độ Nét | `https://filetools-app.vercel.app/pdf/compress` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 7 | `/pdf/ocr` | OCR Nhận Dạng Văn Bản PDF Trực Tuyến — Chuyển Scan Sang Text | `https://filetools-app.vercel.app/pdf/ocr` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 8 | `/pdf/sign` | Ký Số PDF & Thêm Con Dấu Điện Tử Trực Tuyến | `https://filetools-app.vercel.app/pdf/sign` | `index, follow` | 0.8 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 9 | `/pdf/delete` | Xóa Trang PDF Trực Tuyến — Loại Bỏ Trang Thừa Nhanh Chóng | `https://filetools-app.vercel.app/pdf/delete` | `index, follow` | 0.8 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 10 | `/pdf/organize` | Sắp Xếp & Xoay Trang PDF — Kéo Thả Trực Quan | `https://filetools-app.vercel.app/pdf/organize` | `index, follow` | 0.8 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 11 | `/pdf/redact` | Che Thông Tin Nhạy Cảm PII Trực Tuyến — Redact PDF Bảo Mật | `https://filetools-app.vercel.app/pdf/redact` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 12 | `/ocr` | OCR Nhận Dạng Văn Bản & Ký Tự Quang Học | `https://filetools-app.vercel.app/ocr` | `index, follow` | 0.9 | Weekly | `SoftwareApplication` |
| 13 | `/convert` | Chuyển Đổi Tệp Đa Năng — Convert PDF, Office, HTML, Markdown | `https://filetools-app.vercel.app/convert` | `index, follow` | 0.9 | Weekly | `SoftwareApplication` |
| 14 | `/convert/word-to-pdf` | Chuyển Đổi Word Sang PDF Trực Tuyến — Giữ Nguyên Định Dạng | `https://filetools-app.vercel.app/convert/word-to-pdf` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 15 | `/office` | Chuyển Đổi Tài Liệu Microsoft Office (Word, Excel, PowerPoint) | `https://filetools-app.vercel.app/office` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 16 | `/image` | Studio Chỉnh Sửa & Tối Ưu Hình Ảnh — Tách Nền & Vectorize | `https://filetools-app.vercel.app/image` | `index, follow` | 0.9 | Weekly | `SoftwareApplication` |
| 17 | `/image/compress` | Nén Hình Ảnh Trực Tuyến — Giảm Dung Lượng WebP, PNG, JPEG | `https://filetools-app.vercel.app/image/compress` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 18 | `/video` | Video Studio — Cắt Ghép, Nén & Xử Lý Video Trực Tuyến | `https://filetools-app.vercel.app/video` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 19 | `/creative` | Creative Shorts Studio — Tạo Video Ngắn Tự Động | `https://filetools-app.vercel.app/creative` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 20 | `/speech` | Speech-to-Text — Chuyển Đổi Giọng Nói Thành Văn Bản Whisper | `https://filetools-app.vercel.app/speech` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 21 | `/video-translate` | Dịch Thuật Phụ Đề Video Đa Ngôn Ngữ Trực Tuyến | `https://filetools-app.vercel.app/video-translate` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 22 | `/archive` | Nén & Giải Nén Tệp ZIP An Toàn Trực Tuyến | `https://filetools-app.vercel.app/archive` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 23 | `/qr` | QR Code Studio — Tạo & Tùy Biến Mã QR Trực Tuyến | `https://filetools-app.vercel.app/qr` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 24 | `/batch` | Xử Lý Tệp Hàng Loạt Tốc Độ Cao | `https://filetools-app.vercel.app/batch` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 25 | `/editor` | Monaco Code Editor — Soạn Thảo Mã Nguồn Trực Tuyến | `https://filetools-app.vercel.app/editor` | `index, follow` | 0.8 | Weekly | `SoftwareApplication` |
| 26 | `/workflows` | Workflow Studio — Tự Động Hóa Xử Lý File Đa Bước Theo DAG | `https://filetools-app.vercel.app/workflows` | `index, follow` | 0.9 | Weekly | `SoftwareApplication`, `BreadcrumbList` |
| 27 | `/features/workflow-studio` | Điều hướng chuẩn hóa về `/workflows` (301 Redirect Alias) | `https://filetools-app.vercel.app/workflows` | `index, follow` | 0.8 | Weekly | — |
| 28 | `/pricing` | Bảng Giá & Gói Đăng Ký 2026 — Tiết Kiệm Tới 33% | `https://filetools-app.vercel.app/pricing` | `index, follow` | 0.9 | Weekly | `Product`, `PriceSpecification` |
| 29 | `/security` | Kiến Trúc An Ninh & Bảo Mật Dữ Liệu Doanh Nghiệp | `https://filetools-app.vercel.app/security` | `index, follow` | 0.8 | Monthly | `Article`, `BreadcrumbList` |
| 30 | `/privacy` | Chính Sách Quyền Riêng Tư & Bảo Vệ Dữ Liệu Minh Bạch | `https://filetools-app.vercel.app/privacy` | `index, follow` | 0.8 | Monthly | `Article`, `BreadcrumbList` |
| 31 | `/guides` | Trung Tâm Hướng Dẫn & Thủ Thuật Xử Lý Tệp Chi Tiết | `https://filetools-app.vercel.app/guides` | `index, follow` | 0.9 | Weekly | `HowTo`, `BreadcrumbList` |
| 32 | `/api-docs` | REST API & Webhooks Documentation | `https://filetools-app.vercel.app/api-docs` | `index, follow` | 0.7 | Monthly | `TechArticle` |

---

### 2.2. Nhóm Tuyến Đường Riêng Tư & Không Được Index (Private NoIndex URLs)

Tất cả các tuyến đường dưới đây **tuyệt đối không xuất hiện trong sitemap.xml**, được gắn quy tắc `Disallow` trong `robots.txt`, và tự động chèn thẻ `<meta name="robots" content="noindex, nofollow" />`:

| Tuyến Đường (Private Route) | Mục Đích | Cơ Chế Bảo Vệ SEO & Bảo Mật |
|:---|:---|:---|
| `/dashboard` | Không gian tệp cá nhân & quản lý công việc | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/login` | Cổng đăng nhập người dùng | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/register` | Cổng tạo tài khoản mới | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/forgot-password` | Form khôi phục mật khẩu | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/reset-password` | Form đặt lại mật khẩu | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/verify-email` | Xác thực hòm thư người dùng | Chặn robots.txt + Thẻ `noindex, nofollow` |
| `/*?token=*` | Đường dẫn chứa mã truy cập OAuth / Token cá nhân | Chặn robots.txt (`Disallow: /*?token=*`) |
| `/*?session_id=*` | Đường dẫn phản hồi thanh toán Stripe | Chặn robots.txt (`Disallow: /*?session_id=*`) |
| `/api/*` | Cổng REST API Backend | Chặn robots.txt + Rewrite sang Render API |
| `/outputs/*` & `/uploads/*` | Các tệp nhị phân tạm thời | Chặn robots.txt + Đóng thư mục tĩnh công khai |

---

## 3. Cấu Hình Redirect & Rewrite Chuẩn Hóa

### 3.1. Cấu hình Vercel (`client/vercel.json`)
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://filetools-api.onrender.com/api/$1"
    },
    {
      "source": "/socket.io/(.*)",
      "destination": "https://filetools-api.onrender.com/socket.io/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate, proxy-revalidate" },
        { "key": "Pragma", "value": "no-cache" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 3.2. Cấu hình Netlify / Cloudflare Pages (`client/public/_redirects`)
```text
/api/*  https://filetools-api.onrender.com/api/:splat  200
/*      /index.html                                    200
```

---

## 4. Xử Lý Mã Trạng Thái HTTP 404 & Trang Bị Lỗi

Trong môi trường SPA:
- Nếu người dùng hoặc bot truy cập vào một URL không tồn tại (ví dụ: `/pdf/non-existent-tool`), router `client/src/App.jsx` sẽ kích hoạt route `path="*"` dẫn tới component [`client/src/pages/NotFound.jsx`](file:///C:/Users/Admin/test_app/filetools-app/client/src/pages/NotFound.jsx).
- Component `NotFound.jsx` tự động chèn thẻ `<meta name="robots" content="noindex, nofollow" />` và cập nhật tiêu đề trang thành `404 — Không Tìm Thấy Trang — FileTools Pro`.
- Đối với các dịch vụ SSR hoặc serverless Edge functions trong tương lai, mã trạng thái HTTP 404 thực tế sẽ được trả về trực tiếp ở tầng header mạng để ngăn chặn tình trạng Soft 404 trên Google Search Console.
