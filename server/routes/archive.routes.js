'use strict';

const express    = require('express');
const router     = express.Router();
const upload     = require('../middleware/upload');
const archiveSvc = require('../services/archive.service');
const { respondFile, respondFiles } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Tạo ZIP
router.post('/zip', optionalAuth, upload.array('files', 50), wrap(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Không có file nào được tải lên' });
  }
  const zipPath = await archiveSvc.createZip(req.files);
  await respondFile(req, res, zipPath, 'archive-zip', { fileCount: req.files.length });
}));

// Giải nén ZIP
router.post('/unzip', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const extractedFiles = await archiveSvc.extractZip(req.file.path);
  await respondFiles(req, res, extractedFiles, 'archive-unzip');
}));

module.exports = router;
