# ROUTES & FEATURES INVENTORY MATRIX
**Document ID:** `AUDIT-ROUTES-FEATURES-2026-10-23`  
**Classification States:**
* `declared`: Endpoint/route registered in code router.
* `reachable`: Accessible from client UI or valid HTTP request.
* `functional-by-test`: Validated with real end-to-end execution.
* `stub`: Route returns mocked, static, or placeholder response.
* `broken`: Fails due to missing dependency, crash, or logic flaw.
* `not-tested`: Declared and reachable, but lacks automated test coverage.

---

## 1. Frontend Page Routes Inventory (`client/src/App.jsx`)

| Route Path | Component File | Category | Status | Primary Action & Notes |
| :--- | :--- | :--- | :---: | :--- |
| `/` | `pages/Home.jsx` | Landing | `reachable` | Hero, quick tool launcher, background animation. |
| `/pdf` | `pages/PdfTools.jsx` | PDF | `reachable` | Comprehensive PDF hub (compress, convert, watermark). |
| `/pdf/merge` | `pages/PdfMergeTool.jsx` | PDF | `functional-by-test` | PDF merge with page reorder and rotation. |
| `/pdf/split` | `pages/PdfSplitTool.jsx` | PDF | `reachable` | PDF split by range, even/odd, single pages. |
| `/pdf/sign` | `pages/PdfSignTool.jsx` | PDF | `reachable` | Canvas digital signature placement on PDF pages. |
| `/pdf/delete` | `pages/PdfDeleteTool.jsx` | PDF | `reachable` | Delete specific pages from PDF. |
| `/pdf/organize` | `pages/PdfOrganizeTool.jsx` | PDF | `reachable` | Visual thumbnail drag-and-drop page reorganizer. |
| `/pdf/redact` | `pages/PdfRedactTool.jsx` | PDF | `functional-by-test` | PII search (CCCD, phone, email) & blackout blocks. |
| `/image` | `pages/ImageTools.jsx` | Image | `reachable` | Compress, resize, convert, removebg, inpaint. |
| `/convert` | `pages/ConvertTools.jsx` | Convert | `functional-by-test` | Image→PDF, PDF→Image ZIP, URL→PDF, MD→PDF. |
| `/creative` | `pages/CreativeTools.jsx` | Studio | `reachable` | BotocIT Studio, viral clipper, watermark inpaint. |
| `/office` | `pages/OfficeTools.jsx` | Office | `reachable` | Word→PDF, PDF→Word, Excel, PPTX. (Requires LibreOffice). |
| `/ai` | `pages/AiTools.jsx` | AI | `reachable` | AI chat, document summarize, vision analysis. |
| `/editor` | `pages/AdvancedEditor.jsx` | Editor | `reachable` | Monaco code editor, markdown, data tables, collab. |
| `/ocr` | `pages/OcrTools.jsx` | OCR | `functional-by-test` | Image OCR, PDF Scan OCR, Searchable PDF creation. |
| `/archive` | `pages/ArchiveTools.jsx` | Archive | `reachable` | ZIP/TAR/GZ compression and extraction. |
| `/qr` | `pages/QrTools.jsx` | Utility | `reachable` | QR code generation with logo & barcode scanner. |
| `/signature` | `pages/SignaturePage.jsx` | Utility | `reachable` | Dedicated signature pad and export. |
| `/batch` | `pages/BatchTools.jsx` | Batch | `broken` | Multi-file processor (S-10 in-memory queue crash risk). |
| `/speech` | `pages/SpeechToText.jsx` | Audio | `reachable` | Audio transcribe with Groq/Whisper. |
| `/video-translate` | `pages/VideoTranslate.jsx` | Video/AI | `broken` | Video subtitle translation & Edge-TTS dubbing (S-08, timeout). |
| `/video` | `pages/VideoTools.jsx` | Video | `broken` | Trim, merge, compress, convert, delogo (S-13 missing in Docker). |
| `/login` | `pages/Login.jsx` | Auth | `reachable` | Email/password, Telegram, Google, GitHub OAuth. |
| `/register` | `pages/Register.jsx` | Auth | `reachable` | Account registration with password hashing. |
| `/dashboard` | `pages/Dashboard.jsx` | Account | `reachable` | User profile, recent files, quota view (S-20 false PRO badge). |
| `/api-docs` | `pages/ApiDocs.jsx` | Developer | `reachable` | Swagger-like API documentation. |
| `/forgot-password` | `pages/ForgotPassword.jsx` | Auth | `broken` | Calls `/api/auth/forgot-password` via relative path (S-09 fails on Vercel). |
| `/reset-password` | `pages/ResetPassword.jsx` | Auth | `reachable` | Password reset with token validation. |
| `/verify-email` | `pages/VerifyEmail.jsx` | Auth | `broken` | Calls `/api/auth/verify-email` via relative path (S-09 fails on Vercel). |

---

## 2. Backend API Route Registrations & Security Audit

### 2.1 PDF Routes (`server/routes/pdf.routes.js`)
| Method & Path | Auth Required | File Ownership (ACL) | Status | Audit Note / Risk |
| :--- | :---: | :---: | :---: | :--- |
| `POST /api/pdf/merge` | Optional | None | `functional-by-test` | Clean merge via pdf-lib. |
| `POST /api/pdf/split` | Optional | None | `reachable` | Splits pages into new documents. |
| `POST /api/pdf/compress` | Optional | None | `reachable` | Calls Ghostscript `pdfwrite`. |
| `POST /api/pdf/pdf-to-word` | Optional | None | `reachable` | Calls LibreOffice headless. |
| `POST /api/pdf/word-to-pdf` | Optional | None | `reachable` | Calls LibreOffice headless. |
| `POST /api/pdf/redact-scan` | Optional | None | `functional-by-test` | Scans PII using Poppler `pdftotext -tsv`. |
| `POST /api/pdf/redact` | Optional | **FAILED (S-08)** | `broken` | **S-04 & S-08:** Accepts raw `tempFilePath` from body. Overlay fallback leaves raw text stream. |
| `POST /api/pdf/flatten` | Optional | None | `reachable` | Converts PDF pages to high-res images. |
| `POST /api/pdf/delete-pages` | Optional | None | `reachable` | Removes page indexes via pdf-lib. |
| `POST /api/pdf/organize` | Optional | None | `reachable` | Page reordering and rotation. |

### 2.2 OCR Routes (`server/routes/ocr.routes.js`)
| Method & Path | Auth Required | Engine | Status | Audit Note / Risk |
| :--- | :---: | :--- | :---: | :--- |
| `POST /api/ocr/image` | Optional | Tesseract CLI | `functional-by-test` | OCR on PNG/JPG/WebP; auto-routes PDF. |
| `POST /api/ocr/pdf-scan` | Optional | Poppler $\rightarrow$ Tesseract | `functional-by-test` | Rasterizes PDF $\rightarrow$ OCR per page $\rightarrow$ text. |
| `POST /api/ocr/searchable-pdf` | Optional | Tesseract + pdf-lib | `functional-by-test` | Produces searchable PDF with hidden text layer. |

### 2.3 Video & Media Routes (`server/routes/video.routes.js` & `videotranslate.routes.js`)
| Method & Path | Auth Required | Engine | Status | Audit Note / Risk |
| :--- | :---: | :--- | :---: | :--- |
| `POST /api/video/info` | None | FFprobe | `broken` | **S-13:** FFprobe not installed in Dockerfile. |
| `POST /api/video/trim` | Optional | FFmpeg | `broken` | **S-13:** Fails on Docker container. |
| `POST /api/video/merge` | Optional | FFmpeg | `broken` | **S-13:** Fails on Docker container. |
| `POST /api/video/compress` | Optional | FFmpeg | `broken` | **S-13:** Fails on Docker container. |
| `POST /api/video/delogo` | Optional | FFmpeg delogo filter | `broken` | **S-13:** Fails on Docker container. |
| `POST /api/video-translate/transcribe` | Optional | Groq Whisper | `reachable` | Audio extraction + Whisper transcription. |
| `POST /api/video-translate/translate` | Optional | AI $\rightarrow$ MyMemory | `reachable` | Batch subtitle translation with fallback. |
| `POST /api/video-translate/render` | Optional | FFmpeg + Edge-TTS | `broken` | **S-08 & Timeout:** Synchronous HTTP > 100s drops connection. |

### 2.4 Authentication & Session Routes (`server/routes/auth.routes.js`)
| Method & Path | Strategy | Status | Audit Note / Risk |
| :--- | :--- | :---: | :--- |
| `POST /api/auth/register` | Local bcrypt | `reachable` | Creates user, issues token. |
| `POST /api/auth/login` | Local bcrypt + rate limit | `reachable` | Issues access/refresh cookies & tokens. |
| `GET /api/auth/telegram/callback` | Telegram Widget | `broken` | **S-02 (P0):** Bypasses HMAC signature if `BOT_TOKEN` is unset! |
| `GET /api/auth/google` | Passport Google OAuth20 | `reachable` | Requires Google Cloud credentials. |
| `GET /api/auth/github` | Passport GitHub2 | `reachable` | Requires GitHub credentials. |
| `POST /api/auth/refresh` | RefreshToken rotation | `reachable` | Rotates JWT refresh tokens. |
| `POST /api/auth/forgot-password` | Nodemailer | `broken` | **S-09:** Fails when invoked from Vercel without proxy. |
| `GET /api/auth/verify-email` | Crypto token | `broken` | **S-09:** Fails when invoked from Vercel without proxy. |

### 2.5 Infrastructure & Static Delivery Routes (`server/index.js`)
| Method & Path | Auth Required | Status | Audit Note / Risk |
| :--- | :---: | :---: | :--- |
| `GET /outputs/*` | **NONE** | `broken` | **S-01 (P0):** Public static directory serving. |
| `GET /uploads/*` | **NONE** | `broken` | **S-01 (P0):** Public static directory serving. |
| `GET /api/download/:filename` | **NONE** | `broken` | **S-01 (P0):** Direct download without ownership check. |
| `GET /api/view/:filename` | **NONE** | `broken` | **S-01 (P0):** Direct inline view without ownership check. |
| `GET /api/health` | **NONE** | `broken` | **S-19 (P1):** Returns `status: ok` even when MongoDB is offline. |
| `GET /ping` | **NONE** | `functional-by-test` | Ultra-lightweight keep-alive responder. |

---

## 3. Duplicate Tools & Engines Analysis

The audit identified multiple redundant implementations that should be consolidated into unified engines:

```
[ DUPLICATE FRONTEND TOOLS ]
├── PDF Tools:
│   ├── /pdf (Hub)
│   ├── /pdf/merge (Dedicated Page)  <-- Duplicate merge UI
│   ├── /pdf/split (Dedicated Page)  <-- Duplicate split UI
│   └── /pdf/organize (Dedicated)    <-- Duplicate reorder UI
│   ==> Recommendation: Consolidate into unified "PDF Studio" while preserving SEO route redirects.
│
├── Watermark & Inpainting:
│   ├── /creative (BotocIT Studio delogo)
│   ├── /image (Inpaint & removebg)
│   └── /video (Delogo & watermark remove)
│   ==> Recommendation: Consolidate into shared Inpainting Engine.
│
└── Voice & Audio:
    ├── /speech (Transcribe)
    ├── /video-translate (Dubbing)
    └── AiVoiceStudio component
    ==> Recommendation: Consolidate into shared Audio/Speech Studio.
```
