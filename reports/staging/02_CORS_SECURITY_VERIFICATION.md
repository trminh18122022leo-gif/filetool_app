# FILETOOLS PRO — CORS SECURITY & ORIGIN HARDENING REPORT
**Document ID:** `reports/staging/02_CORS_SECURITY_VERIFICATION.md`  
**Evaluation Date:** October 25, 2026  
**Auditor Roles:** Application Security Engineer, Penetration Tester, Backend Lead  
**Target Repository:** [`trminh18122022leo-gif/filetool_app`](https://github.com/trminh18122022leo-gif/filetool_app)  
**Pull Request:** [**PR #15 — Release Candidate v1.0.0 — Staging Verification**](https://github.com/trminh18122022leo-gif/filetool_app/pull/15)  
**Verification Suite:** `tests/security/cors-hardening.test.js` (ALL PASS)

---

## 1. THREAT MODEL & AUDIT OBJECTIVES

Cross-Origin Resource Sharing (CORS) with `credentials: true` allows browser clients to transmit sensitive cookies (`ft_auth_token`, `ft_refresh_token`) and `Authorization` headers.

Prior implementations exhibited three distinct vulnerabilities:
1. **Opaque Origin Trust (`Origin: null`):** `corsGuard.js` contained `if (!origin || origin === 'null') return true;`. In modern browsers, sandboxed iframes (`<iframe sandbox src="...">`) and cross-site data URIs emit `Origin: null`. Trusting `null` with credentialed CORS permits malicious third-party websites to extract private documents and session tokens.
2. **Localhost Infiltration:** `defaultAllowedOrigins` hardcoded `http://localhost:3000`, `http://localhost:5173`, etc. directly in the array, allowing local development origins to bypass staging and production restrictions.
3. **Implicit Credential Reflection:** Using static `app.use(cors({ origin: isOriginAllowed }))` caused the `cors` package to echo `Access-Control-Allow-Origin: null` whenever `isOriginAllowed('null')` returned true.

---

## 2. HARDENED CORS DEFENSE IMPLEMENTATION

### 2.1 Core Rules in `server/utils/corsGuard.js`

```javascript
'use strict';

const VERIFIED_VERCEL_ORIGINS = [
  'https://filetool-app.vercel.app',
  'https://filetools-app.vercel.app',
  'https://filetool-app-git-staging.vercel.app',
  'https://filetools-app-git-staging.vercel.app',
  'https://filetool-app-git-release-v1-0-0-candidate.vercel.app',
  'https://filetools-app-git-release-v1-0-0-candidate.vercel.app',
  'https://filetools.pro',
  'https://www.filetools.pro',
];

const VERIFIED_NATIVE_SCHEMES = [
  'filetools://',
  'com.filetools.pro://',
];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3030',
  'http://127.0.0.1:3030',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

function getAllowedOrigins() {
  const isSecureEnv = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging';
  const origins = new Set();

  if (process.env.CLIENT_URL) origins.add(process.env.CLIENT_URL.replace(/\/$/, ''));
  if (process.env.STAGING_CLIENT_URL) origins.add(process.env.STAGING_CLIENT_URL.replace(/\/$/, ''));

  VERIFIED_VERCEL_ORIGINS.forEach(o => origins.add(o));

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().replace(/\/$/, '')).forEach(o => {
      if (o) {
        if (isSecureEnv && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) {
          return;
        }
        origins.add(o);
      }
    });
  }

  // Local development origins are strictly disallowed in staging and production
  if (!isSecureEnv) {
    LOCAL_DEV_ORIGINS.forEach(o => origins.add(o));
  }

  return Array.from(origins);
}

function isOriginAllowed(origin) {
  // Requests without an Origin header (server-to-server, curl, CLI) are legitimate non-CORS requests
  if (!origin) return true;

  // Strict rejection of string 'null' (sandboxed iframes, opaque origins)
  if (origin === 'null' || origin === 'NULL') return false;

  // Reject dangerous pseudo-protocols
  if (/^(javascript|data|blob|file|vbscript):/i.test(origin)) return false;

  // Allow verified native app custom schemes
  for (const scheme of VERIFIED_NATIVE_SCHEMES) {
    if (origin === scheme.replace(/\/+$/, '') || origin.startsWith(scheme)) {
      return true;
    }
  }

  const isSecureEnv = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging';

  // Localhost is forbidden in production or staging
  if (isSecureEnv && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return false;
  }

  const allowed = getAllowedOrigins();
  const normalized = origin.replace(/\/$/, '');
  return allowed.includes(normalized);
}

function corsOptionsDelegate(req, callback) {
  const origin = req.header('Origin');

  // If no Origin header, allow request to proceed without echoing Access-Control-Allow-Origin
  if (!origin) {
    return callback(null, { origin: false });
  }

  if (isOriginAllowed(origin)) {
    return callback(null, {
      origin: origin, // Echo exact verified origin (never '*')
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key'],
      maxAge: 86400,
    });
  }

  // Unauthorized origin: do not set CORS headers
  return callback(null, { origin: false });
}
```

### 2.3 Express Integration in `server/index.js`

```javascript
const { defaultAllowedOrigins, getAllowedOrigins, isOriginAllowed, corsOptionsDelegate } = require('./utils/corsGuard');
app.isOriginAllowed = isOriginAllowed;
app.getAllowedOrigins = getAllowedOrigins;

app.use(cors(corsOptionsDelegate));
```

---

## 3. SECURITY MATRIX COMPARISON

| Scenario | Incoming Header | Previous Behavior | Hardened Production/Staging Behavior | Security Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Sandboxed Iframe Attack** | `Origin: null` | `true` -> Returned `ACAO: null` | `false` -> No ACAO header; blocked | Sandboxed iframes cannot read responses |
| **Data URI Exploit** | `Origin: data:...` | Permissive | `false` -> Rejected immediately | Browser blocks credentialed read |
| **Localhost in Staging** | `Origin: http://localhost:5173` | Allowed via hardcoded list | `false` -> Stripped from allowlist | Staging cannot be hijacked by rogue dev server |
| **Arbitrary Vercel App** | `Origin: https://evil.vercel.app` | Regex match risk | `false` -> Exact allowlist match required | Preview domain collision blocked |
| **Server-to-Server / Curl** | No `Origin` header | Allowed | Allowed (`origin: false`), no CORS response headers | Does not pollute non-browser clients |
| **Verified Preview** | `Origin: https://filetool-app-git-staging.vercel.app` | Allowed | `true` -> `ACAO: <calling origin>` + `credentials: true` | Fully authorized seamless preview testing |
| **Native Desktop/Mobile** | `Origin: filetools://auth` | Permissive | `true` -> Verified custom scheme | Supports Electron and Capacitor |

---

## 4. REGRESSION TEST RESULTS (`tests/security/cors-hardening.test.js`)

```text
▶ 🛡️ CORS Hardening & Origin Defense Verification Suite
  ▶ 1. Rejection of Opaque & Sandboxed Origins (Origin: null)
    ✔ strictly rejects literal string "null" (1.1128ms)
    ✔ strictly rejects uppercase string "NULL" (0.1107ms)
    ✔ strictly rejects dangerous pseudo-protocols (0.1604ms)
  ✔ 1. Rejection of Opaque & Sandboxed Origins (Origin: null) (2.0179ms)
  ▶ 2. Rejection of Arbitrary External Origins
    ✔ rejects untrusted domains and spoofed subdomains (0.3038ms)
  ✔ 2. Rejection of Arbitrary External Origins (0.4002ms)
  ▶ 3. Localhost Disallowance in Staging and Production
    ✔ forbids localhost and 127.0.0.1 when APP_ENV=staging (0.3019ms)
    ✔ forbids localhost and 127.0.0.1 when NODE_ENV=production (0.1554ms)
  ✔ 3. Localhost Disallowance in Staging and Production (0.6134ms)
  ▶ 4. Preservation of Non-Browser Requests Without Origin
    ✔ allows missing origin without echoing CORS headers (0.2304ms)
  ✔ 4. Preservation of Non-Browser Requests Without Origin (0.3254ms)
  ▶ 5. Credentialed CORS Options Delegate & Explicit Origin Reflection
    ✔ echoes exact calling origin (never "*") and sets credentials: true for verified Vercel origins (0.3407ms)
    ✔ rejects cross-origin requests for untrusted origins in corsOptionsDelegate (0.1673ms)
  ✔ 5. Credentialed CORS Options Delegate & Explicit Origin Reflection (0.6075ms)
  ▶ 6. Verified Native Custom URL Schemes
    ✔ authorizes verified native custom schemes (Electron & Capacitor) (0.1725ms)
  ✔ 6. Verified Native Custom URL Schemes (0.2211ms)
✔ 🛡️ CORS Hardening & Origin Defense Verification Suite (4.7228ms)
```

**Verdict: VERIFIED & SECURE.** CORS headers are restricted to explicitly verified origins with zero leakage to opaque or local origins.
