'use strict';

const defaultAllowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3030',
  'http://127.0.0.1:3030',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://filetool-app.vercel.app',
  'https://filetools-app.vercel.app',
].filter(Boolean);

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).forEach(o => {
    if (o && !defaultAllowedOrigins.includes(o)) defaultAllowedOrigins.push(o);
  });
}

function isOriginAllowed(origin) {
  // Cho phép request không có origin (mobile apps, server-to-server, curl, Postman, Electron file://)
  if (!origin || origin === 'null') return true;
  if (origin.startsWith('filetools://') || origin.startsWith('com.filetools.pro://')) {
    return true;
  }
  // Cho phép các domain cấu hình tường minh
  if (defaultAllowedOrigins.includes(origin)) {
    return true;
  }
  // Cho phép các cổng local chỉ trong môi trường phát triển (non-production)
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  // Chỉ cho phép preview deployments Vercel thuộc tiền tố dự án này (chặn tùy tiện *.vercel.app)
  if (/^https:\/\/(filetool-app|filetools-app)(-[a-zA-Z0-9_-]+)?\.vercel\.app$/.test(origin)) {
    return true;
  }
  return false;
}

module.exports = {
  defaultAllowedOrigins,
  isOriginAllowed,
};
