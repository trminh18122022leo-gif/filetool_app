'use strict';

/**
 * server/queue/connection.js
 * Quản lý kết nối Redis / Valkey-compatible cho BullMQ và Background Workers.
 * Hỗ trợ các thiết lập chịu lỗi (Durability & Graceful Degradation).
 */

const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL || null;
let redisClient = null;
let isConnected = false;

function createRedisConnection(customOpts = {}) {
  if (!redisUrl) {
    return null;
  }

  const defaultOpts = {
    maxRetriesPerRequest: null, // Bắt buộc cho BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      // Bounded exponential backoff: tối đa 3000ms
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Tự động reconnect khi gặp replica failover
        return true;
      }
      return false;
    },
  };

  const client = new Redis(redisUrl, {
    ...defaultOpts,
    ...customOpts,
  });

  client.on('connect', () => {
    isConnected = true;
    console.log('⚡ [Redis/Queue] Đã kết nối thành công tới Redis/Valkey instance');
  });

  client.on('ready', () => {
    isConnected = true;
  });

  client.on('error', (err) => {
    isConnected = false;
    // Không crash tiến trình khi Redis tạm thời mất kết nối
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️ [Redis/Queue] Lỗi kết nối: ${err.message}`);
    }
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
}

if (redisUrl) {
  try {
    redisClient = createRedisConnection();
  } catch (err) {
    console.warn(`⚠️ [Redis/Queue] Không thể khởi tạo Redis client: ${err.message}`);
  }
}

function getRedisClient() {
  return redisClient;
}

function isRedisReady() {
  return isConnected && redisClient && redisClient.status === 'ready';
}

async function closeRedisConnection() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {
      redisClient.disconnect();
    }
    redisClient = null;
    isConnected = false;
  }
}

module.exports = {
  createRedisConnection,
  getRedisClient,
  isRedisReady,
  closeRedisConnection,
  redisUrl,
};
