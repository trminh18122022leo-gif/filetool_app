'use strict';

const { execSync } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

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

  let flags = '-noframes -enc UTF-8';
  if (mode === 'complex') flags += ' -c'; // complex layout: sinh kèm css/ảnh
  if (mode === 'single')  flags += ' -s'; // gom vào 1 file HTML duy nhất

  try {
    execSync(`pdftohtml ${flags} "${pdfPath}" "${outBase}"`, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      'pdftohtml thất bại. Hãy cài poppler-utils:\n' +
      '  macOS: brew install poppler\n' +
      '  Linux: sudo apt install poppler-utils\n' +
      '  Windows: https://github.com/oschwartz10612/poppler-windows\n' +
      err.message
    );
  }

  // Đóng gói thư mục output thành ZIP để tiện tải về
  const zipPath = path.join(OUT, `html_export_${uuidv4()}.zip`);
  const output  = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(outDir, false);
    archive.finalize();
  });

  const fileCount = fs.readdirSync(outDir).length;
  // Xóa thư mục HTML thô sau khi đã zip
  fs.rmSync(outDir, { recursive: true, force: true });

  return {
    zipPath,
    zipName: path.basename(zipPath),
    fileCount,
  };
}

module.exports = { convert };
