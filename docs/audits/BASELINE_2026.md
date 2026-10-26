# FILETOOLS PRO — BASELINE AUDIT REPORT 2026
**Document ID:** `AUDIT-BASELINE-2026-10-23`  
**Execution Date:** 2026-10-23  
**Auditor Roles:** Principal Software Architect + Staff Engineer + QA Lead  
**Repository:** `https://github.com/trminh18122022leo-gif/filetool_app`  
**Branch:** `main`  
**Exact Commit HEAD SHA:** `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`  
**Upstream Sync:** `Your branch is up to date with 'origin/main'.`

---

## 1. Executive Summary & Mandatory Document Check

### 1.1 Document Availability Check (Mandatory Rule #1)
- `AGENTS.md`: **ABSENT** (`Test-Path AGENTS.md` $\rightarrow$ `False`).
- `01_MASTER_PLAN.md`: **ABSENT** (`Test-Path 01_MASTER_PLAN.md` $\rightarrow$ `False`).
- **Audit Action Taken:** In strict accordance with prompt directives, **no file was fabricated**. The operational blueprint, baseline checklist, and 23 risk findings have been sourced directly and exclusively from the explicit `FILETOOLS PRO — MASTER PRODUCTION BLUEPRINT` provided by the project owner.

### 1.2 Git Working Tree State
```
d1e5e30d359a5717f14cf20fdd972fb9ec168d31
M  client/index.html (Meta tags & SEO annotations added)
A  client/public/robots.txt (Crawler policy added)
A  client/public/sitemap.xml (22 public route entries added)
```

---

## 2. Workspace Structure & Script Inventory

The project is structured as a non-monorepo hybrid multi-target workspace:

| Subproject | Directory | Primary Framework | Manifest | Lockfile |
| :--- | :--- | :--- | :--- | :--- |
| **Root (Backend API & Orchestration)** | `/` | Node.js 20+, Express 4.21, Mongoose 8.9 | `package.json` | `package-lock.json` (321 KB) |
| **Client (Web SPA & PWA)** | `client/` | React 18.3, Vite 6.1, Tailwind 4.0 | `client/package.json` | `client/package-lock.json` (Present) |
| **Desktop Wrapper (Electron)** | `electron/` | Electron 28+, Node.js runtime | `electron/package.json` | `electron/package-lock.json` (193 KB) |
| **Mobile Wrapper (Capacitor)** | `client/` | Capacitor Android 8.5 | `client/capacitor.config.json` | Shared with client |
| **Browser Extension** | `chrome-extension/` | Chrome Manifest V3 | `chrome-extension/manifest.json` | None (Vanilla JS) |

### Script Inventory & Evaluation
* Root `package.json`:
  * `npm start`: `node server/index.js` — **FUNCTIONAL**
  * `npm run dev`: `nodemon --config nodemon.json server/index.js` — **FUNCTIONAL**
  * `npm run client`: `npm --prefix client run dev` — **FUNCTIONAL**
  * `npm run build`: `cd client && npm run build` — **FUNCTIONAL**
  * `npm test`: `node scripts/verify-syntax.cjs` — **FUNCTIONAL BUT DEFICIENT** (Syntax-only check, 0 unit/integration tests).
  * `npm run clean`: Cleans `uploads/` and `outputs/` — **FUNCTIONAL**
  * `npm run electron:build`: Builds client and calls electron build — **UNVERIFIED on headless Linux / CI**.

---

## 3. Real Baseline Build & Test Execution Evidence

### 3.1 Backend Syntax Verification (`npm test`)
* **Command Executed:** `npm test` (`node scripts/verify-syntax.cjs`)
* **Exit Code:** `0`
* **Real Log Output:**
```
> filetools-app@1.0.0 test
> node scripts/verify-syntax.cjs

🔍 Running JavaScript syntax verification across backend files...
✅ Syntax verification passed! Checked 73 files with 0 errors.
```
* **QA Finding:** While 73/73 files have valid JavaScript syntax, there are **0 unit tests, 0 integration tests, and 0 API contract tests**.

### 3.2 Frontend Production Build (`npm run build` in `client/`)
* **Command Executed:** `cd client && npm run build` (`vite build`)
* **Execution Duration:** 1m 10s
* **Exit Code:** `0`
* **Real Log Output (Truncated Key Summary):**
```
vite v6.4.3 building for production...
✓ 4716 modules transformed.
rendering chunks...
dist/index.html                                   2.36 kB │ gzip:     1.04 kB
dist/assets/vendor-react-FTfhIgkQ.js            180.68 kB │ gzip:    59.54 kB
dist/assets/vendor-pdf-CyniYFEE.js              364.06 kB │ gzip:   107.37 kB
dist/assets/vendor-collab-DuHvc4eK.js         4,051.11 kB │ gzip: 1,053.46 kB
(!) Some chunks are larger than 3000 kB after minification (vendor-collab-DuHvc4eK.js)
✓ built in 1m 10s
PWA v1.3.0 mode generateSW (168 entries precached)
```

---

## 4. Verification of All 23 Blueprint Findings (S-01 to S-23)

Every single finding from the Master Plan was cross-examined against exact source lines at HEAD commit `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`:

| ID | Sev | Source Code Location | Status | Observed Vulnerability / Defect Evidence |
| :---: | :---: | :--- | :---: | :--- |
| **S-01** | **P0** | `server/index.js:217-265` | **CONFIRMED** | `app.use('/outputs', express.static(...))` and `app.use('/uploads', express.static(...))` are fully public. `/api/download/:filename` and `/api/view/:filename` have zero ownership/tenant validation. |
| **S-02** | **P0** | `server/routes/auth.routes.js:206-209` | **CONFIRMED** | `if (process.env.TELEGRAM_BOT_TOKEN) { checkTelegramAuth(...) }` skips authentication completely if token is unset, allowing arbitrary login via query params. |
| **S-03** | **P0** | `server/middleware/auth.js:48,80,130` | **CONFIRMED** | If auth DB disconnects, fallback executes: `req.user = { role: 'user', plan: 'pro' };`. Also `freeModeUpgrade` overrides plan to `'pro'`. |
| **S-04** | **P0** | `server/services/redact.service.js:336`, `server/routes/pdf.routes.js:380` | **CONFIRMED** | Default route parameter is `flatten = 'false'`. If flatten fails, it falls back to visual rectangle overlay, leaving raw PDF text streams accessible to `pdftotext`. |
| **S-05** | **P0** | `server/index.js:228-242`, `server/middleware/security.js:78` | **CONFIRMED** | `validateUploadedFiles` is mounted at route level before Multer runs inside sub-routes. Line 78: `if (!files.length) return next();` exits immediately without inspecting any file. |
| **S-06** | **P0** | `server/utils/browser.js:11`, `server/services/pdfAdvanced.service.js:253` | **CONFIRMED** | Puppeteer launches with `--no-sandbox` as a singleton browser and evaluates arbitrary user-submitted HTML via `page.setContent()`. |
| **S-07** | **P0** | `server/socket/index.js:62-64`, `server/index.js:63-75` | **CONFIRMED** | `socket.on('join-job', jobId)` has no user ownership check. Yjs WebSocket server `/collab?room=...` accepts unauthenticated connections with zero ACL. |
| **S-08** | **P0** | `server/routes/pdf.routes.js:356-364`, `server/routes/videotranslate.routes.js:205` | **CONFIRMED** | Endpoints accept raw `tempFilePath` and `videoFilename` from request bodies. Users can point to other users' file paths on disk. |
| **S-09** | **P1** | `client/vercel.json:1-8`, `client/src/pages/ForgotPassword.jsx:17` | **CONFIRMED** | Vercel catch-all rewrites all routes to `/index.html`. Calling `/api/...` on Vercel without proxy returns HTML instead of forwarding to Render. |
| **S-10** | **P1** | `server/routes/batch.routes.js:21-52` | **CONFIRMED** | In-memory `p-queue` is spawned per-request inside the HTTP process. Server restart kills all in-flight jobs without persistence or durability. |
| **S-11** | **P1** | `server/services/storage.service.js:66` | **CONFIRMED** | `fs.readFileSync(localFilePath)` loads entire file into buffer before S3 PutObject, creating massive memory spikes on 512MB RAM instances. |
| **S-12** | **P1** | `server/models/FileRecord.js:31` | **CONFIRMED** | MongoDB TTL index `expires: 0` purges MongoDB records automatically, but never issues S3/R2 DeleteObject commands, creating orphaned cloud storage. |
| **S-13** | **P1** | `Dockerfile:7-32` | **CONFIRMED** | Debian packages installed: `ghostscript qpdf libreoffice tesseract-ocr poppler-utils chromium`. Neither `ffmpeg` nor `ffprobe` is installed in Docker. |
| **S-14** | **P1** | `server/middleware/planLimit.js`, `server/routes/` | **CONFIRMED** | `planLimit` middleware is defined but not attached to PDF, Image, Video, Convert, or OCR routes. |
| **S-15** | **P1** | `.github/workflows/ci.yml:37,68` | **CONFIRMED** | Gitleaks scan has `continue-on-error: true`. `npm audit` has `continue-on-error: true`. `npm test` only verifies syntax. |
| **S-16** | **P1** | `.github/workflows/deploy.yml:121,131` | **CONFIRMED** | Uses legacy action `amondnet/vercel-action@v25` which has known breaking API failures and unverified deployment SHAs. |
| **S-17** | **P1** | `client/vite.config.js:48-56` | **CONFIRMED** | PWA Workbox config caches `/api/.*` using `NetworkFirst`, creating risk of caching private authenticated data on shared devices. |
| **S-18** | **P1** | `client/src/App.jsx:77-100`, `server/routes/auth.routes.js:41-47` | **CONFIRMED** | Tokens passed in URL parameters `?token=...`, stored in `localStorage`, while backend also sets cookies `token`, `accessToken`, and `refreshToken`. |
| **S-19** | **P1** | `server/index.js:301-313` | **CONFIRMED** | `/api/health` returns `status: 'ok'` even when `isAuthConnected()` and `isDataConnected()` return `false`. |
| **S-20** | **P2** | `client/src/components/UserMenu.jsx:111,129` | **CONFIRMED** | Expression `{user.plan && user.plan !== 'free' ? user.plan : 'PRO'}` renders `PRO` badge when `user.plan` is `free`. |
| **S-21** | **P2** | `client/public/blue-sky.mp4`, `client/src/components/backgrounds/SolitudeSkyBackground.jsx:77` | **CONFIRMED** | 18.3 MB video + 5.2 MB poster loaded with `preload="auto"` unconditionally on all devices including mobile. |
| **S-22** | **P2** | `client/index.html` | **CONFIRMED** | Pure client-side SPA rendering with empty `<div id="root"></div>`; tools have zero pre-rendered content for search crawlers. |
| **S-23** | **P2** | `server/services/ai.service.js:54,59`, `.env:9` | **CONFIRMED** | Code expects `GOOGLE_AI_API_KEY` while `.env` configures `GOOGLE_API_KEY`. Defaults to outdated `gemini-1.5-flash`. |

---

## 5. Secret Key & Environment Variable Inventory

> **SECURITY NOTICE:** In accordance with prompt rules, only **VARIABLE NAMES** and **REQUIREMENT FLAGS** are listed. Zero secret values or token fragments are disclosed.

| Variable Name | Required | Consumer / Scope | Risk if Missing / Leaked |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional (default: 3002) | `server/index.js` | Server port binding |
| `NODE_ENV` | Optional (default: development) | System-wide | Production hardening, cookie secure flag |
| `CLIENT_URL` | **Required** | Auth redirect & CORS | Open redirect, CORS failure |
| `ALLOWED_ORIGINS` | Optional | CORS allowlist | Unwanted origin access |
| `MONGODB_URI` | **Required** (or Auth/Data pair) | Database connectivity | Complete DB failure |
| `MONGODB_AUTH_URI` | Optional | Multi-cluster Auth DB | Falls back to MONGODB_URI |
| `MONGODB_DATA_URI` | Optional | Multi-cluster Data DB | Falls back to MONGODB_URI |
| `JWT_SECRET` | **Required** | `auth.service.js` | Token forgery if leaked/empty |
| `JWT_REFRESH_SECRET` | **Required** | `auth.service.js` | Session hijacking |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram OAuth callback | S-02 bypass if not set |
| `GOOGLE_AI_API_KEY` | Optional | Gemini AI service | AI features unavailable |
| `GROQ_API_KEY` | Optional | Groq Whisper & Llama | Fallback to MyMemory / disabled |
| `OPENROUTER_API_KEY` | Optional | AI Model cascade | Provider skipped |
| `CEREBRAS_API_KEY` | Optional | Fast AI inference | Provider skipped |
| `MISTRAL_API_KEY` | Optional | European AI provider | Provider skipped |
| `R2_ENDPOINT` | Optional | S3 / Cloudflare R2 | Storage falls back to disk |
| `R2_ACCESS_KEY_ID` | Optional | S3 authentication | R2 authentication failure |
| `R2_SECRET_ACCESS_KEY` | Optional | S3 authentication | Full bucket compromise if leaked |
| `R2_BUCKET_NAME` | Optional | S3 target bucket | Unknown storage target |
| `STRIPE_SECRET_KEY` | Optional | `stripe.service.js` | Payment processing failure |
| `STRIPE_WEBHOOK_SECRET` | Optional | `payment.routes.js` | Webhook forgery if invalid |
| `REMOVE_BG_API_KEY` | Optional | `removebg.service.js` | Falls back to local Rembg |

---

## 6. Dependency & License Compliance Matrix

A rigorous dependency check was executed for commercial distribution (including Windows Store and Web monetization):

| Dependency | License | Distribution Risk & Compliance Requirement |
| :--- | :---: | :--- |
| `Ghostscript` (CLI) | **AGPL-3.0** | **HIGH RISK:** If run inside server processing pipeline or distributed in desktop packages, AGPL copyleft obligations apply. Must be isolated or replaced with permissive engines (`pdf-lib`, `qpdf`, `poppler-utils`). |
| `@imgly/background-removal-node` | **GPL-3.0 / Commercial** | **HIGH RISK:** Commercial use requires commercial license from IMG.LY or reliance on non-GPL fallback. |
| `ffmpeg` / `fluent-ffmpeg` | **LGPL-2.1 / GPL** | **MEDIUM RISK:** Must ensure binary build uses `--enable-shared` and avoids GPL-only flags if distributed in desktop package. |
| `libreoffice` (CLI) | **MPL-2.0** | **LOW-MEDIUM:** Weak copyleft; executing via CLI headless process is compliant without license contagion. |
| `sharp` (libvips) | **Apache-2.0 / LGPL** | **LOW:** Permissive Apache-2.0 for sharp; underlying libvips is LGPL. |
| `pdf-lib` | **MIT** | **COMPLIANT:** Fully permissive. |
| `pdfjs-dist` | **Apache-2.0** | **COMPLIANT:** Fully permissive. |
| `tesseract.js` / Tesseract CLI | **Apache-2.0** | **COMPLIANT:** Fully permissive. |
| `qpdf` | **Apache-2.0** | **COMPLIANT:** Fully permissive. |
| `yjs` / `y-websocket` | **MIT** | **COMPLIANT:** Fully permissive. |
| `monaco-editor` | **MIT** | **COMPLIANT:** Fully permissive. |
| `stripe` | **MIT** | **COMPLIANT:** Fully permissive. |
| `xlsx` (SheetJS) | **Apache-2.0** | **COMPLIANT:** Community edition permissive. |
