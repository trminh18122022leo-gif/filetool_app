'use strict';

require('dotenv').config();

const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const path         = require('path');
const fs           = require('fs');
const winston      = require('winston');
const cron         = require('node-cron');
const mongoose     = require('mongoose');
const { execSync } = require('child_process');

const { initSocket } = require('./socket');
const { cleanDirectory, cleanupTempFiles } = require('./middleware/cleanup');
const { apiRateLimit, authRateLimit, toolRateLimit, uploadRateLimit } = require('./middleware/rateLimit');

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

// ── MongoDB Connection ────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => logger.info('MongoDB đã kết nối thành công'))
    .catch(err => logger.error('Lỗi kết nối MongoDB:', err.message));
} else {
  logger.warn('MONGODB_URI chưa được cấu hình. Auth/Payment/Cloud DB sẽ không khả dụng cho tới khi cấu hình .env');
}

// ── Khởi tạo App & Server ─────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

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
}));
app.use(compression());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Route Stripe webhook cần raw body — phải đặt TRƯỚC express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Áp dụng Rate Limit chung cho toàn bộ API
app.use('/api', apiRateLimit);

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/outputs', express.static(path.resolve('outputs')));
app.use('/uploads', express.static(path.resolve('uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
// Auth & User & Billing
app.use('/api/auth',     authRateLimit, require('./routes/auth.routes'));
app.use('/api/user',     require('./routes/user.routes'));
app.use('/api/payment',  require('./routes/payment.routes'));
app.use('/api/apikey',   require('./routes/apikey.routes'));
app.use('/api/storage',  require('./routes/storage.routes'));

// Tool Routes (có gắn toolRateLimit để bảo vệ CPU)
app.use('/api/pdf',       toolRateLimit, require('./routes/pdf.routes'));
app.use('/api/image',     toolRateLimit, require('./routes/image.routes'));
app.use('/api/office',    toolRateLimit, require('./routes/office.routes'));
app.use('/api/ocr',       toolRateLimit, require('./routes/ocr.routes'));
app.use('/api/archive',   toolRateLimit, require('./routes/archive.routes'));
app.use('/api/batch',     toolRateLimit, require('./routes/batch.routes'));
app.use('/api/qr',        toolRateLimit, require('./routes/qr.routes'));
app.use('/api/signature', toolRateLimit, require('./routes/signature.routes'));
app.use('/api/ai',        toolRateLimit, require('./routes/ai.routes'));
app.use('/api/convert',   toolRateLimit, require('./routes/convert.routes'));

// Download file kết quả local an toàn
app.get('/api/download/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(path.resolve('outputs'), safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa tự động sau 1h' });
  }

  res.download(filePath, safeName);
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
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    systemTools: {
      ghostscript: chk(gsCmd),
      libreoffice: chk(loCmd),
      tesseract:   chk('tesseract --version'),
      qpdf:        chk('qpdf --version'),
      pdftohtml:   chk('pdftohtml -v'),
    },
    database: {
      connected: mongoose.connection.readyState === 1,
    },
  });
});

// ── Production Frontend Serving ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve('client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
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
