# FileTools Pro — PDF Tool Parity & Action Traceability Matrix
**Document Version:** 1.0.0 (Phase G1.6 — PDF Studio Consolidation)  
**Author:** Document Application Architect + PDF UX Engineer + Integration QA  
**Standard:** ISO 32000-1 (PDF 1.7), PDF/A-2b (ISO 19005-2), WCAG 2.2 Level AA  
**Scope:** Traceability across UI routes, REST API endpoints, underlying engines, formats, and parity status

---

## 1. Executive Parity Assessment

FileTools Pro previously implemented 24+ discrete PDF functions spread across isolated tool pages (`/pdf/merge`, `/pdf/split`, `/pdf/organize`, `/pdf/redact`, `/pdf/sign`, etc.) and a generic tabbed hub (`/pdf`). While the server-side engines (`pdf-lib`, Ghostscript, Poppler, Tesseract) are robust and hardened against security vulnerabilities (G1.1–G1.4), the user experience suffered from:
- **Duplicated File Uploaders:** Each tool required re-uploading the file and re-rendering thumbnails from scratch.
- **Lost Editing Context:** Users could not chain operations (e.g. Delete page 3 → Rotate page 5 → Secure Redact PII → Compress) without downloading and re-uploading intermediary files.
- **False Editing Claims:** The previous UI occasionally implied arbitrary flow-re-layout text editing ("Foxit/Acrobat clone"). FileTools Pro strictly scopes its editing capabilities to **Document Assembly, Annotation Placement, Visual Redaction, Page Geometry Transformation, Form Flattening, and Format Conversion**. Arbitrary WYSIWYG reflow text editing is explicitly classified as **OUT OF SCOPE** to prevent deceptive user expectations.

---

## 2. Exhaustive PDF Action Traceability Matrix

| # | Action Name | Deep-Link URL | REST Endpoint | Underlying Engine | Inputs / MIME | Output Format | Parity Status | Functional Description & Transformation |
|---|---|---|---|---|---|---|:---:|---|
| 1 | **Gộp PDF (Merge)** | `/pdf/merge` | `POST /api/pdf/merge` | `pdf-lib` v1.17.1 | Multiple `application/pdf` (up to 50) | Single `application/pdf` | **WORKING** | Reorders files or individual page slices (`fileIndex`, `pageNum`, `rotation`). Preserves vector objects and outlines. |
| 2 | **Tách PDF (Split)** | `/pdf/split` | `POST /api/pdf/split` | `pdf-lib` | Single `application/pdf` | Multi-file ZIP (`application/zip`) | **WORKING** | Bursts multi-page PDF into discrete 1-page documents or custom range splits. |
| 3 | **Sắp xếp trang (Reorder)** | `/pdf/organize` | `POST /api/pdf/reorder` | `pdf-lib` | Single `application/pdf`, `order` csv | Single `application/pdf` | **WORKING** | Permutes page tree order in-memory without raster re-encoding. |
| 4 | **Xóa trang (Delete)** | `/pdf/delete` | `POST /api/pdf/delete-pages` | `pdf-lib` | Single `application/pdf`, `pages` csv | Single `application/pdf` | **WORKING** | Drops selected page dictionaries from trailer dictionary; cleans orphan objects. |
| 5 | **Ký PDF (Visual Sign)** | `/pdf/sign` | `POST /api/pdf/sign` | `pdf-lib` | `application/pdf` + `image/png` | Single `application/pdf` | **WORKING** | Stamps PNG signature or drawn bezier path onto specified coordinates `(x, y, page)`. Note: Visual signature, not X.509 cryptographic PKI. |
| 6 | **Che PII (Secure Redact)** | `/pdf/redact` | `POST /api/pdf/redact` | Poppler `pdftoppm` + `pdf-lib` + `sharp` | Single `application/pdf` + redaction rects | Single `application/pdf` (rasterized) | **WORKING (GATED)** | Enforces G1.3 finding S-04. Raster-backed content elimination. `flatten=false` is rejected. Metadata scrubbed. |
| 7 | **Quét PII (PII Scan)** | `/pdf/redact` | `POST /api/pdf/redact-scan` | Poppler `pdftotext -tsv` + Regex | Single `application/pdf` | JSON `{ piiMatches, words }` | **WORKING** | Automated bounding-box discovery for CCCD, CMND, Phone, Email, Credit Cards. |
| 8 | **Nén PDF (Compress)** | `/pdf` (tab) | `POST /api/pdf/compress` | Ghostscript (`/ebook`, `/screen`) | Single `application/pdf` | Single `application/pdf` | **WORKING** | Downsamples embedded images to 150 DPI / 72 DPI and re-encodes flate streams. |
| 9 | **Xoay PDF (Rotate)** | `/pdf` (tab) | `POST /api/pdf/rotate` | `pdf-lib` | Single `application/pdf`, `angle` | Single `application/pdf` | **WORKING** | Modifies `/Rotate` property in Page catalog ($90^\circ, 180^\circ, 270^\circ$). Zero re-compression loss. |
| 10 | **Cắt PDF (Crop)** | `/pdf` (tab) | `POST /api/pdf/crop` | `pdf-lib` | Single `application/pdf`, `(x,y,w,h)` | Single `application/pdf` | **WORKING** | Modifies `/CropBox` and `/MediaBox` coordinates. Vector content outside crop box is clipped. |
| 11 | **Watermark** | `/pdf` (tab) | `POST /api/pdf/watermark` | `pdf-lib` (StandardFonts) | Single `application/pdf`, text, opacity | Single `application/pdf` | **WORKING** | Draws diagonal semi-transparent vector text across each page layer. |
| 12 | **Khóa mật khẩu (Protect)** | `/pdf` (tab) | `POST /api/pdf/protect` | `pdf-lib` / Ghostscript | Single `application/pdf`, passwords | Single `application/pdf` (AES-128/256) | **WORKING** | Encrypts document with user password (read) and owner password (permissions). |
| 13 | **Mở khóa (Unlock)** | `/pdf` (tab) | `POST /api/pdf/unlock` | `pdf-lib` / Ghostscript | Encrypted PDF, password string | Single `application/pdf` (unencrypted) | **WORKING** | Decrypts document stream when valid password is supplied. |
| 14 | **Đánh số trang (Page Nums)** | `/pdf` (tab) | `POST /api/pdf/page-numbers` | `pdf-lib` | Single `application/pdf`, format | Single `application/pdf` | **WORKING** | Appends page number footer/header string with dynamic alignment. |
| 15 | **Header / Footer** | `/pdf` (tab) | `POST /api/pdf/header-footer` | `pdf-lib` | Single `application/pdf`, strings | Single `application/pdf` | **WORKING** | Renders running headers and footers with custom font size and color. |
| 16 | **Flatten PDF** | `/pdf` (tab) | `POST /api/pdf/flatten` | `pdf-lib` | Single `application/pdf` | Single `application/pdf` | **WORKING** | Flattens AcroForm interactive form fields into static page content streams. |
| 17 | **Chuẩn PDF/A (Archival)** | `/pdf` (tab) | `POST /api/pdf/to-pdfa` | Ghostscript (`pdfwrite` PDFA) | Single `application/pdf`, level | Single `application/pdf` (PDF/A-2b) | **WORKING** | Embeds device-independent color profiles (sRGB ICC) and XMP metadata conforming to ISO 19005-2. |
| 18 | **Sửa lỗi PDF (Repair)** | `/pdf` (tab) | `POST /api/pdf/repair` | Ghostscript / `pdf-lib` | Malformed `application/pdf` | Single `application/pdf` | **WORKING** | Rebuilds corrupted XRef cross-reference tables and regenerates trailer dictionaries. |
| 19 | **PDF → Markdown** | `/pdf` (tab) | `POST /api/pdf/to-markdown` | `pdf-parse` + Gemini AI | Single `application/pdf` | Markdown file (`.md`) | **WORKING** | Extracts raw text stream and synthesizes semantic Markdown headings, tables, and lists. |
| 20 | **Scan Ảnh → PDF** | `/pdf` (tab) | `POST /api/pdf/scan-to-pdf` | `sharp` + `pdf-lib` | Multiple `image/*` | Single `application/pdf` | **WORKING** | Normalizes contrast, sharpens document contours, centers on A4/Letter page. |
| 21 | **So sánh PDF (Diff)** | `/pdf` (tab) | `POST /api/pdf/compare-text` | `pdf-parse` + diff engine | 2 `application/pdf` files | PDF diff report or JSON | **WORKING** | Performs Myers diff algorithm on extracted text tokens and highlights changes. |
| 22 | **HTML → PDF** | `/pdf` (tab) | `POST /api/pdf/html-to-pdf` | Puppeteer / Chromium | HTML file or raw HTML string | Single `application/pdf` | **WORKING (GATED)** | Enforces G1.3 SSRF guard: Deny-all private IP, link-local, and cloud metadata access. |
| 23 | **PDF → Excel** | `/pdf` (tab) | `POST /api/pdf/to-excel` | Poppler / `pdf-parse` + XLSX | Single `application/pdf` | Spreadsheet (`.xlsx`) | **PARTIAL** | Table boundary heuristic succeeds on grid tables; complex nested tables require OCR verification. |
| 24 | **PDF → PowerPoint** | `/pdf` (tab) | `POST /api/pdf/to-pptx` | Poppler `pdftoppm` + PPTXGenJS | Single `application/pdf` | Presentation (`.pptx`) | **WORKING** | Rasterizes each page at specified DPI ($150\text{DPI}$) as individual full-bleed presentation slides. |
| 25 | **PDF → Word** | `/pdf` (tab) | `POST /api/pdf/to-word` | LibreOffice (`soffice`) | Single `application/pdf` | Word Document (`.docx`) | **WORKING** | Invokes LibreOffice headless converter. Layout fidelity dependent on PDF complexity. |
| 26 | **Word → PDF** | `/pdf` (tab) | `POST /api/pdf/from-word` | LibreOffice (`soffice`) | Word Document (`.docx, .doc`) | Single `application/pdf` | **WORKING** | Invokes LibreOffice headless converter. High layout fidelity. |
| 27 | **Chèn thêm trang (Insert)** | `/pdf` (tab) | `POST /api/pdf/insert-pages` | `pdf-lib` | 2 `application/pdf` files | Single `application/pdf` | **WORKING** | Slices pages from secondary document and splices after target page index. |
| 28 | **Dark Mode PDF** | `/pdf` (tab) | `POST /api/pdf/dark-mode` | Poppler + Invert filter | Single `application/pdf` | Single `application/pdf` | **WORKING** | Inverts luminosity curves for night reading while preserving image hues. |
| 29 | **Tạo Mục Lục (Auto TOC)** | `/pdf` (tab) | `POST /api/pdf/auto-toc` | Poppler + `pdf-lib` + AI | Single `application/pdf` | Single `application/pdf` with TOC | **WORKING** | Scans heading fonts, generates Table of Contents page with clickable internal page links. |
| 30 | **Thống kê (Doc Stats)** | `/pdf` (tab) | `POST /api/pdf/stats` | `pdf-parse` | Single `application/pdf` | JSON metadata & stats | **WORKING** | Counts words, characters, pages, author, creator, and embedded font inventory. |

---

## 3. Discontinued / Consolidated Duplicate Stubs

1. **`PdfDeleteTool.jsx` & `PdfOrganizeTool.jsx`:**
   - *Status:* Consolidated into **PDF Studio Workbench**. Both operations are now native gestures on the Studio Thumbnail Rail (drag to reorder, trash button to delete).
   - *Deep Link Strategy:* `/pdf/delete` and `/pdf/organize` redirect to `/pdf` with active action tab presets (`action=delete` / `action=reorder`), preserving SEO titles and metadata.
2. **`PdfMergeTool.jsx`:**
   - *Status:* Preserved as an entry point. Seamlessly launches PDF Studio with multi-file dropzone and visual merge rail.
3. **`PdfSplitTool.jsx`:**
   - *Status:* Preserved as an entry point. Launches PDF Studio in Split mode with thumbnail range selector.
4. **`PdfSignTool.jsx`:**
   - *Status:* Preserved as an entry point. Launches PDF Studio in Sign mode with interactive signature placement pad.
5. **`PdfRedactTool.jsx`:**
   - *Status:* Preserved as an entry point. Launches PDF Studio in Redact mode with Poppler PII detection and verified raster redaction.

---

## 4. Honest Scope Boundary & "Foxit-Level" Editing Policy

> [!IMPORTANT]
> **Strict Non-Deceptive Policy:** FileTools Pro does **NOT** provide arbitrary flow-reflow structural text editing (where clicking a word reflows paragraphs, changes kerning, or modifies font subset metrics across pages like Foxit PhantomPDF or Adobe Acrobat Pro).
> 
> FileTools Pro provides:
> 1. Full Document Assembly (Merge, Split, Extract, Reorder, Delete, Insert).
> 2. Full Page Geometry Transformation (Rotate, Crop, Scale, Dark Mode, Flatten).
> 3. Visual & Text Layer Overlay (Signatures, Watermarks, Header/Footer, Page Numbers).
> 4. Secure PII Redaction & Metadata Elimination (Poppler-verified raster content removal).
> 5. Format Translation & Archival Conversion (PDF/A, Markdown, Word, Excel, PPTX).
> 
> Any marketing or UI text claiming "Sửa văn bản như Word/Foxit" is removed to uphold technical integrity.
