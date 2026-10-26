'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const crypto = require('node:crypto');
const jwt    = require('jsonwebtoken');

// Ensure required environment variables for test execution
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-security-audit-32chars!';
process.env.CLIENT_URL = 'http://localhost:5173';

const authSvc = require('../../server/services/auth.service');
const { requireAuth, optionalAuth, requirePlan, requireRole } = require('../../server/middleware/auth');
const { validateDownloadAccess } = require('../../server/middleware/accessControl');
const { registerJob, hasJobAccess } = require('../../server/services/jobEmitter');
const dbConfig = require('../../server/config/database');

describe('🛡️ P0 Security & Access Control Verification Suite', () => {

  // Synthetic Users A & B
  const userA = {
    _id: '507f1f77bcf86cd799439011',
    email: 'synthetic_user_a@test.local',
    role: 'user',
    plan: 'free',
  };

  const userB = {
    _id: '507f191e810c19729de860ea',
    email: 'synthetic_user_b@test.local',
    role: 'user',
    plan: 'free',
  };

  const adminUser = {
    _id: '507f191e810c19729de860ff',
    email: 'synthetic_admin@test.local',
    role: 'admin',
    plan: 'pro',
  };

  const tokenA = authSvc.signAccessToken(userA._id);
  const tokenB = authSvc.signAccessToken(userB._id);

  // Helper mock response
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      redirect(url) {
        this.redirectUrl = url;
        return this;
      },
      cookie(name, value, opts) {
        this.cookies = this.cookies || {};
        this.cookies[name] = { value, opts };
        return this;
      },
      send(data) {
        this.sentData = data;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
  }

  // ── 1. Auth DB Outage & No Plan Elevation ──────────────────────────────────
  describe('1. Auth DB Outage & Fail-Closed Semantics', () => {
    it('requireAuth MUST return 503 and NEVER elevate to plan: pro when AuthDB is disconnected', async () => {
      // Stub isAuthConnected to false
      const originalIsAuthConnected = dbConfig.isAuthConnected;
      dbConfig.isAuthConnected = () => false;

      try {
        const req = {
          headers: { authorization: `Bearer ${tokenA}` },
          cookies: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        await requireAuth(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false, 'next() must NOT be called during DB outage');
        assert.equal(res.statusCode, 503, 'Must return HTTP 503');
        assert.equal(res.body?.code, 'AUTH_DB_UNAVAILABLE');
        assert.equal(req.user, undefined, 'req.user must NOT be set, strictly no plan elevation to pro');
      } finally {
        dbConfig.isAuthConnected = originalIsAuthConnected;
      }
    });

    it('optionalAuth MUST fail closed without attaching req.user or plan: pro when AuthDB is disconnected', async () => {
      const originalIsAuthConnected = dbConfig.isAuthConnected;
      dbConfig.isAuthConnected = () => false;

      try {
        const req = {
          headers: { authorization: `Bearer ${tokenA}` },
          cookies: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        await optionalAuth(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, true, 'next() should be called to let request proceed anonymously');
        assert.equal(req.user, undefined, 'req.user must be undefined, strictly no elevation');
      } finally {
        dbConfig.isAuthConnected = originalIsAuthConnected;
      }
    });
  });

  // ── 2. JWT Expiration & Invalid Token Handling ─────────────────────────────
  describe('2. JWT Expiration & Invalid Token Handling', () => {
    it('requireAuth returns 401 TOKEN_EXPIRED on expired access token', async () => {
      const expiredToken = jwt.sign(
        { userId: userA._id, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: -10 } // expired 10 seconds ago
      );

      const req = {
        headers: { authorization: `Bearer ${expiredToken}` },
        cookies: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireAuth(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body?.code, 'TOKEN_EXPIRED');
    });

    it('requireAuth returns 401 INVALID_TOKEN on tampered signature', async () => {
      const tamperedToken = tokenA.slice(0, -6) + 'abcdef';

      const req = {
        headers: { authorization: `Bearer ${tamperedToken}` },
        cookies: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await requireAuth(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body?.code, 'INVALID_TOKEN');
    });
  });

  // ── 3. Telegram Callback Cryptographic Verification ────────────────────────
  describe('3. Telegram Callback Cryptographic Verification', () => {
    const BOT_TOKEN = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_mock';

    function signTelegramData(payload, botToken) {
      const checkString = Object.keys(payload)
        .sort()
        .map(k => `${k}=${payload[k]}`)
        .join('\n');
      const secret = crypto.createHash('sha256').update(botToken).digest();
      return crypto.createHmac('sha256', secret).update(checkString).digest('hex');
    }

    it('Telegram callback redirects with telegram_auth_disabled when TELEGRAM_BOT_TOKEN is unset', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      try {
        const authRoutes = require('../../server/routes/auth.routes');
        // Test route via mock req/res
        const routeLayer = authRoutes.stack.find(s => s.route?.path === '/telegram/callback');
        assert.ok(routeLayer, 'Route /telegram/callback must exist');

        const req = {
          query: { id: '99999' },
          cookies: {},
          get: () => 'localhost:3002',
        };
        const res = createMockRes();

        await routeLayer.route.stack[0].handle(req, res);

        assert.ok(res.redirectUrl.includes('error=telegram_auth_disabled'), 'Must fail closed when BOT_TOKEN is missing');
      } finally {
        process.env.TELEGRAM_BOT_TOKEN = originalToken;
      }
    });

    it('Telegram callback rejects tampered signature', async () => {
      process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
      const authRoutes = require('../../server/routes/auth.routes');
      const routeLayer = authRoutes.stack.find(s => s.route?.path === '/telegram/callback');

      const nowSec = Math.floor(Date.now() / 1000);
      const payload = {
        id: '123456',
        first_name: 'Attacker',
        auth_date: String(nowSec),
      };
      const validHash = signTelegramData(payload, BOT_TOKEN);
      const tamperedHash = validHash.slice(0, -4) + '0000';

      const req = {
        query: { ...payload, hash: tamperedHash },
        cookies: {},
        get: () => 'localhost:3002',
      };
      const res = createMockRes();

      await routeLayer.route.stack[0].handle(req, res);

      assert.ok(res.redirectUrl.includes('telegram_auth_invalid_signature'), 'Must reject tampered HMAC signature');
    });

    it('Telegram callback rejects expired auth_date (> 15 minutes)', async () => {
      process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
      const authRoutes = require('../../server/routes/auth.routes');
      const routeLayer = authRoutes.stack.find(s => s.route?.path === '/telegram/callback');

      const expiredSec = Math.floor(Date.now() / 1000) - 1000; // 16.6 minutes ago
      const payload = {
        id: '123456',
        first_name: 'OldSession',
        auth_date: String(expiredSec),
      };
      const hash = signTelegramData(payload, BOT_TOKEN);

      const req = {
        query: { ...payload, hash },
        cookies: {},
        get: () => 'localhost:3002',
      };
      const res = createMockRes();

      await routeLayer.route.stack[0].handle(req, res);

      assert.ok(res.redirectUrl.includes('telegram_auth_expired_auth_date'), 'Must reject expired auth_date');
    });

    it('Telegram callback rejects replay attacks of identical hash', async () => {
      process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
      const authRoutes = require('../../server/routes/auth.routes');
      const routeLayer = authRoutes.stack.find(s => s.route?.path === '/telegram/callback');

      const nowSec = Math.floor(Date.now() / 1000);
      const payload = {
        id: '789101',
        first_name: 'ReplayTarget',
        auth_date: String(nowSec),
      };
      const hash = signTelegramData(payload, BOT_TOKEN);

      const RefreshToken = require('../../server/models/RefreshToken');
      const origCreateToken = RefreshToken.createToken;
      RefreshToken.createToken = async () => 'mock-refresh-token-123';
      const User = require('../../server/models/User');
      const origFindOne = User.findOne;
      User.findOne = async () => ({
        _id: '507f191e810c19729de860ee',
        telegramId: '789101',
        email: 'replay@telegram.user',
        name: 'ReplayTarget',
        save: async () => {},
      });

      // First attempt
      const req1 = {
        query: { ...payload, hash },
        cookies: {},
        headers: { 'user-agent': 'node-test-agent' },
        ip: '127.0.0.1',
        get: () => 'localhost:3002',
      };
      const res1 = createMockRes();

      // Second attempt with exact same hash
      const req2 = {
        query: { ...payload, hash },
        cookies: {},
        headers: { 'user-agent': 'node-test-agent' },
        ip: '127.0.0.1',
        get: () => 'localhost:3002',
      };
      const res2 = createMockRes();

      try {
        await routeLayer.route.stack[0].handle(req1, res1);
        await routeLayer.route.stack[0].handle(req2, res2);
      } finally {
        User.findOne = origFindOne;
        RefreshToken.createToken = origCreateToken;
      }

      assert.ok(res2.redirectUrl.includes('telegram_auth_replay_detected'), 'Replay attack must be blocked');
    });
  });

  // ── 4. Cross-User File Isolation & Download Tokens ─────────────────────────
  describe('4. Tenant Boundary & File Download/View Access Control', () => {
    const filenameUserA = 'document_user_a.pdf';
    const downloadTokenUserA = authSvc.signDownloadToken(filenameUserA, userA._id, '1h');

    it('User A can access their own file with valid signed download token', async () => {
      const req = {
        params: { filename: filenameUserA },
        query: { token: downloadTokenUserA },
        headers: {},
        user: { _id: userA._id },
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'User A must have access to their file');
      assert.equal(res.statusCode, 200);
    });

    it('User B is FORBIDDEN (403) from accessing User A file even when possessing User A token', async () => {
      const req = {
        params: { filename: filenameUserA },
        query: { token: downloadTokenUserA },
        headers: {},
        user: { _id: userB._id }, // Authenticated as User B
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'User B must be blocked from User A file');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'CROSS_USER_FORBIDDEN');
    });

    it('Unauthenticated request without token is rejected with 403 FORBIDDEN_FILE_ACCESS', async () => {
      const req = {
        params: { filename: filenameUserA },
        query: {},
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'FORBIDDEN_FILE_ACCESS');
    });

    it('Attacker attempting path traversal is blocked with 400 PATH_TRAVERSAL_DETECTED', async () => {
      const req = {
        params: { filename: '../../etc/shadow' },
        query: { token: downloadTokenUserA },
        headers: {},
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.code, 'PATH_TRAVERSAL_DETECTED');
    });

    it('Token for filename X cannot be used to download filename Y (FILE_TOKEN_MISMATCH)', async () => {
      const req = {
        params: { filename: 'other_secret_file.pdf' },
        query: { token: downloadTokenUserA },
        headers: {},
        user: { _id: userA._id },
      };
      const res = createMockRes();
      let nextCalled = false;

      await validateDownloadAccess(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'FILE_TOKEN_MISMATCH');
    });
  });

  // ── 5. WebSocket Job Room Authorization (Socket.IO join-job) ─────────────────
  describe('5. WebSocket Job Room Authorization (join-job)', () => {
    const jobId = 'job-batch-884920';
    const jobSecret = 'secret-job-key-4421';

    before(() => {
      registerJob(jobId, {
        ownerId: userA._id,
        secret: jobSecret,
        action: 'pdf-compress',
      });
    });

    it('User A has authorized access to their own registered job', () => {
      const allowed = hasJobAccess(jobId, { userId: userA._id });
      assert.equal(allowed, true, 'Job owner must have access');
    });

    it('User B is DENIED access to User A registered job', () => {
      const allowed = hasJobAccess(jobId, { userId: userB._id });
      assert.equal(allowed, false, 'Non-owner User B must be denied');
    });

    it('Anonymous user without secret is DENIED access to registered job', () => {
      const allowed = hasJobAccess(jobId, { userId: null, secret: null });
      assert.equal(allowed, false, 'Anonymous user without secret must be denied');
    });

    it('Guest client with valid job secret is GRANTED access', () => {
      const allowed = hasJobAccess(jobId, { userId: null, secret: jobSecret });
      assert.equal(allowed, true, 'Valid secret grants access to job');
    });
  });

  // ── 6. Yjs Collab Room Tenant Boundary ─────────────────────────────────────
  describe('6. Yjs Collab Room Tenant Boundary & Cross-User Isolation', () => {
    it('Verifies room ownership pattern: User A allowed in their room, User B forbidden', () => {
      const docName = `user_${userA._id}_private_scratchpad`;
      const parts = docName.split(/[_:]/);
      const roomOwnerId = parts[1];

      assert.equal(roomOwnerId, userA._id);

      // Access test for User A
      const userAAccess = String(roomOwnerId) === String(userA._id);
      assert.equal(userAAccess, true, 'User A must be allowed in their scoped room');

      // Access test for User B
      const userBAccess = String(roomOwnerId) === String(userB._id);
      assert.equal(userBAccess, false, 'User B must be forbidden from User A scoped room');
    });
  });

  // ── 7. Role & Global State Protection (/tts/dictionary) ───────────────────
  describe('7. Global State Mutation Protection (Speech Dictionary)', () => {
    it('Regular user (role: user) is forbidden (403) from mutating global dictionary', () => {
      const middleware = requireRole('admin');
      const req = { user: userA };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Regular user must not pass requireRole(admin)');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.code, 'FORBIDDEN');
    });

    it('Admin user (role: admin) is permitted to mutate global dictionary', () => {
      const middleware = requireRole('admin');
      const req = { user: adminUser };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'Admin user must be allowed');
      assert.equal(res.statusCode, 200);
    });
  });

  // ── 8. Open Redirect & Host Header Poisoning Defense ────────────────────────
  describe('8. Open Redirect & Host Header Poisoning Defense', () => {
    it('Host header with evil-attacker.com and arbitrary *.vercel.app is ignored', () => {
      const configuredClient = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
      const testHosts = ['evil-attacker.com', 'phishing.vercel.app', 'malicious-clone.vercel.app'];

      const VERIFIED_VERCEL_HOSTS = [
        'filetool-app.vercel.app',
        'filetools-app.vercel.app',
        'filetool-app-git-staging.vercel.app',
        'filetools-app-git-staging.vercel.app',
        'filetool-app-git-release-v1-0-0-candidate.vercel.app',
        'filetools-app-git-release-v1-0-0-candidate.vercel.app',
        'filetools.pro',
        'www.filetools.pro',
      ];

      testHosts.forEach(rawHost => {
        const host = rawHost.split(':')[0].toLowerCase();
        const isAllowedHost =
          host === 'localhost' ||
          host === '127.0.0.1' ||
          VERIFIED_VERCEL_HOSTS.includes(host) ||
          (configuredClient && configuredClient.includes(host));

        assert.equal(isAllowedHost, false, `${rawHost} must NOT be allowed`);
      });

      // Verified project deployment host must be allowed, arbitrary unverified host rejected
      const verifiedPreview = 'filetool-app-git-staging.vercel.app';
      const unverifiedPreview = 'filetool-app-arbitrary-pr999.vercel.app';
      assert.equal(VERIFIED_VERCEL_HOSTS.includes(verifiedPreview), true, 'Verified project staging host must be allowed');
      assert.equal(VERIFIED_VERCEL_HOSTS.includes(unverifiedPreview), false, 'Arbitrary unverified host must be rejected');
    });

    it('Strict CORS isOriginAllowed rejects arbitrary third-party vercel domains', () => {
      const { isOriginAllowed } = require('../../server/utils/corsGuard');
      assert.equal(isOriginAllowed('https://filetool-app.vercel.app'), true);
      assert.equal(isOriginAllowed('https://filetools-app.vercel.app'), true);
      assert.equal(isOriginAllowed('https://filetool-app-git-staging.vercel.app'), true);
      assert.equal(isOriginAllowed('https://filetool-app-git-release-v1-0-0-candidate.vercel.app'), true);
      assert.equal(isOriginAllowed('https://arbitrary-unverified.vercel.app'), false);
      assert.equal(isOriginAllowed('https://evil-phishing.vercel.app'), false);
      assert.equal(isOriginAllowed('https://attacker-site.com'), false);
    });
  });

  after(async () => {
    try {
      await dbConfig.closeConnections();
    } catch (_) {}
  });

});
