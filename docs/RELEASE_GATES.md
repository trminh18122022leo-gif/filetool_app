# PRODUCTION RELEASE GATES & ROLLBACK PROTOCOL
**Document ID:** `RELEASE-GATES-2026-10-23`  
**Execution Sequence:** Linear & Gated (Gates G0 through G9 must pass in strict order)  
**Authority:** Owner approval required at every gate milestone

---

## 1. Release Gates Matrix (G0 through G9)

```
[ G0: Baseline ] ──► [ G1: Security ] ──► [ G2: Reliability ] ──► [ G3: Product/UX ]
                                                                          │
[ G7: Web Prod ] ◄── [ G6: Staging ]  ◄── [ G5: SEO/PWA ]    ◄── [ G4: Billing ]
       │
       ▼
[ G8: Windows Store ] ──► [ G9: Mobile Stores ]
```

| Gate | Title | Primary Objective | Passing Criteria (Hard Definition) | Rollback Trigger |
| :---: | :--- | :--- | :--- | :--- |
| **G0** | **Baseline Audit** | Lock baseline & document unknown states | Git tree clean, HEAD SHA recorded (`d1e5e30d`), baseline build & syntax checks documented without fabrication. | Working tree dirty, uncommitted untracked code. |
| **G1** | **Security Gate** | Close all P0 vulnerabilities (S-01 to S-08) | 100% of P0 items have (a) failing regression test before fix, (b) pass after fix, (c) negative cross-user test, (d) private R2 signed URLs. | Any P0 regression or unauthorized file access. |
| **G2** | **Reliability Gate** | Decouple heavy jobs to BullMQ workers | In-memory queues removed; BullMQ + Redis active; jobs survive API restart; R2 reconciler deletes expired files. | Worker crash under 5 concurrent jobs; memory leak > 512MB. |
| **G3** | **Product & UX Gate** | Core Free flows & Apple-inspired design | Unified File Workspace + PDF Studio; 6 themes verified; WCAG AA contrast pass; video background removed from default. | Broken core tool workflow; mobile layout overflow. |
| **G4** | **Billing & Quotas** | Server-side entitlement ledger & Stripe | Atomic quota reservation, commit, and refund; Free user shows no PRO badge; Stripe sandbox checkout & webhook verified. | Double billing; quota deduction failure; client-side plan override. |
| **G5** | **SEO & PWA Gate** | Public discoverability & PWA validation | Pre-rendered static HTML landing pages; sitemap & robots verified; PWA passes installability checks; no private routes leaked. | Private URLs in sitemap; broken PWA service worker. |
| **G6** | **Staging Rehearsal** | Full end-to-end rehearsal | Full automated E2E test suite pass; load test with 20 concurrent simulated users; zero 500/504 errors. | E2E failure rate > 0%; HTTP 504 timeout on supported operations. |
| **G7** | **Web Production** | Production deployment on Vercel & Render | Owner explicit "GO" sign-off; deployment SHA verified; post-deploy smoke tests pass on live domain. | Any live 500 error on core tools; auth failure. |
| **G8** | **Windows Store** | Microsoft Store submission package | PWA/MSIX packaged via PWABuilder; passes Windows App Certification Kit (WACK); deep link & file association pass. | WACK failure; install/uninstall crash. |
| **G9** | **Mobile Stores** | Android (Play Store) & iOS (App Store) | Touch UX verified; Google Play / Apple IAP compliance review complete; release builds signed and verified on physical devices. | App store review rejection; IAP non-compliance. |

---

## 2. Release Branch & Commit Policy

To ensure 100% traceability and zero undocumented changes:

1. **Branch Protection:**
   * Direct push to `main` is prohibited during implementation phases.
   * Implementation work must occur on dedicated feature branches: `fix/g1-security-p0`, `feat/g2-bullmq-worker`, `feat/g3-workspace-ui`.
2. **Commit Naming Standard:**
   * Format: `<type>(<scope>): <finding-id> <description>`
   * Examples:
     * `fix(security): S-01 replace static file serving with signed R2 URLs`
     * `fix(auth): S-02 enforce fail-closed validation on Telegram callback`
     * `refactor(worker): S-10 integrate BullMQ durable worker pool`
3. **Audit Provenance:**
   * Every commit fixing an audit finding must reference the finding ID (S-01 through S-23) and include automated tests verifying the fix.

---

## 3. Rollback Methodology per Service Tier

| Tier | Deployment Target | Rollback Mechanism | Target Recovery Time (RTO) |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Vercel | Vercel Instant Rollback to previous deployment SHA via Vercel Dashboard / CLI (`vercel rollback`). | < 1 minute |
| **Backend API** | Render | Render Deploy Rollback to previous healthy image SHA or previous stable git commit. | < 3 minutes |
| **Database** | MongoDB Atlas | Point-in-time Restore (PITR) from automated continuous backup snapshot. | < 15 minutes |
| **Object Storage** | Cloudflare R2 | Object Versioning enabled on bucket; revert lifecycle rules if reconciler fails. | < 5 minutes |
