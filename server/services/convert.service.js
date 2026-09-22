/**
 * Convert Service — Image→PDF, PDF→Images, URL→PDF, Markdown→PDF, Doc Stats, JSON/CSV→Excel
 */
'use strict';

const { PDFDocument }   = require('pdf-lib');
const { execFileSync }  = require('child_process');
const pdfParse          = require('pdf-parse');
const sharp             = require('sharp');
const { withPage }      = require('../utils/browser');
const path              = require('path');
const fs                = require('fs');
const archiver          = require('archiver');
const XLSX              = require('xlsx');
const { v4: uuidv4 }    = require('uuid');

const OUT = path.resolve('outputs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function runSafe(executable, args = []) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Lệnh thực thi thất bại: ${executable} ${args.join(' ')}\nChi tiết: ${err.stderr?.toString() || err.message}`);
  }
}

async function imagesToPdf(filePaths, opts = {}) {
  const { margin = 20, pageSize = 'A4' } = opts;

  const PAGE_SIZES = {
    A4:     [595, 842],
    A3:     [842, 1191],
    Letter: [612, 792],
    auto:   null,
  };

  const doc = await PDFDocument.create();

  for (const fp of filePaths) {
    let img;
    try {
      const ext = path.extname(fp).toLowerCase();
      if (ext === '.png') {
        img = await doc.embedPng(fs.readFileSync(fp));
      } else if (ext === '.jpg' || ext === '.jpeg') {
        img = await doc.embedJpg(fs.readFileSync(fp));
      } else {
        const pngBuf = await sharp(fp).png().toBuffer();
        img = await doc.embedPng(pngBuf);
      }
    } catch (_) {
      // Fallback: Universal sharp converter to PNG buffer
      const pngBuf = await sharp(fp).png().toBuffer();
      img = await doc.embedPng(pngBuf);
    }

    const { width: iw, height: ih } = img.scale(1);

    let pw, ph;
    if (pageSize === 'auto' || !PAGE_SIZES[pageSize]) {
      pw = iw; ph = ih;
    } else {
      [pw, ph] = PAGE_SIZES[pageSize];
    }

    const page = doc.addPage([pw, ph]);
    const m    = Number(margin) || 0;

    const scale = Math.min((pw - m * 2) / iw, (ph - m * 2) / ih);
    const drawW = iw * scale;
    const drawH = ih * scale;
    const drawX = (pw - drawW) / 2;
    const drawY = (ph - drawH) / 2;

    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
  }

  const outPath = path.join(OUT, 'img2pdf_' + uuidv4() + '.pdf');
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

async function pdfToImages(pdfPath, opts = {}) {
  const { format = 'jpg', dpi = 150 } = opts;
  const gsDev  = format === 'png' ? 'png16m' : 'jpeg';
  const ext    = format === 'png' ? 'png'    : 'jpg';

  const tmpDir = path.resolve('uploads/p2i_' + uuidv4());
  fs.mkdirSync(tmpDir, { recursive: true });

  const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';
  runSafe(gsCmd, [
    '-dNOPAUSE', '-dBATCH', '-dQUIET',
    `-sDEVICE=${gsDev}`,
    `-r${dpi}`,
    `-sOutputFile=${tmpDir}/page_%04d.${ext}`,
    pdfPath,
  ]);

  const images = fs.readdirSync(tmpDir).filter(f => f.endsWith('.' + ext)).sort();
  if (!images.length) throw new Error('Không tạo được ảnh từ file PDF.');

  const zipPath = path.join(OUT, 'pdf2img_' + uuidv4() + '.zip');
  const output  = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    images.forEach(img => archive.file(path.join(tmpDir, img), { name: img }));
    archive.finalize();
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { zipPath, pageCount: images.length };
}

const dns = require('dns');
const net = require('net');

function isPrivateOrReservedIP(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 0) return true; // 0.0.0.0/8
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true; // Link Local & Cloud Metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] >= 224) return true; // Multicast & Reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.includes('::ffff:')) {
      const v4 = lower.split('::ffff:')[1];
      return isPrivateOrReservedIP(v4);
    }
    return false;
  }
  return true;
}

async function validateSafeUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('URL không hợp lệ');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ chấp nhận giao thức HTTP hoặc HTTPS');
  }

  const hostname = parsed.hostname;
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Không được phép truy cập địa chỉ cục bộ (Localhost)');
  }

  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        throw new Error(`Truy cập bị từ chối: Địa chỉ IP ${addr.address} thuộc vùng mạng nội bộ hoặc hệ thống bảo vệ.`);
      }
    }
  } catch (err) {
    if (err.message.includes('Truy cập bị từ chối')) throw err;
    throw new Error(`Không thể phân giải tên miền: ${hostname}`);
  }

  return parsed;
}

// convert url web sang pdf
async function urlToPdf(url, opts = {}) {
  const { format = 'A4', printBackground = true, waitUntil = 'networkidle0' } = opts;
  await validateSafeUrl(url);

  return await withPage(async (page) => {
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Chặn request tới dải IP/giao thức nguy hiểm trong quá trình render trang
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const reqUrl = new URL(req.url());
        if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:' && reqUrl.protocol !== 'data:') {
          return req.abort('accessdenied');
        }
        if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1' || reqUrl.hostname === '169.254.169.254') {
          return req.abort('accessdenied');
        }
        req.continue();
      } catch (_) {
        req.abort('failed');
      }
    });

    await page.goto(url, { waitUntil, timeout: 30000 });

    const outPath = path.join(OUT, 'url_' + uuidv4() + '.pdf');
    await page.pdf({
      path: outPath,
      format,
      printBackground,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    return outPath;
  });
}

// convert markdown sang pdf
async function markdownToPdf(mdContent, opts = {}) {
  const { theme = 'github' } = opts;

  const THEMES = {
    github: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; } h1,h2,h3 { border-bottom: 1px solid #e1e4e8; padding-bottom: 8px; } code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: monospace; } pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; } blockquote { border-left: 4px solid #0366d6; margin: 0; padding-left: 16px; color: #6a737d; } table { border-collapse: collapse; width: 100%; margin: 16px 0; } th,td { border: 1px solid #e1e4e8; padding: 8px 12px; } th { background: #f6f8fa; } img { max-width: 100%; }',
    dark: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #e6edf3; background: #0d1117; line-height: 1.7; } h1,h2,h3 { border-bottom: 1px solid #30363d; padding-bottom: 8px; color: #f0f6fc; } code { background: #161b22; padding: 2px 6px; border-radius: 3px; font-family: monospace; color: #ff7b72; } pre { background: #161b22; padding: 16px; border-radius: 6px; } blockquote { border-left: 4px solid #1f6feb; margin: 0; padding-left: 16px; color: #8b949e; } table { border-collapse: collapse; width: 100%; margin: 16px 0; } th,td { border: 1px solid #30363d; padding: 8px 12px; } th { background: #161b22; } img { max-width: 100%; }',
  };

  let htmlContent = '';
  try {
    const { marked } = require('marked');
    htmlContent = marked.parse(mdContent);
  } catch (_) {
    htmlContent = '<pre>' + mdContent + '</pre>';
  }

  // Khử các thẻ nguy hiểm ngăn chặn Local File Inclusion (LFI) & SSRF
  const sanitizedHtml = String(htmlContent)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<frame\b[^>]*>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '');

  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + (THEMES[theme] || THEMES.github) + '</style></head><body>' + sanitizedHtml + '</body></html>';

  return await withPage(async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const reqUrl = new URL(req.url());
        if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:' && reqUrl.protocol !== 'data:') {
          return req.abort('accessdenied');
        }
        if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1' || reqUrl.hostname === '169.254.169.254') {
          return req.abort('accessdenied');
        }
        req.continue();
      } catch (_) {
        req.abort('failed');
      }
    });

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT, 'md_' + uuidv4() + '.pdf');
    await page.pdf({ path: outPath, format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
    return outPath;
  });
}

async function getDocStats(filePath) {
  const bytes   = fs.readFileSync(filePath);
  const parsed  = await pdfParse(bytes);
  const { PDFDocument: PD } = require('pdf-lib');
  const doc     = await PD.load(bytes);

  const text  = (parsed.text || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences    = text.split(/[.!?]+/).filter(s => s.trim()).length;
  const paragraphs   = text.split(/\n\n+/).filter(p => p.trim()).length;
  const pages        = doc.getPageCount();

  const wordsPerMin  = 220;
  const readTimeSec  = Math.ceil((words / wordsPerMin) * 60);
  const readTimeMin  = Math.floor(readTimeSec / 60);
  const readTimeSec2 = readTimeSec % 60;

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    const matches = word.match(/[aeiouy]+/g);
    return matches ? matches.length : 1;
  }
  const wordList = text.split(/\s+/).filter(Boolean);
  const syllables = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  const fleschScore = sentences > 0 && words > 0
    ? Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words))
    : null;

  const readabilityLabel = fleschScore === null ? 'N/A'
    : fleschScore >= 90 ? 'Rất dễ đọc'
    : fleschScore >= 70 ? 'Dễ đọc'
    : fleschScore >= 60 ? 'Bình thường'
    : fleschScore >= 50 ? 'Khó vừa'
    : fleschScore >= 30 ? 'Khó'
    : 'Rất khó';

  return {
    pages,
    words,
    chars,
    charsNoSpace,
    sentences,
    paragraphs,
    readTime:      readTimeMin + 'p ' + readTimeSec2 + 's',
    readTimeMin:   readTimeMin,
    sizeKb:        Math.round(bytes.length / 1024),
    fleschScore,
    readability:   readabilityLabel,
    hasText:       words > 50,
    avgWordsPerPage: pages > 0 ? Math.round(words / pages) : 0,
  };
}

async function jsonToExcel(jsonData, opts = {}) {
  const { sheetName = 'Sheet1' } = opts;
  let data;
  if (typeof jsonData === 'string') {
    data = JSON.parse(jsonData);
  } else {
    data = jsonData;
  }
  if (!Array.isArray(data)) throw new Error('JSON phải là array of objects (danh sách bản ghi)');

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const outPath = path.join(OUT, 'json_' + uuidv4() + '.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

async function csvToExcel(csvPath) {
  const wb = XLSX.readFile(csvPath);
  const outPath = path.join(OUT, 'csv_' + uuidv4() + '.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

module.exports = {
  imagesToPdf,
  pdfToImages,
  urlToPdf,
  markdownToPdf,
  getDocStats,
  jsonToExcel,
  csvToExcel,
};
