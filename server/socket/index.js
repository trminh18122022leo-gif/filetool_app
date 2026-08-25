'use strict';

const { Server }     = require('socket.io');
const jwt            = require('jsonwebtoken');
const { jobEmitter } = require('../services/jobEmitter');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:5173',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT auth middleware cho socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
      } catch (_) {}
    }
    next(); // Cho phép cả guest kết nối
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
