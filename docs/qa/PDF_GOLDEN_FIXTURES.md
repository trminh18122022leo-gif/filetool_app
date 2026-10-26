# FileTools Pro — PDF Golden Fixtures & Fidelity Test Matrix
**Document Version:** 1.0.0 (Phase G1.6 — PDF Studio Consolidation)  
**Standard:** ISO 32000-1 Compliance / Unicode 15.1 / Memory Bounded Benchmarking  
**Execution:** Automated Integration Test Suite (`tests/fidelity/pdf-fidelity.test.js`)

---

## 1. Golden Fixture Catalog

The test suite evaluates real, synthesized PDF fixtures representing common enterprise edge cases:

| Fixture ID | File Name | Characteristics | Key Stress Dimension | Expected Outcome |
|---|---|---|---|---|
| **FIX-01** | `vietnamese_diacritics.pdf` | Unicode UTF-8 with full tone marks (*Hỏi, Ngã, Nặng, Sắc, Huyền*), compound diacritics (*ệ, ợ, ứ, ẫ*) | Embedded font subsetting & text extraction | 100% exact text extraction match via `pdf-parse` without mojibake or lost tone marks. |
| **FIX-02** | `cjk_multilingual.pdf` | Japanese (Hiragana/Katakana/Kanji), Simplified Chinese, Korean (Hangul) | CMap font tables & multi-byte character encoding | CJK glyphs preserved; search and text extraction return valid Unicode code points. |
| **FIX-03** | `mixed_geometry.pdf` | Page 1: A4 Portrait ($595 \times 842\text{pt}$)<br>Page 2: A3 Landscape ($1191 \times 842\text{pt}$)<br>Page 3: US Letter ($612 \times 792\text{pt}$) | Page boundary metrics (`/MediaBox`, `/CropBox`) | Merge and reorder operations preserve individual page dimensions without forced cropping. |
| **FIX-04** | `rotated_pages.pdf` | 4 pages with alternating rotation attributes ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) | Coordinate transformation matrix & rotation metadata | `getPage().getRotation().angle` matches intended orientation post-assembly. |
| **FIX-05** | `encrypted_sample.pdf` | PDF encrypted with Standard Security Handler (Password: `SecretPass123`) | Detection of encrypted streams & password authentication | Throws authorization error without password; successfully decrypts and renders with valid password. |
| **FIX-06** | `scanned_image_only.pdf` | Single full-page JPEG scan with zero vector text streams | OCR text detection guard | `pdf-parse` returns empty text; system accurately routes to OCR extraction without crashing. |
| **FIX-07** | `synthetic_300page.pdf` | 300-page synthetic document with headers, page numbers, and varied text density | Memory footprint, garbage collection, thread blocking | Complete document assembly completes in $< 2000\text{ms}$; Node heap memory increase is bounded $< 120\text{MB}$. |

---

## 2. Automated Fidelity Test Verification

The test suite is executable via:
```bash
npm run test:fidelity
# or as part of full verification:
npm run test:all
```

### Verification Criteria:
1. **Vietnamese Text Integrity:**
   ```javascript
   const sample = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM — Độc lập - Tự do - Hạnh phúc';
   assert.ok(extractedText.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
   ```
2. **CJK Multilingual Integrity:**
   ```javascript
   const cjkSample = 'ファイル・ツール・プロ / 办公文档处理 / 파일 도구';
   assert.ok(extractedText.includes('ファイル'));
   assert.ok(extractedText.includes('办公文档处理'));
   ```
3. **300-Page Heap Consumption:**
   ```javascript
   const memBefore = process.memoryUsage().heapUsed;
   // Generate and load 300 pages
   const memAfter = process.memoryUsage().heapUsed;
   const diffMB = (memAfter - memBefore) / 1024 / 1024;
   assert.ok(diffMB < 120, `Heap growth must be < 120MB, measured: ${diffMB.toFixed(2)}MB`);
   ```
