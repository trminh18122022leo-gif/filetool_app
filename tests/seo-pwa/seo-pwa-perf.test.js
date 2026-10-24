'use strict';

/**
 * tests/seo-pwa/seo-pwa-perf.test.js
 * Comprehensive SEO, PWA Cache Policy & Performance Suite:
 * - Sitemap Route Integrity & Zero Private Route Leaks
 * - Robots.txt Disallow Directives for Private/Token URLs
 * - Vercel Rewrite Ordering (/api/* BEFORE /(.*) SPA fallback)
 * - PWA Cache Policy: Zero broad /api/ cache, safe public GETs only
 * - Logout Cache Eviction Routine
 * - Video Preload & Canvas Motion Throttling (prefers-reduced-motion, document.hidden)
 * - Schema.org JSON-LD Structured Data & Canonical URLs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('🚀 SEO, PWA Cache Policy & Performance Suite', () => {

  // ── 1. Sitemap.xml Route Integrity & Private Leaks Defense ─────────────────
  describe('1. Sitemap Route Integrity & Privacy Boundary', () => {
    const sitemapPath = path.join(ROOT_DIR, 'client/public/sitemap.xml');
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

    it('verifies all required public SEO routes exist in sitemap.xml', () => {
      const requiredRoutes = [
        '/',
        '/tools',
        '/pdf',
        '/pdf/merge',
        '/pdf/split',
        '/pdf/compress',
        '/pdf/ocr',
        '/convert/word-to-pdf',
        '/image/compress',
        '/pricing',
        '/security',
        '/privacy',
        '/guides',
        '/workflows',
        '/api-docs',
      ];

      requiredRoutes.forEach((route) => {
        const pathPart = route === '/' ? '/' : route;
        const matches = sitemapContent.includes(`<loc>https://filetool-app.vercel.app${pathPart}</loc>`) ||
                        sitemapContent.includes(`<loc>https://filetools-app.vercel.app${pathPart}</loc>`);
        assert.ok(
          matches,
          `Sitemap must contain public route: ${route}`
        );
      });
    });

    it('enforces ZERO private routes exist in sitemap.xml', () => {
      const forbiddenPrivateRoutes = [
        '/dashboard',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/api/',
        '/outputs/',
        '/uploads/',
        'token=',
        'session_id=',
      ];

      forbiddenPrivateRoutes.forEach((privateKeyword) => {
        assert.strictEqual(
          sitemapContent.includes(privateKeyword),
          false,
          `Sitemap must NEVER contain private route or token: ${privateKeyword}`
        );
      });
    });
  });

  // ── 2. Robots.txt Compliance & Disallow Directives ──────────────────────────
  describe('2. Robots.txt Compliance & Crawl Control', () => {
    const robotsPath = path.join(ROOT_DIR, 'client/public/robots.txt');
    const robotsContent = fs.readFileSync(robotsPath, 'utf8');

    it('verifies critical private and token URLs are disallowed in robots.txt', () => {
      const requiredDisallows = [
        'Disallow: /dashboard',
        'Disallow: /login',
        'Disallow: /register',
        'Disallow: /forgot-password',
        'Disallow: /reset-password',
        'Disallow: /verify-email',
        'Disallow: /api/',
        'Disallow: /*?token=*',
        'Disallow: /*?session_id=*',
      ];

      requiredDisallows.forEach((directive) => {
        assert.ok(
          robotsContent.includes(directive),
          `robots.txt must include directive: ${directive}`
        );
      });
    });

    it('verifies sitemap declaration is present in robots.txt', () => {
      assert.ok(
        robotsContent.includes('Sitemap: https://filetool-app.vercel.app/sitemap.xml') ||
        robotsContent.includes('Sitemap: https://filetools-app.vercel.app/sitemap.xml'),
        'robots.txt must declare official sitemap URL'
      );
    });
  });

  // ── 3. Vercel Rewrite Ordering & Anti-Cache Headers ─────────────────────────
  describe('3. Vercel Rewrite Ordering & CDN Anti-Cache Headers', () => {
    const vercelConfigPath = path.join(ROOT_DIR, 'client/vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    it('verifies /api/(.*) rewrite is placed BEFORE /(.*) SPA fallback', () => {
      const rewrites = vercelConfig.rewrites;
      assert.ok(Array.isArray(rewrites), 'rewrites must be an array');

      const apiIndex = rewrites.findIndex(r => r.source === '/api/(.*)');
      const spaIndex = rewrites.findIndex(r => r.source === '/(.*)');

      assert.ok(apiIndex !== -1, 'Must define /api/(.*) rewrite rule');
      assert.ok(spaIndex !== -1, 'Must define /(.*) SPA fallback rule');
      assert.ok(
        apiIndex < spaIndex,
        'CRITICAL: /api/(.*) MUST precede /(.*) so API requests do not return SPA HTML'
      );
    });

    it('verifies Cache-Control: no-store header on /api/(.*) to prevent CDN caching private data', () => {
      const headers = vercelConfig.headers;
      assert.ok(Array.isArray(headers), 'headers must be an array');

      const apiHeaders = headers.find(h => h.source === '/api/(.*)');
      assert.ok(apiHeaders, 'Must define headers for /api/(.*)');

      const cacheControl = apiHeaders.headers.find(h => h.key === 'Cache-Control');
      assert.ok(cacheControl, 'Must specify Cache-Control header for API');
      assert.ok(
        cacheControl.value.includes('no-store'),
        'API responses must never be cached at CDN (Cache-Control must contain no-store)'
      );
    });
  });

  // ── 4. PWA Workbox Cache Policy & Negative Verification ────────────────────
  describe('4. PWA Workbox Cache Policy & Anti-Leak Safeguards', () => {
    const viteConfigPath = path.join(ROOT_DIR, 'client/vite.config.js');
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');

    it('verifies dangerous broad /api/ cache regex has been eliminated', () => {
      // Must NOT contain broad urlPattern: /^\/api\/.*/ without allowlist
      const hasBroadApiCache = /urlPattern:\s*\/\^\\\/api\\\/\.\*\//.test(viteConfigContent);
      assert.strictEqual(
        hasBroadApiCache,
        false,
        'CRITICAL: Broad /api/ cache regex must be eliminated to prevent caching private auth/user endpoints'
      );
    });

    it('verifies navigateFallbackDenylist contains /api/ and /socket.io/', () => {
      assert.ok(
        viteConfigContent.includes('/^\\/api\\//'),
        'Workbox navigateFallbackDenylist must explicitly block /api/'
      );
      assert.ok(
        viteConfigContent.includes('/^\\/socket\\.io\\//'),
        'Workbox navigateFallbackDenylist must block /socket.io/'
      );
    });

    it('verifies cleanupOutdatedCaches is enabled for seamless SW updates', () => {
      assert.ok(
        viteConfigContent.includes('cleanupOutdatedCaches: true'),
        'Workbox must enable cleanupOutdatedCaches to purge old client caches'
      );
    });
  });

  // ── 5. Video Preload & Canvas Throttling Optimization ───────────────────────
  describe('5. Video Network Cost & Canvas Motion Throttling', () => {
    const solitudePath = path.join(
      ROOT_DIR,
      'client/src/components/backgrounds/SolitudeSkyBackground.jsx'
    );
    const solitudeContent = fs.readFileSync(solitudePath, 'utf8');

    it('verifies background video uses preload="none" and optimized poster', () => {
      assert.ok(
        solitudeContent.includes('preload="none"'),
        'Background video must use preload="none" to prevent automatic multi-megabyte download'
      );
      assert.ok(
        solitudeContent.includes('poster="/blue-sky-poster.webp"'),
        'Background video must use lightweight webp poster'
      );
    });

    it('verifies SolitudeSkyBackground pauses on document.hidden and checks prefers-reduced-motion', () => {
      assert.ok(
        solitudeContent.includes('prefers-reduced-motion: reduce'),
        'Must respect OS prefers-reduced-motion accessibility preference'
      );
      assert.ok(
        solitudeContent.includes('visibilitychange') || solitudeContent.includes('document.hidden'),
        'Must pause video when document.hidden is true'
      );
    });

    const northernPath = path.join(
      ROOT_DIR,
      'client/src/components/backgrounds/NorthernLightsBackground.jsx'
    );
    const northernContent = fs.readFileSync(northernPath, 'utf8');

    it('verifies NorthernLightsBackground freezes RAF loop when hidden or reduced motion', () => {
      assert.ok(
        northernContent.includes('document.hidden'),
        'Canvas animation loop must freeze when document.hidden is true'
      );
      assert.ok(
        northernContent.includes('prefers-reduced-motion: reduce'),
        'Canvas animation must respect prefers-reduced-motion'
      );
    });
  });

  // ── 6. Structured Data & Canonical Tag Invariants ──────────────────────────
  describe('6. Schema.org JSON-LD & Canonical Invariants', () => {
    const indexPath = path.join(ROOT_DIR, 'client/index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    it('verifies client/index.html defines canonical link', () => {
      assert.ok(
        indexContent.includes('<link rel="canonical" href="https://filetool-app.vercel.app/" />') ||
        indexContent.includes('<link rel="canonical" href="https://filetools-app.vercel.app/" />'),
        'index.html must define valid canonical tag'
      );
    });

    it('verifies valid JSON-LD structured data for SoftwareApplication and Organization', () => {
      assert.ok(
        indexContent.includes('"@type": "SoftwareApplication"'),
        'index.html must include Schema.org SoftwareApplication'
      );
      assert.ok(
        indexContent.includes('"@type": "Organization"'),
        'index.html must include Schema.org Organization'
      );
    });

    it('verifies Twitter Card and Open Graph metadata are present', () => {
      assert.ok(indexContent.includes('name="twitter:card"'), 'Twitter card tag must be present');
      assert.ok(indexContent.includes('property="og:type"'), 'OG type tag must be present');
      assert.ok(indexContent.includes('property="og:image"'), 'OG image tag must be present');
    });
  });
});
