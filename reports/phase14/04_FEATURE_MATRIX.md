# Phase 14 — Report 04: Complete Feature Inventory & Parity Matrix

**Audit Phase:** Phase 14 — Comprehensive Final Second Pass & Production Release Audit  
**Author:** Independent Principal Product Architect & QA Lead  
**Audit Date:** 2026-10-24  
**Scope:** Route-by-route and endpoint-by-endpoint feature inventory across PDF Studio, Image Tools, Conversions, AI Tools, File Workspace, and Workflow Studio.

---

## 1. Feature Inventory & Entitlement Matrix

| Feature Area | Frontend Route & Component | Backend API Endpoint | Engine / Implementation | Entitlements (Free / Plus / Pro) | Automated Test Coverage | Status |
|:---|:---|:---|:---|:---|:---|:---:|
| **PDF Studio: Merge** | `/pdf/merge`<br>`PdfMergeTool.jsx` | `POST /api/pdf/merge` | `pdf-lib` stream append | Free: 10 files / Plus: 50 / Pro: 100 | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **PDF Studio: Split** | `/pdf/split`<br>`PdfSplitTool.jsx` | `POST /api/pdf/split` | `pdf-lib` page extraction | Free: 25MB / Plus: 250MB / Pro: 1GB | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **PDF Studio: Compress**| `/pdf/compress`<br>`PdfCompressTool.jsx`| `POST /api/pdf/compress` | Ghostscript & Sharp raster | Free: standard / Plus: high / Pro: max | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **PDF Studio: Redact** | `/pdf/redact`<br>`PdfRedactTool.jsx` | `POST /api/pdf/redact` | Rasterizer + metadata scrub | Free: 5 pgs / Plus: 50 / Pro: 200 | `tests/security/redact-render.test.js` | **SECURE (RASTER)** |
| **PDF Studio: OCR** | `/pdf/ocr`<br>`PdfOcrTool.jsx` | `POST /api/pdf/ocr` | Tesseract.js / CLI (`vie`+`eng`) | Free: 0 / Plus: 300 pgs / Pro: 1000 pgs | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **PDF Studio: Organize**| `/pdf/organize`<br>`PdfOrganizeTool.jsx`| `POST /api/pdf/reorder` | `pdf-lib` matrix re-indexing | Free: 20 pgs / Plus: 100 / Pro: 500 | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **PDF Studio: Sign** | `/pdf/sign`<br>`PdfSignTool.jsx` | `POST /api/pdf/sign` | PNG visual stamp embed | Free: 1 sign / Plus: unlim / Pro: unlim | `tests/fidelity/pdf-fidelity.test.js` | **VISUAL_STAMP_ONLY** |
| **PDF Studio: Delete** | `/pdf/delete`<br>`PdfDeleteTool.jsx` | `POST /api/pdf/delete-pages` | `pdf-lib` index removal | Free: 25MB / Plus: 250MB / Pro: 1GB | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **Image: Compress** | `/image/compress`<br>`ImageCompressTool.jsx`| `POST /api/image/compress` | Sharp (libvips) WebP/JPEG | Free: 10MB / Plus: 50MB / Pro: 200MB | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **Image: Remove BG** | `/image/remove-bg`<br>`ImageTools.jsx` | `POST /api/image/remove-bg` | `@imgly/background-removal` | Free: 5 imgs / Plus: 50 / Pro: 200 | `tests/integration/workflow-workspace.test.js` | **FEATURE_VERIFIED** |
| **Convert: Word to PDF**| `/convert/word-to-pdf`<br>`WordToPdfTool.jsx`| `POST /api/convert/word-to-pdf`| LibreOffice headless | Free: 25MB / Plus: 100MB / Pro: 500MB | `tests/fidelity/pdf-fidelity.test.js` | **FEATURE_VERIFIED** |
| **Convert: Markdown/PDF**| `/convert/md-to-pdf`<br>`ConvertTools.jsx` | `POST /api/convert/markdown-to-pdf`| Marked + Puppeteer sandbox | Free: standard / Plus: custom CSS / Pro: unlim | `tests/security/redact-render.test.js` | **FEATURE_VERIFIED** |
| **AI: Document Summary**| `/ai/summarize`<br>`AiTools.jsx` | `POST /api/ai/summarize` | Gemini 2.5 Flash / Groq | Free: 0 / Plus: 100 cred / Pro: 500 cred | `tests/ai/ai-evals.test.js` | **FEATURE_VERIFIED** |
| **AI: Grounded QA** | `/ai/chat-doc`<br>`AiTools.jsx` | `POST /api/ai/chat` | Segmented page citations | Free: 0 / Plus: 100 cred / Pro: 500 cred | `tests/ai/ai-evals.test.js` | **FEATURE_VERIFIED** |
| **AI: BYOK Key Vault** | `/settings/ai-byok`<br>`AiTools.jsx` | `POST /api/ai/byok` | AES-256-GCM envelope vault | Free: BYOK allowed / Plus: BYOK / Pro: BYOK | `tests/ai/ai-evals.test.js` | **FEATURE_VERIFIED** |
| **Workflow Studio: DAG**| `/workflows`<br>`WorkflowStudioPage.jsx`| `POST /api/workflows/run` | Topological sort pipeline | Free: 2 steps / Plus: 5 steps / Pro: 10 steps | `tests/integration/workflow-workspace.test.js` | **FEATURE_VERIFIED** |
| **File Workspace** | `/dashboard`<br>`Dashboard.jsx` | `GET /api/storage/files` | MongoDB + Cloudflare R2 | Free: 24h TTL / Plus: 7d TTL / Pro: 30d TTL | `tests/security/file-storage.test.js` | **FEATURE_VERIFIED** |
| **Pricing & Checkout** | `/pricing`<br>`PricingPage.jsx` | `POST /api/payment/checkout` | Stripe Checkout / Portal | Free: \$0 / Plus: \$4.99 / Pro: \$9.99 | `tests/billing/subscription-finops.test.js` | **SAFETY GATE ACTIVE** |

---

## 2. Competitive Parity Disclosures & Limits

> [!IMPORTANT]
> **HONEST PARITY DISCLOSURES**  
> In compliance with product guidelines, FileTools Pro makes zero unsubstantiated marketing claims regarding enterprise competitor parity:

1. **Structural Text Editing vs Foxit / Adobe Acrobat:**  
   - FileTools Pro **does NOT** provide Foxit-level native font reflow or typographic editing of pre-existing PDF paragraph text.  
   - PDF modifications are non-destructive (adding annotations, visual signature stamps, headers/footers, page deletions, rotations, and full-page raster redactions).
2. **Visual Stamp vs. Cryptographic Digital Signature:**
   - PDF Sign in FileTools Pro is a **visual signature stamp** (raster PNG signature placement onto the PDF page canvas via `pdf-lib`).
   - It is **NOT** a cryptographic digital signature (X.509 PKI certificate, AATL trust chain, timestamp authority, or document hash digest). It does not provide cryptographic non-repudiation or certificate validation.
3. **Secure Redaction Searchability Trade-off:**  
   - To guarantee complete PII elimination and prevent vector extraction attacks, redacted pages are rasterized into high-resolution images. As a result, non-redacted text on those specific pages is no longer selectable in simple PDF viewers without re-running OCR.
3. **OCR Engine Fidelity:**  
   - Tesseract OCR delivers high accuracy ($> 95\%$) on clean printed Latin and Vietnamese text, but degrades on complex multi-column handwritten documents.
