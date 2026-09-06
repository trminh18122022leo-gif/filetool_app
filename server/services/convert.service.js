/**
 * Convert Service — Image→PDF, PDF→Images, URL→PDF, Markdown→PDF, Doc Stats, JSON/CSV→Excel
 */
'use strict';

const { PDFDocument }   = require('pdf-lib');
const { execSync }      = require('child_process');
const pdfParse          = require('pdf-parse');
const puppeteer         = require('puppeteer');
const sharp             = require('sharp');
const path              = require('path');
const fs                = require('fs');
const archiver          = require('archiver');
const XLSX              = require('xlsx');
const { v4: uuidv4 }    = require('uuid');

const OUT = path.resolve('outputs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

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
  try {
    execSync([
      gsCmd, '-dNOPAUSE', '-dBATCH', '-dQUIET',
      '-sDEVICE=' + gsDev,
      '-r' + dpi,
      '-sOutputFile="' + tmpDir + '/page_%04d.' + ext + '"',
      '"' + pdfPath + '"',
    ].join(' '));
  } catch (err) {
    throw new Error('Ghostscript không khả dụng hoặc lỗi: ' + err.message);
  }

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

async function urlToPdf(url, opts = {}) {
  const { format = 'A4', printBackground = true, waitUntil = 'networkidle0' } = opts;
  try { new URL(url); } catch { throw new Error('URL không hợp lệ'); }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil, timeout: 30000 });

    const outPath = path.join(OUT, 'url_' + uuidv4() + '.pdf');
    await page.pdf({
      path: outPath,
      format,
      printBackground,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    return outPath;
  } finally {
    await browser.close();
  }
}

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

  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + (THEMES[theme] || THEMES.github) + '</style></head><body>' + htmlContent + '</body></html>';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT, 'md_' + uuidv4() + '.pdf');
    await page.pdf({ path: outPath, format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
    return outPath;
  } finally {
    await browser.close();
  }
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
