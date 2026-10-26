# Renderer Isolation & SSRF Defense Specification
**Tài liệu Kiểm toán Bảo mật Bộ máy Render & Trình duyệt Headless (Finding S-06)**  
**Phân hệ:** Chromium Puppeteer Sandbox & URL/HTML Conversion Pipelines  
**Trạng thái:** CONFIRMED & RESOLVED (PASS)  
**Ngày kiểm toán:** 23/10/2026  
**Tiêu chuẩn bảo mật:** OWASP Top 10 A10:2021 (SSRF), CWE-918, CWE-73, CIS Benchmark Chromium  

---

## 1. Phân tích Rủi ro & Bối cảnh Lỗ hổng (Finding S-06)

Các tính năng chuyển đổi tài liệu web như `URL-to-PDF`, `HTML-to-PDF`, và `Markdown-to-PDF` sử dụng trình duyệt không đầu (Headless Chromium) để nạp nội dung và in ra định dạng PDF. Khi người dùng có thể tùy ý nhập URL hoặc tải lên file HTML tự tạo, hệ thống đối mặt với 4 vector tấn công nghiêm trọng:

1. **Server-Side Request Forgery (SSRF) tới Cloud Metadata:**
   - Kẻ tấn công yêu cầu render URL hoặc chèn thẻ `<img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">`.
   - Nếu không có cơ chế chặn, Chromium trong hạ tầng Render/AWS/GCP sẽ tải và in thông tin token quyền truy cập đám mây vào trang PDF kết quả.
2. **Quét cổng & Xâm nhập Mạng Nội bộ (VPC / Intranet Pivoting):**
   - URL trỏ tới `http://10.0.0.1/admin`, `http://172.16.0.1`, `http://192.168.1.1` hoặc `http://127.0.0.1:3002` để khai thác các dịch vụ nội bộ (Redis, MongoDB, metrics endpoints).
3. **Local File Inclusion (LFI / Arbitrary File Read):**
   - HTML chứa `<iframe src="file:///etc/passwd">` hoặc `<link rel="stylesheet" href="file:///app/.env">`.
4. **Bypass Sandbox bằng cờ `--no-sandbox` bừa bãi:**
   - Việc chạy Chromium bằng tài khoản `root` kèm cờ `--no-sandbox` biến mọi lỗi RCE bộ nhớ của Chromium (v8 engine) thành chiếm quyền kiểm soát toàn bộ server/container.

---

## 2. Kiến trúc Phòng thủ Đa tầng (Defense-in-Depth)

Hệ thống triển khai 4 tầng cô lập độc lập và phối hợp chặt chẽ:

```
[ User Input: URL hoặc Untrusted HTML ]
                   │
                   ▼
[ TẦNG 1: Feature Flag Gate (ENABLE_URL_TO_PDF) ]
  ├── Nếu ENABLE_URL_TO_PDF != 'true' ──► HTTP 403 FEATURE_DISABLED (Fail-Closed)
  └── Nếu hợp lệ ──────────────────────► Chuyển sang Tầng 2
                   │
                   ▼
[ TẦNG 2: SSRF & DNS Rebinding Guard (server/utils/ssrfGuard.js) ]
  ├── Kiểm tra Protocol: Chỉ chấp nhận http: và https: (Cấm file://, gopher://, dict://)
  ├── Kiểm tra Hostname: Cấm localhost, *.local, *.internal, metadata.google.internal
  └── Phân giải DNS trước: Kiểm tra TẤT CẢ bản ghi IP (A / AAAA)
        └── Khớp dải cấm: 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10 (CGNAT),
                          127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12,
                          192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4,
                          ::1, fc00::/7, fe80::/10, ::ffff:0:0/96
                   │
                   ▼
[ TẦNG 3: Puppeteer Request Interception (Real-time Network Filter) ]
  ├── Chế độ 'deny-all' (Cho HTML-to-PDF / Markdown):
  │     ├── Cho phép 'data:' URI (ảnh inline base64)
  │     └── Chặn 100% mọi kết nối mạng ngoại vi (Access Denied)
  └── Chế độ 'allow-safe-remote' (Cho URL-to-PDF):
        └── Intercept mọi sub-resource & HTTP redirect trong quá trình load trang;
            tái kiểm tra IP đích theo danh sách đen thời gian thực (Chống DNS Rebinding)
                   │
                   ▼
[ TẦNG 4: Trình duyệt Headless & Container Sandbox Cô Lập ]
  ├── Dockerfile: Chạy dưới tài khoản không đặc quyền `filetools` (UID 1001)
  ├── Không bao giờ gán cứng `--no-sandbox` (Chỉ kích hoạt có cảnh báo khi có biến môi trường)
  └── Timeout tối đa 30 giây + Auto close tab (WithPage wrapper chống leak RAM/CPU)
```

---

## 3. Cấu hình Chi tiết Bộ Lọc IP (`server/utils/ssrfGuard.js`)

Bảng quy chuẩn dải IP bị cấm triệt để:

| Phân loại | Dải CIDR | Mục đích ngăn chặn |
| :--- | :--- | :--- |
| **Current Network** | `0.0.0.0/8` | Truy cập mạng cục bộ không xác định |
| **Private RFC 1918** | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | Mạng nội bộ VPC, router, Kubernetes pods |
| **Carrier-Grade NAT** | `100.64.0.0/10` | Hạ tầng nhà mạng và VPC peering |
| **Loopback RFC 1122** | `127.0.0.0/8`, `::1` | Localhost, dịch vụ chạy ngầm trên máy chủ |
| **Cloud Metadata** | `169.254.0.0/16`, `fe80::/10` | AWS/GCP/Azure/Render Instance Metadata Service |
| **IPv4-mapped IPv6** | `::ffff:0:0/96` | Bypass bằng cách đóng gói IPv4 trong IPv6 |
| **Multicast & Reserved** | `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255` | Giao thức quảng bá và định tuyến |

---

## 4. Cô lập HTML-to-PDF (Chế độ Deny-All Network)

Đối với file `.html` hoặc raw HTML người dùng gửi lên:
1. **HTML Sanitization:** Khử toàn bộ thẻ `<script>`, `<iframe style="display:none">`, `<frame>`, `<object>`, `<embed>`, `<base>`.
2. **Network Deny-by-Default:** Puppeteer page kích hoạt `protectPageNetwork(page, { mode: 'deny-all', allowDataUris: true })`.
   - Mọi request hướng ra ngoài (kể cả `<img src="http://...">`, `<link href="...">`, `@import`) đều bị ngắt lập tức với mã `'accessdenied'`.
   - Chỉ cho phép `data:image/png;base64,...` hoặc vector nhúng nội dòng.
3. Không thể đọc file cục bộ: Giao thức `file://` bị cấm hoàn toàn.

---

## 5. Chính sách Kích hoạt URL-to-PDF (`ENABLE_URL_TO_PDF`)

Theo khuyến nghị cấu trúc Render:
- Mặc định môi trường: `ENABLE_URL_TO_PDF=false`.
- Endpoint `POST /api/convert/url-to-pdf` trả về mã `403 FEATURE_DISABLED` nếu biến môi trường chưa được bật rõ ràng.
- Chỉ kích hoạt `ENABLE_URL_TO_PDF=true` khi dịch vụ chạy trên dedicated container có network namespace riêng biệt và egress firewall giới hạn ra internet.

---

## 6. Bằng chứng Kiểm thử Tự động (Evidence)

Suite kiểm thử `tests/security/redact-render.test.js` đã chứng minh:
1. `validateSafeUrl` chặn thành công:
   - `http://169.254.169.254/latest/meta-data` (Rejected: dải mạng nội bộ)
   - `http://127.0.0.1:3002/api/health` (Rejected: dải mạng nội bộ)
   - `http://10.0.0.1/admin` (Rejected: dải mạng nội bộ)
   - `http://localhost:8080` (Rejected: forbidden domain)
   - `file:///etc/passwd` (Rejected: không phải HTTP/HTTPS)
   - `gopher://127.0.0.1:6379/_flushall` (Rejected: không phải HTTP/HTTPS)
2. `Feature Flag ENABLE_URL_TO_PDF`: Trả đúng mã lỗi `FEATURE_DISABLED` (403) khi chưa bật.
3. `HTML-to-PDF Isolation`: Render thành công file HTML có nhúng link metadata và iframe, xác nhận 100% request nội bộ bị ngắt và không có dữ liệu nhạy cảm nào bị trích xuất vào PDF.

**Kết luận:** Gate S-06 ĐÃ ĐÓNG HOÀN TOÀN.
