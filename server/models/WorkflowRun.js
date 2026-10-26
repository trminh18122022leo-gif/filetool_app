'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const workflowRunSchema = new mongoose.Schema({
  runId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
    default:  () => uuidv4(),
  },
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: false, // Hỗ trợ guest với sessionSecret
    index:    true,
  },
  sessionSecret: {
    type:   String,
    select: false,
  },
  title: {
    type:    String,
    default: 'Workflow Run',
  },
  templateId: {
    type:  String,
    index: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  dag: {
    version: { type: String, default: 'v1' },
    nodes:   { type: Array, required: true },
    edges:   { type: Array, required: true },
  },
  nodeStates: {
    type:    Map,
    of:      Object,
    default: {},
  },
  idempotencyKey: {
    type:  String,
    index: true,
    sparse: true,
  },
  quotaUnits: {
    type:    Number,
    default: 1,
  },
  quotaCommitted: {
    type:    Boolean,
    default: false,
  },
  artifacts: [{
    fileId:      String,
    fileName:    String,
    mimeType:    String,
    fileSize:    Number,
    downloadUrl: String,
  }],
  error: {
    type: String,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

workflowRunSchema.index({ user: 1, createdAt: -1 });
workflowRunSchema.index({ status: 1, createdAt: -1 });

module.exports = dataConn.model('WorkflowRun', workflowRunSchema);
