# Runtime Capability & Binary Verification Report
**Tài liệu Kiểm định Khả năng Thực thi & Công cụ Nhị phân Hệ thống (QA Lead & Infrastructure Audit)**  
**Dự án:** FileTools Pro  
**Môi trường xác minh:** Windows Native (Node v24.18.0) & Production Container (Debian Bookworm)  
**Trạng thái:** VERIFIED & OPERATIONAL (PASS)  
**Ngày kiểm toán:** 23/10/2026  

---

## 1. Bảng Tổng hợp Công cụ Nhị phân Hệ thống (Binary Manifest)

| Công cụ | Phiên bản thực tế | Đường dẫn phát hiện (Windows Host) | Đường dẫn Container (Debian) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Ghostscript** | 10.07.1 (2026-05-19) | `gswin64c` / `C:\Program Files\gs\...` | `/usr/bin/gs` | ✅ OPERATIONAL |
| **Poppler utils** | 26.02.0 | `pdftoppm`, `pdftotext`, `pdfinfo` | `/usr/bin/pdftoppm` | ✅ OPERATIONAL |
| **LibreOffice** | 26.x+ Headless | `C:\Program Files\LibreOffice\program\soffice.exe` | `/usr/bin/soffice` | ✅ OPERATIONAL |
| **Tesseract OCR** | 5.x+ (`vie` + `eng`) | `C:\Program Files\Tesseract-OCR\tesseract.exe` | `/usr/bin/tesseract` | ✅ OPERATIONAL |
| **FFmpeg / FFprobe**| 9.0.1-full_build | `ffmpeg.exe` / `ffprobe.exe` (System PATH) | `/usr/bin/ffmpeg` | ✅ OPERATIONAL |
| **Chromium** | 134.x+ Headless | Bundled Puppeteer / System PATH | `/usr/bin/chromium` | ✅ OPERATIONAL |

---

## 2. Kết quả Thực nghiệm & Kiểm định Năng lực (Runtime Verifications)

### 2.1 Ghostscript Verification
- **Lệnh kiểm tra:** `gswin64c -v`
- **Output xác thực:** `GPL Ghostscript 10.07.1 (2026-05-19) Copyright (C) 2026 Artifex Software, Inc.`
- **Cờ an toàn bắt buộc:** `-dSAFER -dBATCH -dNOPAUSE -dQUIET` (Ngăn chặn Ghostscript PostScript file inclusion).

### 2.2 Poppler pdftoppm Verification
- **Lệnh kiểm tra:** `pdftoppm -v`
- **Output xác thực:** `pdftoppm version 26.02.0 Copyright 2005-2026 The Poppler Developers`
- **Năng lực kiểm định:**
  - Trích xuất ảnh PNG/JPEG từ PDF đạt chuẩn 150 - 300 DPI.
  - Trích xuất toạ độ từng từ và dòng qua `pdftotext -tsv` phục vụ nhận diện PII.

### 2.3 LibreOffice Headless Verification
- **Lệnh kiểm tra:** `soffice --version`
- **Năng lực kiểm định:**
  - Chuyển đổi hai chiều Word `.docx` ⇄ PDF.
  - Phân tích và giữ nguyên bố cục bảng tính, font chữ tiếng Việt không bị lỗi thanh điệu.

### 2.4 FFmpeg & FFprobe Verification
- **Lệnh kiểm tra:** `ffmpeg -version` và `ffprobe -version`
- **Output xác thực:** `ffmpeg version 9.0.1-full_build-www.gyan.dev built with gcc 16.1.0`
- **Năng lực kiểm định:**
  - Hỗ trợ giải mã/mã hóa video H.264/AVC, H.265/HEVC, AV1, VP9.
  - Hỗ trợ xử lý audio WAV, MP3, AAC, FLAC cho phân hệ TTS, Audio Enhancement và Stem Splitting.

### 2.5 Sandboxed Chromium (Puppeteer) Verification
- **Cấu hình kiểm tra:** `server/utils/browser.js` & `server/utils/ssrfGuard.js`
- **Năng lực kiểm định:**
  - Khởi tạo trình duyệt singleton không leak memory.
  - Cơ chế tự động hồi phục khi tab crash (`browser.on('disconnected')`).
  - Request Interception chặn thành công 100% request SSRF tới loopback, private IPs và cloud metadata.

---

## 3. Tổng kết Suite Kiểm thử Tự động (Automated Test Pass Rates)

| Test Suite | Đường dẫn file kiểm thử | Số lượng bài test | Kết quả | Thời gian thực thi |
| :--- | :--- | :--- | :--- | :--- |
| **P0 Auth & Access Control** | `tests/security/auth-access.test.js` | 18 tests | ✅ **18/18 PASS** | ~2.8s |
| **File Storage & Lifecycle** | `tests/security/file-storage.test.js` | 18 tests | ✅ **18/18 PASS** | ~4.1s |
| **Redaction & Renderer SSRF** | `tests/security/redact-render.test.js`| 10 tests | ✅ **10/10 PASS** | ~3.4s |
| **TỔNG HỢP TOÀN HỆ THỐNG** | `npm run test:security` | **46 tests** | ✅ **46/46 PASS (100%)** | **~13.9s** |
| **Kiểm tra Cú pháp Backend** | `npm test` (`verify-syntax.cjs`) | 76 files | ✅ **76/76 PASS (0 errors)** | ~0.5s |

---

## 4. Quyết định Cổng Chất lượng (Quality Gate Decision)

- **Gate S-04 (PDF Redaction Security):** **PASS**
- **Gate S-06 (Renderer & SSRF Isolation):** **PASS**
- **Subprocess & Binary Execution Security:** **PASS**
- **Phê duyệt tiếp theo:** Bàn giao sang Phase kế tiếp cho hệ thống Worker / Queue / BullMQ hoặc hoàn thiện UI/UX.
