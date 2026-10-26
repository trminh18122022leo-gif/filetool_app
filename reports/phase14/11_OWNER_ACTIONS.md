# Phase 14 — Report 11: Human Owner Production Action Plan

**Audit Phase:** Phase 14 — Comprehensive Final Second Pass & Production Release Audit  
**Author:** Independent Release Engineering Lead & Principal Architect  
**Audit Date:** 2026-10-24  
**Scope:** Actionable, human-executable roadmap for launching FileTools Pro across Web, Windows, Android, and iOS.

---

## 1. Mandatory Owner Stop Gate Notice

> [!IMPORTANT]
> **AUTOMATED AI EXECUTION HAS HALTED BEFORE PRODUCTION PUSH**  
> To protect production systems and comply with security policies:
> - The AI assistant will **NOT** automatically execute `git push origin main`.
> - The AI assistant will **NOT** automatically trigger live Render or Vercel production builds.
> - The AI assistant will **NOT** enroll developer accounts or submit store applications.
> - All live deployments and credential inputs must be executed by the authorized human repository owner following the sequential instructions below.

---

## 2. Stage 1: Web Free Tier Staging Rehearsal (STAGING_CANDIDATE)

The Web Free tier is prepared as a staging candidate. Direct push to `main` is prohibited until staging rehearsal passes.

### Step 1.1: Release Branch, Secret Scan & Staged PR
Do **NOT** use `git add .` or push directly to `origin/main`. Instead, follow the staged candidate flow:
```powershell
cd C:\Users\Admin\test_app\filetools-app

# 1. Ensure on release candidate branch
git checkout -b release/v1.0.0-candidate

# 2. Verify no unignored .env or secrets exist
git status --ignored

# 3. Stage verified release files selectively
git add client/ server/ docs/ reports/ tests/ package.json package-lock.json Dockerfile .github/

# 4. Review staged diff
git diff --cached --stat

# 5. Commit candidate
git commit -m "feat(release): candidate v1.0.0 for staging verification (Phase 14 release evidence gate)"

# 6. Push to remote candidate branch and open Pull Request
git push origin release/v1.0.0-candidate
```

### Step 1.2: Complete Staging Deployment Inventory (Names Only)
In the **Render Dashboard** & **Vercel Dashboard** $\rightarrow$ **Environment Variables**:
| Variable Name | Environment | Purpose & Notes |
|:---|:---|:---|
| `NODE_ENV` | `staging` / `production` | Enables secure cookies, strict CORS & production error masking |
| `CLIENT_URL` | `https://filetool-app.vercel.app` | Canonical SPA origin allowlist |
| `ALLOWED_ORIGINS` | `https://filetool-app.vercel.app,https://filetools-app.vercel.app` | CORS allowlist for client and fallback alias |
| `AUTH_DB_URI` | Secret URI | MongoDB Atlas cluster for user authentication, blacklist & sessions |
| `DATA_DB_URI` | Secret URI | MongoDB Atlas cluster for file records, jobs, and workflow state |
| `REDIS_URL` | Secret TLS URI | Managed Redis instance for BullMQ distributed queue |
| `R2_ACCOUNT_ID` | Cloudflare ID | R2 storage account identifier |
| `R2_ACCESS_KEY_ID` | Secret Token | S3-compatible API token key |
| `R2_SECRET_ACCESS_KEY` | Secret Token | S3-compatible API token secret |
| `R2_BUCKET_NAME` | Bucket Name | Cloudflare R2 bucket for customer artifacts |
| `R2_PUBLIC_URL` | Public Domain | Cloudflare R2 custom domain for signed file downloads |
| `JWT_SECRET` | Secret String | $\ge 64$ random chars token signing secret |
| `AI_KEY_VAULT_SECRET` | 32-byte Hex | AES-256-GCM envelope encryption master key |
| `BILLING_ENABLED` | `false` | **MUST REMAIN FALSE** until Stripe sandbox testing is signed off |
| `ENABLE_URL_TO_PDF` | `false` | Keep disabled unless public URL rendering is explicitly needed |

### Step 1.3: Render Service Sizing & Spin-Down Truth
- **Render Free Web Services:** Spin down automatically after 15 minutes of inactivity, causing 30–60 second cold starts on subsequent requests.
- **Render Paid Services (Starter / Standard):** Do NOT spin down on idle. For production background workers running FFmpeg/LibreOffice, a paid instance with $\ge 2\text{GB}$ RAM is required to prevent container OOM.

### Step 1.4: Rollback Drill & Staging Verification
1. Deploy candidate to Vercel Preview and Render Staging.
2. Execute smoke tests on Staging: login, merge PDF, convert document, verify fail-closed health check `/api/health`.
3. Verify rollback mechanism: revert commit or roll back to prior SHA in Vercel/Render dashboard within 60 seconds.

### Step 1.3: Trigger Staging & Production Deployment
1. **Frontend (Vercel):**  
   Pushing to `main` will automatically build the client on Vercel. Approve the production deployment in the GitHub Actions environment tab if approval gates are active.
2. **Backend (Render):**  
   Click **Manual Deploy** $\rightarrow$ **Deploy latest commit**.
3. **Smoke Verification:**  
   Execute:
   ```bash
   curl -s https://filetools-jkx7.onrender.com/api/ready | jq .
   ```
   Verify that `"status": "ready"` is returned.

---

## 3. Stage 2: Web Paid Tier & Stripe Monetization Activation

*Do not activate until commercial tax and legal terms are reviewed.*

1. **Activate Live Stripe Account:**  
   Navigate to [dashboard.stripe.com](https://dashboard.stripe.com) and complete business verification.
2. **Configure Stripe Webhook:**  
   - Add endpoint: `https://filetools-jkx7.onrender.com/api/payment/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copy the **Signing Secret** (`whsec_...`).
3. **Update Render Environment:**  
   - Set `STRIPE_SECRET_KEY`: `sk_live_...`
   - Set `STRIPE_WEBHOOK_SECRET`: `whsec_...`
   - Set `BILLING_ENABLED`: `true`
4. **Test Live Monitored Checkout:**  
   Perform a live \$4.99 purchase using an owner test card; verify subscription activates and cancellation downgrades gracefully.

---

## 4. Stage 3: Windows Desktop / Microsoft Store Submission

1. **Enroll in Microsoft Partner Center:**  
   Visit [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com) and register as an individual developer (2026 zero registration fee; requires government ID verification).
2. **Reserve App Name:**  
   Reserve **FileTools Pro**.
3. **Obtain Package Identity:**  
   In Partner Center $\rightarrow$ **App management** $\rightarrow$ **App identity**:
   - Copy `Package/Identity/Name` (e.g., `12345YourName.FileToolsPro`).
   - Copy `Package/Identity/Publisher` (Publisher CN, e.g., `CN=...`).
   - Copy `PublisherDisplayName`.
4. **Package MSIX via PWABuilder:**  
   - Visit [pwabuilder.com](https://www.pwabuilder.com) $\rightarrow$ enter `https://filetools-app.vercel.app`.
   - Click **Package for Windows** $\rightarrow$ enter the 3 Package Identity fields.
   - Download the generated `.msixbundle`.
5. **Submit Store Listing:**  
   Use copy, feature bullets, search tags, and reviewer demo credentials from [`docs/releases/STORE_LISTING_COPY.md`](file:///C:/Users/Admin/test_app/filetools-app/docs/releases/STORE_LISTING_COPY.md).

---

## 5. Stage 4: Future Mobile Tracks (Android & iOS)

### Android Google Play Track
1. Register on [play.google.com/console](https://play.google.com/console) (\$25 fee).
2. Follow keystore creation and AAB compilation commands in [`docs/releases/ANDROID_CHECKLIST.md`](file:///C:/Users/Admin/test_app/filetools-app/docs/releases/ANDROID_CHECKLIST.md).
3. Complete Data Safety questionnaire using declarations provided.

### iOS Apple App Store Track
1. Enroll in the Apple Developer Program (\$99/year).
2. On a macOS runner with Xcode, initialize `client/ios/` via `npx cap add ios`.
3. Follow guidelines in [`docs/releases/IOS_CHECKLIST.md`](file:///C:/Users/Admin/test_app/filetools-app/docs/releases/IOS_CHECKLIST.md) (StoreKit 2, PrivacyInfo manifest, TestFlight archive).
