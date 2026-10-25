'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const { v4: uuidv4 } = require('uuid');
const FileRecord = require('../models/FileRecord');
const User       = require('../models/User');
const { PLANS }  = require('../config/plans');

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

let s3 = null;

function isValidStorageEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    // Bắt buộc giao thức HTTPS
    if (url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();

    // Chặn localhost, loopback, private subnet RFC1918 và Cloud instance metadata service (169.254.169.254)
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '169.254.169.254' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname === '::1' ||
      hostname.startsWith('fe80:') ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:')
    ) {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

function getS3Client() {
  if (!s3 && process.env.R2_ENDPOINT) {
    if (!isValidStorageEndpoint(process.env.R2_ENDPOINT)) {
      throw new Error(`[SECURITY ALERT] R2_ENDPOINT không hợp lệ hoặc có nguy cơ SSRF: ${process.env.R2_ENDPOINT}`);
    }
    s3 = new S3Client({
      region:   'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3;
}

async function uploadToCloud(localFilePath, opts = {}) {
  let client = null;
  try {
    client = getS3Client();
  } catch (_) {}
  if (!client) throw new Error('Cloud storage chưa được cấu hình (thiếu R2_ENDPOINT)');

  const { userId, originalName, operation, retentionDays, userPlan } = opts;
  if (!fs.existsSync(localFilePath)) {
    throw new Error('Tệp nguồn không tồn tại trên máy chủ');
  }

  // Single Source of Truth (SSOT) cho thời hạn lưu trữ theo gói (Free: 1d, Plus: 7d, Pro: 30d, Business: 90d)
  let effectiveRetentionDays = retentionDays;
  if (!effectiveRetentionDays) {
    const planKey = (userPlan || 'free').toLowerCase();
    effectiveRetentionDays = PLANS[planKey]?.entitlements?.retentionDays ?? 1;
  }

  const stat = fs.statSync(localFilePath);
  const ext = path.extname(localFilePath);
  const fileId = uuidv4();
  const cloudKey = `users/${userId}/${fileId}${ext}`;
  const mimeType = getMime(ext);

  const checksum = await computeFileSha256(localFilePath);

  // Truyền tải dạng stream, không đọc toàn bộ file vào buffer RAM
  const fileStream = fs.createReadStream(localFilePath);

  await client.send(new PutObjectCommand({
    Bucket:        process.env.R2_BUCKET_NAME,
    Key:           cloudKey,
    Body:          fileStream,
    ContentLength: stat.size,
    ContentType:   mimeType,
    Metadata: {
      'checksum-sha256': checksum,
      'original-name':   encodeURIComponent(originalName || path.basename(localFilePath)),
    },
  }));

  const expiresAt = new Date(Date.now() + effectiveRetentionDays * 24 * 60 * 60 * 1000);
  const record = await FileRecord.create({
    fileId,
    user:          userId,
    originalName:  originalName || path.basename(localFilePath),
    sanitizedName: path.basename(localFilePath),
    cloudKey,
    fileSize:      stat.size,
    mimeType,
    checksum,
    storageType:   'r2',
    status:        'RESULT_READY',
    operation,
    validatedAt:   new Date(),
    expiresAt,
  });

  await User.findByIdAndUpdate(userId, { $inc: { cloudStorageUsed: stat.size } });
  const downloadUrl = await getDownloadUrl(cloudKey, 3600, record.originalName);

  return { record, downloadUrl };
}

async function getDownloadUrl(cloudKey, expiresInSeconds = 3600, safeDownloadName = null) {
  let client = null;
  try {
    client = getS3Client();
  } catch (_) {}
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    cloudKey,
    ResponseCacheControl: 'private, no-cache, no-store, must-revalidate',
    ResponseContentDisposition: safeDownloadName
      ? `attachment; filename="${encodeURIComponent(safeDownloadName)}"`
      : undefined,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

async function deleteFromCloud(recordId, userId) {
  const record = await FileRecord.findOne({
    $or: [{ _id: recordId }, { fileId: recordId }],
    user: userId,
  });
  if (!record || record.status === 'DELETED') {
    return { success: true, message: 'File không tồn tại hoặc đã được xóa trước đó' };
  }

  let client = null;
  try {
    client = getS3Client();
  } catch (_) {}
  if (client && record.cloudKey) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key:    record.cloudKey,
      }));
    } catch (s3Err) {
      console.warn(`[storage] Cảnh báo khi xóa R2 object (${record.cloudKey}): ${s3Err.message}`);
    }
  }

  await User.findByIdAndUpdate(userId, { $inc: { cloudStorageUsed: -record.fileSize } });
  record.status = 'DELETED';
  record.deletedAt = new Date();
  await record.save();

  return { success: true };
}

async function getUserFiles(userId) {
  return FileRecord.find({ user: userId }).sort({ createdAt: -1 });
}

function getMime(ext) {
  const map = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.zip':  'application/zip',
    '.csv':  'text/csv',
    '.txt':  'text/plain',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  uploadToCloud,
  getDownloadUrl,
  deleteFromCloud,
  getUserFiles,
  isCloudConfigured: () => Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME),
};
