# FileTools Pro — Consolidated Audit & Production Readiness Backlog
**Document Version:** 1.0.0 (Established at Workflow Update Milestone)  
**Maintained By:** Principal Software Architect + Integration QA Lead  
**Audit Target for Phase 14:** Comprehensive Final Second Pass & Production Readiness Review (Phases 00–13)

---

## 1. Executive Status & Audit Backlog Mandate

Per the **Execution Workflow Update**, independent Second Pass reviews after each intermediate phase are superseded by a continuous single-pass verified implementation model. All deferred findings, non-blocking operational observations, and cross-system concerns are consolidated here to be rigorously examined and closed during **Phase 14 (Comprehensive Final Second Pass & Production Readiness Audit)**.

---

## 2. Findings Carried Over from Completed Phases (Phases 00 – 06)

| ID | Phase Origin | Category | Finding Description | Current Mitigation | Verification Status in Phase 14 |
|:---:|:---:|:---|---|---|:---:|
| **F-01** | Phase 00 | Deployment | `Dockerfile` lacks `ffmpeg` and `ffprobe` packages in Alpine/Debian package manager list. | Video service operates in local node environment; container build needs package addition before Phase 08. | **MUST VERIFY DOCKER BUILD** |
| **F-02** | Phase 00 | CI/CD | GitHub Actions workflow `.github/workflows/deploy.yml` utilizes deprecated `amondnet/vercel-action@v25`. | Staged for upgrade to official `@vercel/action` or Vercel Git integration in Phase 13. | **PIPELINE AUDIT** |
| **F-03** | Phase 01 | Auth | Guest users rely on `jobSecret` stored in localStorage for accessing async jobs without an account. | `jobSecret` generated via `crypto.randomBytes(24)`, validated via `crypto.timingSafeEqual` with 1-hour TTL. | **NEGATIVE CROSS-GUEST TEST** |
| **F-04** | Phase 02 | Storage | Cloudflare R2 bucket retention lifecycle policies must be mirrored between local reconciler and Cloudflare dashboard. | `reconcileExpiredCloudFiles` service runs scheduled cleanup; Cloudflare dashboard TTL acts as safety net. | **STORAGE LEAK AUDIT** |
| **F-05** | Phase 03 | Redaction | Raster-backed PDF redaction alters text searchability on redacted pages (visual raster vs vector). | Documented explicitly in `PDF_TOOL_PARITY.md`; user informed that redacted pages become image-backed. | **FIDELITY QA AUDIT** |
| **F-06** | Phase 04 | Reliability | Managed Redis instance failure modes depend on hosting tier (Redis Sentinel vs standalone Valkey). | Fail-closed graceful fallback to synchronous queue implemented if Redis connection is unavailable. | **CHAOS KILL TEST** |
| **F-07** | Phase 05 | Performance | Monaco Editor chunk size warning (>3000 kB) during Vite production build. | Code splitting active via `lazy()`; Monaco is isolated to `/editor` route and doesn't affect LCP of `/` or `/pdf`. | **CHUNKING / ROLLUP REVIEW** |
| **F-08** | Phase 06 | Document UX | Scanned PDFs without OCR text stream cannot be searched before running OCR tool. | Detected via FIX-06 guard; user guided via UI banner to run OCR step first. | **OCR CHAINING TEST** |
| **F-09** | Phase 09 | AI & BYOK | BYOK AES-256-GCM envelope encryption requires production key vault secret `AI_KEY_ENCRYPTION_SECRET`. | Fails closed (`BYOK_KEYVAULT_UNCONFIGURED`) if secret is missing or under 16 bytes. | **VAULT SECURITY AUDIT** |
| **F-10** | Phase 09 | Privacy | External AI providers receive document snippets only when explicit consent (`aiConsent: true`) is provided. | Middleware `requireAiConsent` returns HTTP 403 `AI_CONSENT_REQUIRED` if unconsented. | **CONSENT BOUNDARY TEST** |
| **F-11** | Phase 11 | Billing & Store | Apple IAP & Google Play Billing requires native store adapter when packaged for mobile stores; web uses Stripe. `BILLING_ENABLED=false` safety gate active until production approval. | Documented in `STORE_BILLING_POLICY_REVIEW.md`; Safety gate prevents live checkout. | **MULTI-PLATFORM BILLING AUDIT** |
| **F-12** | Phase 11 | FinOps | Variable worker costs require monthly active subscriber ratio $> 18-20$ paying users to exceed fixed baseline ($122/mo). | Outlined in `COGS_SCENARIOS.md`; daily usage caps protect against runaway LLM and worker compute. | **FINOPS MARGIN DRIFT TEST** |
| **F-13** | Phase 12 | PWA & Security | Eliminated broad `/api/` cache in Workbox to prevent storing user tokens; strict allowlist only. | `client/vite.config.js` and `AuthContext` logout cache purge. | **CACHE ISOLATION AUDIT** |
| **F-14** | Phase 12 | SEO & Staging | Vercel rewrite ordering `/api/(.*)` before `/(.*)` fixed to prevent API endpoints returning SPA HTML. | `client/vercel.json` and `_redirects` updated. | **STAGING REWRITE AUDIT** |
| **F-15** | Phase 13 | Windows & Store | Official MSIX binary generation requires Microsoft Partner Center Package Identity (Identity Name, Publisher CN) from human owner account. Blocked until owner completes ID verification. | Documented in `docs/OWNER_ACTIONS.md` and `docs/releases/MS_STORE_CHECKLIST.md`. | **STORE SUBMISSION AUDIT** |

---

## 3. Unresolved Non-Blocking Operational & Architectural Concerns

1. **Redis Persistence Configuration on Render:**
   - *Concern:* Managed Redis on free/starter tiers may not persist AOF (Append-Only File) to disk across host migrations.
   - *Action Plan:* Document that Render Redis must be configured with persistent disk or enterprise Valkey tier before enabling public asynchronous batch processing.
2. **Client-Side Vercel API Proxy:**
   - *Concern:* Direct relative calls to `/api/*` from Vercel require valid rewrites in `client/vercel.json` pointing to the live Render backend URL (`https://filetools-jkx7.onrender.com`).
   - *Action Plan:* Finalize production environment variable `VITE_API_URL` vs Vercel Serverless Function proxy in Phase 13 staging rehearsal.
3. **Database Index Verification:**
   - *Concern:* High volume of file queries and job lookups requires compound indexes (`ownerId + createdAt`, `status + expiresAt`).
   - *Action Plan:* Ensure all Mongo models (`FileRecord`, `JobRecord`, `WorkflowRun`) define exact compound indexes with background creation.

---

## 4. UI / UX & Accessibility Backlog

- [x] **WCAG AA Contrast Compliance:** All 6 semantic themes (`arctic-precision`, `ember-studio`, `apple-modern`, `vibrant-sunset`, `earthy-minimal`, `midnight-neon`) pass $\ge 4.5:1$ for normal text and $\ge 7:1$ for primary headings.
- [x] **Motion Policy Compliance:** System-wide zero-motion enforcement under `prefers-reduced-motion: reduce`.
- [ ] **PWA Offline Service Worker Caching:** Ensure offline shell displays informative fallback for tools requiring cloud workers (e.g. LibreOffice conversion, Whisper speech recognition).
- [ ] **Monaco Editor Theme Synchronization:** Ensure Monaco code editor theme dynamically updates when user selects one of the 6 application themes in `ThemeSelector`.

---

## 5. Security, Authorization & Privacy Invariants

The following security invariants are strictly enforced and must never be relaxed:
1. **Private by Default:** All files in R2 and local temporary storage are private. No public `/uploads` or `/outputs` directory serving.
2. **Fail-Closed Auth:** An outage of MongoDB Auth cluster must return HTTP 503 `AUTH_DB_UNAVAILABLE` and **never** elevate users to `plan: 'pro'`.
3. **SSRF Network Deny-All:** Any server-side rendering of user HTML or remote URLs must deny loopback (`127.0.0.1`), private RFC1918 subnets, and cloud metadata (`169.254.169.254`).
4. **Permanent Redaction:** Redaction must permanently remove vector text streams from the output PDF. Vector overlays (`flatten=false`) are strictly disallowed.
5. **No Embedded User IDs in Templates:** Workflow and automation templates must be 100% sanitized and parameterized, containing zero hardcoded file keys or personal identifiers.

---

## 6. Verification Checklist for Phase 14 (Final Production Audit)

Prior to issuing a **GO / NO-GO** certification for public release, Phase 14 must execute:
- [ ] **E2E Load Test:** 20 concurrent simulated users executing mixed PDF, image, and workflow jobs.
- [ ] **Negative Cross-Tenant Security Audit:** Automated penetration test verifying synthetic User B cannot read, mutate, or download User A's files, jobs, or workflow runs.
- [ ] **Stripe Sandbox Reconciliation:** Full lifecycle test of checkout, webhook signature verification, quota allocation, plan upgrade, and cancellation.
- [ ] **Windows App Certification Kit (WACK):** Verify packaged MSIX passes all automated Microsoft Store compliance checks.
- [ ] **Zero-Leak Memory Test:** Verify 1-hour continuous worker execution leaves no orphan child processes, zombie Chromium instances, or leaked temporary files.
