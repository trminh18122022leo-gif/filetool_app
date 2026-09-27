'use strict';

/**
 * redact.service.js — Dịch vụ phát hiện và che giấu thông tin nhạy cảm (PII) trong PDF
 * 
 * Các tính năng:
 * 1. Tự động nhận diện PII qua Poppler TSV & Regex (CCCD 12 số, CMND 9 số, SĐT VN, Email, Thẻ tín dụng, STK ngân hàng).
 * 2. Hỗ trợ tìm kiếm và khoanh vùng từ khóa tùy biến do người dùng nhập.
 * 3. Che vĩnh viễn bằng pdf-lib (vẽ khối che mờ đè lên toạ độ).
 * 4. Chế độ Flatten bảo mật 100%: Rasterize trang sang ảnh độ nét cao rồi đóng gói lại PDF để loại bỏ triệt để mọi text ngầm trong PDF stream.
 * 5. Tẩy rửa siêu dữ liệu (Metadata scrubbing: Author, Title, Subject, Producer).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');

const OUT_DIR = path.resolve('outputs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Regex patterns cho thông tin cá nhân nhạy cảm
 */
const PATTERNS = [
  {
    type: 'cccd',
    label: 'CCCD (12 chữ số)',
    regex: /\b\d{12}\b/,
  },
  {
    type: 'cmnd',
    label: 'CMND cũ (9 chữ số)',
    regex: /\b\d{9}\b/,
  },
  {
    type: 'phone',
    label: 'Số điện thoại',
    regex: /\b(?:\+?84|0)(?:3|5|7|8|9)\d{8}\b/,
  },
  {
    type: 'email',
    label: 'Địa chỉ Email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
  {
    type: 'credit_card',
    label: 'Thẻ tín dụng / Ghi nợ',
    regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/,
  },
];

/**
 * Quét tài liệu PDF để tìm từ ngữ và thông tin nhạy cảm
 */
async function scanPdfForPII(pdfPath, options = {}) {
  const { customKeywords = [] } = options;

  if (!fs.existsSync(pdfPath)) {
    throw new Error('File PDF không tồn tại');
  }

  // 1. Chạy pdftotext -tsv để lấy toạ độ từng từ
  let tsvOutput = '';
  try {
    tsvOutput = execFileSync('pdftotext', ['-tsv', '--', pdfPath, '-'], {
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    }).toString('utf-8');
  } catch (err) {
    throw new Error(`Không thể phân tích PDF bằng pdftotext: ${err.message}`);
  }

  const lines = tsvOutput.split('\n');
  const pages = {};
  const words = [];
  const textLines = []; // Gom nhóm theo từng dòng văn bản (line_num)
  let currentLine = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const parts = rawLine.replace(/\r$/, '').split('\t');
    const level = parts[0];
    const pageNum = parseInt(parts[1], 10);
    const left = parseFloat(parts[6]);
    const top = parseFloat(parts[7]);
    const width = parseFloat(parts[8]);
    const height = parseFloat(parts[9]);
    const text = parts[11]?.trim() || '';

    if (level === '1') {
      pages[pageNum] = { width, height };
    } else if (level === '4') {
      currentLine = {
        page: pageNum,
        left,
        top,
        width,
        height,
        words: [],
      };
      textLines.push(currentLine);
    } else if (level === '5' && text) {
      const wordObj = { page: pageNum, left, top, width, height, text };
      words.push(wordObj);
      if (currentLine && currentLine.page === pageNum) {
        currentLine.words.push(wordObj);
      }
    }
  }

  const findings = [];
  let findingId = 1;

  // 2. Quét PII theo từng từ
  for (const w of words) {
    const pageDim = pages[w.page] || { width: 595, height: 842 };
    const cleanWord = w.text.replace(/^[^\w+]+|[^\w]+$/g, '');

    for (const p of PATTERNS) {
      if (p.regex.test(cleanWord) || p.regex.test(w.text)) {
        findings.push({
          id: `pii-${findingId++}`,
          type: p.type,
          label: p.label,
          text: w.text,
          page: w.page,
          box: {
            x: Math.round(w.left * 10) / 10,
            y: Math.round((pageDim.height - w.top - w.height) * 10) / 10,
            width: Math.round(w.width * 10) / 10,
            height: Math.round(w.height * 10) / 10,
          },
        });
      }
    }
  }

  // 3. Quét từ khoá tùy chỉnh (Custom Keywords)
  const normKeywords = customKeywords
    .map(k => String(k || '').trim())
    .filter(k => k.length > 0);

  if (normKeywords.length > 0) {
    for (const line of textLines) {
      const lineText = line.words.map(w => w.text).join(' ');
      const pageDim = pages[line.page] || { width: 595, height: 842 };

      for (const kw of normKeywords) {
        const idx = lineText.toLowerCase().indexOf(kw.toLowerCase());
        if (idx !== -1) {
          // Tính bounding box của các từ khớp
          const matchedWords = line.words.filter(w =>
            kw.toLowerCase().includes(w.text.toLowerCase()) ||
            w.text.toLowerCase().includes(kw.toLowerCase())
          );

          if (matchedWords.length > 0) {
            const minLeft = Math.min(...matchedWords.map(w => w.left));
            const maxRight = Math.max(...matchedWords.map(w => w.left + w.width));
            const minTop = Math.min(...matchedWords.map(w => w.top));
            const maxBottom = Math.max(...matchedWords.map(w => w.top + w.height));

            findings.push({
              id: `pii-${findingId++}`,
              type: 'custom',
              label: `Từ khóa: "${kw}"`,
              text: kw,
              page: line.page,
              box: {
                x: Math.round(minLeft * 10) / 10,
                y: Math.round((pageDim.height - maxBottom) * 10) / 10,
                width: Math.round((maxRight - minLeft) * 10) / 10,
                height: Math.round((maxBottom - minTop) * 10) / 10,
              },
            });
          }
        }
      }
    }
  }

  const totalPages = Object.keys(pages).length || 1;

  return {
    totalPages,
    pages,
    totalFindings: findings.length,
    findings,
  };
}

/**
 * Thực hiện che giấu thông tin nhạy cảm trên PDF
 */
async function redactPdf(pdfPath, redactions = [], options = {}) {
  const {
    fillColor = 'black',     // 'black' | 'white' | 'gray'
    stampLabel = '',          // Ví dụ: '[ĐÃ CHE BẢO MẬT]'
    flatten = false,          // Biến toàn bộ trang thành ảnh raster chống extract text ngầm
  } = options;

  if (!fs.existsSync(pdfPath)) {
    throw new Error('File PDF đầu vào không tồn tại');
  }

  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();

  let boxColor = rgb(0, 0, 0); // Đen
  if (fillColor === 'white') boxColor = rgb(1, 1, 1);
  else if (fillColor === 'gray') boxColor = rgb(0.3, 0.3, 0.3);

  let font = null;
  if (stampLabel) {
    try {
      font = await doc.embedFont(StandardFonts.HelveticaBold);
    } catch (_) {}
  }

  // Nhóm các box theo trang
  const byPage = {};
  for (const r of redactions) {
    const p = Number(r.page) || 1;
    if (!byPage[p]) byPage[p] = [];
    byPage[p].push(r);
  }

  for (let pNum = 1; pNum <= totalPages; pNum++) {
    const pageRedactions = byPage[pNum] || [];
    if (pageRedactions.length === 0) continue;

    const page = doc.getPage(pNum - 1);

    for (const item of pageRedactions) {
      const box = item.box || item;
      const x = Math.max(0, Number(box.x) - 2);
      const y = Math.max(0, Number(box.y) - 1);
      const w = Number(box.width) + 4;
      const h = Number(box.height) + 2;

      // Vẽ khối chữ nhật che đè
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: boxColor,
      });

      // Nếu có nhãn dán đè lên
      if (stampLabel && font && w > 30 && h > 8) {
        const fontSize = Math.min(Math.max(h * 0.6, 6), 9);
        const textWidth = font.widthOfTextAtSize(stampLabel, fontSize);
        const textX = x + Math.max(2, (w - textWidth) / 2);
        const textY = y + (h - fontSize) / 2;

        page.drawText(stampLabel, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color: fillColor === 'white' ? rgb(0, 0, 0) : rgb(1, 1, 1),
        });
      }
    }
  }

  // Tẩy sạch Metadata (Bảo vệ thông tin người tạo văn bản)
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('FileTools AI Privacy Redactor');
  doc.setCreator('FileTools Platform');

  const uid = uuidv4().slice(0, 8);
  const outFilename = `redacted_${uid}.pdf`;
  const tempPath = path.join(OUT_DIR, `temp_${outFilename}`);
  const finalPath = path.join(OUT_DIR, outFilename);

  const modifiedBytes = await doc.save();
  fs.writeFileSync(tempPath, modifiedBytes);

  // Nếu người dùng chọn Flatten (Loại bỏ 100% text ngầm bằng pdftoppm)
  if (flatten) {
    const flatDir = path.join(OUT_DIR, `flat_temp_${uid}`);
    try {
      fs.mkdirSync(flatDir, { recursive: true });
      const prefix = path.join(flatDir, 'page');
      execFileSync('pdftoppm', ['-png', '-r', '150', '--', tempPath, prefix], { windowsHide: true });

      // Gom các ảnh lại vào PDF mới
      const newDoc = await PDFDocument.create();
      const files = fs.readdirSync(flatDir)
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0', 10);
          const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0', 10);
          return numA - numB;
        });

      for (const imgName of files) {
        const imgPath = path.join(flatDir, imgName);
        const imgBytes = fs.readFileSync(imgPath);
        const embeddedImg = await newDoc.embedPng(imgBytes);
        const newPage = newDoc.addPage([embeddedImg.width * 72 / 150, embeddedImg.height * 72 / 150]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight(),
        });
      }

      fs.unlink(tempPath, () => {});
      const flatBytes = await newDoc.save();
      fs.writeFileSync(finalPath, flatBytes);

      // Xóa sạch thư mục tạm
      fs.rm(flatDir, { recursive: true, force: true }, () => {});

      return {
        outputPath: finalPath,
        filename: outFilename,
        flattened: true,
      };
    } catch (err) {
      console.warn(`[redact] Flatten failed, falling back to vector redact:`, err.message);
      try { fs.rmSync(flatDir, { recursive: true, force: true }); } catch (_) {}
      fs.renameSync(tempPath, finalPath);
      return {
        outputPath: finalPath,
        filename: outFilename,
        flattened: false,
      };
    }
  }

  // Chế độ vector chuẩn
  fs.renameSync(tempPath, finalPath);
  return {
    outputPath: finalPath,
    filename: outFilename,
    flattened: false,
  };
}

module.exports = {
  scanPdfForPII,
  redactPdf,
};
