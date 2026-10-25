# 🔍 FileTools Pro — Minimal Configuration Delta Matrix
**Document ID:** `FT-STAGING-13`  
**Target Candidate:** `release/v1.0.0-candidate` (PR #15)  
**Evaluation Date:** 2026-10-25  
**Audience:** Platform Owner, Infrastructure Engineer, Release SRE  
**Core Principle:** **Reuse Existing Infrastructure — Maximum Logical Isolation, Zero Unnecessary Resources ($0 Incremental Cost)**  

---

## 1. Executive Summary

This document specifies the exact, minimal delta required to connect the FileTools Pro v1.0.0 Release Candidate to the owner's running infrastructure. 

Rather than provisioning new accounts or spinning up redundant cloud resources, the release candidate leverages **logical multi-tenancy**:
- **MongoDB Atlas:** Isolated database names on existing clusters (`/filetools_auth_staging` and `/filetools_data_staging`).
- **Redis / Valkey:** Isolated BullMQ queue names (`BULLMQ_QUEUE_NAME=filetools-jobs-staging`) on the existing Redis instance to eliminate job stealing.
- **Cloudflare R2:** Dedicated staging bucket (`filetools-staging-uploads`) in the existing Cloudflare R2 account.
- **Vercel:** Existing automatic preview deployments with edge rewrites already configured in [client/vercel.json](file:///C:/Users/Admin/test_app/filetools-app/client/vercel.json).
- **Render:** Updating the active branch and environment variables on the existing Render Web and Worker services.

---

## 2. Master Delta Matrix

| Component | Existing Resource Today | Release Candidate Requirement | Action Needed (Reuse / Update / Provision) | New Resource Required? | Incremental Cost | Owner Dashboard Access Required? |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Frontend Web** | Vercel Project `filetool-app` (`minh-2742`) | Preview deployment of PR #15 branch `release/v1.0.0-candidate` | **Reuse** existing Vercel project; preview is automatically active at `filetool-app-git-release-v100-candidate-minh-2742.vercel.app` | **No** | **$0** | No (Vercel automatically built & deployed) |
| **Backend Web API** | Render Web Service `filetools-backend` (Docker Starter) | Container deployment with security invariants (`APP_ENV=staging`, `NODE_ENV=production`) | **Update** environment variables in Render Web dashboard and point to candidate branch | **No** | **$0** | Yes (set environment variables in Render dashboard) |
| **Backend Worker** | Render Background Worker (or Web-colocated) | BullMQ worker consuming async heavy jobs ([server/worker.js](file:///C:/Users/Admin/test_app/filetools-app/server/worker.js)) | **Reuse / Update** worker start command (`node server/worker.js`) and queue name | **No** | **$0** | Yes (verify worker service in Render dashboard) |
| **Auth Database** | Atlas Cluster 0 (`cluster0.dpjmacd.mongodb.net`) | Isolated Auth DB with strict user/session/key records | **Reuse** existing cluster; specify `/filetools_auth_staging` in URI | **No** | **$0** | No (URI query path is passed via Render env var) |
| **Data Database** | Atlas Cluster 1 (`cluster1.d8zqt6m.mongodb.net`) | Isolated Data DB with FileRecord, Quota, DAG workflows | **Reuse** existing cluster; specify `/filetools_data_staging` in URI | **No** | **$0** | No (URI query path is passed via Render env var) |
| **Redis / Queue** | Existing Redis instance (Upstash / Render) | Durable BullMQ queue without silent in-memory fallback | **Reuse** existing Redis; set `BULLMQ_QUEUE_NAME=filetools-jobs-staging` | **No** | **$0** | No (queue name is passed via Render env var) |
| **Object Storage** | Cloudflare R2 Account (`ae5cdb78c294cc4...`) | Private storage with short-lived presigned download URLs | **Reuse** existing account; create bucket `filetools-staging-uploads` (or use prefix) | **No** (new bucket in same account is free) | **$0** | Yes (create bucket in Cloudflare dashboard, 30s) |
| **OAuth Identity** | Google Cloud & GitHub OAuth Apps | OAuth login with cryptographic HMAC state origin check | **Reuse** existing apps; add staging callback URI to authorized list | **No** | **$0** | Yes (add 1 redirect URI in Google/GitHub console) |
| **AI Providers** | Google Gemini 2.5 Flash / Pro, Groq, OpenRouter | Normalized active models with BYOK vault encryption | **Reuse** existing API keys; token telemetry is isolated by DB | **No** | **$0** | No (re-use existing keys in Render env) |
| **Payment Gateway** | Stripe Account (Keys in `.env`) | Blocked checkout creation via `BILLING_ENABLED=false` | **Reuse** existing keys; keep `BILLING_ENABLED=false` | **No** | **$0** | No (already enforced by code gate) |

---

## 3. Deep-Dive: Service-by-Service Minimal Delta

### 3.1 Vercel Frontend
1. **What exists today:**
   * Active Vercel project `filetool-app` linked to GitHub repo `trminh18122022leo-gif/filetool_app`.
   * PR #15 automatically generated and deployed preview:  
     `https://filetool-app-git-release-v100-candidate-minh-2742.vercel.app`
2. **What candidate requires:**
   * Rewrites for `/api/(.*)`, `/socket.io/(.*)`, and `/collab/(.*)` to point to staging backend.
   * Already committed and verified in [client/vercel.json](file:///C:/Users/Admin/test_app/filetools-app/client/vercel.json).
3. **Minimum change needed:**
   * **None in code or Git.**
   * If custom backend domain is desired, owner can optionally set `VITE_API_URL` in Vercel project environment variables (for Preview environment only). Otherwise, the default edge rewrite proxies directly.
4. **Environment isolation:**
   * Handled 100% by host-header detection in Vercel edge rewrite.

---

### 3.2 Render Web Service (`filetools-backend`)
1. **What exists today:**
   * Service defined in [render.yaml](file:///C:/Users/Admin/test_app/filetools-app/render.yaml) (`runtime: docker`, `region: singapore`).
2. **What candidate requires:**
   * Docker build of [Dockerfile](file:///C:/Users/Admin/test_app/filetools-app/Dockerfile).
   * Liveness probe: `/api/live`.
   * Readiness probe: `/api/ready` (evaluates AuthDB && DataDB && Redis && R2).
   * Security environment: `NODE_ENV=production`, `APP_ENV=staging`.
3. **Minimum change needed:**
   * In Render Dashboard $\rightarrow$ Web Service settings:
     * Point branch to `release/v1.0.0-candidate` (or deploy from existing staging service).
     * Update Environment Variables table as detailed in Section 4.
4. **Environment isolation:**
   * `APP_ENV=staging` activates staging CORS rules, non-production OAuth redirects, and staging audit tagging.

---

### 3.3 Render Background Worker
1. **What exists today:**
   * [server/worker.js](file:///C:/Users/Admin/test_app/filetools-app/server/worker.js) implements the full BullMQ job processor.
2. **What candidate requires:**
   * Background process executing `node server/worker.js` with access to the same MongoDB and Redis.
3. **Minimum change needed:**
   * In Render Dashboard:
     * If using an existing Render Background Worker: set Start Command to `node server/worker.js`, copy identical environment variables from Web Service, and set `SERVICE_ROLE=worker`.
     * Set `BULLMQ_QUEUE_NAME=filetools-jobs-staging` to prevent job collision with production.
4. **Environment isolation:**
   * Queue name segregation ensures workers never pull jobs across environments.

---

### 3.4 MongoDB Atlas (Auth & Data Clusters)
1. **What exists today:**
   * Cluster 0: `cluster0.dpjmacd.mongodb.net` (Auth).
   * Cluster 1: `cluster1.d8zqt6m.mongodb.net` (Data).
2. **What candidate requires:**
   * Database connectivity for [server/config/database.js](file:///C:/Users/Admin/test_app/filetools-app/server/config/database.js).
3. **Minimum change needed:**
   * **Zero cluster creation.** Simply append `/filetools_auth_staging` and `/filetools_data_staging` to the existing connection string:
     ```text
     AUTH_DB_URI=mongodb+srv://<user>:<password>@cluster0.dpjmacd.mongodb.net/filetools_auth_staging?retryWrites=true&w=majority
     DATA_DB_URI=mongodb+srv://<user>:<password>@cluster1.d8zqt6m.mongodb.net/filetools_data_staging?retryWrites=true&w=majority
     ```
   * MongoDB Atlas will automatically provision these logical databases upon first write.

---

### 3.5 Redis / Valkey Queue
1. **What exists today:**
   * Single Redis instance (Upstash or Render Redis).
2. **What candidate requires:**
   * Durable BullMQ queue connection string (`REDIS_URL`).
3. **Minimum change needed:**
   * Re-use the existing `REDIS_URL`.
   * Add environment variable:
     ```text
     BULLMQ_QUEUE_NAME=filetools-jobs-staging
     ```
   * This partitions all job keys under the staging queue name, completely isolating staging and production workloads on the same Redis instance.

---

### 3.6 Cloudflare R2 Storage
1. **What exists today:**
   * Cloudflare R2 Account with endpoint `https://ae5cdb78c294cc4ff82715bbe5cd0a2c.r2.cloudflarestorage.com`.
2. **What candidate requires:**
   * Storage bucket for presigned uploads/downloads with short TTL.
3. **Minimum change needed:**
   * Log in to Cloudflare Dashboard $\rightarrow$ R2 $\rightarrow$ Create Bucket: `filetools-staging-uploads`.
   * In Render environment variables, set:
     ```text
     R2_BUCKET_NAME=filetools-staging-uploads
     ```
   * Reuse the existing `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
   * Cloudflare R2 charges **$0** per additional bucket.

---

### 3.7 OAuth Identity Providers
1. **What exists today:**
   * Google Cloud OAuth 2.0 Client ID & Secret.
   * GitHub OAuth App Client ID & Secret.
2. **What candidate requires:**
   * Whitelisted redirect URIs for authentication callbacks.
3. **Minimum change needed:**
   * In Google Cloud Console $\rightarrow$ APIs & Services $\rightarrow$ Credentials $\rightarrow$ Existing OAuth Client:
     * Add Authorized Redirect URI: `https://<render-service-url>/api/auth/google/callback`
   * In GitHub Developer Settings $\rightarrow$ OAuth Apps $\rightarrow$ Existing App:
     * Add Authorization callback URL (or maintain preview domain callback).
   * **Zero new GCP projects or GitHub OAuth apps.**

---

## 4. Render Environment Variables Reference (Copy-Paste Ready)

Set these exact variables on the **Render Web API** service for Staging:

```ini
# Environment & Isolation
NODE_ENV=production
APP_ENV=staging
PORT=3001
SERVICE_ROLE=web

# Server & Client URLs
SERVER_URL=https://staging-filetools-api.onrender.com
CLIENT_URL=https://filetool-app.vercel.app
STAGING_CLIENT_URL=https://filetool-app-git-release-v100-candidate-minh-2742.vercel.app

# Cryptographic Secrets (Reused from existing config)
JWT_SECRET=<REUSE_EXISTING_JWT_SECRET>
JWT_REFRESH_SECRET=<REUSE_EXISTING_JWT_REFRESH_SECRET>
AI_KEY_ENCRYPTION_SECRET=<REUSE_OR_GENERATE_32_HEX_CHARS>

# MongoDB Atlas Multi-Cluster (Logical DB Name Isolation)
AUTH_DB_URI=mongodb+srv://<USER>:<PASS>@cluster0.dpjmacd.mongodb.net/filetools_auth_staging?retryWrites=true&w=majority
DATA_DB_URI=mongodb+srv://<USER>:<PASS>@cluster1.d8zqt6m.mongodb.net/filetools_data_staging?retryWrites=true&w=majority

# Redis BullMQ Queue (Queue Name Isolation)
REDIS_URL=<REUSE_EXISTING_REDIS_URL>
BULLMQ_QUEUE_NAME=filetools-jobs-staging
REQUIRE_DURABLE_QUEUE=true

# Cloudflare R2 (Dedicated Bucket in Existing Account)
R2_ENDPOINT=https://ae5cdb78c294cc4ff82715bbe5cd0a2c.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<REUSE_EXISTING_R2_ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<REUSE_EXISTING_R2_SECRET_ACCESS_KEY>
R2_BUCKET_NAME=filetools-staging-uploads
REQUIRE_CLOUD_STORAGE=true

# OAuth & AI Providers (100% Reused)
GOOGLE_CLIENT_ID=<REUSE_EXISTING_GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<REUSE_EXISTING_GOOGLE_CLIENT_SECRET>
GITHUB_CLIENT_ID=<REUSE_EXISTING_GITHUB_CLIENT_ID>
GITHUB_CLIENT_SECRET=<REUSE_EXISTING_GITHUB_CLIENT_SECRET>
GOOGLE_API_KEY=<REUSE_EXISTING_GOOGLE_API_KEY>
GROQ_API_KEY=<REUSE_EXISTING_GROQ_API_KEY>

# Mandatory Safety Controls
BILLING_ENABLED=false
ENABLE_URL_TO_PDF=false
CHROMIUM_NO_SANDBOX=false
ALLOW_SANDBOX_FALLBACK=false
```

---

## 5. Incremental Cost Audit

$$\text{Total Incremental Cost} = \$0.00 \text{ USD}$$

* **Vercel:** Included in existing plan (preview deployments are free).
* **Render:** Reuses existing Web & Worker compute instances.
* **MongoDB Atlas:** $0 (logical database creation on existing clusters is free).
* **Redis / Valkey:** $0 (logical queue prefixing on existing Redis is free).
* **Cloudflare R2:** $0 base cost (unlimited buckets per account; storage billing only applies to actual GB stored, which for staging test files is $<\$0.01$).
* **OAuth Providers:** Free.
* **AI Providers:** Free base tier or pay-as-you-go token usage.
