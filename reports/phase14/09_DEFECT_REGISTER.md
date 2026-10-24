# Phase 14 — Report 09: Prioritized Defect Register & Remediation Log

**Audit Phase:** Phase 14 — Comprehensive Final Second Pass & Production Release Audit  
**Author:** Independent QA Lead & Senior Security Engineer  
**Audit Date:** 2026-10-24  
**Severity Classification:**
- **P0:** Critical security vulnerability, data loss, or release-blocking failure.
- **P1:** Major functionality, reliability, or integration defect.
- **P2:** Performance, UX, or maintainability problem.
- **P3:** Optional enhancement or non-blocking suggestion.

---

## 1. Prioritized Defect Register

| Defect ID | Sev | Category | Title & Origin | Original Observed Defect | Root Cause Analysis | Remediation Applied | Regression Test | Final Status |
|:---:|:---:|:---|:---|:---|:---|:---|:---|:---:|
| **DEF-01** | **P0** | Security | Public static directories & unauthenticated downloads (S-01) | `/outputs` and `/uploads` served static files publicly; anyone could download files by guessing filenames. | `app.use('/outputs', express.static(...))` mounted without ACL. | Removed static serving. Implemented HMAC signed download tokens in `server/middleware/accessControl.js`. | `tests/security/file-storage.test.js` (Test 1, 2) | **VERIFIED_FIXED** |
| **DEF-02** | **P0** | Security | Telegram authentication bypass (S-02) | Query params without bot token could log in as arbitrary user. | Conditional check bypassed auth verification if `TELEGRAM_BOT_TOKEN` unset. | Enforced fail-closed redirect if token unset; timing-safe HMAC validation; 15m timestamp check; replay cache. | `tests/security/auth-access.test.js` (Test 3) | **VERIFIED_FIXED** |
| **DEF-03** | **P0** | Security | Auth DB outage elevated users to `'pro'` (S-03) | Disconnected database caused middleware fallback to assign `req.user = { plan: 'pro' }`. | Insecure fail-open fallback in `server/middleware/auth.js`. | Replaced with HTTP 503 `AUTH_DB_UNAVAILABLE` fail-closed response. `FREE_MODE` set to false. | `tests/security/auth-access.test.js` (Test 1) | **VERIFIED_FIXED** |
| **DEF-04** | **P0** | Security | Fake vector redaction overlay (S-04) | Redaction default `flatten = false` left raw PDF text streams accessible to `pdftotext`. | Non-destructive vector rectangle drew over text without eliminating content stream. | Forced `flatten = true` by default; `flatten = false` throws error; rasterized pages and scrubbed metadata. | `tests/security/redact-render.test.js` (Test 1) | **VERIFIED_FIXED** |
| **DEF-05** | **P0** | Security | Early exit in upload file validation (S-05) | Upload validation ran before Multer; returned next() immediately on empty array. | Misplaced middleware in `server/index.js`. | Chained `validateUploadedFiles` after Multer; added magic-bytes binary signature inspection. | `tests/security/file-storage.test.js` (Test 6) | **VERIFIED_FIXED** |
| **DEF-06** | **P0** | Security | Chromium singleton SSRF & arbitrary HTML (S-06) | Puppeteer evaluated untrusted HTML with `--no-sandbox` without network isolation. | Missing network request interception; singleton browser instance. | Added Deny-All network interception in `ssrfGuard.js`; blocked private/metadata IPs; `ENABLE_URL_TO_PDF=false`. | `tests/security/redact-render.test.js` (Test 2) | **VERIFIED_FIXED** |
| **DEF-07** | **P0** | Store Compliance | Missing in-app account deletion (Phase 14) | No self-service account deletion endpoint; causes immediate Apple & Google Store rejection. | Lack of account purge handler in `auth.routes.js`. | Implemented `DELETE /api/auth/account` in `server/routes/auth.routes.js` with cascade purge of tokens, files, and keys. | `tests/security/auth-access.test.js` | **VERIFIED_FIXED** |
| **DEF-08** | **P1** | CI/CD | Deprecated Vercel action in deploy workflow (S-16, F-02) | Deploy pipeline utilized deprecated `amondnet/vercel-action@v25` with API failures. | Unmaintained third-party GitHub Action. | Replaced with official Vercel CLI (`npx vercel`), SHA provenance logging, approval gates, and smoke checks. | `.github/workflows/deploy.yml` | **VERIFIED_FIXED** |
| **DEF-09** | **P1** | CI/CD | Permissive syntax-only test gate in CI (S-15) | CI only executed `npm test` (syntax check) with `continue-on-error: true` on audits. | Weak quality gate in `.github/workflows/ci.yml`. | Upgraded CI to execute `npm run test:all` across all 10 suites in matrix (Node 20 & 22). | `.github/workflows/ci.yml` | **VERIFIED_FIXED** |
| **DEF-10** | **P1** | Observability | `/api/health` reported OK when DBs down (S-19) | Health check returned HTTP 200 `status: 'ok'` even when both Auth and Data DBs were disconnected. | Endpoint returned static JSON without checking `isAuthConnected()`. | Updated `/api/health` to return HTTP 503 `status: 'degraded'` if databases are disconnected. | `server/index.js:355` | **VERIFIED_FIXED** |
| **DEF-11** | **P1** | Mobile Security | Capacitor config allowed cleartext & wildcard navigation | `client/capacitor.config.json` had `"cleartext": true` and `"allowNavigation": ["*"]`. | Debug configuration left active. | Hardened to `"cleartext": false` and restricted allowNavigation to verified domains. | `client/capacitor.config.json` | **VERIFIED_FIXED** |
| **DEF-12** | **P2** | Performance | Video background battery & network drain (S-21) | 18MB background video loaded with `preload="auto"` unconditionally. | Decorative asset loaded without performance constraints. | Changed to `preload="none"`, WebP poster, and frozen RAF loops on `document.hidden` / reduced motion. | `tests/seo-pwa/seo-pwa-perf.test.js` (Test 5) | **VERIFIED_FIXED** |
| **DEF-13** | **P2** | UI/UX | Free users rendered with PRO badge (S-20) | Expression rendered `'PRO'` when `user.plan` was `'free'`. | Inverted ternary check in `client/src/components/UserMenu.jsx`. | Corrected to `{user.plan ? user.plan.toUpperCase() : 'FREE'}` with neutral slate styling. | `UserMenu.jsx:112` | **VERIFIED_FIXED** |

---

## 2. Outstanding External Blockers Register

The following items cannot be resolved via automated code modifications and are appropriately categorized as **External Owner Blockers**:

| Blocker ID | Platform Impact | Blocking Dependency | Reason for Blocker | Required Owner Resolution |
|:---:|:---:|:---|:---|:---|
| **BLK-01** | Web Paid | Live Stripe Keys & Webhook Secret | Safety gate `BILLING_ENABLED=false` is enforced to prevent live credit card charges without owner authorization. | Owner populates live Stripe API keys and reviews commercial tax/currency settings. |
| **BLK-02** | Windows Desktop | Microsoft Partner Center Package Identity | Generating a signed `.msix` bundle requires official `Identity/Name`, `Publisher CN`, and `PublisherDisplayName`. | Owner registers on `storedeveloper.microsoft.com` and completes government ID verification. |
| **BLK-03** | Android | Google Play Console Enrollment & Keystore | Compiling and uploading an `.aab` requires a Google Play developer account (\$25) and signing keystore. | Owner registers on `play.google.com/console` and creates release keystore. |
| **BLK-04** | iOS | macOS / Xcode Hardware & Apple Developer Program | Generating `client/ios/` and archiving an `.ipa` requires macOS hardware with Xcode and Apple Developer account (\$99/yr). | Owner provisions macOS build runner and enrolls in Apple Developer Program. |
