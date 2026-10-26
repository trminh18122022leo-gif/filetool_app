'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const fileRecordSchema = new mongoose.Schema({
  fileId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
    default:  () => uuidv4(),
  },
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: false, // null cho khách vãng lai
    index:    true,
  },
  sessionSecret: {
    type:   String,
    select: false,
  },
  originalName: {
    type:     String,
    required: true,
  },
  sanitizedName: {
    type: String,
  },
  storageType: {
    type:    String,
    enum:    ['local', 'r2'],
    default: 'local',
  },
  localPath: {
    type:   String, // Tuyệt đối không trả về client
    select: false,
  },
  cloudKey: {
    type:     String,
    required: false, // Chỉ bắt buộc khi lưu trên R2
    index:    true,
  },
  fileSize: {
    type:     Number,
    required: true, // bytes
  },
  mimeType: {
    type:     String,
    required: true,
  },
  checksum: {
    type: String, // SHA-256
  },
  status: {
    type:    String,
    enum:    [
      'INITIATED',
      'UPLOADING',
      'QUARANTINED',
      'VALIDATED',
      'PROCESSING',
      'RESULT_READY',
      'EXPIRING',
      'DELETED',
    ],
    default: 'INITIATED',
    index:   true,
  },
  quarantineReason: {
    type: String,
  },
  operation: {
    type: String,
  },
  validatedAt: {
    type: Date,
  },
  downloadCount: {
    type:    Number,
    default: 0,
  },
  expiresAt: {
    type:     Date,
    required: true,
    index:    true,
  },
  folder: {
    type:    String,
    default: '/',
    trim:    true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  isSoftDeleted: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  deletedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Compound indexes for optimal tenant-isolated workspace listing
fileRecordSchema.index({ user: 1, isSoftDeleted: 1, createdAt: -1 });
fileRecordSchema.index({ user: 1, folder: 1, isSoftDeleted: 1 });
fileRecordSchema.index({ user: 1, tags: 1, isSoftDeleted: 1 });
fileRecordSchema.index({ user: 1, checksum: 1 });

module.exports = dataConn.model('FileRecord', fileRecordSchema);
