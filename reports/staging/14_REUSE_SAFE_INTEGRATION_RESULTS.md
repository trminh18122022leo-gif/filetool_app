# 📋 FileTools Pro — Reuse-Safe Staging Integration Results Report
**Document ID:** `FT-STAGING-14`  
**Target Release:** FileTools Pro v1.0.0-candidate  
**Pull Request:** [Draft PR #15](https://github.com/trminh18122022leo-gif/filetool_app/pull/15)  
**Evaluation Date:** 2026-10-26  
**Audience:** Platform Owner, SRE Lead, Application Security Reviewer  
**Status Verdict:** **STAGING INTEGRATION READY — ZERO PRODUCTION DISRUPTION**  

---

## 1. Executive Summary

This report establishes the final, reuse-safe integration posture for FileTools Pro v1.0.0. 

In accordance with owner directives:
1. **Production Preservation:** The active production Render service, production databases, production Redis queues, and production domains are preserved **100% untouched**.
2. **Account Reuse vs. Runtime Isolation:** All existing cloud accounts, database clusters, storage accounts, and SaaS subscriptions are reused, while runtime execution is strictly isolated.
3. **Realtime Cross-Process Event Bridge:** Implemented a distributed Redis Pub/Sub event bridge in [server/services/jobEmitter.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/jobEmitter.js) and database-backed persistent ownership checks in [server/socket/index.js](file:///C:/Users/Admin/test_app/filetools-app/server/socket/index.js).
4. **Document-Level Authorization:** Implemented MongoDB-backed document access control in [server/models/CollabRoom.js](file:///C:/Users/Admin/test_app/filetools-app/server/models/CollabRoom.js) and [server/services/collabAuth.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/collabAuth.js), rejecting unauthorized cross-account access regardless of room naming convention.
5. **Quality Verification:** All **196 automated tests** pass locally across 97 suites with zero errors.

---

## 2. Resource Categorization Breakdown

```mermaid
flowchart TD
    subgraph Operational ["1. Already Operational Resources"]
        VercelLive["Vercel Project & Live Preview (PR #15)"]
        AtlasClusters["MongoDB Atlas Cluster 0 & 1"]
        R2Account["Cloudflare R2 Account"]
        RedisServer["Redis / Valkey Instance"]
        OAuthAI["OAuth Apps & AI API Keys"]
        ProdService["Production Render Service (Untouched)"]
    end

    subgraph ConfigUpdates ["2. Configuration Updates"]
        StagingDB["Logical DB Names (/filetools_*_staging)"]
        StagingQueue["Queue (filetools-jobs-staging) & Pub/Sub"]
        StagingSecrets["Separate Staging JWT Secrets"]
        CollabAuth["Database-Backed Yjs Document Authorization"]
        RealtimeBridge["Redis Pub/Sub Cross-Process Bridge"]
    end

    subgraph Missing ["3. Actually Missing Resources"]
        StagingBucket["R2 Bucket: filetools-staging-uploads (30s setup)"]
        StagingCompute["Render Staging Service: staging-filetools-api (2m setup)"]
    end

    subgraph OptionalPaid ["4. Optional Paid Infrastructure"]
        StarterCompute["Render Starter Tier ($7/mo - No Spindown)"]
        DedicatedWorker["Render Dedicated Worker ($7/mo)"]
    end

    subgraph E2ETests ["5. Remaining Runtime E2E Tests"]
        ProbeE2E["Liveness & Readiness Probes (/api/live, /api/ready)"]
        RealtimeE2E["Worker to Socket.IO Event Bridge & Reconnect"]
        CollabE2E["Multi-Account Yjs Document Authorization"]
        StorageE2E["Private R2 Upload & Signed URL Download"]
    end

    Operational --> ConfigUpdates
    ConfigUpdates --> Missing
    Missing -.-> OptionalPaid
    Missing --> E2ETests
```

---

### Section 1: Already Operational Resources
These resources already exist, are actively configured in the owner's environment, and require **zero recreation**:

1. **Vercel Frontend Platform:**
   * Team: `minh-2742`, Project: `filetool-app` (ID: `prj_YSBVWaJf6zyxe0r8meCUHevHh3c9`).
   * Production Domain: `https://filetool-app.vercel.app` (HTTP 200).
   * PR #15 Preview: Automatically deployed and live at:  
     👉 `https://filetool-app-git-release-v100-candidate-minh-2742.vercel.app` (HTTP 200).
   * Edge rewrites in [client/vercel.json](file:///C:/Users/Admin/test_app/filetools-app/client/vercel.json) automatically isolate preview traffic.

2. **MongoDB Atlas Multi-Cluster:**
   * Cluster 0 (Auth & Security): `cluster0.dpjmacd.mongodb.net`.
   * Cluster 1 (Data & Storage): `cluster1.d8zqt6m.mongodb.net`.
   * Both clusters are healthy and operational.

3. **Cloudflare R2 Storage Account:**
   * Account Endpoint: `https://ae5cdb78c294cc4ff82715bbe5cd0a2c.r2.cloudflarestorage.com`.
   * Private storage engine active.

4. **Redis / Valkey Instance:**
   * Durable connection manager in [server/queue/connection.js](file:///C:/Users/Admin/test_app/filetools-app/server/queue/connection.js) with exponential backoff and replica failover.

5. **Third-Party Identity & AI Providers:**
   * Google OAuth 2.0 & GitHub OAuth credentials configured in `.env`.
   * AI API keys configured for Gemini 2.5 Flash, Gemini 2.5 Pro, Groq LPU, OpenRouter, Cerebras, Mistral, and Remove.bg.
   * Brevo Email SMTP configured.

6. **Production Render Service:**
   * Active production compute service running live version on `main`.
   * **Preserved 100% untouched.**

---

### Section 2: Configuration Updates Implemented in Release Candidate
The following concrete enhancements were implemented in `release/v1.0.0-candidate` to ensure safe staging reuse:

1. **Cross-Process Realtime Event Bridge ([server/services/jobEmitter.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/jobEmitter.js)):**
   * Background workers publish progress, completion, and error events to Redis Pub/Sub channel `${BULLMQ_PREFIX}:job-events`.
   * Web API process subscribes to the channel and relays events to connected Socket.IO clients in `job:${jobId}` rooms.
   * Eliminates the silent event loss problem between separate worker and web processes.

2. **Persistent Job Ownership & Reconnect Verification ([server/socket/index.js](file:///C:/Users/Admin/test_app/filetools-app/server/socket/index.js)):**
   * Added `hasJobAccessAsync` to query MongoDB `JobRecord` when a client reconnects after page reload or network disruption.
   * Prevents unauthorized users from sniffing job rooms while ensuring legitimate owners seamlessly reconnect.

3. **Database-Backed Document-Level Yjs Authorization ([server/models/CollabRoom.js](file:///C:/Users/Admin/test_app/filetools-app/server/models/CollabRoom.js), [server/services/collabAuth.js](file:///C:/Users/Admin/test_app/filetools-app/server/services/collabAuth.js)):**
   * Replaced simplistic room naming convention checks with database-persisted room ownership in MongoDB.
   * First authenticated visitor registers ownership; subsequent users from different accounts are strictly rejected with `HTTP 403 Forbidden` (`ROOM_ACCESS_DENIED`) unless explicitly added to `collaborators`.
   * Verified by automated tests in [tests/staging/websocket-isolation.test.js](file:///C:/Users/Admin/test_app/filetools-app/tests/staging/websocket-isolation.test.js).

4. **Queue & Database Logical Partitioning:**
   * `BULLMQ_QUEUE_NAME=filetools-jobs-staging` and `BULLMQ_PREFIX=filetools_staging` isolate staging jobs on the shared Redis instance.
   * `/filetools_auth_staging` and `/filetools_data_staging` isolate staging records on the shared Atlas clusters.

5. **Cryptographic Signing Isolation:**
   * Staging environment requires separate `JWT_SECRET` and `JWT_REFRESH_SECRET` values, preventing token cross-replay between staging and production.

---

### Section 3: Actually Missing Resources
Only two lightweight staging assets need creation in the owner's existing cloud dashboards:

| Missing Resource | Where to Create | Time Required | Incremental Cost | Action |
| :--- | :--- | :---: | :---: | :--- |
| **R2 Staging Bucket** | Cloudflare Dashboard $\rightarrow$ R2 | ~30 seconds | **$0.00** | Click **Create bucket** $\rightarrow$ `filetools-staging-uploads`. Disable public access. |
| **Render Staging Service** | Render Dashboard $\rightarrow$ Web Services | ~2 minutes | **$0.00** (Free) | Click **New Web Service** $\rightarrow$ repo `filetool_app` $\rightarrow$ branch `release/v1.0.0-candidate` $\rightarrow$ name `staging-filetools-api`. |

*(Note: No new MongoDB Atlas clusters, no new Redis databases, and no new domain registrations are required).*

---

### Section 4: Optional Paid Infrastructure
If the owner chooses enhanced operational capabilities over the baseline Free tier, the measured costs are:

| Component | Free Plan (Baseline) | Optional Paid Tier | Additional Cost | When to Choose |
| :--- | :--- | :--- | :---: | :--- |
| **Staging Web API** | Render Free Web Service (512MB RAM, 15m spindown) | Render Starter Web Service (512MB RAM, no sleep) | **$7.00 / month** (~$0.23 / day) | If you want zero cold-starts during prolonged testing. |
| **Staging Worker** | Colocated inside Web API container | Dedicated Background Worker service | **$7.00 / month** (~$0.23 / day) | If running heavy batch OCR/transcoding benchmarks exceeding 512MB RAM. |
| **All Other Services** | Free (Atlas, Redis, R2, Vercel) | Unchanged | **$0.00** | Standard operational tier is sufficient. |

---

### Section 5: Remaining Runtime E2E Tests
Before merging PR #15 to `main`, execute these 5 focused runtime verification steps against the deployed staging service:

1. **Liveness Probe:**
   ```bash
   curl -i https://staging-filetools-api.onrender.com/api/live
   ```
   * *Pass Criteria:* HTTP 200 OK with alive status and process metadata.

2. **Readiness Probe:**
   ```bash
   curl -i https://staging-filetools-api.onrender.com/api/ready
   ```
   * *Pass Criteria:* HTTP 200 OK with `authDatabase: true`, `dataDatabase: true`, `durableQueueReady: true`, and `storageReady: true`.

3. **Realtime Cross-Process Progress & Reconnect:**
   * Open `https://filetool-app-git-release-v100-candidate-minh-2742.vercel.app`
   * Submit a multi-step PDF conversion.
   * *Pass Criteria:* Progress bar streams smoothly via WebSocket; browser page reload reconnects and resumes progress display without access errors.

4. **Document-Level Yjs Collaboration Authorization:**
   * Open two browser sessions with different user accounts.
   * User A creates collaborative room `project-notes-v1`.
   * User B attempts direct URL access to `project-notes-v1`.
   * *Pass Criteria:* User B receives HTTP 403 Forbidden until User A adds User B as collaborator.

5. **Private R2 Storage & Pre-signed URL Flow:**
   * Complete a file compression or conversion.
   * *Pass Criteria:* Download link is a pre-signed URL expiring in 15 minutes; direct public access without signature returns HTTP 403.
