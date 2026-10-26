'use strict';

/**
 * tests/staging/websocket-isolation.test.js
 * Comprehensive WebSocket Integration, Authentication & Tenant Isolation Suite:
 * - Direct WSS Base URL Resolution across environments (Production, Staging/Preview, Localhost)
 * - Vercel Edge parity for /socket.io/ and /collab/
 * - Socket.IO hardened CORS origin verification (no 'null' bypass, verified Vercel & native schemes)
 * - Yjs WebSocket Route Compatibility & Real y-websocket Client Integration
 * - Database-backed Document-Level Yjs Authorization & Room Creation Security
 * - Redis Pub/Sub Instance Identification across containers sharing identical PIDs
 * - Colocated Background Worker Process Supervisor Lifecycle
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const { setupWSConnection, docs: ywsDocs } = require('y-websocket/bin/utils');

const {
  getWebSocketBaseUrl,
  PRODUCTION_WS_URL,
  STAGING_WS_URL,
  LOCAL_WS_URL,
  PRODUCTION_HOSTS,
} = require('../../client/src/utils/apiEnv');

const { isOriginAllowed } = require('../../server/utils/corsGuard');

const {
  isValidRoomIdentifier,
  createCollabRoom,
  deleteCollabRoom,
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
  getInstanceId,
  setInstanceIdForTesting,
  processIncomingPubSubMessage,
  REDIS_CHANNEL,
  jobEmitter,
} = require('../../server/services/jobEmitter');

const {
  isWorkerRunning,
  getWorkerPid,
  resetSupervisorForTesting,
} = require('../../server/utils/workerSupervisor');

describe('⚡ WebSocket Environment Isolation, Routing & Security Suite', () => {

  describe('1. Direct WSS Endpoint Environment Resolution (client/src/utils/apiEnv.js)', () => {
    it('resolves direct wss:// production backend on production frontends', () => {
      assert.equal(PRODUCTION_WS_URL, 'wss://filetools-jkx7.onrender.com');
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

      const stagingCollab = collabRewrites.find(r =>
        r.destination.includes('staging-filetools-api.onrender.com/collab/')
      );
      assert.ok(stagingCollab, 'Must have rewrite routing staging /collab/ to staging backend');

      const prodCollab = collabRewrites.find(r =>
        r.destination.includes('filetools-jkx7.onrender.com/collab/') && !r.destination.includes('staging-')
      );
      assert.ok(prodCollab, 'Must have rewrite routing production /collab/ to production backend');
    });

    it('maintains /collab/ fallback routing to staging, NEVER production', () => {
      const fallbackCollab = rewrites.find(r => r.source === '/collab/(.*)' && !r.has);
      assert.ok(fallbackCollab, 'Must have fallback /collab/ rewrite');
      assert.ok(fallbackCollab.destination.includes('staging-filetools-api.onrender.com'));
      assert.ok(!fallbackCollab.destination.includes('//filetools-jkx7.onrender.com'));
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

  describe('4. Yjs WebSocket Route Compatibility & Real Client Integration', () => {
    let testHttpServer;
    let testPort;
    const jwtSecret = 'test-secret-for-real-collab-test-32chars!';
    const userAlice = '65a123456789abcdef000001';
    const userBob = '65a123456789abcdef000002';
    const aliceToken = jwt.sign({ userId: userAlice, email: 'alice@example.com' }, jwtSecret, { expiresIn: '1h' });
    const bobToken = jwt.sign({ userId: userBob, email: 'bob@example.com' }, jwtSecret, { expiresIn: '1h' });

    beforeEach(() => {
      resetCollabRoomsForTesting();
    });

    it('connects actual y-websocket client to real Node WebSocket server and syncs document updates', async () => {
      const authorizedDocId = 'real-contract-doc-01';
      await createCollabRoom(authorizedDocId, userAlice, { title: 'Alice Contract' });

      // Create test server matching server/index.js upgrade handler
      const server = http.createServer();
      const sockets = new Set();
      server.on('connection', s => {
        sockets.add(s);
        s.on('close', () => sockets.delete(s));
      });

      const collabWSS = new WebSocket.Server({ noServer: true });

      collabWSS.on('connection', (ws, req) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        let docName = '';
        if (parsedUrl.pathname.startsWith('/collab/')) {
          docName = decodeURIComponent(parsedUrl.pathname.replace(/^\/collab\/?/, '').split('/')[0]);
        }
        if (!docName) {
          docName = parsedUrl.searchParams.get('room') || 'default';
        }
        setupWSConnection(ws, req, { docName, gc: true });
      });

      server.on('upgrade', async (req, socket, head) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const isCollab = parsedUrl.pathname === '/collab' || parsedUrl.pathname.startsWith('/collab/');
          if (!isCollab) {
            socket.destroy();
            return;
          }

          let token = parsedUrl.searchParams.get('token');
          if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          let decoded;
          try {
            decoded = jwt.verify(token, jwtSecret);
          } catch (_) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          let docName = '';
          if (parsedUrl.pathname.startsWith('/collab/')) {
            docName = decodeURIComponent(parsedUrl.pathname.replace(/^\/collab\/?/, '').split('/')[0]);
          }
          if (!docName) {
            docName = parsedUrl.searchParams.get('room') || '';
          }

          const authResult = await verifyCollabRoomAccess(docName, decoded.userId);
          if (!authResult.authorized) {
            socket.write(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n`);
            socket.destroy();
            return;
          }

          collabWSS.handleUpgrade(req, socket, head, (ws) => {
            collabWSS.emit('connection', ws, req);
          });
        } catch (_) {
          socket.destroy();
        }
      });

      await new Promise(resolve => server.listen(0, resolve));
      testPort = server.address().port;

      const activeProviders = [];
      const activeDocs = [];

      try {
        // Connect Alice (Owner) using real y-websocket client library
        const ydocAlice = new Y.Doc();
        activeDocs.push(ydocAlice);
        const providerAlice = new WebsocketProvider(
          `ws://localhost:${testPort}/collab`,
          authorizedDocId,
          ydocAlice,
          {
            WebSocketPolyfill: WebSocket,
            params: { token: aliceToken },
          }
        );
        activeProviders.push(providerAlice);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Alice connection timeout')), 3000);
          providerAlice.on('status', ({ status }) => {
            if (status === 'connected') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        // Set content from Alice
        const textAlice = ydocAlice.getText('monaco');
        textAlice.insert(0, 'Hello from Alice');

        // Connect Bob (Invited Collaborator)
        await addCollabRoomCollaborator(authorizedDocId, userAlice, userBob);

        const ydocBob = new Y.Doc();
        activeDocs.push(ydocBob);
        const providerBob = new WebsocketProvider(
          `ws://localhost:${testPort}/collab`,
          authorizedDocId,
          ydocBob,
          {
            WebSocketPolyfill: WebSocket,
            params: { token: bobToken },
          }
        );
        activeProviders.push(providerBob);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Bob connection timeout')), 3000);
          providerBob.on('status', ({ status }) => {
            if (status === 'connected') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        // Verify synced text across clients
        await new Promise(resolve => setTimeout(resolve, 300));
        const textBob = ydocBob.getText('monaco');
        assert.equal(textBob.toString(), 'Hello from Alice');

      } finally {
        for (const p of activeProviders) {
          p.shouldConnect = false;
          if (p.ws) {
            try { p.ws.terminate(); } catch (_) {}
          }
          try { p.destroy(); } catch (_) {}
        }
        for (const d of activeDocs) {
          try { d.destroy(); } catch (_) {}
        }
        if (collabWSS && collabWSS.clients) {
          for (const c of collabWSS.clients) {
            try { c.terminate(); } catch (_) {}
          }
          await new Promise(resolve => collabWSS.close(resolve));
        }
        for (const s of sockets) {
          try { s.destroy(); } catch (_) {}
        }
        await new Promise(resolve => server.close(resolve));
        if (ywsDocs) {
          ywsDocs.forEach(doc => { try { doc.destroy(); } catch (_) {} });
          ywsDocs.clear();
        }
      }
    });

    it('rejects y-websocket connection when token is missing or room is unauthorized (HTTP 401/403)', async () => {
      const server = http.createServer();
      const sockets = new Set();
      server.on('connection', s => {
        sockets.add(s);
        s.on('close', () => sockets.delete(s));
      });

      server.on('upgrade', async (req, socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        const parsedUrl = new URL(req.url, 'http://localhost');
        const token = parsedUrl.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        let docName = parsedUrl.pathname.replace(/^\/collab\/?/, '').split('/')[0] || '';
        let decoded = jwt.verify(token, jwtSecret);
        const auth = await verifyCollabRoomAccess(docName, decoded.userId);
        if (!auth.authorized) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }
      });

      await new Promise(resolve => server.listen(0, resolve));
      const port = server.address().port;

      const activeProviders = [];
      const activeDocs = [];

      try {
        // 1. Attempt connect without token -> Fails with HTTP 401
        const ydoc1 = new Y.Doc();
        activeDocs.push(ydoc1);
        const providerMissingToken = new WebsocketProvider(
          `ws://localhost:${port}/collab`,
          'some-room',
          ydoc1,
          { WebSocketPolyfill: WebSocket }
        );
        activeProviders.push(providerMissingToken);

        let error401Received = false;
        providerMissingToken.on('connection-error', (err) => {
          error401Received = true;
        });

        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(providerMissingToken.wsconnected, false);
        assert.equal(error401Received, true);

        // 2. Attempt connect with valid token to unauthorized room -> Fails with HTTP 403
        const ydoc2 = new Y.Doc();
        activeDocs.push(ydoc2);
        const providerUnauthorized = new WebsocketProvider(
          `ws://localhost:${port}/collab`,
          'unauthorized-room-xyz',
          ydoc2,
          {
            WebSocketPolyfill: WebSocket,
            params: { token: bobToken },
          }
        );
        activeProviders.push(providerUnauthorized);

        let error403Received = false;
        providerUnauthorized.on('connection-error', (err) => {
          error403Received = true;
        });

        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(providerUnauthorized.wsconnected, false);
        assert.equal(error403Received, true);

      } finally {
        for (const p of activeProviders) {
          p.shouldConnect = false;
          if (p.ws) {
            try { p.ws.terminate(); } catch (_) {}
          }
          try { p.destroy(); } catch (_) {}
        }
        for (const d of activeDocs) {
          try { d.destroy(); } catch (_) {}
        }
        for (const s of sockets) {
          try { s.destroy(); } catch (_) {}
        }
        await new Promise(resolve => server.close(resolve));
      }
    });
  });

  describe('5. Collaboration Room Creation Security & Database Authorization', () => {
    const userA = '65a123456789abcdef000001';
    const userB = '65a123456789abcdef000002';
    const userC = '65a123456789abcdef000003';

    beforeEach(() => {
      resetCollabRoomsForTesting();
    });

    it('validates room identifiers and rejects dangerous or invalid patterns', () => {
      assert.equal(isValidRoomIdentifier('valid-room_123'), true);
      assert.equal(isValidRoomIdentifier('user_65a123_scratch'), true);
      assert.equal(isValidRoomIdentifier('../etc/passwd'), false);
      assert.equal(isValidRoomIdentifier('room/subpath'), false);
      assert.equal(isValidRoomIdentifier('ab'), false); // too short
      assert.equal(isValidRoomIdentifier(''), false);
      assert.equal(isValidRoomIdentifier(null), false);
    });

    it('rejects unauthorized claims to unknown arbitrary room IDs (does not grant on connect)', async () => {
      const res = await verifyCollabRoomAccess('unregistered-arbitrary-doc-123', userA);
      assert.equal(res.authorized, false);
      assert.equal(res.reason, 'ROOM_NOT_FOUND');
    });

    it('verifies personal user rooms for owner and rejects cross-user access', async () => {
      const resOwner = await verifyCollabRoomAccess(`user_${userA}_myworkspace`, userA);
      assert.equal(resOwner.authorized, true);
      assert.equal(resOwner.role, 'personal_room_owner');

      const resAttacker = await verifyCollabRoomAccess(`user_${userA}_myworkspace`, userB);
      assert.equal(resAttacker.authorized, false);
      assert.equal(resAttacker.reason, 'CROSS_USER_ROOM_FORBIDDEN');
    });

    it('requires verified creation flow, isolates across accounts, and supports invited collaborators', async () => {
      const roomId = 'project-alpha-verified-doc';

      // 1. Explicit creation by User A
      await createCollabRoom(roomId, userA, { title: 'Project Alpha' });

      // 2. User A access: Allowed as owner
      const resA = await verifyCollabRoomAccess(roomId, userA);
      assert.equal(resA.authorized, true);
      assert.equal(resA.role, 'room_owner');

      // 3. User B access before invitation: Strictly FORBIDDEN
      const resB = await verifyCollabRoomAccess(roomId, userB);
      assert.equal(resB.authorized, false);
      assert.equal(resB.reason, 'ROOM_ACCESS_DENIED');

      // 4. User A invites User B
      await addCollabRoomCollaborator(roomId, userA, userB);

      // 5. User B access after invitation: Allowed as collaborator
      const resBAfter = await verifyCollabRoomAccess(roomId, userB);
      assert.equal(resBAfter.authorized, true);
      assert.equal(resBAfter.role, 'room_collaborator');

      // 6. User C (uninvited): Still strictly rejected
      const resC = await verifyCollabRoomAccess(roomId, userC);
      assert.equal(resC.authorized, false);
      assert.equal(resC.reason, 'ROOM_ACCESS_DENIED');
    });

    it('rejects access to deleted documents and rooms with DOCUMENT_DELETED', async () => {
      const roomId = 'doc-to-be-deleted-999';
      await createCollabRoom(roomId, userA, { title: 'Temporary Doc' });

      // Accessible before deletion
      const beforeDel = await verifyCollabRoomAccess(roomId, userA);
      assert.equal(beforeDel.authorized, true);

      // Delete room
      await deleteCollabRoom(roomId, userA);

      // Access after deletion must fail closed
      const afterDel = await verifyCollabRoomAccess(roomId, userA);
      assert.equal(afterDel.authorized, false);
      assert.equal(afterDel.reason, 'DOCUMENT_DELETED');
    });
  });

  describe('6. Redis Pub/Sub Instance Identification & Cross-Container Event Bridge', () => {
    const originalInstanceId = getInstanceId();
    const webInstanceId = 'container-web-pid1-instance-aaa';
    const workerInstanceId = 'container-worker-pid1-instance-bbb';

    beforeEach(() => {
      setInstanceIdForTesting(webInstanceId);
    });

    it('processes worker events even when both containers share identical PID 1', (t, done) => {
      const sampleJob = 'job-identical-pid-test-001';
      let eventReceived = false;

      const handler = ({ jobId, progress, currentStep }) => {
        if (jobId === sampleJob) {
          eventReceived = true;
          assert.equal(progress, 75);
          assert.equal(currentStep, 'OCR in progress');
          jobEmitter.off('progress', handler);
          done();
        }
      };

      jobEmitter.on('progress', handler);

      // Simulate Worker container publishing event with PID 1 and workerInstanceId
      processIncomingPubSubMessage(REDIS_CHANNEL, JSON.stringify({
        type: 'progress',
        jobId: sampleJob,
        data: { progress: 75, currentStep: 'OCR in progress' },
        senderInstanceId: workerInstanceId,
        senderPid: 1, // Identical PID to Web container
      }));

      assert.equal(eventReceived, true);
    });

    it('filters out self-published events matching current instanceId to prevent loops', () => {
      const sampleJob = 'job-self-published-test';
      let selfEventProcessed = false;

      const handler = () => {
        selfEventProcessed = true;
      };

      jobEmitter.on('progress', handler);

      // Publish with webInstanceId (matching current instanceId)
      processIncomingPubSubMessage(REDIS_CHANNEL, JSON.stringify({
        type: 'progress',
        jobId: sampleJob,
        data: { progress: 100 },
        senderInstanceId: webInstanceId,
        senderPid: process.pid,
      }));

      jobEmitter.off('progress', handler);
      assert.equal(selfEventProcessed, false);
    });

    it('verifies persistent async job ownership checks for reconnecting clients', async () => {
      const jobOwnerId = '65b123456789abcdef000010';
      const otherUserId = '65b123456789abcdef000020';
      const sampleJobId = 'job-reconnect-test-uuid-99';
      const guestSecret = 'guest-secure-secret-token-xyz';

      registerJob(sampleJobId, { ownerId: jobOwnerId, secret: guestSecret, action: 'pdf-compress' });

      // Owner authorized
      assert.equal(hasJobAccess(sampleJobId, { userId: jobOwnerId }), true);
      const ownerAllowed = await hasJobAccessAsync(sampleJobId, { userId: jobOwnerId });
      assert.equal(ownerAllowed, true);

      // Guest authorized
      assert.equal(hasJobAccess(sampleJobId, { secret: guestSecret }), true);
      const guestAllowed = await hasJobAccessAsync(sampleJobId, { secret: guestSecret });
      assert.equal(guestAllowed, true);

      // Unauthorized rejected
      assert.equal(hasJobAccess(sampleJobId, { userId: otherUserId }), false);
      const attackerAllowed = await hasJobAccessAsync(sampleJobId, { userId: otherUserId });
      assert.equal(attackerAllowed, false);
    });
  });

  describe('7. Colocated Background Worker Process Supervisor Lifecycle', () => {
    it('verifies worker supervisor status helpers without launching redundant processes in test', () => {
      resetSupervisorForTesting();
      assert.equal(typeof isWorkerRunning, 'function');
      assert.equal(typeof getWorkerPid, 'function');
      assert.equal(isWorkerRunning(), false);
      assert.equal(getWorkerPid(), null);
    });
  });

});
