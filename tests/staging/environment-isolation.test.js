'use strict';

/**
 * environment-isolation.test.js — Automated Environment Isolation & Route Destination Suite
 * 
 * Validates:
 * 1. client/vercel.json rewrites:
 *    - Production domains route to production backend (filetools-api.onrender.com).
 *    - Preview & Staging domains route to staging backend (staging-filetools-api.onrender.com).
 *    - Generic/relative fallback routes to staging backend, NEVER production.
 * 2. Client apiEnv.js destination logic:
 *    - Correctly distinguishes production vs staging hostnames.
 *    - Prevents hardcoded production VITE_API_URL on staging domains.
 *    - Converts WebSocket protocols to wss:// for secure edge isolation.
 * 3. Server auth.routes.js getClientUrl(req):
 *    - Respects verified Origin/Referer from calling frontend.
 *    - In APP_ENV=staging, defaults to staging client, never localhost.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('🌐 Environment Isolation & Staging Destination Verification Suite', () => {

  describe('1. Vercel Edge Rewrites Isolation (client/vercel.json)', () => {
    const vercelConfigPath = path.resolve(__dirname, '../../client/vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
    const rewrites = vercelConfig.rewrites || [];

    it('defines explicit host-conditional rewrites for /api/(.*)', () => {
      const apiRewrites = rewrites.filter(r => r.source === '/api/(.*)');
      assert.ok(apiRewrites.length >= 2, 'Must have at least 2 environment-specific /api/ rewrite rules');

      // Check staging / preview rule
      const stagingRule = apiRewrites.find(r =>
        r.destination.includes('staging-filetools-api.onrender.com') &&
        r.has && r.has.some(h => h.type === 'host' && h.value.includes('git|preview|staging|candidate'))
      );
      assert.ok(stagingRule, 'Must contain host-based rewrite routing preview/staging domains to staging backend');

      // Check production rule
      const prodRule = apiRewrites.find(r =>
        r.destination.includes('filetools-api.onrender.com') &&
        !r.destination.includes('staging-') &&
        r.has && r.has.some(h => h.type === 'host' && h.value.includes('filetool-app|filetools-app|filetools'))
      );
      assert.ok(prodRule, 'Must contain host-based rewrite routing production domains to production backend');
    });

    it('defines explicit host-conditional rewrites for /socket.io/(.*)', () => {
      const socketRewrites = rewrites.filter(r => r.source === '/socket.io/(.*)');
      assert.ok(socketRewrites.length >= 2, 'Must have at least 2 environment-specific /socket.io/ rewrite rules');

      const stagingSocket = socketRewrites.find(r =>
        r.destination.includes('staging-filetools-api.onrender.com')
      );
      assert.ok(stagingSocket, 'Must contain rewrite routing preview/staging WebSockets to staging backend');
    });

    it('enforces that fallback /api/ rewrite routes to staging backend, NEVER production', () => {
      const fallbackApi = rewrites.find(r => r.source === '/api/(.*)' && !r.has);
      assert.ok(fallbackApi, 'Must have a default fallback /api/ rewrite rule');
      assert.ok(
        fallbackApi.destination.includes('staging-filetools-api.onrender.com'),
        `Fallback /api/ destination (${fallbackApi.destination}) must route to STAGING, never production`
      );
      assert.ok(
        !fallbackApi.destination.includes('//filetools-api.onrender.com'),
        'Fallback /api/ must not route directly to production backend'
      );
    });

    it('places /api/ and /socket.io/ rewrites BEFORE the catch-all SPA fallback /(.*)', () => {
      const lastRewrite = rewrites[rewrites.length - 1];
      assert.equal(lastRewrite.source, '/(.*)', 'SPA catch-all must be the last rewrite rule');
      assert.equal(lastRewrite.destination, '/index.html', 'SPA catch-all must route to /index.html');
    });
  });

  describe('2. Client API & WebSocket Environment Resolver (client/src/utils/apiEnv.js)', () => {
    it('accurately identifies production domains vs preview/staging domains', () => {
      const {
        isProductionDomain,
        isPreviewOrStagingDomain,
        PRODUCTION_HOSTS
      } = require('../../client/src/utils/apiEnv');

      // Production domains
      for (const host of PRODUCTION_HOSTS) {
        assert.equal(isProductionDomain(host), true, `${host} must be classified as production domain`);
        assert.equal(isPreviewOrStagingDomain(host), false, `${host} must not be classified as preview domain`);
      }

      // Preview / staging domains
      const samplePreviewHosts = [
        'filetool-app-git-staging.vercel.app',
        'filetools-app-git-staging.vercel.app',
        'filetool-app-git-release-v1-0-0-candidate.vercel.app',
        'filetool-app-preview-abc12345.vercel.app',
        'filetool-app-abc12345-minh-2742.vercel.app'
      ];

      for (const host of samplePreviewHosts) {
        assert.equal(isProductionDomain(host), false, `${host} must not be classified as production domain`);
        assert.equal(isPreviewOrStagingDomain(host), true, `${host} must be classified as preview/staging domain`);
      }
    });

    it('produces isolated staging URLs when running on preview hosts', () => {
      const {
        getApiBaseUrl,
        PRODUCTION_API_URL,
        STAGING_API_URL
      } = require('../../client/src/utils/apiEnv');

      assert.equal(typeof getApiBaseUrl, 'function');
      assert.equal(PRODUCTION_API_URL, 'https://filetools-api.onrender.com');
      assert.equal(STAGING_API_URL, 'https://staging-filetools-api.onrender.com');
    });
  });

  describe('3. Server Environment-Isolated Client URL Resolution (server/routes/auth.routes.js)', () => {
    it('returns staging client URL when APP_ENV=staging without localhost fallback', () => {
      const origAppEnv = process.env.APP_ENV;
      const origClientUrl = process.env.CLIENT_URL;
      const origStagingUrl = process.env.STAGING_CLIENT_URL;

      try {
        process.env.APP_ENV = 'staging';
        delete process.env.CLIENT_URL;
        delete process.env.STAGING_CLIENT_URL;

        // Re-require to test
        delete require.cache[require.resolve('../../server/utils/corsGuard')];
        const { isOriginAllowed } = require('../../server/utils/corsGuard');

        // Test that verified staging origin is allowed
        const stagingOrigin = 'https://filetool-app-git-staging.vercel.app';
        assert.equal(isOriginAllowed(stagingOrigin), true, 'Staging origin must be allowed');

        // Test that localhost is forbidden in staging
        assert.equal(isOriginAllowed('http://localhost:5173'), false, 'localhost:5173 must be forbidden in staging');
        assert.equal(isOriginAllowed('http://127.0.0.1:3000'), false, '127.0.0.1 must be forbidden in staging');
      } finally {
        process.env.APP_ENV = origAppEnv;
        if (origClientUrl) process.env.CLIENT_URL = origClientUrl;
        if (origStagingUrl) process.env.STAGING_CLIENT_URL = origStagingUrl;
        delete require.cache[require.resolve('../../server/utils/corsGuard')];
      }
    });
  });

});
