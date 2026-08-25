'use strict';

const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const pdfSvc     = require('../services/pdf.service');
const imageSvc   = require('../services/image.service');
const archiveSvc = require('../services/archive.service');
const { emitProgress, emitComplete, emitError } = require('../services/jobEmitter');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Dynamic import p-queue
let PQueue = null;
async function getQueue() {
  if (!PQueue) {
    const mod = await import('p-queue');
    PQueue = mod.default;
  }
  return new PQueue({ concurrency: 3 });
}

router.post('/process', optionalAuth, upload.array('files', 20), wrap(async (req, res) => {
  const { action, options = '{}', jobId: clientJobId } = req.body;
  const jobId = clientJobId || uuidv4();
  const opts  = typeof options === 'string' ? JSON.parse(options) : options;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Không có file nào được upload' });
  }

  const queue = await getQueue();
  const total = req.files.length;
  const processedPaths = [];
  const errors = [];

  // Trả về jobId ngay lập tức để client lắng nghe qua Socket.io
  res.json({ success: true, jobId, totalFiles: total, status: 'processing' });

  // Xử lý background
  (async () => {
    let completed = 0;

    const tasks = req.files.map((file, idx) => queue.add(async () => {
      try {
        let outPath = null;

        switch (action) {
          case 'pdf-compress':
            outPath = await pdfSvc.compressPDF(file.path, opts.quality || 'ebook');
            break;
          case 'image-convert':
            outPath = await imageSvc.convert(file.path, opts.format || 'webp', opts.quality || 85);
            break;
          case 'image-compress':
            outPath = await imageSvc.compress(file.path, opts.quality || 75);
            break;
          case 'image-resize':
            outPath = await imageSvc.resize(file.path, opts.width, opts.height);
            break;
          case 'pdf-rotate':
            outPath = await pdfSvc.rotatePDF(file.path, opts.angle || 90);
            break;
          default:
            throw new Error(`Thao tác không hỗ trợ: ${action}`);
        }

        processedPaths.push({ path: outPath, originalname: path.basename(outPath) });
      } catch (err) {
        errors.push({ file: file.originalname, error: err.message });
      } finally {
        completed++;
        emitProgress(jobId, {
          total,
          completed,
          percent: Math.round((completed / total) * 100),
          currentFile: file.originalname,
        });
      }
    }));

    await Promise.all(tasks);

    try {
      if (processedPaths.length === 0) {
        throw new Error('Tất cả files đều thất bại: ' + errors.map(e => e.error).join(', '));
      }

      // Đóng gói tất cả file kết quả thành 1 file ZIP
      const zipPath = await archiveSvc.createZip(processedPaths);
      emitComplete(jobId, {
        zipFile: path.basename(zipPath),
        successCount: processedPaths.length,
        failCount: errors.length,
        errors,
      });
    } catch (err) {
      emitError(jobId, err);
    }
  })();
}));

module.exports = router;
