#  FileTools Pro

Ứng dụng hỗ trợ edit file.

---

##  Tính năng chính

| Nhóm | Tính năng | Công nghệ |
|------|-----------|-----------|
| **PDF** | Merge, Split, Compress thực tế, Word↔PDF, Extract, Rotate, Watermark, Protect/Unlock, Dark Mode, Auto TOC | Ghostscript, LibreOffice, qpdf, pdf-lib |
| **Ảnh** | Convert (JPG/PNG/WEBP/AVIF/TIFF), Resize, Crop, Filter, Remove Background | Sharp, @imgly, remove.bg |
| **Office** | DOCX↔PDF, XLSX↔PDF, PPTX↔PDF, XLSX↔CSV, PDF↔HTML | LibreOffice Headless, Poppler |
| **OCR** | Nhận diện chữ Tiếng Việt & Tiếng Anh từ ảnh scan / PDF scan, Searchable PDF | Tesseract OCR CLI |
| **AI** | Tóm tắt tài liệu, Dịch thuật đa ngữ, Chat PDF, Chữ viết tay thực tế | Gemini 1.5 Flash/Pro + Claude Sonnet, Puppeteer |
| **Khác** | E-Signature Canvas, QR Code Embed/Generate, Xử lý hàng loạt (Batch Queue), Quản lý API Key | Canvas API, QRCode, p-queue, Socket.io |

---

##  Yêu cầu hệ thống

1. **Node.js**: >= 20.x
2. **Ghostscript**: Dành cho nén PDF thực tế
3. **LibreOffice**: Dành cho chuyển đổi Office sang PDF
4. **Tesseract OCR**: Dành cho nhận dạng văn bản (tiếng Việt `vie`, tiếng Anh `eng`)
5. **qpdf**: Dành cho đặt và gỡ mật khẩu PDF
6. **poppler-utils**: Dành cho PDF sang HTML
