'use strict';

const { execFileSync } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

function runSafe(executable, args = []) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      `${executable} thất bại: ${err.stderr?.toString() || err.message}\nHãy đảm bảo đã cài poppler-utils:\n` +
      '  macOS: brew install poppler\n' +
      '  Linux: sudo apt install poppler-utils\n' +
      '  Windows: https://github.com/oschwartz10612/poppler-windows'
    );
  }
}

/**
 * Chuyển PDF sang HTML.
 * Dùng pdftohtml từ poppler-utils.
 * 
 * @param {string} pdfPath
 * @param {object} opts
 * @param {string} opts.mode - 'complex' (giữ layout) | 'simple' (gọn) | 'single' (1 file)
 * @returns {Promise<{zipName: string, htmlPath: string, fileCount: number}>}
 */
async function convert(pdfPath, opts = {}) {
  const { mode = 'complex' } = opts;
  const outDir = path.join(OUT, `html_${uuidv4()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const outBase = path.join(outDir, 'index');

  const args = ['-noframes', '-enc', 'UTF-8'];
  if (mode === 'complex') args.push('-c'); // complex layout: sinh kèm css/ảnh
  if (mode === 'single')  args.push('-s'); // gom vào 1 file HTML duy nhất
  args.push(pdfPath, outBase);

  const zipPath = path.join(OUT, `html_export_${uuidv4()}.zip`);

  try {
    runSafe('pdftohtml', args);

    // Đóng gói thư mục output thành ZIP để tiện tải về
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(outDir, false);
      archive.finalize();
    });

    let fileCount = 0;
    try {
      fileCount = fs.readdirSync(outDir).length;
    } catch (_) {}

    return {
      zipPath,
      zipName: path.basename(zipPath),
      fileCount,
    };
  } finally {
    // Luôn dọn dẹp thư mục HTML thô kể cả khi thành công lẫn khi ném lỗi
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = { convert };
