# Document Processing Fidelity & Conversion Matrix
**Tài liệu Định chuẩn Chất lượng Xử lý Tài liệu & Kiểm tra Độ trung thực (QA Lead Specification)**  
**Phân hệ:** PDF, Office, OCR & Typography Pipelines  
**Trạng thái:** ACTIVE QUALITY SPECIFICATION  
**Ngày cập nhật:** 23/10/2026  

---

## 1. Ma trận Chuyển đổi & Động cơ Xử lý (Conversion Matrix)

| Chiều chuyển đổi | Động cơ chính (Primary) | Động cơ dự phòng (Fallback) | Chuẩn chất lượng & Tiêu chí đo lường |
| :--- | :--- | :--- | :--- |
| **PDF ➔ Images (PNG/JPG)** | Poppler `pdftoppm` (`-png`, `-jpeg`) | Ghostscript (`gswin64c` / `gs`) | 150 - 300 DPI; không vỡ font; đúng tỷ lệ kích thước trang |
| **PDF ➔ Word (DOCX)** | LibreOffice Writer headless | pdf-parse + Mammoth / text-extract | Giữ cấu trúc đoạn văn, phân tách bảng, font tiếng Việt |
| **Word (DOCX) ➔ PDF** | LibreOffice Writer headless | N/A (Fail-Closed) | Giữ nguyên ngắt trang (pagination), header/footer, bảng biểu |
| **PDF ➔ Excel (XLSX)** | Poppler TSV + `xlsx` engine | Regex table parser | Khớp đúng cột số liệu, không lệch dòng, encoding UTF-8 |
| **PDF ➔ PowerPoint (PPTX)** | `pdftoppm` 150 DPI + `pptxgenjs` | Ghostscript + `pptxgenjs` | Tỷ lệ 16:9 / 4:3; ảnh slide sắc nét; đúng thứ tự trang |
| **PDF ➔ Markdown** | `pdf-parse` + heading heuristic | Tesseract OCR (`vie` + `eng`) | Trích xuất đề mục `#`, `##`, danh sách gạch đầu dòng |
| **Ảnh Scan ➔ PDF (Searchable)** | Tesseract OCR (`vie+eng`) | `pdf-lib` image embedder | Nhúng lớp text ẩn phía sau ảnh scan; cho phép bôi đen copy |
| **HTML ➔ PDF** | Headless Chromium (`withPage`) | N/A | Chế độ cách ly mạng `deny-all`; giữ nguyên CSS styling |
| **Markdown ➔ PDF** | `marked` + GitHub/Dark Theme + Chromium | N/A | Khử thẻ script/iframe; căn lề chuẩn A4 15mm |

---

## 2. Tiêu chuẩn Typography & Hỗ trợ Đa ngôn ngữ (Font Matrix)

### 2.1 Tiếng Việt (Vietnamese Chữ Quốc Ngữ)
- **Vấn đề kiểm định:** Tránh lỗi hiển thị ô vuông (tofu) hoặc mất dấu thanh tiếng Việt (sắc, huyền, hỏi, ngã, nặng) khi render trên môi trường Linux/Docker.
- **Gói font bắt buộc (Dockerfile):**
  - `fonts-liberation`: Thay thế chuẩn metric cho Times New Roman, Arial, Courier New.
  - `fonts-noto`: Bộ font toàn diện từ Google hỗ trợ đầy đủ các dải Unicode tiếng Việt.
  - `fonts-dejavu-core`: Đảm bảo ký tự toán học và Latin mở rộng.
- **Quy tắc render:** Luôn khai báo `charset="UTF-8"` và ưu tiên fallback font hệ thống:  
  `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Liberation Sans", Arial, sans-serif;`

### 2.2 Tiếng Đông Á (CJK - Chinese, Japanese, Korean)
- **Gói font bắt buộc:** `fonts-noto-cjk` (Noto Sans CJK SC/TC/JP/KR).
- Đảm bảo tài liệu chứa tiếng Trung, Nhật, Hàn không bị rơi chữ hoặc giãn dòng bất thường.

---

## 3. Kiểm định Ngắt trang & Độ dịch chuyển Bố cục (Layout Shift & Pagination)

| Tác vụ | Ngưỡng sai lệch cho phép (Tolerance) | Phương pháp kiểm tra |
| :--- | :--- | :--- |
| **Word ➔ PDF** | Sai lệch ngắt trang $\le 0$ trang (trùng khớp 100%) | Đếm `doc.getPageCount()` so với số trang gốc trong DOCX |
| **Merge / Split PDF** | 0% mất dữ liệu trang | Đối chiếu tổng số trang sau gộp: $\sum \text{pages}_{\text{input}} = \text{pages}_{\text{output}}$ |
| **Compress PDF** | Giảm $\ge 30\%$ dung lượng (chế độ ebook/screen); không méo chữ | Kiểm tra tỷ lệ nén và đọc kiểm tra text layer sau nén |
| **Rotate / Crop PDF** | Dung sai toạ độ $\le 1$ pt | Kiểm tra MediaBox và CropBox bằng Poppler `pdfinfo` |
| **Secure Redact** | Khối chữ nhật che phủ vượt biên độ chữ 2-4 pt (safe padding) | Kiểm tra trực quan và xác nhận $0$ ký tự rò rỉ |

---

## 4. An toàn Thực thi Tiến trình con (Subprocess Safety)

Toàn bộ các tác vụ gọi công cụ nhị phân bên dưới (`gs`, `soffice`, `pdftoppm`, `tesseract`, `ffmpeg`, `qpdf`) tuân thủ nghiêm ngặt:
1. **Không sử dụng shell:** Tuyệt đối dùng `execFileSync`, `execFile`, hoặc `spawn` với danh sách tham số mảng (`args: string[]`).
2. **Cờ `windowsHide: true`:** Ẩn toàn bộ cửa sổ command prompt trên môi trường Windows native.
3. **Giới hạn thời gian (Timeout):** Mỗi tiến trình con có timeout từ 30 - 120 giây ngăn chặn process treo chiếm dụng tài nguyên CPU.
4. **Buffer giới hạn:** `maxBuffer: 20 * 1024 * 1024` (20MB) ngăn tràn bộ nhớ Node.js.
