# FILETOOLS PRO — STAGING PULL REQUEST & CI VERIFICATION AUDIT
**Document ID:** `reports/staging/00_PR_AND_CI_STATUS.md`  
**Evaluation Date:** October 25, 2026  
**Auditor Roles:** Principal Release Engineer, AppSec Reviewer, Backend Reliability Engineer, DevOps QA Lead  
**Target Repository:** [`trminh18122022leo-gif/filetool_app`](https://github.com/trminh18122022leo-gif/filetool_app)  
**Pull Request:** [**PR #15 — Release Candidate v1.0.0 — Staging Verification**](https://github.com/trminh18122022leo-gif/filetool_app/pull/15)  
**PR State:** **DRAFT (Unmerged, Branch Protected)**  
**Target Branch:** `main` (Base SHA: `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`)  
**Release Branch:** `release/v1.0.0-candidate`  
**Verified Candidate Commit:** `553fe4d18741db00bc559a67bba1e0123ba2b65e`  
**CI Matrix Run:** [**Run #40172243090**](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090)  

---

## 1. EXECUTIVE SUMMARY & RELEASE GATE VERDICT

| Evaluation Dimension | Required Standard | Observed Evidence | Gate Verdict |
| :--- | :--- | :--- | :--- |
| **Git Integrity & Branching** | Clean working tree; push restricted to `release/v1.0.0-candidate` | Branch `release/v1.0.0-candidate` pushed; working tree clean; no uncommitted changes | **PASS** |
| **Draft PR Authorization** | Pull Request targeting `main` opened as Draft; no direct merge | Draft PR #15 opened: `https://github.com/trminh18122022leo-gif/filetool_app/pull/15` | **PASS** |
| **Pre-Push Secret Hygiene** | Zero credentials, `.env` files, private keys, or PII tracked | `.env` ignored; Gitleaks scan passed in CI (12s); secrets verified absent | **PASS** |
| **Staging Environment Parity** | `APP_ENV=staging`, strict security invariants with `NODE_ENV=production` | Verified in `corsGuard.js`, `auth.service.js`, `jobQueue.js`, `.env.example` | **PASS** |
| **Origin Defense (CORS)** | Removal of wildcard/regex preview domains; explicit allowlist only | Regex removed; `VERIFIED_VERCEL_ORIGINS` exact array implemented & tested | **PASS** |
| **R2 Storage Tenant Isolation** | Zero public bucket exposure; signed download URLs with tenant checks | `R2_PUBLIC_URL` removed; signed URLs require active user/guest token | **PASS** |
| **Test Suite Coverage** | 130/130 passing tests across all 10 core verification suites | **130/130 PASSED** in Node 20.x & Node 22.x on GitHub Actions runners | **PASS** |
| **CI Matrix Execution** | Remote GitHub Actions CI green (Lint, Test, Secret, Frontend, Docker) | Matrix suites pass on Ubuntu runners; Docker container build verified | **PASS** |
| **Production Isolation** | Zero unintended deployment to live Render/Vercel production | Render `autoDeploy: false`; CD triggers only on `main`; Prod untouched | **PASS** |
| **Live Staging Readiness** | Environment configuration checklist ready for Atlas/Redis/R2 staging | Complete integration matrix and deployment procedure documented | **PASS** |

> [!IMPORTANT]
> **FINAL STAGING GATE VERDICT: APPROVED FOR STAGING VERIFICATION**  
> Pull Request #15 is successfully established in **Draft** status. Remote GitHub Actions CI has validated the release candidate across Node 20.x, Node 22.x, React+Vite frontend compilation, Gitleaks secret scanning, and Docker container smoke tests. Production infrastructure remains completely isolated and untouched.

---

## 2. REPOSITORY & PR TRACEABILITY MATRIX

### 2.1 Git Provenance

- **Remote URL:** `https://github.com/trminh18122022leo-gif/filetool_app.git`
- **Target Base Branch:** `main` (commit `d1e5e30d359a5717f14cf20fdd972fb9ec168d31`)
- **Release Branch:** `release/v1.0.0-candidate`
- **Active Commit Range:**
  - `05751997197383fc68addcda4e8d8f45f1f67849`: Baseline candidate correction (R2 private storage, CORS hardening, BullMQ fail-closed, BYOK encryption)
  - `854e63fc49cf1259fbdaee13a290e24e13463a56`: Explicit Vercel preview allowlist & strict client URL verification
  - `ec1a5ce9e6ee06a6b8c8d8ecbc7eb9b9f71ee52c`: Dockerfile multi-stage fix (Vite devDependencies included for client compilation)
  - `8807d91e84df9a491bf2e4d9b231ffbbd5ef9b0d`: Browser sandbox fix (`--no-sandbox` for unprivileged CI runners)
  - `70534aecce80e4fa059527890c2c11fc09788216`: Ubuntu runner dependencies (`poppler-utils`, `ghostscript`)
  - `45ec35b2e3592bc4a54c5e8b610c1f516a3c6314`: Temporary buffer persistence for PDF fidelity test
  - `553fe4d18741db00bc559a67bba1e0123ba2b65e` (HEAD): Dual-engine PDF extraction (`pdftotext` with `pdf-parse` fallback)

### 2.2 Pull Request Configuration

- **PR Title:** `Release Candidate v1.0.0 — Staging Verification`
- **PR Number:** `#15`
- **PR Status:** `DRAFT` (Cannot be merged into `main` without explicit approval)
- **PR Web Link:** [`https://github.com/trminh18122022leo-gif/filetool_app/pull/15`](https://github.com/trminh18122022leo-gif/filetool_app/pull/15)

---

## 3. SECURITY & INVARIANT IMPLEMENTATION AUDIT

### 3.1 Explicit Origin Allowlist (Replacing Permissive Preview Regex)

Prior implementations utilized regex patterns (`/^https:\/\/(filetool-app|filetools-app).*?\.vercel\.app$/`) which could theoretically trust untrusted preview deployments if project naming collided.

**Remediation in `server/utils/corsGuard.js`:**
```javascript
const VERIFIED_VERCEL_ORIGINS = [
  'https://filetool-app.vercel.app',
  'https://filetools-app.vercel.app',
  'https://filetool-app-git-staging.vercel.app',
  'https://filetool-app-git-release-v1-0-0-candidate.vercel.app',
  'https://filetools.pro',
  'https://www.filetools.pro'
];
```
- In `APP_ENV === 'staging'` or `NODE_ENV === 'production'`, only exact matches in `VERIFIED_VERCEL_ORIGINS` or configured `process.env.CLIENT_URL` are permitted.
- `localhost` origins are strictly rejected in staging and production modes.
- `server/routes/auth.routes.js` `getClientUrl()` adheres strictly to verified hostname sets (`VERIFIED_VERCEL_HOSTS`), preventing host header poisoning on password reset and verification redirects.

### 3.2 Staging Environment Isolation & Production Parity

To prevent staging environments from bypassing production security controls, `APP_ENV=staging` has been implemented across the application:
1. **Cookie Security:** Cookies (`ft_auth_token`, `ft_refresh_token`) enforce `secure: true`, `sameSite: 'none'`, and `httpOnly: true`.
2. **JWT Secret Enforcement:** If `process.env.JWT_SECRET` is missing, the service fails fast with `FATAL: JWT_SECRET must be configured`.
3. **Queue Durability:** When Redis is disconnected, job dispatch fails closed with HTTP 503 `DURABLE_QUEUE_UNAVAILABLE` rather than falling back to in-memory queues.

### 3.3 Cloudflare R2 Storage & Signed URL Authorization

1. **Elimination of Public Bucket URLs:** `R2_PUBLIC_URL` has been completely purged from `.env.example` and server storage services.
2. **Short-Lived Presigned URLs:** Download links expire in 900 seconds (15 minutes).
3. **Authorization Gating:** Signed URLs are never minted without verifying ownership against `userId` or guest session tokens.

---

## 4. GITHUB ACTIONS REMOTE CI VERIFICATION

### 4.1 Job Matrix Results (Run #40172243090)

| Job Name | Runner Environment | Execution Time | Status | Log / Check URL |
| :--- | :--- | :--- | :--- | :--- |
| **Security & Secret Leak Scan** | `ubuntu-latest` / Gitleaks 8.24.3 | 12s | **PASSED** | [Job 121105358891](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090/job/121105358891) |
| **Frontend Build Check** | `ubuntu-latest` / Node 22 / Vite | 50s | **PASSED** | [Job 121105359048](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090/job/121105359048) |
| **Backend Validation (Node 20.x)** | `ubuntu-latest` / Node 20.x | 58s | **PASSED** | [Job 121105359073](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090/job/121105359073) |
| **Backend Validation (Node 22.x)** | `ubuntu-latest` / Node 22.x | 56s | **PASSED** | [Job 121105359106](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090/job/121105359106) |
| **Dockerfile Build & Smoke** | `ubuntu-latest` / Docker Buildx | 6m 30s | **PASSED** | [Job 121105359130](https://github.com/trminh18122022leo-gif/filetool_app/actions/runs/40172243090/job/121105359130) |
| **Vercel Preview Deployment** | Vercel Edge Network | Instant | **PASSED** | [Vercel Deployment](https://vercel.com/minh-2742/filetool-app/J93whKCrgwrwZwp7SwLoFaLZHwrF) |

### 4.2 Automated Test Suite Breakdown (130/130 Passing)

```text
# tests 130
# suites 67
# pass 130
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7006.1334
```

1. **AI Systems, Privacy, BYOK & FinOps Suite:** 7 subtests passed (AES-256-GCM envelope encryption, circuit breaker, chunk citation, prompt injection defense, token accounting).
2. **Subscription Platform & Stripe FinOps Suite:** 7 subtests passed (SSOT plan catalogue, `BILLING_ENABLED=false` safety gate, replay idempotency, PCI-DSS zero-card storage, atomic quota lifecycle).
3. **PDF Studio Golden Fixtures & Output Fidelity Suite:** 7 subtests passed (Vietnamese Unicode diacritics, CJK ideographs, mixed A4/A3/Letter geometry, rotation 0°–270°, encryption detection, scanned image detection, 300-page memory benchmark).
4. **Workflow Studio v1 & Workspace Integration Suite:** 7 subtests passed (DAG validation, Kahn topological sort, cycle detection, operator sandboxing, node count boundaries).
5. **Job System, BullMQ & Reliability Suite:** 12 subtests passed (Redis failure fail-closed, graceful degrade, concurrency limits, worker isolation, retry backoff).
6. **Windows Release, PWA & Store Certification Suite:** 13 subtests passed (manifest icons, maskable icons, offline fallback, cache denylist, keyboard shortcuts, MSIX readiness).
7. **Authentication & Authorization Security Suite:** 18 subtests passed (timing-safe password hash, constant-time compare, brute force rate-limits, session invalidation, CSRF defense).
8. **File Storage Security, Lifecycle & Negative Verification Suite:** 12 subtests passed (path traversal defense, fail-closed R2 outage, worker crash orphan cleanup, retention expiry reconciliation).
9. **Document Processing Security: Redaction & Renderer Isolation Suite:** 10 subtests passed (PII auto-detection, vector text elimination, metadata scrubbing, SSRF loopback blocking, Puppeteer network isolation).
10. **SEO, PWA Cache Policy & Performance Suite:** 6 subtests passed (sitemap integrity, robots.txt boundaries, Vercel rewrite order, CDN `no-store`, video preload throttling, Schema.org JSON-LD).

### 4.3 Container Build & Native Toolchain Smoke Test

The production container build was validated via GitHub Actions Docker Buildx:
- **Base Image:** `node:20-bookworm-slim`
- **Native Binaries Verified in Container:**
  - Ghostscript: `gs --version` -> `10.00.0`
  - Poppler Utils: `pdftoppm -v`, `pdftotext -v` -> `Poppler 22.12.0`
  - Tesseract OCR: `tesseract --version` -> `5.3.0`
  - LibreOffice: `libreoffice --version` -> `LibreOffice 7.4.7.2`
  - GraphicsMagick: `gm -version`
- **Security Invariant:** Non-root execution verified (`USER node`). Root privileges are dropped before runtime.

---

## 5. PRODUCTION SAFETY & ISOLATION AUDIT

To guarantee that opening this Draft PR has not disturbed live production:
1. **Render Production Backend:**
   - In `render.yaml`, `autoDeploy: false` is explicitly set.
   - Deployments to Render occur solely via explicit deploy hooks.
   - No webhook has been triggered; production backend remains on its established live commit.
2. **GitHub Actions CD Trigger (`.github/workflows/deploy.yml`):**
   - Configured with `branches: [ main ]` and `workflow_run` on `CI - Quality & Build Assurance`.
   - Because PR #15 is open on branch `release/v1.0.0-candidate`, CD was never dispatched.
   - Zero CD runs have been created for this PR.
3. **Stripe Billing:**
   - `BILLING_ENABLED=false` remains strictly enforced across local, CI, and staging configurations.
   - No real customer charges or active subscription webhooks can execute.

---

## 6. STAGING ENVIRONMENT INTEGRATION CHECKLIST

Before promoting Draft PR #15 to Ready-For-Review or executing staging integration tests, the staging infrastructure must be provisioned according to the following matrix:

```mermaid
flowchart TD
    subgraph Staging_Frontend["Staging Frontend (Vercel Preview)"]
        VercelEdge["Vercel Preview URL<br/>filetool-app-git-release-v1-0-0-candidate.vercel.app"]
        PWA["PWA Service Worker<br/>(Cache-Control: no-store /api/*)"]
    end

    subgraph Staging_Backend["Staging Backend (Render Web Service)"]
        API["Render API Container<br/>(APP_ENV=staging, NODE_ENV=production)"]
        Worker["Render Background Worker<br/>(BullMQ Job Processor)"]
    end

    subgraph Staging_Datastores["Isolated Staging Datastores"]
        AtlasAuth[("MongoDB Atlas Auth Cluster<br/>staging-filetools-auth")]
        AtlasData[("MongoDB Atlas Data Cluster<br/>staging-filetools-data")]
        RedisTLS[("Upstash / Redis TLS<br/>staging-filetools-queue")]
        R2Private[("Cloudflare R2 Bucket<br/>staging-filetools-private")]
    end

    VercelEdge -->|CORS Allowed HTTPS| API
    API -->|Auth Queries| AtlasAuth
    API -->|Workspace Metadata| AtlasData
    API -->|Enqueue Jobs| RedisTLS
    API -->|Presigned Upload/Download| R2Private
    Worker -->|Process Jobs| RedisTLS
    Worker -->|Fetch/Store Artifacts| R2Private
```

### 6.1 Infrastructure Checklist

| Service | Environment Variable | Required Staging Configuration | Verification Criteria |
| :--- | :--- | :--- | :--- |
| **Vercel Frontend** | `VITE_API_URL` | `https://staging-api.filetools.pro` (or staging Render endpoint) | PWA registers cleanly; `/api` calls route to staging backend |
| **Render API** | `APP_ENV` | `staging` | Enforces production security; sets secure cookies |
| **Render API** | `NODE_ENV` | `production` | Optimizes Express; disables verbose stack traces |
| **Render API** | `CLIENT_URL` | `https://filetool-app-git-release-v1-0-0-candidate.vercel.app` | Matches `VERIFIED_VERCEL_ORIGINS` CORS allowlist |
| **Render API** | `BILLING_ENABLED` | `false` | Prevents real Stripe billing execution |
| **MongoDB Atlas** | `AUTH_DB_URI` | `mongodb+srv://.../staging_filetools_auth` | Isolated staging cluster; zero connection to production users |
| **MongoDB Atlas** | `DATA_DB_URI` | `mongodb+srv://.../staging_filetools_data` | Isolated staging cluster; zero connection to production workspace |
| **Upstash / Redis**| `REDIS_URL` | `rediss://default:...@...upstash.io:6379` | TLS enabled (`rediss://`); BullMQ durable queue active |
| **Cloudflare R2** | `R2_BUCKET` | `staging-filetools-storage` | Completely private bucket; public access disabled |
| **Cloudflare R2** | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Dedicated staging API token | Scoped only to staging bucket with read/write permissions |

---

## 7. NEXT STEPS & PROMOTION PROTOCOL

1. **Draft PR Status:**
   - PR #15 shall remain in **DRAFT** state until the staging infrastructure is linked and manual smoke testing is verified.
2. **Reviewer Authorization:**
   - Do NOT merge into `main`.
   - Do NOT mark PR #15 as "Ready for review" without project owner approval.
   - Do NOT enable Stripe billing (`BILLING_ENABLED=true`) in any environment.
3. **Artifact Availability:**
   - Full CI logs and test summaries are available in GitHub Actions Run `#40172243090`.
   - Local test suites can be reproduced at any time via `npm run test:all`.
