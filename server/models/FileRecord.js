'use strict';

const mongoose = require('mongoose');

const fileRecordSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  originalName: {
    type:     String,
    required: true,
  },
  cloudKey: {
    type:     String,
    required: true, // key trong R2 bucket
  },
  fileSize: {
    type:     Number,
    required: true, // bytes
  },
  mimeType: String,
  operation: {
    type: String, // 'merge', 'compress', 'ocr', 'ai-summary', ...
  },
  expiresAt: {
    type:     Date,
    required: true,
    index:    { expires: 0 }, // MongoDB TTL index: tự xóa doc khi hết hạn
  },
  downloadCount: {
    type:    Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('FileRecord', fileRecordSchema);
