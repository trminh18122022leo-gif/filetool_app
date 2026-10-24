# RELEASE EVIDENCE GATE — REPORT 01: CANDIDATE GIT MANIFEST

**Audit Phase:** Antigravity Release Evidence Gate  
**System:** FileTools Pro Candidate Working Tree  
**Verification Date:** October 2026  
**Base Commit SHA:** `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`  
**Current Git Branch:** `main`  
**Working Tree Status:** **DIRTY / UNCOMMITTED LOCAL CANDIDATE**  

> [!WARNING]
> This release candidate is currently staged and present in the local working tree. It has **NOT** been pushed to GitHub `origin/main`. Consequently, remote GitHub Actions CI pipelines (e.g., `.github/workflows/ci.yml`) have not run against this exact candidate SHA. All assertions in this report reflect **local machine verification**, not remote CI verification.

---

## 1. Candidate Source Inventory

The candidate contains modifications to 60 tracked files and 38 untracked directories/files implementing the architectural roadmap across Phases 00 through 14 and the Release Evidence Gate.

### 1.1 Tracked Files Modified (60 Files)

| Subsystem | Tracked Files | Primary Architectural Purpose |
| :--- | :--- | :--- |
| **CI / CD & Docker** | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `Dockerfile` | Pinned actions, step timeouts, non-root user execution, multi-stage build. |
| **Client Core & PWA** | `client/capacitor.config.json`, `client/index.html`, `client/public/_redirects`, `client/public/robots.txt`, `client/public/sitemap.xml`, `client/vercel.json`, `client/vite.config.js` | Origin restriction (`cleartext: false`), canonical tags, robots crawl directives, SPA rewrites, Workbox PWA caching without `/api/` leaks. |
| **Frontend UI / Pages** | `client/src/App.jsx`, `client/src/main.jsx`, `client/src/index.css`, `client/src/context/AuthContext.jsx`, `client/src/components/UserMenu.jsx`, `client/src/components/FileDropzone.jsx`, `client/src/pages/AiTools.jsx`, `client/src/pages/Auth.jsx`, `client/src/pages/Dashboard.jsx`, `client/src/pages/Home.jsx`, `client/src/pages/NotFound.jsx`, `client/src/pages/Pdf*.jsx` | Modern multi-theme support, mobile responsiveness, accessible dropzones, lazy-loaded tools. |
| **Backend Core & Security** | `server/index.js`, `server/middleware/auth.js`, `server/middleware/security.js`, `server/middleware/upload.js`, `server/utils/browser.js`, `server/utils/cloudRespond.js` | Health check fail-closed degrader, tenant isolation, strict MIME validation, Puppeteer network sandboxing, secure CORS allowlists. |
| **Backend Services & Routes** | `server/services/ai.service.js`, `server/services/auth.service.js`, `server/services/convert.service.js`, `server/services/pdfAdvanced.service.js`, `server/services/redact.service.js`, `server/services/storage.service.js`, `server/services/stripe.service.js`, `server/routes/*.routes.js` | Self-service account deletion, secure rasterized redaction, metadata scrubbing, AI model deprecation normalization, fail-closed R2 storage. |
| **Dependencies & Lockfile** | `package.json`, `package-lock.json` | Dependency remediation resolving 3 critical CVEs (`proxy-addr`, `shell-quote`, `body-parser`). |

### 1.2 Key Untracked Deliverables (38 Items)

| Path | Purpose & Classification |
| :--- | :--- |
| `server/services/aiProviderAdapter.js` | Multi-provider capability matrix, circuit breaker, BYOK decryption, FinOps COGS tracking. |
| `server/utils/aiKeyVault.js` | AES-256-GCM envelope encryption & memory key isolation. |
| `server/utils/ssrfGuard.js` | DNS resolution check, loopback/private IP blocking, cloud metadata air-gapping. |
| `server/queue/` | BullMQ Redis distributed queue, worker pool, concurrency limiter, fail-closed offline handling. |
| `server/services/quota.service.js` | Atomic quota reservation, commit/refund lifecycle, plan catalogue SSOT. |
| `server/models/` | `JobRecord.js`, `UserByokKey.js`, `AiUsageLedger.js`, `StripeEvent.js`, `Workflow*.js`. |
| `tests/` | 10 comprehensive verification test suites (Security, Reliability, Fidelity, AI, Billing, SEO, Releases). |
| `reports/phase14/` | 13 audit baseline reports from Phase 14 Second Pass. |
| `reports/release_gate/` | 10 release evidence verification reports. |
| `docs/FILETOOLS_PHASE14_INDEPENDENT_REVIEW.md` | Independent architectural review document. |

---

## 2. Integrity Hash & Working Tree Diff Metrics

- **Base Git Commit:** `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`
- **Total Backend Files Checked by Syntax Validator:** 93 files (0 errors)
- **Local Automated Tests:** 129 test cases across 67 suites (100% PASS)
- **Git Push Gate Status:** **HOLD — Pending Explicit User / Owner Approval**

---

## 3. Deployment Safety Statement

Because this candidate is not yet committed or pushed to the remote repository, no production deployment, cloud container push, or Store submission has been initiated. All code changes remain strictly confined to the local filesystem at `C:\Users\Admin\test_app\filetools-app`.
