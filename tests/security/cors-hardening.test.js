'use strict';

/**
 * cors-hardening.test.js — Automated CORS Hardening & Origin Defense Verification Suite
 * 
 * Verifies:
 * 1. Strict rejection of Origin: 'null' and 'NULL' (mitigates sandboxed iframe attacks).
 * 2. Strict rejection of arbitrary external origins (anti-phishing & anti-CSRF).
 * 3. Strict rejection of localhost and 127.0.0.1 in staging & production environments.
 * 4. Preservation of legitimate non-browser requests without an Origin header.
 * 5. Credentialed CORS restriction: Returns exact calling origin, never wildcard '*',
 *    and only for explicitly authorized browser origins.
 * 6. Verified native custom URL schemes (filetools://, com.filetools.pro://).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isOriginAllowed,
  corsOptionsDelegate,
  VERIFIED_VERCEL_ORIGINS,
  VERIFIED_NATIVE_SCHEMES,
  getAllowedOrigins,
} = require('../../server/utils/corsGuard');

describe('🛡️ CORS Hardening & Origin Defense Verification Suite', () => {

  describe('1. Rejection of Opaque & Sandboxed Origins (Origin: null)', () => {
    it('strictly rejects literal string "null"', () => {
      assert.equal(isOriginAllowed('null'), false, 'Origin: "null" must be rejected to prevent sandboxed iframe attacks');
    });

    it('strictly rejects uppercase string "NULL"', () => {
      assert.equal(isOriginAllowed('NULL'), false, 'Origin: "NULL" must be rejected');
    });

    it('strictly rejects dangerous pseudo-protocols', () => {
      const dangerousProtocols = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'blob:https://filetool-app.vercel.app/uuid',
        'file:///etc/passwd',
        'vbscript:msgbox(1)'
      ];

      for (const p of dangerousProtocols) {
        assert.equal(isOriginAllowed(p), false, `Pseudo-protocol origin (${p}) must be rejected`);
      }
    });
  });

  describe('2. Rejection of Arbitrary External Origins', () => {
    it('rejects untrusted domains and spoofed subdomains', () => {
      const maliciousOrigins = [
        'https://evil-attacker.com',
        'https://filetool-app.attacker.com',
        'https://attacker-filetool-app.vercel.app',
        'https://unauthorized-domain.org',
        'http://filetools.pro.attacker.com',
      ];

      for (const origin of maliciousOrigins) {
        assert.equal(isOriginAllowed(origin), false, `Malicious/untrusted origin (${origin}) must be rejected`);
      }
    });
  });

  describe('3. Localhost Disallowance in Staging and Production', () => {
    it('forbids localhost and 127.0.0.1 when APP_ENV=staging', () => {
      const origAppEnv = process.env.APP_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.APP_ENV = 'staging';
        process.env.NODE_ENV = 'production';

        assert.equal(isOriginAllowed('http://localhost:3000'), false, 'localhost:3000 must be forbidden in staging');
        assert.equal(isOriginAllowed('http://localhost:5173'), false, 'localhost:5173 must be forbidden in staging');
        assert.equal(isOriginAllowed('http://127.0.0.1:3000'), false, '127.0.0.1:3000 must be forbidden in staging');
        assert.equal(isOriginAllowed('http://127.0.0.1:5173'), false, '127.0.0.1:5173 must be forbidden in staging');
        assert.equal(isOriginAllowed('http://localhost:8080'), false, 'arbitrary localhost port must be forbidden');
      } finally {
        process.env.APP_ENV = origAppEnv;
        process.env.NODE_ENV = origNodeEnv;
      }
    });

    it('forbids localhost and 127.0.0.1 when NODE_ENV=production', () => {
      const origAppEnv = process.env.APP_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.APP_ENV = 'production';
        process.env.NODE_ENV = 'production';

        assert.equal(isOriginAllowed('http://localhost:3000'), false);
        assert.equal(isOriginAllowed('http://127.0.0.1:5173'), false);
      } finally {
        process.env.APP_ENV = origAppEnv;
        process.env.NODE_ENV = origNodeEnv;
      }
    });
  });

  describe('4. Preservation of Non-Browser Requests Without Origin', () => {
    it('allows missing origin without echoing CORS headers', () => {
      assert.equal(isOriginAllowed(undefined), true, 'Missing origin must pass isOriginAllowed for server-to-server traffic');
      assert.equal(isOriginAllowed(''), true, 'Empty string origin must pass isOriginAllowed');

      // Test corsOptionsDelegate does NOT set CORS headers when Origin header is absent
      const mockReq = { header: (name) => (name.toLowerCase() === 'origin' ? undefined : null) };
      corsOptionsDelegate(mockReq, (err, options) => {
        assert.equal(err, null);
        assert.equal(options.origin, false, 'corsOptionsDelegate must set origin: false when Origin header is missing');
        assert.equal(options.credentials, undefined, 'Must not set credentials header for non-browser request');
      });
    });
  });

  describe('5. Credentialed CORS Options Delegate & Explicit Origin Reflection', () => {
    it('echoes exact calling origin (never "*") and sets credentials: true for verified Vercel origins', () => {
      for (const origin of VERIFIED_VERCEL_ORIGINS) {
        const mockReq = { header: (name) => (name.toLowerCase() === 'origin' ? origin : null) };
        corsOptionsDelegate(mockReq, (err, options) => {
          assert.equal(err, null);
          assert.equal(options.origin, origin, `Must echo exact verified origin: ${origin}`);
          assert.equal(options.credentials, true, 'Must enable credentials for verified origins');
          assert.ok(options.methods.includes('POST'), 'Must permit POST');
          assert.ok(options.allowedHeaders.includes('Authorization'), 'Must permit Authorization header');
        });
      }
    });

    it('rejects cross-origin requests for untrusted origins in corsOptionsDelegate', () => {
      const untrustedOrigins = ['https://malicious.com', 'null', 'http://localhost:9999'];
      for (const origin of untrustedOrigins) {
        const mockReq = { header: (name) => (name.toLowerCase() === 'origin' ? origin : null) };
        corsOptionsDelegate(mockReq, (err, options) => {
          assert.equal(err, null);
          assert.equal(options.origin, false, `Must reject CORS for untrusted origin: ${origin}`);
        });
      }
    });
  });

  describe('6. Verified Native Custom URL Schemes', () => {
    it('authorizes verified native custom schemes (Electron & Capacitor)', () => {
      for (const scheme of VERIFIED_NATIVE_SCHEMES) {
        assert.equal(isOriginAllowed(scheme), true, `Native scheme (${scheme}) must be authorized`);
        assert.equal(isOriginAllowed(`${scheme}auth`), true, `Native sub-path (${scheme}auth) must be authorized`);
      }
    });
  });

});
