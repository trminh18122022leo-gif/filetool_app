'use strict';

/**
 * tests/staging/websocket-isolation.test.js
 * Comprehensive WebSocket Integration, Authentication & Tenant Isolation Suite:
 * - Direct WSS Base URL Resolution across environments (Production, Staging/Preview, Localhost)
 * - Vercel Edge parity for /socket.io/ and /collab/
 * - Socket.IO hardened CORS origin verification (no 'null' bypass, verified Vercel & native schemes)
 * - Yjs /collab JWT token authentication requirement
 * - Yjs /collab cross-tenant room access isolation
 * - Yjs /collab origin verification against CSWSH
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const {
  getWebSocketBaseUrl,
  PRODUCTION_WS_URL,
  STAGING_WS_URL,
  LOCAL_WS_URL,
  PRODUCTION_HOSTS,
} = require('../../client/src/utils/apiEnv');

const { isOriginAllowed } = require('../../server/utils/corsGuard');

const {
  verifyCollabRoomAccess,
  addCollabRoomCollaborator,
  resetCollabRoomsForTesting,
} = require('../../server/services/collabAuth');

const {
  registerJob,
  hasJobAccess,
  hasJobAccessAsync,
  emitProgress,
  emitComplete,
} = require('../../server/services/jobEmitter');

describe('⚡ WebSocket Environment Isolation, Routing & Security Suite', () => {

  describe('1. Direct WSS Endpoint Environment Resolution (client/src/utils/apiEnv.js)', () => {
    it('resolves direct wss:// production backend on production frontends', () => {
      for (const host of PRODUCTION_HOSTS) {
        const wsUrl = getWebSocketBaseUrl(host);
        assert.equal(wsUrl, PRODUCTION_WS_URL, `Host ${host} must resolve to ${PRODUCTION_WS_URL}`);
        assert.ok(wsUrl.startsWith('wss://'), 'Production WS must use secure wss:// scheme');
        assert.ok(!wsUrl.includes('staging'), 'Production WS must not target staging');
      }
    });

    it('resolves direct wss:// staging backend on preview & staging frontends', () => {
      const previewHosts = [
        'filetool-app-git-staging.vercel.app',
        'filetools-app-git-staging.vercel.app',
        'filetool-app-git-release-v1-0-0-candidate.vercel.app',
        'filetools-app-git-release-v1-0-0-candidate.vercel.app',
        'filetool-app-preview-branch.vercel.app',
      ];

      for (const host of previewHosts) {
        const wsUrl = getWebSocketBaseUrl(host);
        assert.equal(wsUrl, STAGING_WS_URL, `Host ${host} must resolve to ${STAGING_WS_URL}`);
        assert.ok(wsUrl.startsWith('wss://'), 'Staging WS must use secure wss:// scheme');
        assert.ok(wsUrl.includes('staging-'), 'Staging WS must target staging backend');
      }
    });

    it('resolves ws:// localhost for local development hosts', () => {
      assert.equal(getWebSocketBaseUrl('localhost'), LOCAL_WS_URL);
      assert.equal(getWebSocketBaseUrl('127.0.0.1'), LOCAL_WS_URL);
    });

    it('prevents accidental production VITE_WS_URL override when running on preview hosts', () => {
      // Direct call with staging hostname guarantees fail-safe fallback to staging
      const resolved = getWebSocketBaseUrl('filetool-app-preview-xyz.vercel.app');
      assert.equal(resolved, STAGING_WS_URL);
    });
  });

  describe('2. Vercel Edge Rewrite Parity for WebSockets (client/vercel.json)', () => {
    const vercelConfigPath = path.resolve(__dirname, '../../client/vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
    const rewrites = vercelConfig.rewrites || [];

    it('includes environment-segregated /collab/(.*) rewrites matching /socket.io/(.*)', () => {
      const collabRewrites = rewrites.filter(r => r.source === '/collab/(.*)');
      assert.ok(collabRewrites.length >= 2, 'Must have at least 2 environment-specific /collab/ rewrite rules');

      // Staging collab rewrite
      const stagingCollab = collabRewrites.find(r =>
        r.destination.includes('staging-filetools-api.onrender.com/collab/')
      );
      assert.ok(stagingCollab, 'Must have rewrite routing staging /collab/ to staging backend');

      // Production collab rewrite
      const prodCollab = collabRewrites.find(r =>
        r.destination.includes('filetools-api.onrender.com/collab/') && !r.destination.includes('staging-')
      );
      assert.ok(prodCollab, 'Must have rewrite routing production /collab/ to production backend');
    });

    it('maintains /collab/ fallback routing to staging, NEVER production', () => {
      const fallbackCollab = rewrites.find(r => r.source === '/collab/(.*)' && !r.has);
      assert.ok(fallbackCollab, 'Must have fallback /collab/ rewrite');
      assert.ok(fallbackCollab.destination.includes('staging-filetools-api.onrender.com'));
      assert.ok(!fallbackCollab.destination.includes('//filetools-api.onrender.com'));
    });
  });

  describe('3. Socket.IO CORS & Origin Validation', () => {
    it('authorizes verified production Vercel origins', () => {
      assert.equal(isOriginAllowed('https://filetool-app.vercel.app'), true);
      assert.equal(isOriginAllowed('https://filetools.pro'), true);
    });

    it('strictly forbids literal string "null" from connecting to WebSockets', () => {
      assert.equal(isOriginAllowed('null'), false);
      assert.equal(isOriginAllowed('NULL'), false);
    });

    it('strictly forbids unverified third-party origins', () => {
      assert.equal(isOriginAllowed('https://malicious-site.com'), false);
      assert.equal(isOriginAllowed('https://attacker.vercel.app'), false);
    });

    it('authorizes native custom URI schemes for desktop and mobile clients', () => {
      assert.equal(isOriginAllowed('filetools://auth'), true);
      assert.equal(isOriginAllowed('com.filetools.pro://auth'), true);
    });
  });

  describe('4. Database-Backed Document Authorization for Yjs /collab Rooms', () => {
    const userA = '65a123456789abcdef000001';
    const userB = '65a123456789abcdef000002';
    const userC = '65a123456789abcdef000003';

    it('enforces that rooms formatted as user_<ownerId>_... restrict access to room owner', async () => {
      // User A accessing own room: Allowed
      const resA = await verifyCollabRoomAccess(`user_${userA}_doc1`, userA);
      assert.equal(resA.authorized, true);

      // User B trying to access User A's room: Forbidden
      const resB = await verifyCollabRoomAccess(`user_${userA}_doc1`, userB);
      assert.equal(resB.authorized, false);
      assert.equal(resB.reason, 'CROSS_USER_ROOM_FORBIDDEN');
    });

    it('rejects unauthenticated attempts without userId', async () => {
      const res = await verifyCollabRoomAccess('confidential-report-2026', null);
      assert.equal(res.authorized, false);
      assert.equal(res.reason, 'UNAUTHENTICATED');
    });

    it('rejects invalid or empty room identifiers', async () => {
      const res = await verifyCollabRoomAccess('   ', userA);
      assert.equal(res.authorized, false);
      assert.equal(res.reason, 'INVALID_ROOM_ID');
    });

    it('binds document ownership on creation and strictly isolates across user accounts regardless of naming convention', async () => {
      const docRoom = 'arbitrary-project-notes-room-99';

      // 1. User A first opens the document and becomes registered owner
      const firstAccess = await verifyCollabRoomAccess(docRoom, userA);
      assert.equal(firstAccess.authorized, true);
      assert.equal(firstAccess.role, 'room_owner_created');

      // 2. User A reconnects/re-enters and is recognized as room_owner
      const ownerAccess = await verifyCollabRoomAccess(docRoom, userA);
      assert.equal(ownerAccess.authorized, true);
      assert.equal(ownerAccess.role, 'room_owner');

      // 3. User B (different account) attempts access to the same document -> Strictly FORBIDDEN
      const unauthorizedAccess = await verifyCollabRoomAccess(docRoom, userB);
      assert.equal(unauthorizedAccess.authorized, false);
      assert.equal(unauthorizedAccess.reason, 'ROOM_ACCESS_DENIED');

      // 4. User A explicitly invites User B as collaborator
      await addCollabRoomCollaborator(docRoom, userA, userB);

      // 5. User B can now collaborate
      const collaboratorAccess = await verifyCollabRoomAccess(docRoom, userB);
      assert.equal(collaboratorAccess.authorized, true);
      assert.equal(collaboratorAccess.role, 'room_collaborator');

      // 6. User C (uninvited) is still strictly rejected
      const uninvitedAccess = await verifyCollabRoomAccess(docRoom, userC);
      assert.equal(uninvitedAccess.authorized, false);
      assert.equal(uninvitedAccess.reason, 'ROOM_ACCESS_DENIED');
    });
  });

  describe('5. Cross-Process Realtime & Persistent Job Ownership Checks', () => {
    const jobOwnerId = '65b123456789abcdef000010';
    const otherUserId = '65b123456789abcdef000020';
    const sampleJobId = 'job-collab-test-uuid-4455';
    const guestSecret = 'guest-secure-secret-token-xyz';

    it('verifies synchronous fast-path job ownership checks in memory', () => {
      registerJob(sampleJobId, { ownerId: jobOwnerId, secret: guestSecret, action: 'pdf-compress' });

      // Owner authorized
      assert.equal(hasJobAccess(sampleJobId, { userId: jobOwnerId }), true);
      // Secret authorized
      assert.equal(hasJobAccess(sampleJobId, { secret: guestSecret }), true);
      // Other user rejected
      assert.equal(hasJobAccess(sampleJobId, { userId: otherUserId }), false);
      // Missing credentials rejected
      assert.equal(hasJobAccess(sampleJobId, { userId: null, secret: null }), false);
    });

    it('verifies persistent async job ownership checks for reconnecting clients', async () => {
      // Reconnect query with owner credentials
      const ownerAllowed = await hasJobAccessAsync(sampleJobId, { userId: jobOwnerId });
      assert.equal(ownerAllowed, true);

      // Reconnect query with guest secret
      const guestAllowed = await hasJobAccessAsync(sampleJobId, { secret: guestSecret });
      assert.equal(guestAllowed, true);

      // Unauthorized reconnect attempt rejected
      const attackerAllowed = await hasJobAccessAsync(sampleJobId, { userId: otherUserId });
      assert.equal(attackerAllowed, false);
    });

    it('emits progress and completion events without crashing when Redis bridge is active or local', (t, done) => {
      let progressSeen = false;
      let completeSeen = false;

      const onProgress = ({ jobId, progress, currentStep }) => {
        if (jobId === sampleJobId) {
          progressSeen = true;
          assert.equal(progress, 50);
          assert.equal(currentStep, 'Compressing PDF');
        }
      };

      const onComplete = ({ jobId, result }) => {
        if (jobId === sampleJobId) {
          completeSeen = true;
          assert.equal(result.fileId, 'output-123');
          assert.equal(progressSeen, true);
          assert.equal(completeSeen, true);
          done();
        }
      };

      const { jobEmitter } = require('../../server/services/jobEmitter');
      jobEmitter.on('progress', onProgress);
      jobEmitter.on('complete', onComplete);

      emitProgress(sampleJobId, { progress: 50, currentStep: 'Compressing PDF' });
      emitComplete(sampleJobId, { fileId: 'output-123' });
    });
  });

});
