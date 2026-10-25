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
 * @returns {string}
 */
export function getWebSocketBaseUrl() {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return apiBase.replace(/^http/, 'ws');
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3002';
    }
    return window.location.origin.replace(/^http/, 'ws');
  }

  return '';
}
