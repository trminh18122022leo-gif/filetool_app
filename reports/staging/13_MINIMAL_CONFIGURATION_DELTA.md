# 🔍 FileTools Pro — Minimal Configuration Delta & Isolation Matrix
**Document ID:** `FT-STAGING-13`  
**Target Candidate:** `release/v1.0.0-candidate` (PR #15)  
**Evaluation Date:** 2026-10-26  
**Audience:** Platform Owner, Infrastructure Engineer, Release SRE  
**Core Directive:** **REUSE EXISTING ACCOUNTS WITH STRICT RUNTIME & DATA ISOLATION**  

---

## 1. Executive Summary

This document specifies the exact configuration delta required to run the FileTools Pro v1.0.0 Release Candidate safely against the owner's existing infrastructure.

**Critical Safety Requirement:**  
Never change the branch, start command, or environment variables of an active production Render service. Modifying an active production service would immediately degrade or break live production API traffic.

Instead, the candidate establishes **account-level reuse with strict runtime isolation**:
- **Compute Isolation:** Deploy a separate staging Web service (`staging-filetools-api`) on the existing Render account.
- **Database Isolation:** Use logical database names (`filetools_auth_staging` and `filetools_data_staging`) on existing Atlas clusters with optional database-scoped credentials.
- **Queue & Pub/Sub Isolation:** Use `BULLMQ_QUEUE_NAME=filetools-jobs-staging` and Redis channel `filetools_staging:job-events` on the existing Redis instance.
- **Storage Isolation:** Use a dedicated private bucket `filetools-staging-uploads` in the existing Cloudflare R2 account with optional bucket-scoped tokens.
- **Cryptographic Isolation:** Staging uses separate, randomly generated `JWT_SECRET` and `JWT_REFRESH_SECRET` values to prevent token replay between staging and production.
- **Document-Level Authorization:** All Yjs collaboration rooms are backed by MongoDB [server/models/CollabRoom.js](file:///C:/Users/Admin/test_app/filetools-app/server/models/CollabRoom.js) and verified via [server/services/collabAuth.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/collabAuth.js), rejecting unauthorized cross-account access regardless of room naming convention.

---

## 2. Infrastructure Reuse vs. Runtime Isolation Matrix

| Component | Existing Resource Today | Release Candidate Staging Requirement | Action Needed (Reuse / Update / Provision) | Separate Runtime Resource? | Incremental Cost | Dashboard Access Required? |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Frontend Web** | Vercel Project `filetool-app` (`minh-2742`) | Preview deployment of PR #15 branch `release/v1.0.0-candidate` | **Reuse** existing project; auto-deployed at `filetool-app-git-release-v100-candidate-minh-2742.vercel.app` | **No** (Vercel Preview) | **$0.00** | No (Auto-built on PR push) |
| **Backend Web API** | Render Web Service `filetools-jkx7` (Production) | Dedicated staging Web API (`staging-filetools-api`) with `APP_ENV=staging`, `NODE_ENV=production` | **Deploy separate staging service** on existing Render account; **DO NOT TOUCH PRODUCTION** | **Yes** (Separate Web Service) | **$0.00** (Free plan) or **$7.00/mo** (Starter plan) | Yes (Create service in Render dashboard) |
| **Backend Worker** | Render Background Worker (or Web-colocated) | BullMQ worker consuming async jobs with Redis Pub/Sub event bridge | **Reuse / Colocate** within Staging Web Service, or deploy separate staging worker | **Optional** (Colocated in Free Web service) | **$0.00** (Colocated) or **$7.00/mo** (Separate Worker) | Yes (Configure service in Render) |
| **Auth Database** | Atlas Cluster 0 (`cluster0.dpjmacd.mongodb.net`) | Isolated Auth DB with strict user/session/key records | **Reuse** existing cluster; specify `/filetools_auth_staging` in connection URI | **No** (Logical database on same cluster) | **$0.00** | No (URI passed via Render env) |
| **Data Database** | Atlas Cluster 1 (`cluster1.d8zqt6m.mongodb.net`) | Isolated Data DB with FileRecord, CollabRoom, Quota Ledger | **Reuse** existing cluster; specify `/filetools_data_staging` in connection URI | **No** (Logical database on same cluster) | **$0.00** | No (URI passed via Render env) |
| **Redis / Queue** | Redis instance (Upstash / Render) | Durable BullMQ queue & cross-process Pub/Sub event bridge | **Reuse** existing instance; set `BULLMQ_QUEUE_NAME=filetools-jobs-staging` & `BULLMQ_PREFIX=filetools_staging` | **No** (Queue name & Pub/Sub channel isolation) | **$0.00** | No (Passed via Render env) |
| **Object Storage** | Cloudflare R2 Account (`ae5cdb78c...`) | Private storage bucket with short-lived presigned download URLs | **Reuse** existing account; create private bucket `filetools-staging-uploads` | **No** (Bucket in same account is free) | **$0.00** base cost (pay per GB stored) | Yes (Create bucket in Cloudflare, 30s) |
| **OAuth Identity** | Google Cloud & GitHub OAuth Apps | OAuth login with HMAC-signed state parameter & origin verification | **Reuse** existing apps; add staging callback URI to authorized redirect list | **No** (Same OAuth Client ID) | **$0.00** | Yes (Add 1 redirect URI in Google Console) |
| **AI Providers** | Google Gemini 2.5 Flash / Pro, Groq, OpenRouter | Normalized active models with BYOK envelope encryption | **Reuse** existing API keys; token telemetry isolated by staging DB | **No** (Shared API keys) | **$0.00** base cost (pay-per-token) | No (Re-use keys in Render env) |
| **Cryptographic Secrets** | Production `JWT_SECRET` and refresh secrets | Distinct staging JWT secrets to eliminate cross-environment token replay | **Generate separate secrets** for staging | **Yes** (Distinct secret values) | **$0.00** | Yes (Paste into Render env) |
| **Payment Gateway** | Stripe Account (Keys in `.env`) | Blocked checkout creation via `BILLING_ENABLED=false` | **Reuse** keys; keep `BILLING_ENABLED=false` enforced | **No** | **$0.00** | No (Enforced by code gate) |

---

## 3. Measured Compute Cost Estimation

Rather than claiming unconditional $0 cost, here is the measured financial breakdown:

```
[ STAGING COMPUTE OPTIONS COMPARISON ]

Option A: Render Free Web Service ($0.00 / month)
├── Web API + Worker colocated in single container
├── 512 MB RAM / 0.1 CPU (Shared)
├── 15-minute idle spindown (wakes up in ~30s on HTTP request)
├── Base Monthly Fee: $0.00
└── Recommended for: Functional verification, manual smoke testing, PR validation

Option B: Render Starter Web Service ($7.00 / month)
├── Web API dedicated container (No idle sleep)
├── 512 MB RAM / 0.5 CPU (Dedicated)
├── Optional separate Worker container: +$7.00/month
├── Prorated Daily Cost: $0.23 / day (~$0.92 for a 4-day staging rehearsal)
└── Recommended for: Continuous background processing benchmarks, automated nightly regression
```

* **Cloudflare R2:** $0 base fee (unlimited buckets per account; storage billing is $0.015/GB/month, meaning 500 MB of test files costs $<\$0.01$).
* **MongoDB Atlas:** $0 (logical database creation on existing clusters is free).
* **Redis / Valkey:** $0 (queue name and prefix namespacing on existing instance is free).
* **Vercel:** $0 (preview deployments on existing project are included free).

---

## 4. Deep Isolation Verification Details

### 4.1 Database-Specific User Scoping (MongoDB Atlas)
To guarantee that staging compute can never accidentally write or delete production data:
1. In MongoDB Atlas $\rightarrow$ **Database Access** $\rightarrow$ **Add New Database User**.
2. Username: `filetools_staging_user`.
3. In **Database User Privileges**, select **Specific Privileges**:
   * Add Role: `readWrite` on database `filetools_auth_staging`.
   * Add Role: `readWrite` on database `filetools_data_staging`.
4. Staging credentials have zero permissions on `filetools_auth` or `filetools_data`.

### 4.2 Redis Queue, Prefix & Pub/Sub Isolation
1. **BullMQ Queue Name:** `BULLMQ_QUEUE_NAME=filetools-jobs-staging` (configured in [server/queue/jobQueue.js](file:///C:/Users/Admin/test_app/filetools-app/server/queue/jobQueue.js) and [server/worker.js](file:///C:/Users/Admin/test_app/filetools-app/server/worker.js)).
2. **Key Prefix:** `BULLMQ_PREFIX=filetools_staging` ensures all BullMQ internal keys (`meta`, `wait`, `active`, `id`) are partitioned under `filetools_staging:*`.
3. **Distributed Pub/Sub Bridge:** [server/services/jobEmitter.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/jobEmitter.js) uses channel `filetools_staging:job-events` to relay progress and completion events from workers to Socket.IO without touching production events.

### 4.3 Cloudflare R2 Bucket Privacy & Scoped API Tokens
1. **Private Bucket:** `filetools-staging-uploads` is created with Public Access disabled.
2. **Short-Lived Signed URLs:** All file access uses `@aws-sdk/s3-request-presigner` with HMAC signatures expiring in 900 seconds (15 minutes). Static directory exposure is eliminated.
3. **Bucket-Scoped API Token:** In Cloudflare R2 $\rightarrow$ Manage API Tokens, create a token with `Object Read & Write` scoped strictly to `filetools-staging-uploads`. Staging credentials have zero access to production buckets.

### 4.4 Separate Cryptographic Signing Secrets
1. `JWT_SECRET` and `JWT_REFRESH_SECRET` on staging must be distinct from production.
2. If an access token issued in staging is sent to production, production will reject it with `401 Unauthorized` (`invalid signature`).
3. If a production token is sent to staging, staging will reject it with `401 Unauthorized`.

### 4.5 Exact API & Realtime Destinations
* **Production Frontend:** `filetool-app.vercel.app`, `filetools-app.vercel.app`
  * HTTP API: `https://filetools-jkx7.onrender.com`
  * WebSocket: `wss://filetools-jkx7.onrender.com`
* **Staging Preview Frontend:** `filetool-app-git-release-v100-candidate-minh-2742.vercel.app`
  * HTTP API: `https://staging-filetools-api.onrender.com` (proxied via Vercel edge rewrite)
  * WebSocket: `wss://staging-filetools-api.onrender.com` (direct WSS upgrade)
