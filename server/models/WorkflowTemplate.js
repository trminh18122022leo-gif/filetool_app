'use strict';

const mongoose = require('mongoose');
const { dataConn } = require('../config/database');

const workflowTemplateSchema = new mongoose.Schema({
  templateId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },
  title: {
    type:     String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    enum: ['document', 'archive', 'media', 'data', 'developer'],
    default: 'document',
    index: true,
  },
  icon: {
    type:    String,
    default: 'Layers',
  },
  isBuiltIn: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  author: {
    type:  mongoose.Schema.Types.ObjectId,
    ref:   'User',
    index: true,
  },
  dag: {
    version: { type: String, default: 'v1' },
    nodes:   { type: Array, required: true },
    edges:   { type: Array, required: true },
  },
  estimatedDurationSeconds: {
    type:    Number,
    default: 30,
  },
  quotaCost: {
    type:    Number,
    default: 1,
  },
  version: {
    type:    Number,
    default: 1,
  },
}, {
  timestamps: true,
});

workflowTemplateSchema.index({ isBuiltIn: 1, category: 1 });
workflowTemplateSchema.index({ author: 1, createdAt: -1 });

module.exports = dataConn.model('WorkflowTemplate', workflowTemplateSchema);
