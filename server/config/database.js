'use strict';

const mongoose = require('mongoose');

const connectionOptions = {
  maxPoolSize:          10,   // Tối đa 10 connection song song
  minPoolSize:          2,    // Giữ tối thiểu 2 connection sẵn sàng
  serverSelectionTimeoutMS: 5000,  // Timeout nếu không chọn được server sau 5s
  socketTimeoutMS:      45000,     // Đóng socket idle sau 45s
  heartbeatFrequencyMS: 10000,     // Ping MongoDB mỗi 10s để giữ kết nối
  maxIdleTimeMS:        30000,     // Đóng connection idle sau 30s
};

// ── 1. Cluster 0: AUTH & SECURITY DATABASE ────────────────────────────────────
// Lưu trữ: User, Authentication, Hash Password, Token, Role, Subscription
const authUri = process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI;
let authConn;

if (authUri) {
  authConn = mongoose.createConnection(authUri, connectionOptions);
  authConn.on('connected', () => {
    console.log('🔒 [DB-Cluster-0] Auth & Security Database đã kết nối thành công');
  });
  authConn.on('error', (err) => {
    console.error('❌ [DB-Cluster-0] Lỗi kết nối Auth Database:', err.message);
  });
  authConn.on('disconnected', () => {
    console.warn('⚠️ [DB-Cluster-0] Auth Database mất kết nối, đang thử lại...');
  });
} else {
  authConn = mongoose.createConnection();
  console.warn('⚠️ [DB-Cluster-0] Chưa cấu hình MONGODB_AUTH_URI hoặc MONGODB_URI trong .env');
}

// ── 2. Cluster 1: DATA & PROCESSING DATABASE ──────────────────────────────────
// Lưu trữ: FileRecord, Cloud Uploads, Storage Metadata, ApiKey, Usage Logs
const dataUri = process.env.MONGODB_DATA_URI || authUri;
let dataConn;

if (dataUri) {
  // Nếu dataUri giống authUri thì dùng luôn authConn để tối ưu connection
  if (dataUri === authUri && authConn) {
    dataConn = authConn;
  } else {
    dataConn = mongoose.createConnection(dataUri, connectionOptions);
    dataConn.on('connected', () => {
      console.log('📦 [DB-Cluster-1] Data & Storage Database đã kết nối thành công');
    });
    dataConn.on('error', (err) => {
      console.error('❌ [DB-Cluster-1] Lỗi kết nối Data Database:', err.message);
    });
    dataConn.on('disconnected', () => {
      console.warn('⚠️ [DB-Cluster-1] Data Database mất kết nối, đang thử lại...');
    });
  }
} else {
  dataConn = mongoose.createConnection();
  console.warn('⚠️ [DB-Cluster-1] Chưa cấu hình MONGODB_DATA_URI trong .env');
}

module.exports = {
  authConn,
  dataConn,
  isAuthConnected: () => authConn && authConn.readyState === 1,
  isDataConnected: () => dataConn && dataConn.readyState === 1,
};
