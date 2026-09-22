'use strict';

require('dotenv').config();

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (_) { }

const express = require('express');
const http = require('http');
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

const { authDB, dataDB, isAuthConnected, isDataConnected } = require('./config/database');
const AuditLog = require('./models/AuditLog');
const { initSocket } = require('./socket');
const { cleanupTempFiles } = require('./middleware/cleanup');
const { apiRateLimit, toolRateLimit, uploadRateLimit } = require('./middleware/rateLimit');
const { sanitizeBody, detectSuspicious, validateUploadedFiles } = require('./middleware/security');

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
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/collab') {
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
const defaultAllowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3030',
  'http://127.0.0.1:3030',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:5173',
].filter(Boolean);

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).forEach(o => {
    if (o && !defaultAllowedOrigins.includes(o)) defaultAllowedOrigins.push(o);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (mobile apps, server-to-server, curl, Postman, Electron file://)
    if (!origin || origin === 'null') return callback(null, true);
    if (origin.startsWith('filetools://') || origin.startsWith('com.filetools.pro://')) {
      return callback(null, true);
    }
    if (defaultAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Cho phép các preview deployments tương ứng nếu CLIENT_URL là domain vercel
    if (process.env.CLIENT_URL && process.env.CLIENT_URL.includes('.vercel.app')) {
      const baseApp = process.env.CLIENT_URL.replace(/^https?:\/\//, '').replace(/\.vercel\.app.*$/, '');
      const escapedBase = baseApp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^https:\\/\\/(${escapedBase}|${escapedBase}-[a-zA-Z0-9_-]+)\\.vercel\\.app$`).test(origin)) {
        return callback(null, true);
      }
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key'],
}));

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

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/outputs', express.static(path.resolve('outputs'), { maxAge: '1h' }));
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '1h' }));

// ── Routes ───────────────────────────────────────────────────────────────────
// Auth & User & Billing
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/apikey', require('./routes/apikey.routes'));
app.use('/api/storage', require('./routes/storage.routes'));

// Tool Routes (có gắn toolRateLimit và validateUploadedFiles)
app.use('/api/pdf', toolRateLimit, validateUploadedFiles, require('./routes/pdf.routes'));
app.use('/api/image', toolRateLimit, validateUploadedFiles, require('./routes/image.routes'));
app.use('/api/office', toolRateLimit, validateUploadedFiles, require('./routes/office.routes'));
app.use('/api/ocr', toolRateLimit, validateUploadedFiles, require('./routes/ocr.routes'));
app.use('/api/archive', toolRateLimit, validateUploadedFiles, require('./routes/archive.routes'));
app.use('/api/batch', toolRateLimit, validateUploadedFiles, require('./routes/batch.routes'));
app.use('/api/qr', toolRateLimit, validateUploadedFiles, require('./routes/qr.routes'));
app.use('/api/signature', toolRateLimit, validateUploadedFiles, require('./routes/signature.routes'));
app.use('/api/ai', toolRateLimit, validateUploadedFiles, require('./routes/ai.routes'));
app.use('/api/convert', toolRateLimit, validateUploadedFiles, require('./routes/convert.routes'));
app.use('/api/creative', toolRateLimit, validateUploadedFiles, require('./routes/creative.routes'));
app.use('/api/speech', toolRateLimit, validateUploadedFiles, require('./routes/speech.routes'));

// Download file kết quả local an toàn (chống Directory Traversal tuyệt đối)
app.get('/api/download/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(path.resolve('outputs'), safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa tự động sau 1h' });
  }

  res.download(filePath, safeName);
});

// View file trực tiếp trong browser (inline image, pdf preview, svg...)
app.get('/api/view/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(path.resolve('outputs'), safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa' });
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    systemTools: checkSystemTools(),
    database: {
      authConnected: isAuthConnected(),
      dataConnected: isDataConnected(),
      mode: process.env.DATA_DB_URI || process.env.MONGODB_DATA_URI ? 'Dual-Cluster (Separated DB)' : 'Single-Cluster (Unified DB)',
    },
  });
});

// Endpoint cực nhẹ cho ping
app.get('/ping', (req, res) => res.send('pong'));

// ── Self-Ping Keep Alive ──────────────────────────────────────────────────────
const SELF_PING_INTERVAL = 4 * 60 * 1000; // 4 phút
setInterval(() => {
  const url = process.env.SERVER_URL || `http://localhost:${PORT}`;
  http.get(`${url}/ping`, () => { }).on('error', () => { });
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

// ── Cron Auto Cleanup ────────────────────────────────────────────────────────
// Dọn dẹp files tạm sau 1 giờ (chạy mỗi 30 phút)
cron.schedule('*/30 * * * *', () => {
  try {
    const { uploadsDeleted, outputsDeleted } = cleanupTempFiles(60 * 60 * 1000);
    if (uploadsDeleted > 0 || outputsDeleted > 0) {
      logger.info(`[cleanup] Đã xóa: ${uploadsDeleted} upload(s), ${outputsDeleted} output(s)`);
    }
  } catch (err) {
    logger.error('[cleanup] Lỗi dọn dẹp file tạm:', err.message);
  }
});

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

module.exports = app;
