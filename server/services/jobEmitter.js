'use strict';

/**
 * server/services/jobEmitter.js
 * Multi-process Distributed Job Event Emitter & Access Control Registry.
 * 
 * Features:
 * 1. In-process EventEmitter for low-latency local dispatching.
 * 2. Cross-process Redis Pub/Sub bridge to relay progress & completion events
 *    from standalone Background Workers to Socket.IO Web API processes.
 * 3. Instance-level identity (INSTANCE_ID) to prevent false self-loop suppression
 *    across containers sharing identical PIDs (e.g. PID 1 in Docker).
 * 4. In-memory and persistent database-backed job ownership checks (hasJobAccess & hasJobAccessAsync)
 *    to protect job status and rooms during reconnects and page reloads.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { createRedisConnection, isRedisReady } = require('../queue/connection');

class JobEmitter extends EventEmitter {}
const jobEmitter = new JobEmitter();

// Unique process-instance identifier generated at startup
let instanceId = process.env.INSTANCE_ID || `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

// In-memory registry of active jobs with ownership & metadata (TTL 1 hour)
const jobRegistry = new Map();

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, meta] of jobRegistry.entries()) {
    if (now - meta.createdAt > 60 * 60 * 1000) {
      jobRegistry.delete(id);
    }
  }
}

function registerJob(jobId, { ownerId = null, secret = null, action = '' } = {}) {
  cleanupExpiredJobs();
  jobRegistry.set(String(jobId), {
    ownerId: ownerId ? String(ownerId) : null,
    secret:  secret || null,
    action,
    createdAt: Date.now(),
  });
}

function getJobMeta(jobId) {
  return jobRegistry.get(String(jobId)) || null;
}

/**
 * Fast in-memory synchronous job access check
 */
function hasJobAccess(jobId, { userId = null, secret = null } = {}) {
  const meta = jobRegistry.get(String(jobId));
  if (!meta) {
    return false;
  }
  if (meta.ownerId) {
    if (userId && String(userId) === meta.ownerId) {
      return true;
    }
    if (secret && meta.secret && secret === meta.secret) {
      return true;
    }
    return false;
  }
  if (meta.secret) {
    return secret === meta.secret;
  }
  return false;
}

/**
 * Persistent async job access check with database fallback (supports reconnects and worker restarts)
 */
async function hasJobAccessAsync(jobId, { userId = null, secret = null } = {}) {
  // 1. Fast path: check in-memory registry
  if (hasJobAccess(jobId, { userId, secret })) {
    return true;
  }

  // 2. Persistent fallback: query JobRecord from MongoDB if connected
  const { isDataConnected } = require('../config/database');
  if (isDataConnected && isDataConnected()) {
    try {
      const JobRecord = require('../models/JobRecord');
      const jobRecord = await JobRecord.findOne({ jobId: String(jobId) }).select('+sessionSecret');
      if (!jobRecord) return false;

      // Cache into memory registry
      registerJob(jobRecord.jobId, {
        ownerId: jobRecord.user ? String(jobRecord.user) : null,
        secret:  jobRecord.sessionSecret || null,
        action:  jobRecord.operation,
      });

      if (jobRecord.user) {
        if (userId && String(userId) === String(jobRecord.user)) return true;
        if (secret && jobRecord.sessionSecret && secret === jobRecord.sessionSecret) return true;
        return false;
      }
      if (jobRecord.sessionSecret) {
        return secret === jobRecord.sessionSecret;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  return false;
}

// ── Distributed Event Bridge via Redis Pub/Sub ───────────────────────────────
const REDIS_CHANNEL = (process.env.BULLMQ_PREFIX || 'bull') + ':job-events';
let redisPublisher = null;
let redisSubscriber = null;
let isPubSubActive = false;

function handlePubSubMessage(channel, message) {
  if (channel !== REDIS_CHANNEL) return;
  try {
    const payload = JSON.parse(message);

    // CRITICAL: Filter out messages that originated from this exact process instance.
    // Compares unique instanceId rather than process.pid alone to prevent false suppression
    // in containerized environments where multiple containers have identical PIDs (e.g. PID 1).
    if (payload.senderInstanceId) {
      if (payload.senderInstanceId === instanceId) {
        return; // Skip self-published events
      }
    } else if (payload.senderPid === process.pid) {
      // Legacy fallback when senderInstanceId is absent
      return;
    }

    const { type, jobId } = payload;
    if (type === 'progress') {
      jobEmitter.emit('progress', { jobId, ...payload.data });
    } else if (type === 'complete') {
      jobEmitter.emit('complete', { jobId, result: payload.result });
    } else if (type === 'error') {
      if (jobEmitter.listenerCount('error') > 0) {
        jobEmitter.emit('error', { jobId, error: payload.error });
      }
    }
  } catch (_) {}
}

function initDistributedEventBridge() {
  if (isPubSubActive) return;
  const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;
  if (!redisUrl) return;

  try {
    redisPublisher = createRedisConnection({ lazyConnect: false });
    redisSubscriber = createRedisConnection({ lazyConnect: false });

    if (!redisSubscriber || !redisPublisher) return;

    redisSubscriber.on('ready', () => {
      redisSubscriber.subscribe(REDIS_CHANNEL, (err) => {
        if (!err) {
          isPubSubActive = true;
        }
      });
    });

    redisSubscriber.on('message', handlePubSubMessage);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️ [JobEmitter] Không thể khởi tạo Redis Pub/Sub event bridge: ${err.message}`);
    }
  }
}

if (process.env.REDIS_URL || process.env.VALKEY_URL) {
  initDistributedEventBridge();
}

function publishEvent(payload) {
  if (redisPublisher && isRedisReady()) {
    try {
      redisPublisher.publish(
        REDIS_CHANNEL,
        JSON.stringify({
          ...payload,
          senderInstanceId: instanceId,
          senderPid: process.pid,
        })
      ).catch(() => {});
    } catch (_) {}
  }
}

function emitProgress(jobId, data) {
  jobEmitter.emit('progress', { jobId, ...data });
  publishEvent({ type: 'progress', jobId, data });
}

function emitComplete(jobId, result) {
  jobEmitter.emit('complete', { jobId, result });
  publishEvent({ type: 'complete', jobId, result });
}

function emitError(jobId, error) {
  const errMsg = error?.message || error;
  if (jobEmitter.listenerCount('error') > 0) {
    jobEmitter.emit('error', { jobId, error: errMsg });
  }
  publishEvent({ type: 'error', jobId, error: errMsg });
}

async function closePubSubBridge() {
  if (redisSubscriber) {
    try { await redisSubscriber.quit(); } catch (_) { redisSubscriber.disconnect(); }
    redisSubscriber = null;
  }
  if (redisPublisher) {
    try { await redisPublisher.quit(); } catch (_) { redisPublisher.disconnect(); }
    redisPublisher = null;
  }
  isPubSubActive = false;
}

function getInstanceId() {
  return instanceId;
}

function setInstanceIdForTesting(newId) {
  instanceId = newId;
}

function processIncomingPubSubMessage(channel, message) {
  handlePubSubMessage(channel, message);
}

module.exports = {
  jobEmitter,
  registerJob,
  getJobMeta,
  hasJobAccess,
  hasJobAccessAsync,
  emitProgress,
  emitComplete,
  emitError,
  initDistributedEventBridge,
  closePubSubBridge,
  getInstanceId,
  setInstanceIdForTesting,
  processIncomingPubSubMessage,
  REDIS_CHANNEL,
};
