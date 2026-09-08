const multer = require('multer');
const passport = require('passport');
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
const { execSync } = require('child_process');

const { authConn, dataConn, isAuthConnected, isDataConnected } = require('./config/database');
const { initSocket } = require('./socket');
const { cleanDirectory, cleanupTempFiles } = require('./middleware/cleanup');
const { apiRateLimit, toolRateLimit, uploadRateLimit } = require('./middleware/rateLimit');

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
// Trust proxy (Render, Railway, Heroku đều dùng proxy) — PHẢI đặt trước rate limiter
app.set('trust proxy', true);
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Khởi tạo Socket.io
initSocket(server);

// Đảm bảo các thư mục cần thiết tồn tại
['uploads', 'outputs', 'logs'].forEach(dir => {
  const p = path.resolve(dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Middlewares Toàn Cục ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP để không chặn fonts/scripts bên ngoài
}));

// Compression — mức 6 là điểm cân bằng tốc độ/kích thước tối ưu
app.use(compression({ level: 6, threshold: 1024 }));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Route Stripe webhook cần raw body — phải đặt TRƯỚC express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Cache-control headers cho static assets (tăng tốc đáng kể lần load 2+)
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 năm cho versioned assets
  } else if (req.url.startsWith('/api/') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// Áp dụng Rate Limit chung cho toàn bộ API
app.use('/api', apiRateLimit);

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/outputs', express.static(path.resolve('outputs'), { maxAge: '1h' }));
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '1h' }));

// ── Routes ───────────────────────────────────────────────────────────────────
// Auth & User & Billing
// authRateLimit đã được áp dụng per-route (login/register có riêng loginRateLimit/registerRateLimit)
// Không dùng authRateLimit ở đây nữa để tránh duplicate rate limit gây lỗi ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/apikey', require('./routes/apikey.routes'));
app.use('/api/storage', require('./routes/storage.routes'));

// Tool Routes (có gắn toolRateLimit để bảo vệ CPU)
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

// Download file kết quả local an toàn
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  const chk = cmd => {
    try { execSync(cmd, { stdio: 'pipe' }); return true; }
    catch (_) { return false; }
  };

  const gsCmd = process.platform === 'win32' ? 'gswin64c -v' : 'gs -v';
  const loCmd = process.platform === 'win32'
    ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --version'
    : 'libreoffice --version';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    systemTools: {
      ghostscript: chk(gsCmd),
      libreoffice: chk(loCmd),
      tesseract: chk('tesseract --version'),
      qpdf: chk('qpdf --version'),
      pdftohtml: chk('pdftohtml -v'),
    },
    database: {
      authConnected: isAuthConnected(),
      dataConnected: isDataConnected(),
      mode: process.env.MONGODB_DATA_URI ? 'Dual-Cluster (Separated DB)' : 'Single-Cluster (Unified DB)',
    },
  });
});

// Endpoint cực nhẹ cho ping — không check DB, không check system tools
app.get('/ping', (req, res) => res.send('pong'));

// ── Self-Ping Keep Alive ──────────────────────────────────────────────────────
// Tự ping chính mình mỗi 4 phút để server không bao giờ ngủ (Render, Railway free)
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
        <p style="color: #94a3b8; max-width: 500px; margin-bottom: 25px;">Server backend đang chạy tại cổng 3002. Giao diện frontend Vite chạy tại cổng 5173.</p>
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

  if (err instanceof multer.MulterError || err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Dung lượng file vượt quá giới hạn 100MB' });
    }
    return res.status(400).json({ error: `Lỗi file tải lên: ${err.message}` });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Lỗi hệ thống máy chủ',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ── Khởi động Server ─────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`⚡ FileTools Pro Server đang chạy tại http://localhost:${PORT}`);
  console.log(`⚡ Socket.io real-time server đã sẵn sàng`);
});

module.exports = app;
