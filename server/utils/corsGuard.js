'use strict';

// Danh sách tường minh các origin Vercel đã xác minh của dự án FileTools Pro
const VERIFIED_VERCEL_ORIGINS = [
  'https://filetool-app.vercel.app',
  'https://filetools-app.vercel.app',
  'https://filetool-app-git-staging.vercel.app',
  'https://filetools-app-git-staging.vercel.app',
  'https://filetool-app-git-release-v1-0-0-candidate.vercel.app',
  'https://filetools-app-git-release-v1-0-0-candidate.vercel.app',
  'https://filetools.pro',
  'https://www.filetools.pro',
];

const defaultAllowedOrigins = [
  process.env.CLIENT_URL,
  process.env.STAGING_CLIENT_URL,
  'http://localhost:3030',
  'http://127.0.0.1:3030',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  ...VERIFIED_VERCEL_ORIGINS,
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
  // Cho phép các domain trong danh sách cho phép tường minh
  if (defaultAllowedOrigins.includes(origin)) {
    return true;
  }
  // Cho phép các cổng local chỉ trong môi trường phát triển (không áp dụng cho production hoặc staging)
  const isSecureEnv = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging';
  if (!isSecureEnv && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

module.exports = {
  VERIFIED_VERCEL_ORIGINS,
  defaultAllowedOrigins,
  isOriginAllowed,
};
