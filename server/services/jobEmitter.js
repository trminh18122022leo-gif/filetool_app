'use strict';

const EventEmitter = require('events');

class JobEmitter extends EventEmitter {}
const jobEmitter = new JobEmitter();

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
    secret: secret || null,
    action,
    createdAt: Date.now(),
  });
}

function getJobMeta(jobId) {
  return jobRegistry.get(String(jobId)) || null;
}

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

function emitProgress(jobId, data) {
  jobEmitter.emit('progress', { jobId, ...data });
}

function emitComplete(jobId, result) {
  jobEmitter.emit('complete', { jobId, result });
}

function emitError(jobId, error) {
  if (jobEmitter.listenerCount('error') > 0) {
    jobEmitter.emit('error', { jobId, error: error.message || error });
  }
}

module.exports = {
  jobEmitter,
  registerJob,
  getJobMeta,
  hasJobAccess,
  emitProgress,
  emitComplete,
  emitError,
};
