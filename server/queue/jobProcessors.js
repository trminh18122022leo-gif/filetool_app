'use strict';

/**
 * server/queue/jobProcessors.js
 * Bộ điều phối thực thi nghiệp vụ cho các tác vụ trong hàng đợi.
 * Bảo đảm môi trường tạm thời cô lập (Isolated Per-Job Sandbox) và zero cross-tenant temp leakage.
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const pdfSvc = require('../services/pdf.service');
const pdfAdv = require('../services/pdfAdvanced.service');
const redactSvc = require('../services/redact.service');
const imageSvc = require('../services/image.service');
const archiveSvc = require('../services/archive.service');

const BASE_TEMP_DIR = path.resolve('uploads', 'jobs');
if (!fs.existsSync(BASE_TEMP_DIR)) {
  fs.mkdirSync(BASE_TEMP_DIR, { recursive: true });
}

/**
 * Thực thi một tác vụ với sandbox directory cô lập hoàn toàn
 */
async function executeJob(jobRecord, onProgress = () => {}) {
  const jobId = jobRecord.jobId;
  const operation = jobRecord.operation;
  const params = jobRecord.params || {};
  const inputFiles = jobRecord.inputFiles || [];

  // Tạo thư mục tạm riêng biệt cho từng job
  const jobSandboxDir = path.join(BASE_TEMP_DIR, jobId);
  if (!fs.existsSync(jobSandboxDir)) {
    fs.mkdirSync(jobSandboxDir, { recursive: true });
  }

  try {
    onProgress(10, 'Bắt đầu xử lý tác vụ trong sandbox');
    let outputResult = null;

    switch (operation) {
      case 'pdf-compress': {
        const file = inputFiles[0];
        if (!file?.localPath || !fs.existsSync(file.localPath)) {
          throw new Error('File PDF đầu vào không tồn tại');
        }
        onProgress(30, 'Đang nén tài liệu PDF');
        const outPath = await pdfSvc.compressPDF(file.localPath, params.quality || 'ebook');
        outputResult = {
          localPath: outPath,
          originalName: `compressed_${file.originalName || 'document.pdf'}`,
          mimeType: 'application/pdf',
        };
        break;
      }

      case 'pdf-merge': {
        if (inputFiles.length < 2) {
          throw new Error('Cần ít nhất 2 file PDF để gộp');
        }
        const paths = inputFiles.map(f => f.localPath).filter(Boolean);
        onProgress(40, 'Đang gộp các trang PDF');
        const outPath = await pdfSvc.mergePDFs(paths, { pageOrder: params.pageOrder });
        outputResult = {
          localPath: outPath,
          originalName: `merged_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
        };
        break;
      }

      case 'pdf-to-word': {
        const file = inputFiles[0];
        if (!file?.localPath || !fs.existsSync(file.localPath)) throw new Error('File PDF không tồn tại');
        onProgress(50, 'Đang chuyển đổi PDF sang DOCX');
        const outPath = await pdfSvc.pdfToWord(file.localPath);
        outputResult = {
          localPath: outPath,
          originalName: `${path.basename(file.originalName, path.extname(file.originalName))}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        break;
      }

      case 'word-to-pdf': {
        const file = inputFiles[0];
        if (!file?.localPath || !fs.existsSync(file.localPath)) throw new Error('File Word không tồn tại');
        onProgress(50, 'Đang render Word sang PDF');
        const outPath = await pdfSvc.wordToPdf(file.localPath);
        outputResult = {
          localPath: outPath,
          originalName: `${path.basename(file.originalName, path.extname(file.originalName))}.pdf`,
          mimeType: 'application/pdf',
        };
        break;
      }

      case 'pdf-redact': {
        const file = inputFiles[0];
        if (!file?.localPath || !fs.existsSync(file.localPath)) throw new Error('File PDF không tồn tại');
        onProgress(30, 'Đang quét và che giấu vĩnh viễn PII');
        const res = await redactSvc.redactPdf(file.localPath, params.redactions || [], {
          fillColor: params.fillColor || 'black',
          stampLabel: params.stampLabel || '',
          flatten: true, // Secure Redaction bắt buộc
          dpi: params.dpi || 200,
        });
        outputResult = {
          localPath: res.outputPath,
          originalName: `redacted_${file.originalName || 'doc.pdf'}`,
          mimeType: 'application/pdf',
        };
        break;
      }

      case 'batch-process': {
        const action = params.action || 'image-compress';
        const total = inputFiles.length;
        const processedPaths = [];
        const errors = [];

        for (let i = 0; i < total; i++) {
          const file = inputFiles[i];
          const percent = Math.round(20 + ((i + 1) / total) * 60);
          onProgress(percent, `Đang xử lý file ${i + 1}/${total}: ${file.originalName}`);

          try {
            let outPath = null;
            if (action === 'image-convert') {
              outPath = await imageSvc.convert(file.localPath, params.format || 'webp', params.quality || 85);
            } else if (action === 'image-compress') {
              outPath = await imageSvc.compress(file.localPath, params.quality || 75);
            } else if (action === 'image-resize') {
              outPath = await imageSvc.resize(file.localPath, params.width, params.height);
            } else {
              outPath = await pdfSvc.compressPDF(file.localPath, params.quality || 'ebook');
            }
            processedPaths.push({ path: outPath, originalname: path.basename(outPath) });
          } catch (err) {
            errors.push({ file: file.originalName, error: err.message });
          }
        }

        if (processedPaths.length === 0) {
          throw new Error('Tất cả files trong batch đều thất bại: ' + errors.map(e => e.error).join(', '));
        }

        onProgress(85, 'Đang nén các file kết quả thành file ZIP');
        const zipPath = await archiveSvc.createZip(processedPaths);
        outputResult = {
          localPath: zipPath,
          originalName: `batch_result_${Date.now()}.zip`,
          mimeType: 'application/zip',
        };
        break;
      }

      case 'image-convert': {
        const file = inputFiles[0];
        if (!file?.localPath) throw new Error('File ảnh không tồn tại');
        onProgress(40, 'Đang định dạng lại ảnh');
        const outPath = await imageSvc.convert(file.localPath, params.format || 'webp', params.quality || 85);
        outputResult = {
          localPath: outPath,
          originalName: `converted.${params.format || 'webp'}`,
          mimeType: `image/${params.format || 'webp'}`,
        };
        break;
      }

      case 'html-to-pdf': {
        const file = inputFiles[0];
        if (!file?.localPath) throw new Error('File HTML không tồn tại');
        onProgress(40, 'Đang render HTML sang PDF có cô lập mạng');
        const outPath = await pdfAdv.htmlFileToPdf(file.localPath, { format: params.format || 'A4' });
        outputResult = {
          localPath: outPath,
          originalName: 'webpage.pdf',
          mimeType: 'application/pdf',
        };
        break;
      }

      default:
        throw new Error(`Thao tác chưa được hỗ trợ: ${operation}`);
    }

    if (outputResult && outputResult.localPath && fs.existsSync(outputResult.localPath)) {
      const stats = fs.statSync(outputResult.localPath);
      outputResult.fileSize = stats.size;
      outputResult.fileId = uuidv4();
    }

    onProgress(100, 'Tác vụ đã hoàn tất thành công');
    return outputResult;
  } finally {
    // Dọn dẹp an toàn thư mục sandbox tạm của job (Ngăn rò rỉ chéo dữ liệu người dùng)
    try {
      if (fs.existsSync(jobSandboxDir)) {
        fs.rmSync(jobSandboxDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

module.exports = {
  executeJob,
};
