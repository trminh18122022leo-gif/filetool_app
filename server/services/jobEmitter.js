'use strict';

const EventEmitter = require('events');

class JobEmitter extends EventEmitter {}
const jobEmitter = new JobEmitter();

function emitProgress(jobId, data) {
  jobEmitter.emit('progress', { jobId, ...data });
}

function emitComplete(jobId, result) {
  jobEmitter.emit('complete', { jobId, result });
}

function emitError(jobId, error) {
  jobEmitter.emit('error', { jobId, error: error.message || error });
}

module.exports = { jobEmitter, emitProgress, emitComplete, emitError };
