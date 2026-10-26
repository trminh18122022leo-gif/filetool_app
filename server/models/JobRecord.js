'use strict';

/**
 * server/models/JobRecord.js
 * Mô hình lưu trữ trạng thái tác vụ phân tán (Durable Distributed Job State)
 * Hỗ trợ idempotent lifecycle, quota atomic reservation, và multi-tenant boundary.
 */

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const jobRecordSchema = new mongoose.Schema({
  jobId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
    default:  () => uuidv4(),
  },
  idempotencyKey: {
    type:   String,
    sparse: true,
    index:  true,
  },
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: false, // null cho guest client
    index:    true,
  },
  sessionSecret: {
    type:   String,
    select: false, // Token bí mật xác thực cho guest client
  },
  operation: {
    type:     String,
    required: true,
    index:    true,
  },
  operationClass: {
    type:    String,
    enum:    ['pdf', 'office', 'ocr', 'media', 'ai'],
    default: 'pdf',
    index:   true,
  },
  status: {
    type:    String,
    enum:    [
      'INITIATED',
      'RESERVED',
      'QUEUED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'TIMEOUT',
    ],
    default: 'INITIATED',
    index:   true,
  },
  progress: {
    type:    Number,
    default: 0,
    min:     0,
    max:     100,
  },
  currentStep: {
    type:    String,
    default: 'Khởi tạo tác vụ',
  },
  params: {
    type:    mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  inputFiles: [{
    fileId:       String,
    originalName: String,
    localPath:    { type: String, select: false },
    cloudKey:     String,
    fileSize:     Number,
    mimeType:     String,
  }],
  outputFile: {
    fileId:       String,
    originalName: String,
    localPath:    { type: String, select: false },
    cloudKey:     String,
    fileSize:     Number,
    mimeType:     String,
    downloadUrl:  String,
  },
  errors: [{
    message:   String,
    code:      String,
    timestamp: { type: Date, default: Date.now },
  }],
  quotaReserved: {
    count:     { type: Number, default: 0 },
    committed: { type: Boolean, default: false },
  },
  attempts: {
    type:    Number,
    default: 0,
  },
  maxAttempts: {
    type:    Number,
    default: 3,
  },
  timeoutSeconds: {
    type:    Number,
    default: 60,
  },
  workerId: {
    type: String,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
}, {
  timestamps: true,
  suppressReservedKeysWarning: true,
});

// Compound index chống duplicate idempotency key trong cùng một tenant
jobRecordSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
jobRecordSchema.index({ status: 1, createdAt: -1 });

module.exports = dataConn.model('JobRecord', jobRecordSchema);
