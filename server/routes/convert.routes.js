'use strict';

const express      = require('express');
const router       = express.Router();
const upload       = require('../middleware/upload');
const pdfToHtmlSvc = require('../services/pdftohtml.service');
const { respondFile } = require('../utils/cloudRespond');

let optionalAuth = (req, res, next) => next();
try { optionalAuth = require('../middleware/auth').optionalAuth; } catch (_) {}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// PDF -> HTML (zip kèm assets)
router.post('/pdf-to-html', optionalAuth, upload.single('file'), wrap(async (req, res) => {
  const { mode = 'complex' } = req.body;
  const { zipPath, zipName, fileCount } = await pdfToHtmlSvc.convert(req.file.path, { mode });
  await respondFile(req, res, zipPath, 'pdf-to-html', { zipName, fileCount });
}));

module.exports = router;
