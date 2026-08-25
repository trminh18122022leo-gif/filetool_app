'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const FileRecord = require('../models/FileRecord');
const User       = require('../models/User');

let s3 = null;

function getS3Client() {
  if (!s3 && process.env.R2_ENDPOINT) {
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
  const client = getS3Client();
  if (!client) throw new Error('Cloud storage chưa được cấu hình');

  const { userId, originalName, operation, retentionDays = 7 } = opts;
  const fileBytes = fs.readFileSync(localFilePath);
  const ext       = path.extname(localFilePath);
  const cloudKey  = `users/${userId}/${uuidv4()}${ext}`;
  const mimeType  = getMime(ext);

  await client.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         cloudKey,
    Body:        fileBytes,
    ContentType: mimeType,
  }));

  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  const record = await FileRecord.create({
    user:         userId,
    originalName: originalName || path.basename(localFilePath),
    cloudKey,
    fileSize:     fileBytes.length,
    mimeType,
    operation,
    expiresAt,
  });

  await User.findByIdAndUpdate(userId, { $inc: { cloudStorageUsed: fileBytes.length } });
  const downloadUrl = await getDownloadUrl(cloudKey, 3600);

  return { record, downloadUrl };
}

async function getDownloadUrl(cloudKey, expiresInSeconds = 3600) {
  const client = getS3Client();
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    cloudKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

async function deleteFromCloud(recordId, userId) {
  const record = await FileRecord.findOne({ _id: recordId, user: userId });
  if (!record) throw new Error('File không tồn tại');

  const client = getS3Client();
  if (client) {
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    record.cloudKey,
    }));
  }

  await User.findByIdAndUpdate(userId, { $inc: { cloudStorageUsed: -record.fileSize } });
  await record.deleteOne();
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
};
