# RELEASE EVIDENCE GATE — REPORT 08: OWNER EXTERNAL CONFIGURATION CHECKLIST

**Audit Phase:** Antigravity Release Evidence Gate  
**Audience:** Platform Owner & Production DevOps Lead  
**Security Policy:** This document lists environment variable **NAMES ONLY**. Never output, generate, or commit raw secret values.  

---

## 1. External Infrastructure Checklist

Before live production deployment or traffic routing can occur, the platform owner must configure the following managed cloud services:

### 1.1 MongoDB Atlas (Dual Cluster Architecture)
- [ ] **`AUTH_DB_URI`** (or `MONGODB_AUTH_URI`): Dedicated MongoDB cluster for identity, credentials, JWT blacklist, and sessions.
- [ ] **`DATA_DB_URI`** (or `MONGODB_DATA_URI`): Independent MongoDB cluster for user files, metadata, job records, and workflows.
- [ ] **Network Whitelist:** Allow outbound IP addresses from Render / Vercel cloud hosting containers.

### 1.2 Redis / BullMQ Infrastructure
- [ ] **`REDIS_URL`** (or `REDIS_TLS_URL`): Managed Redis instance (e.g., Upstash Redis, Redis Cloud) with TLS enabled.
- [ ] **Max Memory Policy:** Configure `noeviction` for BullMQ queue integrity.

### 1.3 Cloudflare R2 Object Storage
- [ ] **`R2_ACCOUNT_ID`**: Cloudflare account identifier.
- [ ] **`R2_ACCESS_KEY_ID`**: S3-compatible API token key.
- [ ] **`R2_SECRET_ACCESS_KEY`**: S3-compatible API token secret.
- [ ] **`R2_BUCKET_NAME`**: Dedicated bucket name (e.g. `filetools-prod-storage`).
- [ ] **`R2_PUBLIC_URL`**: Public CDN domain or Cloudflare custom domain for pre-signed file delivery.
- [ ] **CORS Rules:** Allow `GET`, `PUT`, `HEAD` from `https://filetool-app.vercel.app`.
- [ ] **Lifecycle Rules:** Configure 7-day auto-purge on raw temporary scratch buckets.

---

## 2. Cryptographic Secrets & Platform Keys

- [ ] **`JWT_SECRET`**: Minimum 64-character cryptographically random secret string.
- [ ] **`AI_KEY_VAULT_SECRET`** (or `BYOK_MASTER_KEY`): Exactly 32 bytes (64 hex characters or 44 base64 characters) for AES-256-GCM envelope encryption.

---

## 3. Stripe Billing & FinOps Configuration

> [!CAUTION]
> Do NOT set `BILLING_ENABLED=true` until all Stripe webhooks and tax settings are verified in sandbox.

- [ ] **`STRIPE_SECRET_KEY`**: Production Stripe restricted secret key.
- [ ] **`STRIPE_WEBHOOK_SECRET`**: Webhook signing secret from Stripe Dashboard for endpoint `https://filetools-api.onrender.com/api/payment/webhook`.
- [ ] **`STRIPE_PRICE_PLUS_MONTHLY`**: Stripe Price ID for Plus Monthly ($4.99).
- [ ] **`STRIPE_PRICE_PLUS_YEARLY`**: Stripe Price ID for Plus Yearly ($39.99).
- [ ] **`STRIPE_PRICE_PRO_MONTHLY`**: Stripe Price ID for Pro Monthly ($9.99).
- [ ] **`STRIPE_PRICE_PRO_YEARLY`**: Stripe Price ID for Pro Yearly ($79.99).
- [ ] **`BILLING_ENABLED`**: Keep `false` until final business verification; toggle to `true` to enable paid checkouts.

---

## 4. Platform AI Provider Pool Keys

- [ ] **`GOOGLE_AI_API_KEY`** (or `GOOGLE_API_KEY`): Comma-separated API keys for Gemini Flash/Pro pool.
- [ ] **`GROQ_API_KEY`**: Groq Cloud LPU API keys for fast open-source inference.
- [ ] **`CEREBRAS_API_KEY`**: Cerebras API key for ultra-fast Llama inference.
- [ ] **`MISTRAL_API_KEY`**: Mistral AI API key for multilingual tasks.
- [ ] **`OPENROUTER_API_KEY`**: OpenRouter API key for fallback routing.

---

## 5. Microsoft Partner Center & Store Identity (Windows Release)

- [ ] **Developer Account:** Active registration at [Microsoft Partner Center](https://partner.microsoft.com/dashboard).
- [ ] **App Reservation:** Reserve app name `FileTools Pro`.
- [ ] **Package Identity Record:**
  - `Identity/Name`: Found under App Management $\rightarrow$ App Identity.
  - `Identity/Publisher`: CN hash string.
  - `Identity/PublisherDisplayName`: Registered company or legal developer name.
- [ ] **Store Packaging Run:** Execute PWABuilder CLI packaging command using the above attributes.

---

## 6. Remote Repository & CI Verification Actions

- [ ] **Git Working Tree Review:** Review and authorize commit of local patches.
- [ ] **Git Remote Push:** Authorize `git push origin main`.
- [ ] **GitHub Actions Execution:** Monitor remote build on `.github/workflows/ci.yml`.
