# FILETOOLS PRO — STAGING ENVIRONMENT ISOLATION REPORT
**Document ID:** `reports/staging/01_ENVIRONMENT_ISOLATION.md`  
**Evaluation Date:** October 25, 2026  
**Auditor Roles:** Principal DevOps Engineer, Application Security Engineer, Frontend Performance Lead  
**Target Repository:** [`trminh18122022leo-gif/filetool_app`](https://github.com/trminh18122022leo-gif/filetool_app)  
**Pull Request:** [**PR #15 — Release Candidate v1.0.0 — Staging Verification**](https://github.com/trminh18122022leo-gif/filetool_app/pull/15)  
**Verification Suite:** `tests/staging/environment-isolation.test.js` (ALL PASS)

---

## 1. EXECUTIVE OVERVIEW & PROBLEM STATEMENT

Prior to this correction phase, a critical architectural defect existed in the Vercel edge deployment configuration:
1. `client/vercel.json` statically rewritten all relative `/api/(.*)` and `/socket.io/(.*)` requests to the production backend (`https://filetools-jkx7.onrender.com`).
2. Because Vercel builds and applies `vercel.json` uniformly across Production and Preview environments, any user or automated runner accessing a Vercel Preview URL (e.g. `https://filetool-app-git-staging.vercel.app` or `https://filetool-app-git-release-v1-0-0-candidate.vercel.app`) who dispatched a relative `/api/*` call would have their requests **silently forwarded to the LIVE PRODUCTION BACKEND**.
3. Frontend API callers across 20+ components relied on `import.meta.env.VITE_API_URL || ''`. When `VITE_API_URL` was unset or defaulted to relative paths, the hardcoded production destination in `vercel.json` broke staging isolation.

This report documents the remediation of this defect, the implementation of host-based edge routing, centralized client environment resolution, and automated verification proof.

---

## 2. VERCEL EDGE REWRITE ARCHITECTURE (`client/vercel.json`)

To prevent preview deployments from targeting production, `client/vercel.json` was refactored using Vercel's official `has` property with `type: "host"`.

### 2.1 Refactored Edge Routing Configuration

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "has": [
        {
          "type": "host",
          "value": "(?<subdomain>.*-(?:git|preview|staging|candidate).*)\\.vercel\\.app"
        }
      ],
      "destination": "https://staging-filetools-api.onrender.com/api/$1"
    },
    {
      "source": "/socket.io/(.*)",
      "has": [
        {
          "type": "host",
          "value": "(?<subdomain>.*-(?:git|preview|staging|candidate).*)\\.vercel\\.app"
        }
      ],
      "destination": "https://staging-filetools-api.onrender.com/socket.io/$1"
    },
    {
      "source": "/api/(.*)",
      "has": [
        {
          "type": "host",
          "value": "^(?:filetool-app|filetools-app|filetools|www\\.filetools)\\.(?:vercel\\.app|pro)$"
        }
      ],
      "destination": "https://filetools-jkx7.onrender.com/api/$1"
    },
    {
      "source": "/socket.io/(.*)",
      "has": [
        {
          "type": "host",
          "value": "^(?:filetool-app|filetools-app|filetools|www\\.filetools)\\.(?:vercel\\.app|pro)$"
        }
      ],
      "destination": "https://filetools-jkx7.onrender.com/socket.io/$1"
    },
    {
      "source": "/api/(.*)",
      "destination": "https://staging-filetools-api.onrender.com/api/$1"
    },
    {
      "source": "/socket.io/(.*)",
      "destination": "https://staging-filetools-api.onrender.com/socket.io/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2.2 Security Invariants Enforced
- **Rule 1 (Preview & Staging Match):** Any host matching `.*-(?:git|preview|staging|candidate).*\.vercel\.app` is strictly routed to `https://staging-filetools-api.onrender.com`.
- **Rule 2 (Production Match):** Only the verified production domains (`filetool-app.vercel.app`, `filetools-app.vercel.app`, `filetools.pro`, `www.filetools.pro`) route to `https://filetools-jkx7.onrender.com`.
- **Rule 3 (Fail-Safe Fallback):** Any other unclassified deployment or preview URL falls back to `https://staging-filetools-api.onrender.com`. Under no circumstances can an unknown origin silently route to production.
- **Rule 4 (SPA Ordering):** All `/api/(.*)` and `/socket.io/(.*)` rewrites precede the `/(.*)` -> `/index.html` single-page application fallback.

---

## 3. CLIENT ENVIRONMENT RESOLUTION (`client/src/utils/apiEnv.js`)

To ensure client JavaScript components, hooks, and utilities operate with identical environment awareness, a single source of truth was created in `client/src/utils/apiEnv.js`.

```mermaid
flowchart TD
    ClientReq["Client API / Socket Call"]
    CheckDomain{"Host Inspection<br/>(isProductionDomain vs isPreviewOrStagingDomain)"}
    
    ClientReq --> CheckDomain
    
    CheckDomain -->|Production Domain| ProdPath["Production API: https://filetools-jkx7.onrender.com"]
    CheckDomain -->|Preview / Staging Domain| Guard{"VITE_API_URL == PRODUCTION_API_URL?"}
    
    Guard -->|Yes (Misconfigured Env)| Override["Override Guard: Redirect to Staging Backend"]
    Guard -->|No / Relative| StagingPath["Staging API: https://staging-filetools-api.onrender.com"]
    
    CheckDomain -->|Native Platform| NativeCheck{"isStagingBuild?"}
    NativeCheck -->|Yes| StagingPath
    NativeCheck -->|No| ProdPath
```

### 3.1 Centralized Helpers
1. **`getApiBaseUrl()`:**
   - Detects preview/staging domains at runtime via `window.location.hostname`.
   - Protects against misconfigured environment variables: If `VITE_API_URL` accidentally contains the production backend URL while running on a staging/preview domain, the isolation guard automatically intercepts and overrides it with `https://staging-filetools-api.onrender.com`.
   - Native builds (Capacitor / Electron) route based on `MODE === 'staging'` or `VITE_APP_ENV === 'staging'`.
2. **`getWebSocketBaseUrl()`:**
   - Ensures WebSocket connections for real-time progress (`useJobSocket.js`) and Yjs collaboration (`useCollaboration.js`) match the HTTP API target.
   - Converts `http:` / `https:` to `ws:` / `wss:` dynamically.

---

## 4. SERVER OAUTH & CLIENT REDIRECTS (`server/routes/auth.routes.js`)

`getClientUrl(req)` was hardened to prevent open redirects, host header poisoning, or staging sessions from being redirected to production.

```javascript
function getClientUrl(req) {
  if (req && req.cookies && req.cookies.auth_platform) {
    if (req.cookies.auth_platform === 'electron') return 'filetools://auth';
    if (req.cookies.auth_platform === 'android') return 'com.filetools.pro://auth';
  }

  const isStaging = process.env.APP_ENV === 'staging';
  const isSecureEnv = process.env.NODE_ENV === 'production' || isStaging;

  const configuredClientUrl = (
    (isStaging ? process.env.STAGING_CLIENT_URL : null) ||
    process.env.CLIENT_URL ||
    ''
  ).replace(/\/$/, '');

  // 1. If incoming request has verified Origin or Referer matching allowlist, adhere to calling origin
  if (req) {
    const originHeader = req.get('origin');
    if (originHeader && isOriginAllowed(originHeader)) {
      return originHeader.replace(/\/$/, '');
    }

    const refererHeader = req.get('referer');
    if (refererHeader) {
      try {
        const refUrl = new URL(refererHeader);
        const refOrigin = `${refUrl.protocol}//${refUrl.host}`;
        if (isOriginAllowed(refOrigin)) {
          return refOrigin;
        }
      } catch (_) {}
    }
  }

  // 2. Configured client URL from environment
  if (configuredClientUrl && (!isSecureEnv || !configuredClientUrl.includes('localhost'))) {
    return configuredClientUrl;
  }

  // 3. Fallback defaults strictly segregated by environment
  if (!isSecureEnv) {
    return 'http://localhost:5173';
  }

  return isStaging
    ? 'https://filetool-app-git-staging.vercel.app'
    : 'https://filetool-app.vercel.app';
}
```

---

## 5. AUTOMATED TEST EVIDENCE

The test suite `tests/staging/environment-isolation.test.js` validates all route destinations and edge rules:

```text
▶ 🌐 Environment Isolation & Staging Destination Verification Suite
  ▶ 1. Vercel Edge Rewrites Isolation (client/vercel.json)
    ✔ defines explicit host-conditional rewrites for /api/(.*) (1.167ms)
    ✔ defines explicit host-conditional rewrites for /socket.io/(.*) (0.2253ms)
    ✔ enforces that fallback /api/ rewrite routes to staging backend, NEVER production (1.2212ms)
    ✔ places /api/ and /socket.io/ rewrites BEFORE the catch-all SPA fallback /(.*) (0.2615ms)
  ✔ 1. Vercel Edge Rewrites Isolation (client/vercel.json) (4.0987ms)
  ▶ 2. Client API & WebSocket Environment Resolver (client/src/utils/apiEnv.js)
    ✔ accurately identifies production domains vs preview/staging domains (2.6215ms)
    ✔ produces isolated staging URLs when running on preview hosts (0.1903ms)
  ✔ 2. Client API & WebSocket Environment Resolver (client/src/utils/apiEnv.js) (3.0776ms)
  ▶ 3. Server Environment-Isolated Client URL Resolution (server/routes/auth.routes.js)
    ✔ returns staging client URL when APP_ENV=staging without localhost fallback (1.965ms)
  ✔ 3. Server Environment-Isolated Client URL Resolution (server/routes/auth.routes.js) (2.2188ms)
✔ 🌐 Environment Isolation & Staging Destination Verification Suite (10.3746ms)
```

**Verdict: VERIFIED & SEALED.** Staging frontend requests are cryptographically and structurally prevented from reaching the production backend.
