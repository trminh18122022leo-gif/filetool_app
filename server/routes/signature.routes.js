'use strict';

const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const sigSvc  = require('../services/signature.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Nhúng chữ ký vào PDF
router.post('/sign', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { signature, page = 0, x = 50, y = 700, width = 200, height = 80 } = req.body;
  if (!signature) return res.status(400).json({ error: 'Chưa có dữ liệu chữ ký' });

  const out = await sigSvc.embedSignature(req.file.path, signature, {
    page:   Number(page),
    x:      Number(x),
    y:      Number(y),
    width:  Number(width),
    height: Number(height),
  });
  await respondFile(req, res, out, 'pdf-sign');
}));

// Lấy thông tin kích thước trang PDF
router.post('/page-info', upload.single('file'), wrap(async (req, res) => {
  const pages = await sigSvc.getPageInfo(req.file.path);
  res.json({ success: true, pages });
}));

module.exports = router;
