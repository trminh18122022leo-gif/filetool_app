# 📘 FileTools Pro — Infrastructure Owner Setup & Staging Guide
**Document ID:** `FT-STAGING-07`  
**Target Release:** FileTools Pro v1.0.0-candidate  
**Audience:** Platform Owner, Infrastructure Engineer, Production SRE  
**Scope:** Staging Environment Provisioning & Pre-Deployment Verification  
**Security Boundary:** Stop at the owner provisioning boundary; do NOT connect live production credentials or enable Stripe billing.  
**Date:** 2026-10-25  

---

## 1. System Topology Overview

FileTools Pro utilizes a resilient, decoupled architecture designed for high security, horizontal scalability, and strict tenant isolation:

```mermaid
flowchart TD
    subgraph ClientLayer ["Frontend Layer (Vercel Edge)"]
        SPA["React SPA (Vite v6)"]
        VercelRewrite["Vercel Edge Proxies (/api, /collab, /socket.io)"]
    end

    subgraph ComputeLayer ["Compute Layer (Render.com)"]
        WebAPI["Web API Service (Node 22 / Express)"]
        Worker["Background Job Worker (BullMQ Consumer)"]
    end

    subgraph DataLayer ["Data & Storage Layer"]
        AuthDB["MongoDB Atlas Cluster 0 (Auth, Keys, Rate Limits)"]
        DataDB["MongoDB Atlas Cluster 1 (Files, Audits, Workspaces)"]
        Redis["Upstash Redis (Durable BullMQ Queue & Cache)"]
        R2["Cloudflare R2 (Private S3-Compatible Storage)"]
    end

    subgraph ExternalLayer ["External Services"]
        GoogleOAuth["Google Cloud OAuth 2.0"]
        GitHubOAuth["GitHub OAuth App"]
        GoogleAI["Google Gemini 2.5 Flash / Pro"]
        GroqAI["Groq Cloud LPU (Failover)"]
    end

    SPA -->|HTTPS /api| VercelRewrite
    VercelRewrite -->|HTTPS Proxy| WebAPI
    SPA -.->|Direct WSS /socket.io & /collab| WebAPI

    WebAPI -->|Durable Jobs| Redis
    Redis -->|Consume Jobs| Worker

    WebAPI -->|Read/Write Auth| AuthDB
    WebAPI -->|Read/Write Metadata| DataDB
    Worker -->|Read/Write Processing| DataDB

    WebAPI -->|Presigned URLs| R2
    Worker -->|Stream IO| R2

    WebAPI --> GoogleOAuth
    WebAPI --> GitHubOAuth
    Worker --> GoogleAI
    Worker --> GroqAI
```

---

## 2. Vercel Staging Frontend Setup

### 2.1 Project Creation & Git Integration
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New Project** $\rightarrow$ **Import Git Repository**.
3. Select `trminh18122022leo-gif/filetool_app`.
4. Configure Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### 2.2 Environment Variables (Vercel - Preview & Development)
Set the following variables for **Preview** and **Development** environments (leave Production blank or unassigned until official launch):

| Variable Name | Environment | Value / Description |
| :--- | :--- | :--- |
| `VITE_APP_ENV` | Preview, Dev | `staging` |
| `VITE_API_URL` | Preview | Leave empty `""` (relies on [client/vercel.json](file:///C:/Users/Admin/test_app/filetools-app/client/vercel.json) rewrites) |
| `VITE_WS_URL` | Preview | `wss://staging-filetools-api.onrender.com` |

> [!NOTE]
> [client/vercel.json](file:///C:/Users/Admin/test_app/filetools-app/client/vercel.json) contains host-conditioned rewrites. Any Vercel domain matching `.*-(?:git|preview|staging|candidate).*\.vercel\.app` will automatically proxy `/api/*`, `/socket.io/*`, and `/collab/*` to `https://staging-filetools-api.onrender.com`.

---

## 3. Render.com Compute Services Setup

FileTools Pro requires two separate compute services on Render:
1. **Web Service (`staging-filetools-api`):** Handles REST API, WebSocket connections, OAuth flows, and health probes.
2. **Background Worker (`staging-filetools-worker`):** Pulls asynchronous processing jobs (PDF conversion, OCR, media transcoding) from BullMQ Redis.

### 3.1 Web Service Configuration
- **Name:** `staging-filetools-api`
- **Environment:** `Node` (or `Docker` using repository `Dockerfile`)
- **Region:** Singapore (`sin`) or Oregon (`us-west`) — recommend placing in the same region as MongoDB Atlas and Upstash Redis.
- **Branch:** `release/v1.0.0-candidate`
- **Build Command:** `npm ci --omit=dev`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/live` (Liveness) and `/api/ready` (Readiness)
- **Auto-Deploy:** `Yes` on branch push

### 3.2 Background Worker Configuration
- **Name:** `staging-filetools-worker`
- **Environment:** `Node` (or `Docker`)
- **Region:** Same region as Web Service
- **Branch:** `release/v1.0.0-candidate`
- **Build Command:** `npm ci --omit=dev`
- **Start Command:** `npm run worker`
- **Auto-Deploy:** `Yes` on branch push

### 3.3 Native Toolchain Dependency Requirements
If deploying via Render native Node environment (instead of Docker), ensure the following Debian system packages are present:
- `poppler-utils` (`pdftotext`, `pdftoppm`)
- `ghostscript` (`gs`)
- `qpdf`
- `libreoffice` (`soffice` headless for DOCX/XLSX $\leftrightarrow$ PDF conversion)
- `tesseract-ocr` & `tesseract-ocr-vie`
- `ffmpeg`
- `chromium`

> [!TIP]
> Deploying using the provided [Dockerfile](file:///C:/Users/Admin/test_app/filetools-app/Dockerfile) automatically provisions all required binary utilities, multilingual CJK/Vietnamese fonts, and creates an isolated non-root user (`filetools` uid 1001) for sandboxed execution.

---

## 4. Backing Services Provisioning

### 4.1 MongoDB Atlas (Dual-Cluster Separation)
FileTools Pro enforces dual-cluster physical separation between authentication security data and user processing data:
1. **Cluster 0 (Auth Database):**
   - Stores: Users, Refresh Tokens, ApiKeys, Login Attempts, MFA Secrets.
   - URI format: `mongodb+srv://<auth_user>:<auth_pwd>@staging-auth.mongodb.net/filetools_auth?retryWrites=true&w=majority`
2. **Cluster 1 (Data Database):**
   - Stores: File Records, Audit Logs, Processing History, Collaboration Documents.
   - URI format: `mongodb+srv://<data_user>:<data_pwd>@staging-data.mongodb.net/filetools_data?retryWrites=true&w=majority`
3. **Network Access:** Allowlist the outbound static IPs or range of Render Web Service and Worker.

### 4.2 Upstash Redis (Durable Queue & Cache)
1. Log in to [Upstash Console](https://console.upstash.com).
2. Create a Redis Database named `staging-filetools-redis`.
3. Enable **TLS (rediss://)** and **Eviction: No Eviction** (required for BullMQ queue reliability).
4. Copy the connection string: `rediss://default:<password>@<endpoint>.upstash.io:6379`.

### 4.3 Cloudflare R2 (Private S3-Compatible Object Storage)
1. Log in to Cloudflare Dashboard $\rightarrow$ **R2**.
2. Create Bucket: `filetools-staging-uploads`.
3. **Security Invariant:** Ensure **Public Access is DISABLED**. The bucket must remain completely private.
4. Navigate to **Manage R2 API Tokens** $\rightarrow$ **Create API Token**.
   - Permissions: `Object Read & Write`
   - Specify bucket: `filetools-staging-uploads`
5. Note down:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Endpoint: `https://<account_id>.r2.cloudflarestorage.com`

---

## 5. Complete Environment Variables Manifest

Configure the following variables in **Render Dashboard** $\rightarrow$ **Environment Groups** $\rightarrow$ Link to both `staging-filetools-api` and `staging-filetools-worker`:

| Variable Name | Required | Example Format | Purpose / Invariants |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security behaviors and hardened error handling |
| `APP_ENV` | Yes | `staging` | **CRITICAL:** Enforces staging isolation, non-production redirects, and staging CORS |
| `SERVICE_ROLE` | Yes | `web` (on Web API), `worker` (on Worker) | Identifies component responsibility for readiness checks |
| `PORT` | Yes | `3001` or `10000` | Port assigned by Render for inbound HTTP/WS traffic |
| `SERVER_URL` | Yes | `https://staging-filetools-api.onrender.com` | Public base URL of backend API |
| `CLIENT_URL` | Yes | `https://filetool-app.vercel.app` | Canonical production frontend domain |
| `STAGING_CLIENT_URL` | Yes | `https://filetool-app-git-staging.vercel.app` | Canonical staging frontend domain |
| `ALLOWED_ORIGINS` | No | Comma-separated domains | Explicit list of additional verified preview domains |
| `JWT_SECRET` | Yes | 64+ char random hex string | Signs access tokens and HMAC OAuth state tokens |
| `AUTH_DB_URI` | Yes | `mongodb+srv://...` | Connection string to Cluster 0 (Auth Database) |
| `DATA_DB_URI` | Yes | `mongodb+srv://...` | Connection string to Cluster 1 (Data Database) |
| `REDIS_URL` | Yes | `rediss://default:...@...upstash.io:6379` | Durable BullMQ queue and rate limit store |
| `REQUIRE_DURABLE_QUEUE` | Yes | `true` | Fails closed if Redis connection drops |
| `R2_ACCOUNT_ID` | Yes | 32 char Cloudflare ID | R2 Account identifier |
| `R2_ACCESS_KEY_ID` | Yes | Access key string | S3 client access key |
| `R2_SECRET_ACCESS_KEY` | Yes | Secret access key string | S3 client secret key |
| `R2_BUCKET_NAME` | Yes | `filetools-staging-uploads` | Name of the private R2 bucket |
| `REQUIRE_CLOUD_STORAGE` | Yes | `true` | Fails closed if cloud storage client fails |
| `BILLING_ENABLED` | Yes | `false` | **MANDATORY:** Must remain `false` during staging |
| `CHROMIUM_NO_SANDBOX` | Yes | `false` | Headless Chromium execution sandboxing |
| `ALLOW_SANDBOX_FALLBACK` | Yes | `false` | Fails closed with 503 if sandbox is unavailable |
| `ENABLE_URL_TO_PDF` | Yes | `false` | Disables untrusted SSRF-prone URL rendering |
| `GOOGLE_CLIENT_ID` | Optional | `*.apps.googleusercontent.com` | Google OAuth 2.0 Client ID (staging app) |
| `GOOGLE_CLIENT_SECRET` | Optional | Client secret string | Google OAuth 2.0 Secret |
| `GITHUB_CLIENT_ID` | Optional | Client ID string | GitHub OAuth Client ID (staging app) |
| `GITHUB_CLIENT_SECRET` | Optional | Client secret string | GitHub OAuth Secret |
| `GOOGLE_API_KEY` | Optional | API key string | Gemini 2.5 Flash / Pro API key |
| `GROQ_API_KEY` | Optional | API key string | Groq LPU failover key |
| `AI_KEY_ENCRYPTION_SECRET` | Yes | 32 byte hex string | AES-256-GCM master key for BYOK encryption |

> [!CAUTION]
> Never commit real secret keys into Git repositories, PR comments, or chat transcripts. Use Render Secret Groups and Vercel Environment Variables.

---

## 6. Pre-Flight Verification & Smoke Testing Checklist

Once the services are deployed, execute this 6-step smoke test before approving staging:

### Step 1: Liveness Probe
```bash
curl -i https://staging-filetools-api.onrender.com/api/live
```
- **Expected Result:** HTTP 200 OK
- **Response:** `{"status":"alive","timestamp":"...","uptime":...,"pid":...}`

### Step 2: Readiness Probe (Deep Backing Services Verification)
```bash
curl -i https://staging-filetools-api.onrender.com/api/ready
```
- **Expected Result:** HTTP 200 OK
- **Verifications:**
  - `checks.authDatabase: true`
  - `checks.dataDatabase: true`
  - `checks.dualClusterMode: true`
  - `checks.durableQueueReady: true`
  - `checks.storageReady: true`
  - If any check is `false`, verify Atlas, Upstash, or R2 credentials.

### Step 3: WebSocket Connectivity
```bash
wscat -c "wss://staging-filetools-api.onrender.com/socket.io/?EIO=4&transport=websocket"
```
- **Expected Result:** Successful upgrade and Socket.IO handshake packet `0{"sid":"..."}`.

### Step 4: Yjs Tenant Isolation Check
Connect to `wss://staging-filetools-api.onrender.com/collab?room=user_123_private` without token.
- **Expected Result:** Connection terminates with HTTP 401 Unauthorized (`Missing token for collab`).

### Step 5: Frontend Edge Proxy Verification
Open staging preview frontend URL in browser:
- Open Developer Tools $\rightarrow$ Network Tab.
- Trigger login or sample file conversion.
- Verify requests route to `/api/...` and receive response from `staging-filetools-api.onrender.com`.

### Step 6: Worker Execution Smoke Test
Submit a 1-page sample PDF compression or Word conversion:
- Verify BullMQ job is queued in Redis.
- Verify Background Worker picks up the job and outputs progress via WebSocket.
- Verify output file is securely stored in R2 and accessible only via short-lived signed URL.
