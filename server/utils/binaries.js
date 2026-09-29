'use strict';

/**
 * server/utils/binaries.js
 * Quản lý và định vị các công cụ thực thi nhị phân (Ghostscript, Poppler, Tesseract, LibreOffice)
 * Cung cấp cơ chế dự phòng kép (dual-engine fallback) cho các tác vụ xử lý PDF và hình ảnh.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Tìm đường dẫn Ghostscript executable
 */
function getGsExecutable() {
  if (process.platform === 'win32') {
    const candidates = [
      'gswin64c',
      'C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
      'C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe',
      'C:\\Program Files (x86)\\gs\\gs10.07.1\\bin\\gswin32c.exe',
      'gswin32c'
    ];
    for (const c of candidates) {
      if (!c.includes('\\')) {
        try {
          execFileSync(c, ['-v'], { stdio: 'ignore' });
          return c;
        } catch (_) {}
      } else if (fs.existsSync(c)) {
        return c;
      }
    }
  }
  return 'gs';
}

/**
 * Tìm đường dẫn Poppler binary (pdftoppm, pdfinfo, pdftotext...)
 */
function getPopplerBinary(name = 'pdftoppm') {
  if (process.platform === 'win32') {
    const candidates = [
      name,
      `C:\\Users\\Admin\\poppler-26.02.0\\Library\\bin\\${name}.exe`,
      `C:\\Program Files\\poppler\\bin\\${name}.exe`,
      `C:\\Program Files (x86)\\poppler\\bin\\${name}.exe`,
      `C:\\poppler\\bin\\${name}.exe`
    ];
    for (const c of candidates) {
      if (c === name) {
        try {
          execFileSync(name, ['-v'], { stdio: 'ignore' });
          return name;
        } catch (_) {}
      } else if (fs.existsSync(c)) {
        return c;
      }
    }
  }
  return name;
}

/**
 * Tìm đường dẫn Tesseract OCR executable
 */
function getTesseractExecutable() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
      'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
      'tesseract'
    ];
    for (const c of candidates) {
      if (c === 'tesseract') {
        try {
          execFileSync(c, ['--version'], { stdio: 'ignore' });
          return c;
        } catch (_) {}
      } else if (fs.existsSync(c)) {
        return c;
      }
    }
  }
  return 'tesseract';
}

/**
 * Tìm đường dẫn LibreOffice executable
 */
function getLoExecutable() {
  if (process.platform === 'win32') {
    const winCandidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'soffice'
    ];
    for (const c of winCandidates) {
      if (c === 'soffice') {
        try {
          execFileSync(c, ['--version'], { stdio: 'ignore' });
          return c;
        } catch (_) {}
      } else if (fs.existsSync(c)) {
        return c;
      }
    }
  }
  return 'libreoffice';
}

/**
 * Thực thi an toàn child_process mà không qua shell
 */
function runSafe(executable, args = [], options = {}) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe', ...options });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString('utf8') : err.message;
    throw new Error(`Lệnh thực thi thất bại: ${executable} ${args.slice(0, 5).join(' ')}\nChi tiết: ${detail}`);
  }
}

/**
 * Trích xuất các trang trong PDF thành danh sách file ảnh (PNG hoặc JPG)
 * Sử dụng cơ chế dự phòng kép: pdftoppm (tối ưu tốc độ & font) -> Ghostscript
 */
async function pdfToImages(pdfPath, outDir, opts = {}) {
  const dpi = typeof opts === 'number' ? opts : (opts.dpi || 150);
  const format = typeof opts === 'object' && opts.format ? opts.format : 'png';
  const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';
  const prefix = path.join(outDir, 'page');

  // 1. Thử Engine 1: pdftoppm
  try {
    const pdftoppmBin = getPopplerBinary('pdftoppm');
    const flag = ext === 'jpg' ? '-jpeg' : '-png';
    runSafe(pdftoppmBin, [flag, '-r', String(dpi), '--', pdfPath, prefix], { windowsHide: true });

    const files = fs.readdirSync(outDir)
      .filter(f => f.startsWith('page') && f.endsWith(`.${ext}`))
      .sort((a, b) => {
        const numA = parseInt(a.match(/-(\d+)\.(?:png|jpg)$/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/-(\d+)\.(?:png|jpg)$/)?.[1] || '0', 10);
        return numA - numB;
      })
      .map(f => path.join(outDir, f));

    if (files.length > 0) return files;
  } catch (err) {
    console.warn('[PDF-to-Images] pdftoppm không thành công, chuyển sang Ghostscript fallback:', err.message);
  }

  // 2. Thử Engine 2: Ghostscript
  try {
    const gsBin = getGsExecutable();
    const gsDev = ext === 'jpg' ? 'jpeg' : 'png16m';
    const gsOut = path.join(outDir, `page-%04d.${ext}`);
    runSafe(gsBin, [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
      `-sDEVICE=${gsDev}`,
      `-r${dpi}`,
      `-sOutputFile=${gsOut}`,
      pdfPath
    ], { windowsHide: true });

    const files = fs.readdirSync(outDir)
      .filter(f => f.startsWith('page-') && f.endsWith(`.${ext}`))
      .sort()
      .map(f => path.join(outDir, f));

    if (files.length > 0) return files;
  } catch (err) {
    console.warn('[PDF-to-Images] Ghostscript cũng thất bại:', err.message);
  }

  throw new Error('Không thể trích xuất hình ảnh từ file PDF (cả pdftoppm và Ghostscript đều thất bại).');
}

module.exports = {
  getGsExecutable,
  getPopplerBinary,
  getTesseractExecutable,
  getLoExecutable,
  runSafe,
  pdfToImages,
};
