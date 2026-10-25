'use strict';

// Explicit verified Vercel origins for FileTools Pro
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
      // In staging or production, forbid injecting localhost through ALLOWED_ORIGINS
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

/**
 * Validates whether an incoming HTTP Origin header is authorized for cross-origin access.
 * 
 * Invariants:
 * 1. !origin (missing header): Allowed for server-to-server, curl, Postman, native SDKs without browser origin.
 * 2. Origin: 'null' / 'NULL': STRICTLY REJECTED (mitigates sandboxed iframe & data URI attacks).
 * 3. Pseudo-protocols (javascript:, data:, blob:, file:): REJECTED.
 * 4. Localhost / 127.0.0.1: REJECTED in staging and production modes.
 * 5. Verified native schemes (filetools://, com.filetools.pro://): Allowed for native clients.
 * 6. Explicit allowlist: Allowed.
 * 
 * @param {string|undefined|null} origin
 * @returns {boolean}
 */
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

/**
 * Dynamic CORS options delegate for Express cors() middleware.
 * Ensures credentialed CORS headers are ONLY returned for explicitly authorized browser origins.
 */
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

module.exports = {
  VERIFIED_VERCEL_ORIGINS,
  VERIFIED_NATIVE_SCHEMES,
  LOCAL_DEV_ORIGINS,
  getAllowedOrigins,
  isOriginAllowed,
  corsOptionsDelegate,
};
