'use strict';

require('dotenv').config();

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (_) { }

const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const cron = require('node-cron');
const multer = require('multer');
const passport = require('passport');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const slowDown = require('express-slow-down');
const { execFileSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { authDB, dataDB, isAuthConnected, isDataConnected } = require('./config/database');
const { isRedisReady } = require('./queue/connection');
const { isUrlToPdfEnabled } = require('./utils/ssrfGuard');
const { isCloudConfigured } = require('./services/storage.service');
const AuditLog = require('./models/AuditLog');
const { initSocket } = require('./socket');
const { cleanupTempFiles } = require('./middleware/cleanup');
const { apiRateLimit, toolRateLimit, uploadRateLimit } = require('./middleware/rateLimit');
const { sanitizeBody, detectSuspicious, validateUploadedFiles } = require('./middleware/security');
const { optionalAuth } = require('./middleware/auth');
const { validateDownloadAccess } = require('./middleware/accessControl');

// ── Winston Logger ────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ── Khởi tạo App & Server ─────────────────────────────────────────────────────
const app = express();
// Trust proxy (Render, Railway, Heroku đều dùng 1 hop reverse proxy) — PHẢI đặt trước rate limiter
app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;

// Khởi tạo Socket.io
initSocket(server);

// Khởi tạo Yjs Collaborative WebSocket Server (/collab)
try {
  const WebSocket = require('ws');
  const { setupWSConnection } = require('y-websocket/bin/utils');
  const collabWSS = new WebSocket.Server({ noServer: true });

  collabWSS.on('connection', (ws, req) => {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const docName = parsedUrl.searchParams.get('room') || 'default';
      setupWSConnection(ws, req, { docName, gc: true });
    } catch (err) {
      logger.error(`[Collab] Connection error: ${err.message}`);
    }
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url, 'http://localhost');
      if (parsedUrl.pathname === '/collab') {
        // Trích xuất JWT từ query param hoặc cookie
        let token = parsedUrl.searchParams.get('token');
        if (!token && request.headers.cookie) {
          const match = request.headers.cookie.match(/(?:accessToken|token)=([^;]+)/);
          if (match) token = match[1];
        }

        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nMissing token for collab\r\n');
          socket.destroy();
          return;
        }

        let decoded;
        try {
          const authSvc = require('./services/auth.service');
          decoded = authSvc.verifyAccessToken(token);
        } catch (_) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nInvalid or expired token\r\n');
          socket.destroy();
          return;
        }

        // Kiểm tra quyền truy cập phòng (Tenant Boundary & User Isolation)
        const docName = parsedUrl.searchParams.get('room') || 'default';
        const userId = decoded.userId || decoded.id;

        // Nếu room có định dạng user_<ownerId>_... hoặc user:<ownerId>:... thì chỉ chủ phòng mới được truy cập
        if (docName.startsWith('user_') || docName.startsWith('user:')) {
          const parts = docName.split(/[_:]/);
          const roomOwnerId = parts[1];
          if (roomOwnerId && String(roomOwnerId) !== String(userId)) {
            socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nForbidden: cross-user collaboration room access denied\r\n');
            socket.destroy();
            return;
          }
        }

        request.user = decoded;
        collabWSS.handleUpgrade(request, socket, head, (ws) => {
          collabWSS.emit('connection', ws, request);
        });
      }
    } catch (_) {}
  });
} catch (collabErr) {
  logger.warn(`[Collab] Không thể khởi tạo Yjs WebSocket: ${collabErr.message}`);
}

// Đảm bảo các thư mục cần thiết tồn tại
['uploads', 'outputs', 'logs'].forEach(dir => {
  const p = path.resolve(dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Middlewares Bảo Mật Toàn Cục ──────────────────────────────────────────────

// 1. Security Headers (Helmet + HSTS + CSP an toàn)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:     ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://api.groq.com", "https://openrouter.ai", "wss:", "ws:", "*"],
      workerSrc:  ["'self'", "blob:", "https://cdnjs.cloudflare.com"],
      frameSrc:   ["'self'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// 2. Compression — mức 6 là điểm cân bằng tốc độ/kích thước tối ưu
app.use(compression({ level: 6, threshold: 1024 }));

// 3. CORS — bảo vệ truy cập đa nguồn có xác thực với allowlist cấu hình từ môi trường
const { defaultAllowedOrigins, getAllowedOrigins, isOriginAllowed, corsOptionsDelegate } = require('./utils/corsGuard');
app.isOriginAllowed = isOriginAllowed;
app.getAllowedOrigins = getAllowedOrigins;

app.use(cors(corsOptionsDelegate));

app.isOriginAllowed = isOriginAllowed;

// 4. Route Stripe webhook cần raw body — phải đặt TRƯỚC express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// 5. Body Parsers với giới hạn kích thước payload an toàn
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// 6. NoSQL Injection Prevention (Lọc các toán tử $ trong request query & body)
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`[SECURITY] Phát hiện NoSQL Injection payload: ${key} từ IP: ${req.ip}`);
    AuditLog.log({
      action: 'security.nosql_injection_attempt',
      severity: 'warning',
      ip: req.ip,
      meta: { key, path: req.path },
    });
  },
}));

// 7. HTTP Parameter Pollution (HPP) Prevention
app.use(hpp({ whitelist: ['files', 'pages', 'format', 'quality', 'angle'] }));

// 8. Custom Body Sanitization & Suspicious Request Detection
app.use(sanitizeBody);
app.use(detectSuspicious);

// 9. Slow down sau 60 request liên tục trong 15 phút (tránh DDOS / Crawl)
const speedLimiter = slowDown({
  windowMs:   15 * 60 * 1000,
  delayAfter: 60,
  delayMs:    (hits) => (hits - 60) * 100,
  validate:   { trustProxy: false, xForwardedForHeader: false, default: false },
});
app.use('/api/', speedLimiter);

// 10. Cache-control headers cho static assets (tăng tốc đáng kể lần load 2+)
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 năm cho assets
  } else if (req.url.startsWith('/api/') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// 11. Áp dụng Rate Limit chung cho toàn bộ API
app.use('/api', apiRateLimit);

// 12. Request ID Correlation & Tracing
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Ghi chú bảo mật: Không serve công khai static thư mục /outputs và /uploads
// Mọi truy cập file đều bắt buộc qua /api/download/:filename và /api/view/:filename có ACL token.

// ── Routes ───────────────────────────────────────────────────────────────────
// Durable Distributed Job System
app.use('/api/jobs', toolRateLimit, require('./routes/job.routes'));

// Auth & User & Billing
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/apikey', require('./routes/apikey.routes'));
app.use('/api/storage', require('./routes/storage.routes'));
app.use('/api/workflows', toolRateLimit, require('./routes/workflow.routes'));

// Tool Routes (bảo vệ bởi toolRateLimit và auto-quarantine validation trong upload middleware)
app.use('/api/pdf', toolRateLimit, require('./routes/pdf.routes'));
app.use('/api/image', toolRateLimit, require('./routes/image.routes'));
app.use('/api/office', toolRateLimit, require('./routes/office.routes'));
app.use('/api/ocr', toolRateLimit, require('./routes/ocr.routes'));
app.use('/api/archive', toolRateLimit, require('./routes/archive.routes'));
app.use('/api/batch', toolRateLimit, require('./routes/batch.routes'));
app.use('/api/qr', toolRateLimit, require('./routes/qr.routes'));
app.use('/api/signature', toolRateLimit, require('./routes/signature.routes'));
app.use('/api/ai', toolRateLimit, require('./routes/ai.routes'));
app.use('/api/convert', toolRateLimit, require('./routes/convert.routes'));
app.use('/api/creative', toolRateLimit, require('./routes/creative.routes'));
app.use('/api/speech', toolRateLimit, require('./routes/speech.routes'));
app.use('/api/video-translate', toolRateLimit, require('./routes/videotranslate.routes'));
app.use('/api/video', toolRateLimit, require('./routes/video.routes'));

// Download file kết quả local an toàn có kiểm soát quyền truy cập (ACL / Signed Download Token)
app.get('/api/download/:filename', optionalAuth, validateDownloadAccess, (req, res) => {
  const filePath = req.resolvedFilePath || path.join(path.resolve('outputs'), req.safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa tự động sau 1h', code: 'FILE_NOT_FOUND' });
  }

  res.download(filePath, req.safeFilename);
});

// View file trực tiếp trong browser có kiểm soát quyền truy cập (ACL / Signed Download Token)
app.get('/api/view/:filename', optionalAuth, validateDownloadAccess, (req, res) => {
  const filePath = req.resolvedFilePath || path.join(path.resolve('outputs'), req.safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa', code: 'FILE_NOT_FOUND' });
  }

  res.sendFile(filePath);
});

// Health check system tools cache (TTL 60s để tránh block event loop)
let systemToolsCache = null;
let systemToolsLastChecked = 0;

function checkSystemTools() {
  const now = Date.now();
  if (systemToolsCache && now - systemToolsLastChecked < 60000) {
    return systemToolsCache;
  }

  const { execFileSync } = require('child_process');
  const chk = (exe, args) => {
    try { execFileSync(exe, args, { stdio: 'pipe', timeout: 2000 }); return true; }
    catch (_) { return false; }
  };

  const gsExe = process.platform === 'win32' ? 'gswin64c' : 'gs';
  const loExe = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\LibreOffice\\program\\soffice.exe')
    ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
    : 'libreoffice';

  systemToolsCache = {
    ghostscript: chk(gsExe, ['-v']),
    libreoffice: chk(loExe, ['--version']),
    tesseract: chk('tesseract', ['--version']),
    qpdf: chk('qpdf', ['--version']),
    pdftohtml: chk('pdftohtml', ['-v']),
  };
  systemToolsLastChecked = now;
  return systemToolsCache;
}

// Health check endpoint (Hardened S-19: reflects actual DB connection state)
app.get('/api/health', (req, res) => {
  const authOk = isAuthConnected();
  const dataOk = isDataConnected();
  const isHealthy = authOk || dataOk;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    systemTools: checkSystemTools(),
    database: {
      authConnected: authOk,
      dataConnected: dataOk,
      mode: process.env.DATA_DB_URI || process.env.MONGODB_DATA_URI ? 'Dual-Cluster (Separated DB)' : 'Single-Cluster (Unified DB)',
    },
  });
});

// ── Health & Observability Endpoints (Reliability Spec) ───────────────────────
// 1. Liveness check: Process is alive and responding
const handleLive = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    pid: process.pid,
  });
};
app.get('/live', handleLive);
app.get('/api/live', handleLive);

// 2. Readiness check: Deep verification of all critical backing services
const handleReady = (req, res) => {
  const authReady = isAuthConnected();
  const dataReady = isDataConnected();
  const redisReady = isRedisReady();
  const cloudStorageReady = isCloudConfigured();

  const dependencies = {
    authDatabase: authReady ? 'connected' : 'disconnected',
    dataDatabase: dataReady ? 'connected' : 'disconnected',
    queueBackend: redisReady ? 'bullmq-redis-ready' : 'in-memory-fallback',
    cloudStorage: cloudStorageReady ? 'configured' : 'local-storage-only',
  };

  const isHealthy = authReady || dataReady;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    dependencies,
  });
};
app.get('/ready', handleReady);
app.get('/api/ready', handleReady);

// 3. Capabilities: Safe public feature readiness (No sensitive infrastructure disclosure)
const handleCapabilities = (req, res) => {
  res.status(200).json({
    version: '1.0.0',
    backgroundWorkers: true,
    queueEngine: isRedisReady() ? 'bullmq-redis' : 'in-memory-fallback',
    durableQueue: isRedisReady(),
    urlToPdf: isUrlToPdfEnabled(),
    cloudStorage: isCloudConfigured(),
    supportedJobOperations: [
      'pdf-compress',
      'pdf-merge',
      'pdf-split',
      'pdf-to-word',
      'word-to-pdf',
      'pdf-redact',
      'batch-process',
      'image-convert',
      'image-compress',
      'image-resize',
      'html-to-pdf',
    ],
  });
};
app.get('/capabilities', handleCapabilities);
app.get('/api/capabilities', handleCapabilities);

// Endpoint cực nhẹ cho ping
app.get('/ping', (req, res) => res.send('pong'));

// ── Self-Ping Keep Alive ──────────────────────────────────────────────────────
const SELF_PING_INTERVAL = 4 * 60 * 1000; // 4 phút
setInterval(() => {
  try {
    const rawUrl = process.env.SERVER_URL || `http://127.0.0.1:${PORT}`;
    const targetUrl = `${rawUrl.replace(/\/$/, '')}/ping`;
    const client = targetUrl.startsWith('https:') ? https : http;
    const req = client.get(targetUrl, (res) => {
      res.resume(); // Tiêu thụ stream để giải phóng memory và socket
    });
    req.on('error', (err) => {
      logger.warn(`[Self-Ping] Không thể ping ${targetUrl}: ${err.message}`);
    });
    req.setTimeout(10000, () => {
      req.destroy();
    });
  } catch (err) {
    logger.error(`[Self-Ping] Lỗi cấu hình self-ping: ${err.message}`);
  }
}, SELF_PING_INTERVAL);

// ── Frontend Static Serving ───────────────────────────────────────────────────
const clientDist = path.resolve('client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/outputs') || req.url.startsWith('/uploads') || req.url === '/ping') {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: system-ui, sans-serif; background: #0a0a0f; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <h1 style="background: linear-gradient(to right, #ec4899, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2.5rem; margin-bottom: 10px;">⚡ FileTools Pro Backend API</h1>
        <p style="color: #94a3b8; max-width: 500px; margin-bottom: 25px;">Server backend đang chạy tại cổng ${PORT}. Giao diện frontend Vite chạy tại cổng 5173.</p>
        <a href="http://localhost:5173" style="background: linear-gradient(to right, #db2777, #9333ea); color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 0 20px rgba(236,72,153,0.4);">Mở Giao Diện Web (localhost:5173) →</a>
      </div>
    `);
  });
}

// ── Cron Auto Cleanup & Storage Reconciliation ──────────────────────────────
// Dọn dẹp files tạm và đối soát tệp cloud hết hạn (chạy mỗi 30 phút khi chạy server chính)
const { reconcileStorage } = require('./services/cleanup.service');
if (require.main === module) {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const stats = await reconcileStorage(60 * 60 * 1000);
      if (stats.uploadsDeleted > 0 || stats.outputsDeleted > 0 || stats.cloudDeleted > 0) {
        logger.info(`[cleanup] Đã dọn dẹp: ${stats.uploadsDeleted} upload(s), ${stats.outputsDeleted} output(s), ${stats.cloudDeleted} cloud record(s)`);
      }
    } catch (err) {
      logger.error('[cleanup] Lỗi dọn dẹp & đối soát kho lưu trữ:', err.message);
    }
  });
}

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - ${err.message}`);

  AuditLog.log({
    userId: req.user?._id,
    action: 'server.error',
    severity: err.status >= 500 || !err.status ? 'critical' : 'warning',
    ip: req.ip,
    method: req.method,
    path: req.path,
    meta: { message: err.message, status: err.status || 500 },
  });

  if (err instanceof multer.MulterError || err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Dung lượng file vượt quá giới hạn 100MB', code: 'FILE_TOO_LARGE' });
    }
    return res.status(400).json({ error: `Lỗi file tải lên: ${err.message}`, code: 'UPLOAD_ERROR' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Lỗi hệ thống máy chủ',
    code: err.code || 'INTERNAL_ERROR',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ── Khởi động Server ─────────────────────────────────────────────────────────
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`⚡ FileTools Pro Server đang chạy tại http://localhost:${PORT}`);
    console.log(`⚡ Socket.io real-time server đã sẵn sàng`);
  });

  // tat app don dep browser
  const { closeBrowser } = require('./utils/browser');
  process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit(0);
  });
}

module.exports = app;
