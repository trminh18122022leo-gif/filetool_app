'use strict';

const { Server }     = require('socket.io');
const authSvc        = require('../services/auth.service');
const { jobEmitter } = require('../services/jobEmitter');

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
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = authSvc.verifyAccessToken(token);
        socket.userId = decoded.userId || decoded.id;
      } catch (_) {}
    }
    next(); // Cho phép cả guest kết nối để nhận tiến trình xử lý file ẩn danh
  });

  io.on('connection', socket => {
    // Client tham gia room theo jobId hoặc userId
    socket.on('join-job', jobId => {
      socket.join(`job:${jobId}`);
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
