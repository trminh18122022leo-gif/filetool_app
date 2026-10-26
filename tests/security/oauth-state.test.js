'use strict';

/**
 * tests/security/oauth-state.test.js
 * Cryptographic OAuth State & Cross-Environment Redirection Defense Suite:
 * - HMAC-SHA256 Signed State Generation
 * - Tamper detection (modified payload or forged signature)
 * - Anti-replay and expiration verification
 * - Cross-environment isolation (staging state rejected by production, and vice versa)
 * - Origin validation (only environment-verified origins permitted in state)
 * - Elimination of raw Referer header trusting
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const authRoutes = require('../../server/routes/auth.routes');
const { generateOAuthState, verifyOAuthState, getClientUrl } = authRoutes;
const {
  isOriginAllowedForEnv,
  VERIFIED_PRODUCTION_ORIGINS,
  VERIFIED_STAGING_ORIGINS,
} = require('../../server/utils/corsGuard');

describe('🔐 OAuth Cryptographic State & Environment Separation Suite', () => {

  describe('1. HMAC State Token Generation & Verification', () => {
    it('generates a valid signed state parameter with payload and signature', () => {
      const state = generateOAuthState({
        origin: 'https://filetool-app.vercel.app',
        platform: 'web',
      });

      assert.ok(typeof state === 'string');
      const parts = state.split('.');
      assert.equal(parts.length, 2, 'State must be in format payload.signature');

      const verified = verifyOAuthState(state);
      assert.ok(verified, 'State must verify successfully');
      assert.equal(verified.origin, 'https://filetool-app.vercel.app');
      assert.equal(verified.platform, 'web');
      assert.ok(verified.nonce && verified.nonce.length >= 16);
      assert.ok(verified.exp > Date.now());
    });

    it('strictly rejects tampered payload with altered origin', () => {
      const state = generateOAuthState({
        origin: 'https://filetool-app.vercel.app',
        platform: 'web',
      });
      const [payloadStr, signature] = state.split('.');

      // Attacker decodes payload and alters origin to evil domain
      const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
      payload.origin = 'https://attacker.evil.com';
      const forgedPayloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedState = `${forgedPayloadStr}.${signature}`;
      const result = verifyOAuthState(tamperedState);
      assert.equal(result, null, 'Tampered payload must fail cryptographic signature verification');
    });

    it('strictly rejects tampered signature', () => {
      const state = generateOAuthState({
        origin: 'https://filetool-app.vercel.app',
      });
      const [payloadStr] = state.split('.');
      const bogusSignature = crypto.randomBytes(32).toString('base64url');

      const tamperedState = `${payloadStr}.${bogusSignature}`;
      const result = verifyOAuthState(tamperedState);
      assert.equal(result, null, 'Tampered signature must be rejected');
    });

    it('strictly rejects expired state tokens', () => {
      const secret = process.env.JWT_SECRET || 'filetools-oauth-state-secret-default-key';
      const expiredPayload = {
        origin: 'https://filetool-app.vercel.app',
        platform: 'web',
        env: 'production',
        nonce: 'expirednonce12345',
        exp: Date.now() - 5000, // Expired 5 seconds ago
      };

      const payloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
      const expiredState = `${payloadStr}.${signature}`;

      const result = verifyOAuthState(expiredState);
      assert.equal(result, null, 'Expired state token must be rejected');
    });
  });

  describe('2. Cross-Environment Callback & Origin Isolation', () => {
    it('rejects staging state token on production backend', () => {
      const origEnv = process.env.APP_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      try {
        // Generate state on staging
        process.env.APP_ENV = 'staging';
        const stagingState = generateOAuthState({
          origin: 'https://filetool-app-git-staging.vercel.app',
        });

        // Verify on production
        process.env.APP_ENV = 'production';
        process.env.NODE_ENV = 'production';
        const result = verifyOAuthState(stagingState);
        assert.equal(result, null, 'Production backend must reject state generated in staging');
      } finally {
        process.env.APP_ENV = origEnv;
        process.env.NODE_ENV = origNodeEnv;
      }
    });

    it('rejects production state token on staging backend', () => {
      const origEnv = process.env.APP_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      try {
        // Generate state on production
        process.env.APP_ENV = 'production';
        process.env.NODE_ENV = 'production';
        const prodState = generateOAuthState({
          origin: 'https://filetool-app.vercel.app',
        });

        // Verify on staging
        process.env.APP_ENV = 'staging';
        delete process.env.NODE_ENV;
        const result = verifyOAuthState(prodState);
        assert.equal(result, null, 'Staging backend must reject state generated in production');
      } finally {
        process.env.APP_ENV = origEnv;
        process.env.NODE_ENV = origNodeEnv;
      }
    });

    it('forbids production domains from being set as staging origin via isOriginAllowedForEnv', () => {
      for (const prodOrigin of VERIFIED_PRODUCTION_ORIGINS) {
        assert.equal(
          isOriginAllowedForEnv(prodOrigin, 'staging'),
          false,
          `Production domain ${prodOrigin} must NOT be allowed as staging origin`
        );
      }
    });

    it('forbids staging domains from being set as production origin via isOriginAllowedForEnv', () => {
      for (const stagingOrigin of VERIFIED_STAGING_ORIGINS) {
        assert.equal(
          isOriginAllowedForEnv(stagingOrigin, 'production'),
          false,
          `Staging domain ${stagingOrigin} must NOT be allowed as production origin`
        );
      }
    });
  });

  describe('3. Untrusted Referer Defense & Origin Adherence', () => {
    it('does NOT trust spoofed Referer header alone to determine destination client URL', () => {
      const mockReqWithSpoofedReferer = {
        get: (header) => {
          if (header.toLowerCase() === 'referer') return 'https://attacker.evil.com/fake-login';
          return null;
        },
        query: {},
        cookies: {},
      };

      const clientUrl = getClientUrl(mockReqWithSpoofedReferer);
      assert.ok(!clientUrl.includes('evil.com'), 'Must never redirect to unverified domain from Referer');
      assert.ok(
        clientUrl.includes('filetool-app.vercel.app') || clientUrl.includes('filetools.pro') || clientUrl.includes('localhost'),
        'Must fall back to safe environment client URL'
      );
    });

    it('uses verified state origin over any other request header', () => {
      const validState = generateOAuthState({
        origin: 'https://filetool-app.vercel.app',
      });

      const mockReq = {
        get: () => 'https://some-other-origin.com',
        query: { state: validState },
        cookies: {},
      };

      const clientUrl = getClientUrl(mockReq);
      assert.equal(clientUrl, 'https://filetool-app.vercel.app', 'Verified state origin must take precedence');
    });
  });

});
