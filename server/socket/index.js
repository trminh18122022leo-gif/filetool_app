'use strict';

const { Server } = require('socket.io');
const authSvc = require('../services/auth.service');
const { jobEmitter, hasJobAccess } = require('../services/jobEmitter');

let io = null;

function initSocket(httpServer) {
  const defaultAllowedOrigins = [
    process.env.CLIENT_URL,
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

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origin === 'null') return callback(null, true);
        if (origin.startsWith('filetools://') || origin.startsWith('com.filetools.pro://')) {
          return callback(null, true);
        }
        if (defaultAllowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (process.env.CLIENT_URL && process.env.CLIENT_URL.includes('.vercel.app')) {
          const baseApp = process.env.CLIENT_URL.replace(/^https?:\/\//, '').replace(/\.vercel\.app.*$/, '');
          const escapedBase = baseApp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`^https:\\/\\/(${escapedBase}|${escapedBase}-[a-zA-Z0-9_-]+)\\.vercel\\.app$`).test(origin)) {
            return callback(null, true);
          }
        }
        return callback(null, false);
      },
      methods:     ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT auth middleware cho socket connection
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.cookie) {
      const match = socket.handshake.headers.cookie.match(/(?:accessToken|token)=([^;]+)/);
      if (match) token = match[1];
    }
    if (token) {
      try {
        const decoded = authSvc.verifyAccessToken(token);
        socket.userId = decoded.userId || decoded.id;
      } catch (_) {}
    }
    next(); // Cho phép cả guest kết nối để nhận tiến trình xử lý file với secret hợp lệ
  });

  io.on('connection', socket => {
    // Client tham gia room theo jobId có kiểm soát quyền
    socket.on('join-job', payload => {
      const targetJobId = typeof payload === 'string' ? payload : payload?.jobId;
      const secret = typeof payload === 'object' ? payload?.secret : null;

      if (!targetJobId) {
        return socket.emit('job-error', { error: 'Thiếu jobId', code: 'INVALID_JOB_ID' });
      }

      const authorized = hasJobAccess(targetJobId, { userId: socket.userId, secret });
      if (!authorized) {
        return socket.emit('job-error', {
          jobId: targetJobId,
          error: 'Không có quyền truy cập thông tin job này',
          code: 'FORBIDDEN_JOB_ACCESS',
        });
      }

      socket.join(`job:${targetJobId}`);
    });

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }
  });

  // Lắng nghe sự kiện từ jobEmitter và phát tới room tương ứng
  jobEmitter.on('progress', ({ jobId, ...data }) => {
    io.to(`job:${jobId}`).emit('job-progress', { jobId, ...data });
  });

  jobEmitter.on('complete', ({ jobId, result }) => {
    io.to(`job:${jobId}`).emit('job-complete', { jobId, result });
  });

  jobEmitter.on('error', ({ jobId, error }) => {
    io.to(`job:${jobId}`).emit('job-error', { jobId, error });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
