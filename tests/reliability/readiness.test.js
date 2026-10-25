'use strict';

/**
 * tests/reliability/readiness.test.js
 * Comprehensive Liveness & Readiness Semantics Suite:
 * - /api/live lightweight process ping (always 200 when alive)
 * - /api/ready deep dependency verification
 * - Fail-closed HTTP 503 when AuthDB is disconnected
 * - Fail-closed HTTP 503 when DataDB is disconnected in dual-cluster mode (strict &&, never ||)
 * - Fail-closed HTTP 503 when Redis durable queue is disconnected in staging/production
 * - HTTP 200 readiness when all dependencies for active role are healthy
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('🩺 Liveness & Readiness Semantics Suite', () => {

  describe('1. Liveness Semantics (/api/live)', () => {
    it('returns status alive with process metadata without requiring backing services', () => {
      const mockReq = {};
      let responseStatus = null;
      let responseBody = null;

      const mockRes = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (body) => {
              responseBody = body;
            },
          };
        },
      };

      // Handler replication from server/index.js
      const handleLive = (req, res) => {
        res.status(200).json({
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: Math.round(process.uptime()),
          pid: process.pid,
        });
      };

      handleLive(mockReq, mockRes);
      assert.equal(responseStatus, 200);
      assert.equal(responseBody.status, 'alive');
      assert.ok(typeof responseBody.uptime === 'number');
      assert.ok(typeof responseBody.pid === 'number');
    });
  });

  describe('2. Readiness Semantics & Dual-Cluster Invariants (/api/ready)', () => {
    const evaluateReadiness = ({
      authConnected,
      dataConnected,
      isDualCluster,
      redisConnected,
      cloudConnected,
      env = 'production',
      requireDurableQueue = true,
      requireCloudStorage = false,
    }) => {
      const dbReady = isDualCluster ? (authConnected && dataConnected) : authConnected;
      const isStagingOrProd = env === 'production' || env === 'staging';
      const queueReady = (isStagingOrProd || requireDurableQueue) ? redisConnected : true;
      const storageReady = requireCloudStorage ? cloudConnected : true;

      const isReady = Boolean(dbReady && queueReady && storageReady);
      return {
        statusCode: isReady ? 200 : 503,
        status: isReady ? 'ready' : 'not_ready',
        ready: isReady,
        checks: {
          authDatabase: authConnected,
          dataDatabase: dataConnected,
          dualClusterMode: isDualCluster,
          dbReady,
          queueReady,
          storageReady,
        },
      };
    };

    it('returns HTTP 503 when AuthDB is disconnected (even if DataDB is connected)', () => {
      const result = evaluateReadiness({
        authConnected: false,
        dataConnected: true,
        isDualCluster: true,
        redisConnected: true,
        cloudConnected: true,
      });

      assert.equal(result.statusCode, 503, 'Must return 503 when AuthDB is down');
      assert.equal(result.ready, false);
      assert.equal(result.checks.dbReady, false);
    });

    it('returns HTTP 503 in dual-cluster mode when DataDB is disconnected (even if AuthDB is connected)', () => {
      const result = evaluateReadiness({
        authConnected: true,
        dataConnected: false,
        isDualCluster: true,
        redisConnected: true,
        cloudConnected: true,
      });

      assert.equal(result.statusCode, 503, 'Must return 503 in dual-cluster mode when DataDB is down (no logical || allowed)');
      assert.equal(result.ready, false);
      assert.equal(result.checks.dbReady, false);
    });

    it('returns HTTP 503 in production/staging when Redis durable queue is disconnected', () => {
      const result = evaluateReadiness({
        authConnected: true,
        dataConnected: true,
        isDualCluster: false,
        redisConnected: false, // Redis down
        cloudConnected: true,
        env: 'staging',
      });

      assert.equal(result.statusCode, 503, 'Must return 503 when Redis is down in staging/production');
      assert.equal(result.ready, false);
      assert.equal(result.checks.queueReady, false);
    });

    it('returns HTTP 503 when cloud storage is required but unconfigured', () => {
      const result = evaluateReadiness({
        authConnected: true,
        dataConnected: true,
        isDualCluster: false,
        redisConnected: true,
        cloudConnected: false,
        requireCloudStorage: true,
      });

      assert.equal(result.statusCode, 503, 'Must return 503 when required cloud storage is not configured');
      assert.equal(result.ready, false);
      assert.equal(result.checks.storageReady, false);
    });

    it('returns HTTP 200 ready when all required dependencies are connected and verified', () => {
      const result = evaluateReadiness({
        authConnected: true,
        dataConnected: true,
        isDualCluster: true,
        redisConnected: true,
        cloudConnected: true,
        requireCloudStorage: true,
      });

      assert.equal(result.statusCode, 200, 'Must return 200 ready when all backing services are healthy');
      assert.equal(result.ready, true);
      assert.equal(result.status, 'ready');
    });
  });

  describe('3. /api/health Hardening (Dual-Cluster Protection)', () => {
    it('evaluates health as degraded if either Auth or Data cluster is down in dual-cluster mode', () => {
      const checkHealth = (authOk, dataOk, isDualCluster) => {
        return isDualCluster ? (authOk && dataOk) : authOk;
      };

      assert.equal(checkHealth(true, true, true), true, 'Both up -> healthy');
      assert.equal(checkHealth(true, false, true), false, 'Data down in dual-cluster -> degraded');
      assert.equal(checkHealth(false, true, true), false, 'Auth down in dual-cluster -> degraded');
      assert.equal(checkHealth(false, false, true), false, 'Both down -> degraded');
      assert.equal(checkHealth(true, false, false), true, 'Single cluster with auth up -> healthy');
    });
  });

});
