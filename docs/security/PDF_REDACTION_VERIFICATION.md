# PDF Redaction Verification & Content Elimination Report
**Tài liệu Định chuẩn Kỹ thuật An toàn Tài liệu & Quyền Riêng tư (Finding S-04)**  
**Phân hệ:** FileTools Pro Document Processing Engine  
**Trạng thái:** CONFIRMED & RESOLVED (PASS)  
**Ngày kiểm toán:** 23/10/2026  
**Tiêu chuẩn bảo mật:** ISO/IEC 27001:2022 A.8.12, OWASP Top 10 A01:2021, BSI TR-03126  

---

## 1. Bản chất Lỗ hổng & Bối cảnh (Finding S-04)

### 1.1 Cơ chế lỗ hổng che phủ giả (Visual Overlay Fallback)
Trước bản vá bảo mật, hàm `redactPdf` trong `server/services/redact.service.js` cho phép tham số `flatten = false` (thậm chí là giá trị mặc định). Khi `flatten = false`, hệ thống chỉ sử dụng thư viện `pdf-lib` để vẽ các khối chữ nhật màu đen (`page.drawRectangle`) đè lên tọa độ của đoạn văn bản nhạy cảm.

```
+-------------------------------------------------------------------+
| KIẾN TRÚC LỖ HỔNG (VÉC TƠ CHE PHỦ GIẢ - FLATTEN = FALSE):         |
|                                                                   |
|   Lớp trên cùng: [ Khối chữ nhật màu đen (Rectangle Object) ]     |
|                          |                                        |
|   Lớp bên dưới:  [ BT /F1 12 Tf (012345678901 - CCCD) Tj ET ]   |
|                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^     |
|                  NGUYÊN VẸN 100% TRONG CONTENT STREAM             |
+-------------------------------------------------------------------+
```

Người dùng nhìn bằng mắt thường trên màn hình thấy nội dung đã bị che bởi vạch đen. Tuy nhiên:
1. **Copy - Paste:** Bất kỳ ai mở PDF bằng Adobe Acrobat Reader, Google Chrome, Mozilla Firefox hay macOS Preview đều có thể bôi đen xuyên qua hình chữ nhật và sao chép toàn bộ văn bản gốc ra clipboard.
2. **Text Extraction:** Các công cụ tự động như `pdftotext`, `pdf-parse`, `tesseract`, Python `pypdf`, `pdfplumber` dễ dàng trích xuất chính xác 100% các chuỗi CCCD, CMND, số thẻ ngân hàng, số điện thoại, token bí mật.
3. **Deceptive Fallback:** Nguy hiểm hơn, trong khối `try ... catch` của code cũ, nếu tiến trình `flatten` gặp bất kỳ sự cố nào, code tự động `console.warn` và trả về file vector có vạch đen che giả (`flattened: false`), tạo ra ảo giác an toàn giả mạo (Security Theater) dẫn đến rủi ro lộ lọt dữ liệu cấp độ nghiêm trọng (tương tự vụ rò rỉ hồ sơ Paul Manafort / DOJ năm 2018).

---

## 2. Thiết kế Kiến trúc Secure Redaction Mới

Hệ thống đã loại bỏ hoàn toàn cơ chế che phủ vector giả. Secure Redaction hiện tại là cơ chế bắt buộc duy nhất và fail-closed:

```
[ Input PDF ]
      │
      ▼
[ 1. Scan PII / Regex & TSV Coordinates ] 
      │ (Tọa độ CCCD, CMND, SĐT, Email, Custom Keywords)
      ▼
[ 2. AcroForm Flattening & Sanitization ]
      │ (Ép phẳng form fields, ngăn text ẩn trong form dictionary)
      ▼
[ 3. Vector Mask Burn-in ]
      │ (Vẽ khối che mờ + nhãn đóng dấu [REDACTED])
      ▼
[ 4. High-Fidelity Rasterization (pdftoppm / Ghostscript @ 200 DPI) ]
      │ (Chuyển đổi từng trang thành ảnh Bitmap pixel; tiêu hủy triệt để vector content stream)
      ▼
[ 5. Clean PDF Re-Authoring (pdf-lib) ]
      │ (Nhúng ảnh sạch vào trang mới; KHÔNG tồn tại bất kỳ toán tử Text Tj/TJ nào)
      ▼
[ 6. Metadata Deep Scrubbing ]
      │ (Xóa sạch Title, Author, Subject, Keywords, Creator, Producer)
      ▼
[ Output Secure PDF ] (100% Không thể trích xuất văn bản nhạy cảm)
```

### 2.1 Các quy tắc bảo mật cốt lõi
1. **Mặc định Secure-Redact:** Thuộc tính `flatten: true` là cố định.
2. **Cấm triệt để `flatten=false`:** Nếu client cố tình gửi `flatten: false`, endpoint `/api/pdf/redact` lập tức trả mã lỗi `400 INSECURE_REDACTION_DISALLOWED`. Service `redactPdf` lập tức quăng lỗi và từ chối xử lý.
3. **Chính sách Fail-Closed:** Nếu quá trình rasterize ảnh qua Poppler hoặc Ghostscript gặp lỗi, toàn bộ thư mục tạm và file trung gian bị xóa sạch (`fs.rmSync`). Hệ thống throw `SECURE_REDACTION_FAILED`, **TUYỆT ĐỐI KHÔNG** fallback về file vector có vạch đen che mờ.
4. **Tẩy sạch siêu dữ liệu (Metadata Scrubbing):** Tất cả các trường `Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer` đều bị xóa trắng hoặc thay thế bằng định danh máy chủ chuẩn hóa, ngăn rò rỉ tên máy tính, phiên bản phần mềm hoặc danh tính người tạo.

---

## 3. Đánh đổi Kỹ thuật: Độ sắc nét (Visual Quality) vs Khả năng Tìm kiếm (Searchability)

| Tiêu chí | Chế độ Vector Cũ (Đã cấm) | Chế độ Secure Rasterize Mới (Hiện hành) |
| :--- | :--- | :--- |
| **Bảo mật PII** | ❌ **0%** (Rò rỉ toàn bộ text ngầm qua pdftotext/clipboard) | ✅ **100%** (Tiêu hủy hoàn toàn text stream) |
| **Tính khả dụng tìm kiếm (Searchability)** | Cho phép Ctrl+F (kể cả từ đã bị che) | Text layer không còn tồn tại trên các trang đã redact; không thể Ctrl+F |
| **Độ sắc nét hiển thị** | Vô hạn (Vector font) | 200 DPI (Cực kỳ sắc nét, tương đương chất lượng in ấn thương mại) |
| **Dung lượng file** | Rất nhỏ (Vài chục KB) | Tăng nhẹ (khoảng 300KB - 800KB mỗi trang ảnh PNG nén) |
| **Phù hợp pháp lý** | Vi phạm GDPR, Nghị định 13/2023/NĐ-CP | Đạt chuẩn an toàn dữ liệu PII và compliance doanh nghiệp |

> **Khuyến cáo người dùng:** Tài liệu sau khi che giấu thông tin nhạy cảm là tài liệu phát hành công khai / chia sẻ ra bên ngoài. Việc loại bỏ hoàn toàn tính năng copy text là bắt buộc để đảm bảo an toàn tuyệt đối trước mọi kỹ thuật đảo ngược dữ liệu.

---

## 4. Giới hạn & Xử lý Tài liệu Đặc thù

1. **PDF dạng Scan (Image-only PDFs):** Nếu PDF ban đầu chỉ gồm các ảnh scan không có lớp text, chức năng tự động nhận diện regex sẽ không tìm thấy text. Người dùng cần chạy qua module OCR trước hoặc cung cấp tọa độ thủ công (`redactions` array).
2. **Form động XFA:** Các biểu mẫu phức tạp Adobe XFA không hỗ trợ thao tác trực tiếp bằng thư viện mã nguồn mở. Hệ thống tự động kích hoạt `form.flatten()` trên AcroForms tiêu chuẩn.
3. **Nhiều lớp đồ họa chồng lấn (Multi-layer Overlays):** Quá trình rasterize 200 DPI nén toàn bộ các layer và transparency group thành 1 mặt phẳng pixel duy nhất, triệt tiêu mọi khả năng xem nội dung ẩn bên dưới các layer mờ.

---

## 5. Bằng chứng Thực nghiệm & Test Verification

Bộ kiểm thử tự động `tests/security/redact-render.test.js` đã chứng minh:
- **Synthetic Fixture:** Chứa CCCD `012345678901`, Email `secret_director@confidential.gov.vn`, Secret Token `TOP_SECRET_MARKER_998877665544` và Metadata `CONFIDENTIAL_INTERNAL_REPORT`.
- **Sau khi chạy Secure Redaction:**
  - `pdftotext` quét toàn bộ trang: **0 kết quả** khớp với các marker nhạy cảm.
  - Quét chuỗi nhị phân thô (`Buffer.includes`): **0 kết quả** xuất hiện trong raw content stream.
  - Siêu dữ liệu `Title`, `Author`, `Subject`, `Keywords`: **Trống (Clean)**.
  - Gửi request với `flatten: false`: Bị từ chối với mã lỗi `INSECURE_REDACTION_DISALLOWED`.
  - Cố tình cấp file lỗi cấu trúc: Trả về lỗi `SECURE_REDACTION_FAILED` và dọn dẹp sạch file tạm (Fail-closed).

**Kết luận:** Gate S-04 ĐÃ ĐÓNG HOÀN TOÀN. Hệ thống sẵn sàng cho môi trường Production.
