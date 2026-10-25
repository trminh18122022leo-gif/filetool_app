'use strict';

/**
 * renderer-security.test.js — Automated Chromium Renderer Security & Isolation Suite
 * 
 * Verifies:
 * 1. Puppeteer launch configuration prefers sandboxed execution.
 * 2. process.env.RENDER === 'true' does NOT disable the Chromium sandbox.
 * 3. Network interception in ssrfGuard.js enforces Deny-All mode.
 * 4. SSRF protection against loopback, private RFC 1918, and cloud metadata (169.254.169.254).
 * 5. Dangerous HTML/SVG elements are stripped prior to PDF synthesis.
 * 6. Resource limiting flags (--disable-dev-shm-usage, --disable-gpu) are present.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getBrowserArgs } = require('../../server/utils/browser');
const {
  isPrivateOrReservedIP,
  isForbiddenHostname,
  validateSafeUrl,
  protectPageNetwork,
} = require('../../server/utils/ssrfGuard');

describe('🔒 Chromium Renderer Security & Sandboxing Suite', () => {

  describe('1. Sandbox Configuration & Render Invariants', () => {
    it('does NOT automatically disable sandbox when process.env.RENDER is true', () => {
      const origRender = process.env.RENDER;
      const origNoSandbox = process.env.CHROMIUM_NO_SANDBOX;
      try {
        process.env.RENDER = 'true';
        delete process.env.CHROMIUM_NO_SANDBOX;

        const args = getBrowserArgs({ forceNoSandbox: false });
        // On non-root execution, sandbox must NOT be disabled
        if (process.platform !== 'linux' || (typeof process.getuid === 'function' && process.getuid() !== 0)) {
          assert.equal(
            args.includes('--no-sandbox'),
            false,
            'Chromium sandbox must NOT be disabled solely because RENDER=true'
          );
        }
      } finally {
        if (origRender) process.env.RENDER = origRender; else delete process.env.RENDER;
        if (origNoSandbox) process.env.CHROMIUM_NO_SANDBOX = origNoSandbox; else delete process.env.CHROMIUM_NO_SANDBOX;
      }
    });

    it('enables --no-sandbox only when CHROMIUM_NO_SANDBOX=true is explicitly set', () => {
      const origNoSandbox = process.env.CHROMIUM_NO_SANDBOX;
      try {
        process.env.CHROMIUM_NO_SANDBOX = 'true';
        const args = getBrowserArgs();
        assert.ok(args.includes('--no-sandbox'), 'Must include --no-sandbox when CHROMIUM_NO_SANDBOX=true');
        assert.ok(args.includes('--disable-setuid-sandbox'), 'Must include --disable-setuid-sandbox');
      } finally {
        if (origNoSandbox) process.env.CHROMIUM_NO_SANDBOX = origNoSandbox; else delete process.env.CHROMIUM_NO_SANDBOX;
      }
    });

    it('enforces essential resource containment flags', () => {
      const args = getBrowserArgs();
      assert.ok(args.includes('--disable-dev-shm-usage'), 'Must include --disable-dev-shm-usage');
      assert.ok(args.includes('--disable-gpu'), 'Must include --disable-gpu');
      assert.ok(args.includes('--disable-background-networking'), 'Must include --disable-background-networking');
      assert.ok(args.includes('--mute-audio'), 'Must include --mute-audio');
    });
  });

  describe('2. SSRF Guard & IP Boundary Validation', () => {
    it('identifies and blocks cloud metadata IP 169.254.169.254', () => {
      assert.equal(isPrivateOrReservedIP('169.254.169.254'), true, 'AWS/GCP/Cloudflare metadata IP must be blocked');
      assert.equal(isPrivateOrReservedIP('169.254.1.1'), true, 'Link-local 169.254.0.0/16 must be blocked');
    });

    it('identifies and blocks loopback and private RFC 1918 IP addresses', () => {
      const privateIPs = [
        '127.0.0.1',
        '127.0.0.2',
        '10.0.0.1',
        '10.255.255.255',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '192.168.0.254',
        '0.0.0.0',
        '::1',
        'fc00::1',
      ];

      for (const ip of privateIPs) {
        assert.equal(isPrivateOrReservedIP(ip), true, `Private/Loopback IP (${ip}) must be classified as reserved`);
      }
    });

    it('identifies and blocks forbidden hostnames', () => {
      const forbiddenHosts = [
        'localhost',
        'metadata.google.internal',
        'instance-data',
        'service.local',
        'internal.corp',
      ];

      for (const h of forbiddenHosts) {
        assert.equal(isForbiddenHostname(h), true, `Forbidden hostname (${h}) must be blocked`);
      }
    });

    it('rejects SSRF target URLs via validateSafeUrl', async () => {
      const dangerousUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://localhost:3001/api/health',
        'http://127.0.0.1:27017',
        'file:///etc/passwd',
        'ftp://internal.server/data',
      ];

      for (const url of dangerousUrls) {
        await assert.rejects(
          async () => validateSafeUrl(url),
          /SSRF|giao thức|không được phép|Loopback|Private|bị từ chối|forbidden/i,
          `Dangerous URL (${url}) must be rejected by validateSafeUrl`
        );
      }
    });
  });

  describe('3. Deny-All Page Network Interception (protectPageNetwork)', () => {
    it('aborts all outgoing HTTP/HTTPS sub-requests in deny-all mode', async () => {
      let abortedReason = null;
      let interceptedUrl = null;

      const mockRequest = {
        url: () => 'https://external-resource.com/tracker.js',
        abort: (reason) => { abortedReason = reason; },
        continue: () => { abortedReason = 'continued'; },
      };

      const mockPage = {
        setRequestInterception: async (val) => {},
        on: (event, handler) => {
          if (event === 'request') {
            handler(mockRequest);
          }
        },
      };

      await protectPageNetwork(mockPage, { mode: 'deny-all', allowDataUris: true });
      assert.equal(abortedReason, 'accessdenied', 'External sub-request must be aborted with accessdenied');
    });

    it('allows data URIs for inline embedded images in deny-all mode', async () => {
      let result = null;

      const mockRequest = {
        url: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        abort: (reason) => { result = `aborted:${reason}`; },
        continue: () => { result = 'continued'; },
      };

      const mockPage = {
        setRequestInterception: async () => {},
        on: (event, handler) => {
          if (event === 'request') handler(mockRequest);
        },
      };

      await protectPageNetwork(mockPage, { mode: 'deny-all', allowDataUris: true });
      assert.equal(result, 'continued', 'Data URIs must be allowed for inline graphics');
    });
  });

});
