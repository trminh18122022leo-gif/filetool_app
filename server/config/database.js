'use strict';

const mongoose = require('mongoose');

const DB_OPTIONS = {
  maxPoolSize:              10,
  minPoolSize:              2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:          45000,
  heartbeatFrequencyMS:     10000,
  maxIdleTimeMS:            30000,
};

// ── 1. AUTH & SECURITY DATABASE (Cluster 0) ──────────────────────────────────
// Lưu trữ: User, RefreshToken, LoginAttempt, ApiKey (Dữ liệu xác thực & bảo mật)
const authUri = process.env.AUTH_DB_URI || process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI;
let authDB;

if (authUri) {
  authDB = mongoose.createConnection(authUri, {
    ...DB_OPTIONS,
    maxPoolSize: 5,
  });
  authDB.on('connected',    () => console.log('🔒 [AuthDB] Đã kết nối Auth & Security Database'));
  authDB.on('disconnected', () => console.warn('⚠️ [AuthDB] Auth Database mất kết nối, đang thử lại...'));
  authDB.on('error',        (err) => console.error('❌ [AuthDB] Lỗi kết nối Auth Database:', err.message));
} else {
  authDB = mongoose.createConnection();
  console.warn('⚠️ [AuthDB] Chưa cấu hình AUTH_DB_URI hoặc MONGODB_AUTH_URI');
}

// ── 2. DATA & PROCESSING DATABASE (Cluster 1) ────────────────────────────────
// Lưu trữ: FileRecord, AuditLog, Processing History (Dữ liệu xử lý file & logs)
const dataUri = process.env.DATA_DB_URI || process.env.MONGODB_DATA_URI || authUri;
let dataDB;

if (dataUri) {
  if (dataUri === authUri && authDB) {
    dataDB = authDB;
  } else {
    dataDB = mongoose.createConnection(dataUri, {
      ...DB_OPTIONS,
      maxPoolSize: 15,
    });
    dataDB.on('connected',    () => console.log('📦 [DataDB] Đã kết nối Data & Processing Database'));
    dataDB.on('disconnected', () => console.warn('⚠️ [DataDB] Data Database mất kết nối, đang thử lại...'));
    dataDB.on('error',        (err) => console.error('❌ [DataDB] Lỗi kết nối Data Database:', err.message));
  }
} else {
  dataDB = mongoose.createConnection();
  console.warn('⚠️ [DataDB] Chưa cấu hình DATA_DB_URI hoặc MONGODB_DATA_URI');
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
async function closeConnections() {
  try {
    const promises = [];
    if (authDB && authDB.readyState !== 0) promises.push(authDB.close());
    if (dataDB && dataDB !== authDB && dataDB.readyState !== 0) promises.push(dataDB.close());
    await Promise.all(promises);
    console.log('✅ Đã đóng an toàn tất cả DB connections');
  } catch (err) {
    console.error('Lỗi khi đóng DB connections:', err.message);
  }
}

process.on('SIGINT',  () => closeConnections().then(() => process.exit(0)));
process.on('SIGTERM', () => closeConnections().then(() => process.exit(0)));

module.exports = {
  authDB,
  dataDB,
  authConn: authDB,
  dataConn: dataDB,
  isAuthConnected: () => authDB && authDB.readyState === 1,
  isDataConnected: () => dataDB && dataDB.readyState === 1,
  closeConnections,
};
