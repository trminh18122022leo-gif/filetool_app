# FileTools Pro — Starter Workflow Templates & Customization Specification
**Document Version:** 1.0.0 (Phase 07 — Durable Workflow Orchestration)  
**Standard:** Parameterized Declarative Pipelines / Zero-Script Safety Guarantee  
**Scope:** Built-in starter templates, custom template creation, and metadata sanitization

---

## 1. Safety & Sanitization Invariants for Templates

Workflow templates allow users to save and reuse recurring multi-step pipelines. To guarantee enterprise safety:

1. **Zero Concrete Identifiers:** Templates store abstract DAG node topologies with port connections. They **never** contain hardcoded `fileId`, `userId`, `cloudKey`, or personal session data.
2. **Zero Executable Code:** Templates define operator names and validated parameter objects (e.g. `{ quality: 'ebook', language: 'vie' }`). No arbitrary JavaScript, shell scripts, or SQL expressions can be stored or executed.
3. **Immutability of System Templates:** Starter templates are hardcoded or seeded with `isBuiltIn: true`. Regular users cannot modify or overwrite system starter templates.
4. **Tenant Isolation for Custom Templates:** User-authored templates are scoped to `authorId: req.user._id`. Users cannot view or fork private templates of other accounts unless explicitly made public by the platform.

---

## 2. Official Starter Template Catalog

### Template 1: Scan Ảnh → OCR → Searchable PDF (`scan-ocr-searchable`)
* **Category:** Số hóa tài liệu & Lưu trữ
* **Mục tiêu:** Chuyển đổi loạt ảnh chụp hóa đơn, tài liệu scan thành một tệp PDF chuẩn trang, có thể tìm kiếm và bôi đen sao chép văn bản.
* **Cấu trúc DAG:**
  ```mermaid
  flowchart LR
      N1["1. Nguồn ảnh (image/*)"] --> N2["2. OCR nhận dạng chữ (Tesseract)"]
      N1 --> N3["3. Tạo trang PDF A4 (pdf-lib)"]
      N2 --> N4["4. Gắn Text Layer tìm kiếm"]
      N3 --> N4
      N4 --> N5["5. Xuất Searchable PDF"]
  ```

### Template 2: Gộp PDF → Watermark → Nén Dung Lượng (`merge-watermark-compress`)
* **Category:** Phân phối văn bản & Bảo mật
* **Mục tiêu:** Ghép nhiều tài liệu hợp đồng, đóng dấu chữ mờ bảo mật bản quyền ("CONFIDENTIAL") và nén file tối ưu dung lượng để gửi email.
* **Cấu trúc DAG:**
  ```mermaid
  flowchart LR
      N1["1. Danh sách PDF đầu vào"] --> N2["2. Gộp trang (merge)"]
      N2 --> N3["3. Đóng dấu Watermark"]
      N3 --> N4["4. Nén tối ưu (ebook 150 DPI)"]
      N4 --> N5["5. Xuất tệp hoàn chỉnh"]
  ```

### Template 3: Ảnh Bộ Sưu Tập → Ghép PDF Album (`images-to-pdf-album`)
* **Category:** Sáng tạo & Media
* **Mục tiêu:** Tập hợp các ảnh thiết kế, ảnh chụp du lịch hoặc tài liệu thành một album PDF chuẩn hóa kích thước, căn chỉnh tỷ lệ và đánh số trang chân trang.
* **Cấu trúc DAG:**
  ```mermaid
  flowchart LR
      N1["1. Nguồn ảnh (JPG, PNG, WebP)"] --> N2["2. Chuẩn hóa tỷ lệ & xoay EXIF"]
      N2 --> N3["3. Ghép vào trang PDF A4"]
      N3 --> N4["4. Đánh số trang tự động"]
      N4 --> N5["5. Xuất Album PDF"]
  ```

### Template 4: PDF Tài Liệu → Trích Xuất Markdown (`pdf-to-markdown-extract`)
* **Category:** Lập trình & Dữ liệu
* **Mục tiêu:** Chuyển đổi báo cáo, tài liệu PDF thành định dạng Markdown chuẩn đẹp, giữ nguyên tiêu đề, danh sách và bảng dữ liệu để tích hợp vào Notion, GitHub hoặc Obsidian.
* **Cấu trúc DAG:**
  ```mermaid
  flowchart LR
      N1["1. PDF đầu vào"] --> N2["2. Trích xuất text stream"]
      N2 --> N3["3. AI phân tích cấu trúc tiêu đề & bảng"]
      N3 --> N4["4. Định dạng Markdown .md"]
      N4 --> N5["5. Tải về file Markdown"]
  ```

---

## 3. Template Data Model (`WorkflowTemplate.js`)

```javascript
const workflowTemplateSchema = new mongoose.Schema({
  templateId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },
  title: {
    type:     String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    enum: ['document', 'archive', 'media', 'data', 'developer'],
    default: 'document',
  },
  icon: {
    type: String,
    default: 'Layers',
  },
  isBuiltIn: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  author: {
    type:  mongoose.Schema.Types.ObjectId,
    ref:   'User',
    index: true,
  },
  dag: {
    version: { type: String, default: 'v1' },
    nodes:   { type: Array, required: true },
    edges:   { type: Array, required: true },
  },
  version: {
    type:    Number,
    default: 1,
  },
}, {
  timestamps: true,
});
```
