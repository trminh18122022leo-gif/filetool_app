'use strict';

/**
 * apiEnv.js — Environment & API Destination Isolation Utility
 * 
 * Enforces strict environment separation between Production and Staging.
 * Guarantees that Preview and Staging frontends cannot accidentally or silently
 * dispatch requests to the live Production backend.
 */

export const PRODUCTION_HOSTS = [
  'filetool-app.vercel.app',
  'filetools-app.vercel.app',
  'filetools.pro',
  'www.filetools.pro',
];

export const PRODUCTION_API_URL = 'https://filetools-api.onrender.com';
export const STAGING_API_URL = 'https://staging-filetools-api.onrender.com';

export const PRODUCTION_WS_URL = 'wss://filetools-api.onrender.com';
export const STAGING_WS_URL = 'wss://staging-filetools-api.onrender.com';
export const LOCAL_WS_URL = 'ws://localhost:3002';

/**
 * Check if the given hostname corresponds to the production frontend domain
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isProductionDomain(hostname) {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  return PRODUCTION_HOSTS.includes(host);
}

/**
 * Check if the given hostname corresponds to a Vercel preview or staging deployment
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isPreviewOrStagingDomain(hostname) {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (isProductionDomain(host)) return false;
  return (
    host.includes('-git-') ||
    host.includes('staging') ||
    host.includes('candidate') ||
    host.includes('preview') ||
    (host.endsWith('.vercel.app') && !PRODUCTION_HOSTS.includes(host))
  );
}

/**
 * Resolves the appropriate API Base URL for the active environment.
 * 
 * Priority:
 * 1. Build-time / runtime VITE_API_URL (with safety override if production URL is given on preview domain)
 * 2. Native platforms (Capacitor / Electron): routes to Staging or Production based on build mode
 * 3. Browser SPA: Returns empty string '' so relative /api/* requests are dispatched through
 *    Vercel edge rewrites, which correctly isolate staging vs production by Host header.
 * 
 * @returns {string}
 */
export function getApiBaseUrl() {
  const configured = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
    : '';

  // Safety guard: If running on a preview/staging domain, never allow hardcoded production backend
  if (isPreviewOrStagingDomain() && configured === PRODUCTION_API_URL) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[ENVIRONMENT ISOLATION] Overriding production VITE_API_URL on staging domain with isolated staging backend.');
    }
    return STAGING_API_URL;
  }

  if (configured) {
    return configured;
  }

  // Native platform detection (Capacitor or Electron)
  const isNative = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.() || window.electronAPI);
  if (isNative) {
    const isStagingBuild = typeof import.meta !== 'undefined' && (
      import.meta.env?.MODE === 'staging' ||
      import.meta.env?.VITE_APP_ENV === 'staging'
    );
    return isStagingBuild ? STAGING_API_URL : PRODUCTION_API_URL;
  }

  // Browser SPA: Return empty string to let Vercel environment-isolated rewrites proxy /api/*
  return '';
}

/**
 * Resolves the WebSocket Base URL, keeping WebSocket connections strictly
 * in the same environment as HTTP API traffic.
 * 
 * Invariants:
 * - Browser SPA connects directly to backend wss:// (Render) because Vercel rewrites
 *   do not reliably support persistent WebSocket Upgrade to external HTTP origins.
 * - Production frontends connect to PRODUCTION_WS_URL.
 * - Staging and preview frontends connect strictly to STAGING_WS_URL.
 * - Localhost connects to LOCAL_WS_URL (ws://localhost:3002).
 * 
 * @param {string} [overrideHostname] - Optional hostname for testing or SSR
 * @returns {string}
 */
export function getWebSocketBaseUrl(overrideHostname) {
  const explicitWs = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL)
    ? String(import.meta.env.VITE_WS_URL).replace(/\/$/, '')
    : '';

  if (explicitWs) {
    if (isPreviewOrStagingDomain(overrideHostname) && explicitWs === PRODUCTION_WS_URL) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[ENVIRONMENT ISOLATION] Overriding production VITE_WS_URL on staging domain with isolated staging WebSocket.');
      }
      return STAGING_WS_URL;
    }
    return explicitWs;
  }

  // Check if getApiBaseUrl() provided an explicit origin (e.g. native apps)
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return apiBase.replace(/^http/, 'ws');
  }

  const host = overrideHostname || (typeof window !== 'undefined' ? window.location.hostname : '');
  if (host === 'localhost' || host === '127.0.0.1') {
    return LOCAL_WS_URL;
  }

  if (isProductionDomain(host)) {
    return PRODUCTION_WS_URL;
  }

  return STAGING_WS_URL;
}
