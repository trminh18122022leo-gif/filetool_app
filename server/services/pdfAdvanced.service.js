/**
 * PDF Advanced Service
 * Markdown · Scan · Compare · Reorder · Crop · Excel · PowerPoint
 * Add Image · Flatten · PDF/A · Repair · Insert Pages
 */
'use strict';

const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { execFileSync }  = require('child_process');
const pdfParse      = require('pdf-parse');
const sharp         = require('sharp');
const { withPage }  = require('../utils/browser');
const path          = require('path');
const fs            = require('fs');
const archiver      = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { callAI }    = require('./ai.service');

const OUT = path.resolve('outputs');

function getGsCmd() {
  return process.platform === 'win32' ? 'gswin64c' : 'gs';
}

function runSafe(executable, args = []) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Lệnh thực thi thất bại: ${executable} ${args.join(' ')}\nChi tiết: ${err.stderr?.toString() || err.message}`);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 1. PDF → MARKDOWN ─────────────────────────────────────────────────────────

async function pdfToMarkdown(pdfPath, opts = {}) {
  const { language = 'vi' } = opts;
  const bytes  = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(bytes);
  const doc    = await PDFDocument.load(bytes);
  const text   = parsed.text.trim();

  if (!text || text.length < 10) {
    throw new Error('PDF không có nội dung text. Nếu là PDF scan, hãy dùng tính năng OCR trước.');
  }

  // Dùng AI để chuyển đổi sang Markdown giữ nguyên cấu trúc
  const prompt = `Chuyển đổi nội dung tài liệu sau sang định dạng Markdown chuẩn đẹp.
Yêu cầu:
- Dùng ## và ### cho tiêu đề, căn theo cấu trúc văn bản
- Dùng ** ** cho chữ đậm, * * cho chữ nghiêng
- Chuyển danh sách thành - item hoặc 1. item
- Chuyển bảng thành Markdown table | col1 | col2 |
- Dùng \`code\` cho code inline, \`\`\`lang cho code block
- Dùng > cho quote/blockquote
- Giữ nguyên ngôn ngữ ${language === 'vi' ? 'tiếng Việt' : 'English'}
- KHÔNG thêm nội dung, KHÔNG giải thích hay thêm lời chào — chỉ chuyển đổi format

NỘI DUNG VĂN BẢN:
${text.slice(0, 8000)}`;

  let mdContent = '';
  try {
    mdContent = await callAI(prompt, {
      system: 'Chỉ trả về Markdown thuần túy. Không có giải thích hay markdown code block bao ngoài.',
      maxTokens: 4000,
      textLength: text.length,
    });
  } catch (err) {
    console.warn('[pdfAdvanced] AI conversion error, fallback to simple markdown:', err.message);
    mdContent = text.split('\n\n').map(p => p.trim()).filter(Boolean).join('\n\n');
  }

  const outPath = path.join(OUT, `doc_${uuidv4()}.md`);
  const title = doc.getTitle() || path.basename(pdfPath, '.pdf');
  const header = `# ${title}

> Chuyển đổi từ PDF · ${doc.getPageCount()} trang · ${new Date().toLocaleDateString('vi-VN')}

---

`;
  fs.writeFileSync(outPath, header + mdContent, 'utf-8');
  return { path: outPath, wordCount: mdContent.split(/\s+/).filter(Boolean).length };
}

// ── 2. SCAN ẢNH → PDF (SMART SCAN) ──────────────────────────────────────────

async function scanToPdf(imagePaths, opts = {}) {
  const {
    mode       = 'auto',    // 'auto' | 'color' | 'grayscale' | 'blackwhite'
    enhance    = true,      // auto-enhance quality
    searchable = true,      // chạy OCR để có text layer
    paperSize  = 'A4',      // 'A4' | 'Letter' | 'auto'
  } = opts;

  const PAGE_SIZES = {
    A4:     [595, 842],
    Letter: [612, 792],
  };

  const doc = await PDFDocument.create();

  for (const imgPath of imagePaths) {
    let pipeline = sharp(imgPath);

    if (enhance) {
      pipeline = pipeline.normalize().sharpen({ sigma: 1.2, m1: 0.5, m2: 0.5 });
    }

    if (mode === 'grayscale') {
      pipeline = pipeline.grayscale();
    } else if (mode === 'blackwhite') {
      pipeline = pipeline.grayscale().threshold(128);
    }

    pipeline = pipeline.rotate(); // Auto-orient from EXIF

    const [pw, ph] = PAGE_SIZES[paperSize] || PAGE_SIZES.A4;
    const SCALE_DPI = 2;
    const maxW = pw * SCALE_DPI;
    const maxH = ph * SCALE_DPI;

    pipeline = pipeline.resize(maxW, maxH, { fit: 'inside', withoutEnlargement: true });

    const enhancedBuf = await pipeline.jpeg({ quality: 92, progressive: true }).toBuffer();
    const img = await doc.embedJpg(enhancedBuf);
    const { width: iw, height: ih } = img.scale(1);

    let pageW, pageH;
    if (paperSize === 'auto') {
      pageW = iw / SCALE_DPI;
      pageH = ih / SCALE_DPI;
    } else {
      [pageW, pageH] = PAGE_SIZES[paperSize];
    }

    const scale = Math.min((pageW - 40) / iw, (pageH - 40) / ih);
    const drawW = iw * scale;
    const drawH = ih * scale;
    const drawX = (pageW - drawW) / 2;
    const drawY = (pageH - drawH) / 2;

    const page = doc.addPage([pageW, pageH]);
    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
  }

  const outPath = path.join(OUT, `scan_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await doc.save());

  return { path: outPath, pageCount: imagePaths.length };
}

// ── 3. SO SÁNH PDF (TEXT DIFF) ────────────────────────────────────────────────

async function comparePdfText(pdfPath1, pdfPath2, opts = {}) {
  const { outputFormat = 'pdf' } = opts; // 'pdf' | 'html' | 'json'

  const [parsed1, parsed2] = await Promise.all([
    pdfParse(fs.readFileSync(pdfPath1)),
    pdfParse(fs.readFileSync(pdfPath2)),
  ]);

  const text1 = (parsed1.text || '').trim();
  const text2 = (parsed2.text || '').trim();

  const Diff = require('diff');
  const diffs = Diff.diffLines(text1, text2, { newlineIsToken: false });

  const added     = diffs.filter(d => d.added).reduce((s, d) => s + (d.count || 1), 0);
  const removed   = diffs.filter(d => d.removed).reduce((s, d) => s + (d.count || 1), 0);
  const unchanged = diffs.filter(d => !d.added && !d.removed).reduce((s, d) => s + (d.count || 1), 0);
  const total     = added + removed + unchanged;
  const similarity = total > 0 ? Math.round((unchanged / total) * 100) : 100;

  if (outputFormat === 'json') {
    return { diffs, stats: { added, removed, unchanged, similarity } };
  }

  const diffHtml = diffs.map(part => {
    if (part.added) {
      return `<div class="line added"><span class="marker">+</span><pre>${escapeHtml(part.value)}</pre></div>`;
    }
    if (part.removed) {
      return `<div class="line removed"><span class="marker">-</span><pre>${escapeHtml(part.value)}</pre></div>`;
    }
    const lines = part.value.split('\n');
    if (lines.length <= 4) {
      return `<div class="line unchanged"><span class="marker"> </span><pre>${escapeHtml(part.value)}</pre></div>`;
    }
    return `<div class="line collapsed">... ${lines.length - 2} dòng không thay đổi ...</div>
<div class="line unchanged"><span class="marker"> </span><pre>${escapeHtml(lines.slice(-2).join('\n'))}</pre></div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding-bottom: 40px; }
  .header { background: #1e293b; padding: 24px 32px; border-bottom: 1px solid #334155; }
  h1 { font-size: 20px; color: #f8fafc; }
  .files { display: flex; gap: 16px; margin-top: 14px; font-size: 13px; }
  .file { background: #0f172a; padding: 8px 16px; border-radius: 8px; color: #94a3b8; border: 1px solid #334155; }
  .file span { color: #38bdf8; font-weight: 600; }
  .stats { display: flex; gap: 16px; margin-top: 16px; }
  .stat { background: #0f172a; padding: 12px 20px; border-radius: 10px; text-align: center; border: 1px solid #334155; flex: 1; }
  .stat .val { font-size: 22px; font-weight: 700; font-family: monospace; }
  .stat .lbl { font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; font-weight: 600; }
  .sim-bar { height: 6px; background: #334155; border-radius: 3px; margin-top: 16px; overflow: hidden; }
  .sim-fill { height: 100%; border-radius: 3px; background: linear-gradient(to right, #ef4444, #3b82f6, #22c55e); }
  .diff { padding: 20px 32px; }
  .line { display: flex; gap: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.6; }
  .line pre { flex: 1; white-space: pre-wrap; word-break: break-all; }
  .marker { width: 16px; flex-shrink: 0; font-weight: 700; padding-top: 2px; }
  .added   { background: #064e3b; border-left: 3px solid #10b981; padding: 4px 8px 4px 12px; border-radius: 4px; margin-bottom: 2px; }
  .added .marker { color: #34d399; }
  .removed { background: #450a0a; border-left: 3px solid #ef4444; padding: 4px 8px 4px 12px; border-radius: 4px; margin-bottom: 2px; }
  .removed .marker { color: #f87171; }
  .unchanged { padding: 2px 8px 2px 15px; color: #64748b; }
  .collapsed { padding: 4px 8px 4px 15px; color: #475569; background: #1e293b; font-style: italic; font-size: 12px; border-radius: 4px; margin: 4px 0; }
</style></head><body>
<div class="header">
  <h1>🔍 So Sánh Nội Dung PDF (Diff Report)</h1>
  <div class="files">
    <div class="file">File 1: <span>${path.basename(pdfPath1)}</span></div>
    <div class="file">File 2: <span>${path.basename(pdfPath2)}</span></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="val" style="color:#10b981">+${added}</div><div class="lbl">Dòng thêm vào</div></div>
    <div class="stat"><div class="val" style="color:#ef4444">-${removed}</div><div class="lbl">Dòng bị xóa</div></div>
    <div class="stat"><div class="val" style="color:#64748b">${unchanged}</div><div class="lbl">Không đổi</div></div>
    <div class="stat"><div class="val" style="color:#38bdf8">${similarity}%</div><div class="lbl">Độ tương đồng</div></div>
  </div>
  <div class="sim-bar"><div class="sim-fill" style="width:${similarity}%"></div></div>
</div>
<div class="diff">${diffHtml}</div>
</body></html>`;

  if (outputFormat === 'html') {
    const outPath = path.join(OUT, `compare_${uuidv4()}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    return { path: outPath, stats: { added, removed, unchanged, similarity } };
  }

  // xuat file pdf diff
  return await withPage(async (page) => {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT, `compare_${uuidv4()}.pdf`);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    return { path: outPath, stats: { added, removed, unchanged, similarity } };
  });
}

// 4. html file -> pdf
async function htmlFileToPdf(htmlPath, opts = {}) {
  const { format = 'A4' } = opts;
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  return await withPage(async (page) => {
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT, `html2pdf_${uuidv4()}.pdf`);
    await page.pdf({
      path: outPath,
      format,
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return outPath;
  });
}

// ── 5. SẮP XẾP LẠI TRANG (REORDER) ──────────────────────────────────────────

async function reorderPages(pdfPath, newOrder) {
  const bytes  = fs.readFileSync(pdfPath);
  const srcDoc = await PDFDocument.load(bytes);
  const total  = srcDoc.getPageCount();

  const validOrder = newOrder.map(n => Number(n) - 1).filter(n => n >= 0 && n < total);
  if (!validOrder.length) throw new Error('Thứ tự trang không hợp lệ');

  const newDoc = await PDFDocument.create();
  const pages  = await newDoc.copyPages(srcDoc, validOrder);
  pages.forEach(p => newDoc.addPage(p));

  const outPath = path.join(OUT, `reordered_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await newDoc.save());
  return { path: outPath, pageCount: validOrder.length };
}

// ── 6. CẮT PDF (CROP) ─────────────────────────────────────────────────────────

async function cropPdf(pdfPath, cropOpts) {
  const { x = 0, y = 0, width, height, pages = 'all' } = cropOpts;
  const bytes = fs.readFileSync(pdfPath);
  const doc   = await PDFDocument.load(bytes);
  const total = doc.getPageCount();

  const indices = pages === 'all'
    ? Array.from({ length: total }, (_, i) => i)
    : String(pages).split(',').map(n => parseInt(n.trim(), 10) - 1).filter(n => n >= 0 && n < total);

  indices.forEach(i => {
    const page = doc.getPage(i);
    const { width: pw, height: ph } = page.getSize();

    const cx = Math.max(0, Math.min(Number(x), pw));
    const cy = Math.max(0, Math.min(Number(y), ph));
    const cw = Math.min(Number(width), pw - cx);
    const ch = Math.min(Number(height), ph - cy);

    page.setCropBox(cx, cy, cw, ch);
  });

  const outPath = path.join(OUT, `cropped_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await doc.save());
  return { path: outPath, pagesProcessed: indices.length };
}

// ── 7. PDF → EXCEL (EXTRACT TABLES) ──────────────────────────────────────────

async function pdfToExcel(pdfPath, opts = {}) {
  const { language = 'vi' } = opts;
  const bytes  = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(bytes);
  const text   = parsed.text.trim();

  if (!text) throw new Error('Không đọc được text từ PDF. Vui lòng dùng OCR trước với PDF dạng scan.');

  const prompt = `Trích xuất TẤT CẢ các bảng biểu (table) từ văn bản sau thành cấu trúc JSON.
Trả về định dạng JSON array hợp lệ, KHÔNG thêm bất kỳ giải thích nào:
[
  {
    "title": "Tên bảng",
    "headers": ["Cột 1", "Cột 2", "Cột 3"],
    "rows": [
      ["Ô A1", "Ô B1", "Ô C1"],
      ["Ô A2", "Ô B2", "Ô C2"]
    ]
  }
]

Nếu không có bảng nào rõ ràng, trả về [].
Giữ nguyên ngôn ngữ ${language === 'vi' ? 'tiếng Việt' : 'English'}.

VĂN BẢN:
${text.slice(0, 8000)}`;

  let tables = [];
  try {
    const tablesJson = await callAI(prompt, {
      system: 'Chỉ trả về JSON array hợp lệ. Không có markdown code block.',
      maxTokens: 3000,
    });
    tables = JSON.parse(tablesJson.replace(/```json|```/g, '').trim());
    if (!Array.isArray(tables)) tables = [];
  } catch (err) {
    tables = [];
  }

  if (!tables.length) {
    tables = [{
      title: 'Nội dung trích xuất',
      headers: ['Nội dung'],
      rows: text.split('\n').map(l => l.trim()).filter(Boolean).map(line => [line]),
    }];
  }

  const XLSX = require('xlsx');
  const wb   = XLSX.utils.book_new();

  tables.forEach((table, idx) => {
    const sheetName = (table.title || `Bảng ${idx + 1}`).slice(0, 31).replace(/[\\/?*:[\]]/g, '_');
    const data      = [table.headers || [], ...(table.rows || [])];
    const ws        = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const outPath = path.join(OUT, `pdf2excel_${uuidv4()}.xlsx`);
  XLSX.writeFile(wb, outPath);
  return { path: outPath, tableCount: tables.length };
}

// ── 8. PDF → POWERPOINT ───────────────────────────────────────────────────────

async function pdfToPptx(pdfPath, opts = {}) {
  const { dpi = 150 } = opts;
  const tmpDir = path.join('uploads', `p2pptx_${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const gsCmd = getGsCmd();
  runSafe(gsCmd, [
    '-dNOPAUSE', '-dBATCH', '-dQUIET',
    '-sDEVICE=jpeg', `-r${dpi}`,
    `-sOutputFile=${path.join(tmpDir, 'slide_%04d.jpg')}`,
    pdfPath,
  ]);

  const slides = fs.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).sort();
  if (!slides.length) throw new Error('Không render được trang PDF thành slide.');

  const pptxgenjs = require('pptxgenjs');
  const prs = new pptxgenjs();
  prs.layout = 'LAYOUT_WIDE';

  for (const slideFile of slides) {
    const slidePath = path.join(tmpDir, slideFile);
    const slide     = prs.addSlide();
    const imgBuf    = fs.readFileSync(slidePath);
    const b64       = imgBuf.toString('base64');

    slide.addImage({
      data: `image/jpeg;base64,${b64}`,
      x: 0, y: 0,
      w: '100%', h: '100%',
      sizing: { type: 'contain', w: 10, h: 5.63 },
    });
  }

  const outPath = path.join(OUT, `pdf2pptx_${uuidv4()}.pptx`);
  await prs.writeFile({ fileName: outPath });

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  return { path: outPath, slideCount: slides.length };
}

// ── 9. THÊM ẢNH VÀO PDF ──────────────────────────────────────────────────────

async function addImageToPdf(pdfPath, imagePath, opts = {}) {
  const {
    page    = 0,
    x       = 50,
    y       = 50,
    width   = 200,
    height  = 150,
    opacity = 1,
  } = opts;

  const bytes  = fs.readFileSync(pdfPath);
  const doc    = await PDFDocument.load(bytes);
  const pages  = doc.getPages();
  const pageIdx = Math.max(0, Math.min(Number(page), pages.length - 1));
  const target = pages[pageIdx];
  const { height: ph } = target.getSize();

  const imgBytes = fs.readFileSync(imagePath);
  const ext      = path.extname(imagePath).toLowerCase();
  const img      = ext === '.png'
    ? await doc.embedPng(imgBytes)
    : await doc.embedJpg(imgBytes);

  const drawY = ph - Number(y) - Number(height);

  target.drawImage(img, {
    x:       Number(x),
    y:       Math.max(0, drawY),
    width:   Number(width),
    height:  Number(height),
    opacity: Number(opacity),
  });

  const outPath = path.join(OUT, `img_added_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await doc.save());
  return { path: outPath };
}

// ── 10. FLATTEN PDF ───────────────────────────────────────────────────────────

function flattenPdf(pdfPath) {
  const outPath = path.join(OUT, `flattened_${uuidv4()}.pdf`);
  const gsCmd   = getGsCmd();
  runSafe(gsCmd, [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-sOutputFile=${outPath}`,
    pdfPath,
  ]);
  return { path: outPath };
}

// ── 11. CHUYỂN SANG PDF/A (ARCHIVAL) ─────────────────────────────────────────

function toPdfA(pdfPath, opts = {}) {
  const { level = '2b' } = opts;
  const levelMap = { '1b': 1, '2b': 2, '3b': 3 };
  const pdfa = levelMap[level] || 2;

  const outPath = path.join(OUT, `pdfa_${uuidv4()}.pdf`);
  const gsCmd   = getGsCmd();
  runSafe(gsCmd, [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite',
    `-dPDFA=${pdfa}`,
    '-sProcessColorModel=DeviceRGB',
    '-sPDFACompatibilityPolicy=1',
    `-sOutputFile=${outPath}`,
    pdfPath,
  ]);

  return { path: outPath, level };
}

// ── 12. REPAIR PDF ────────────────────────────────────────────────────────────

function repairPdf(pdfPath) {
  const outPath = path.join(OUT, `repaired_${uuidv4()}.pdf`);
  const gsCmd   = getGsCmd();
  try {
    runSafe(gsCmd, [
      '-dBATCH', '-dNOPAUSE', '-dQUIET',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dAutoRotatePages=/None',
      `-sOutputFile=${outPath}`,
      pdfPath,
    ]);
  } catch (err) {
    try {
      runSafe('qpdf', ['--replace-input', '--coalesce-contents', pdfPath, outPath]);
    } catch {
      throw new Error('Không thể sửa chữa file này. File có thể bị hỏng cấu trúc hoàn toàn.');
    }
  }

  const origSize = fs.statSync(pdfPath).size;
  const newSize  = fs.statSync(outPath).size;
  return { path: outPath, origSize, newSize };
}

// ── 13. CHÈN TRANG VÀO VỊ TRÍ CỤ THỂ ────────────────────────────────────────

async function insertPages(basePdfPath, insertPdfPath, afterPage = 0) {
  const [baseBytes, insertBytes] = await Promise.all([
    fs.readFileSync(basePdfPath),
    fs.readFileSync(insertPdfPath),
  ]);

  const baseDoc   = await PDFDocument.load(baseBytes);
  const insertDoc = await PDFDocument.load(insertBytes);
  const finalDoc  = await PDFDocument.create();

  const baseTotal   = baseDoc.getPageCount();
  const insertTotal = insertDoc.getPageCount();
  const insertAfter = Math.max(0, Math.min(Number(afterPage), baseTotal));

  // Trang 1 → insertAfter từ base
  if (insertAfter > 0) {
    const beforePages = await finalDoc.copyPages(baseDoc, Array.from({ length: insertAfter }, (_, i) => i));
    beforePages.forEach(p => finalDoc.addPage(p));
  }

  // Tất cả trang từ insert file
  const insertedPages = await finalDoc.copyPages(insertDoc, insertDoc.getPageIndices());
  insertedPages.forEach(p => finalDoc.addPage(p));

  // Trang còn lại từ base
  if (insertAfter < baseTotal) {
    const afterPages = await finalDoc.copyPages(
      baseDoc,
      Array.from({ length: baseTotal - insertAfter }, (_, i) => i + insertAfter)
    );
    afterPages.forEach(p => finalDoc.addPage(p));
  }

  const outPath = path.join(OUT, `inserted_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await finalDoc.save());
  return {
    path: outPath,
    totalPages: baseTotal + insertTotal,
    insertedPages: insertTotal,
    insertedAfter: insertAfter,
  };
}

module.exports = {
  pdfToMarkdown,
  scanToPdf,
  comparePdfText,
  htmlFileToPdf,
  reorderPages,
  cropPdf,
  pdfToExcel,
  pdfToPptx,
  addImageToPdf,
  flattenPdf,
  toPdfA,
  repairPdf,
  insertPages,
};
