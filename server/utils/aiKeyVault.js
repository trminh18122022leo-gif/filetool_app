'use strict';

/**
 * server/utils/aiKeyVault.js
 * Envelope Encryption Vault for Bring Your Own Key (BYOK)
 * Uses AES-256-GCM with cryptographically unique 12-byte IV and 16-byte Auth Tag.
 * Zero plaintext API keys are ever stored in the database or exposed via API responses.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getMasterKey() {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AI_KEY_ENCRYPTION_SECRET chưa được cấu hình an toàn trên máy chủ');
  }
  // Derive deterministic 32-byte (256-bit) key
  return crypto.createHash('sha256').update(secret).digest();
}

function isVaultConfigured() {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
  return Boolean(secret && secret.length >= 16);
}

/**
 * Creates a safe masked string for display (e.g. "AIzaSy...4X9a" or "sk-proj-...8Ab1")
 */
function maskApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '****';
  const trimmed = rawKey.trim();
  if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Encrypts an API key with AES-256-GCM
 */
function encryptApiKey(plaintextKey) {
  if (!plaintextKey || typeof plaintextKey !== 'string') {
    throw new Error('Khóa API không hợp lệ để mã hóa');
  }

  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintextKey.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag,
    keyMasked: maskApiKey(plaintextKey),
  };
}

/**
 * Decrypts an encrypted key into memory for execution only
 */
function decryptApiKey(payload) {
  if (!payload || !payload.encryptedKey || !payload.iv || !payload.authTag) {
    throw new Error('Dữ liệu khóa mã hóa không đầy đủ hoặc bị hỏng');
  }

  const masterKey = getMasterKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv, { authTagLength: AUTH_TAG_LENGTH });

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  isVaultConfigured,
  maskApiKey,
  encryptApiKey,
  decryptApiKey,
};
