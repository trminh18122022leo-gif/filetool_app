'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Tạo mục lục tự động cho PDF.
 * 
 * Pipeline:
 * 1. Đọc text và cấu trúc PDF qua pdf-parse
 * 2. Phân tích heading bằng pattern / heuristic hoặc AI
 * 3. Render trang mục lục đẹp chèn vào đầu file PDF
 */
async function generateTOC(pdfPath, opts = {}) {
  const { title = 'MỤC LỤC', useAI = false } = opts;

  const pdfBytes = fs.readFileSync(pdfPath);
  const parsed   = await pdfParse(pdfBytes);

  // 1. Tìm các heading
  let headings = [];
  if (useAI) {
    headings = await detectWithAI(parsed.text.slice(0, 8000));
  }
  if (!headings.length) {
    headings = detectByHeuristic(parsed.text);
  }

  if (!headings.length) {
    throw new Error('Không phát hiện được tiêu đề/mục lục nào trong tài liệu.');
  }

  // 2. Tạo trang TOC và chèn vào PDF
  const doc      = await PDFDocument.load(pdfBytes);
  const font     = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width: pw, height: ph } = doc.getPages()[0].getSize();
  const tocPage = doc.insertPage(0, [pw, ph]);

  // Tiêu đề trang TOC
  tocPage.drawText(title, {
    x:     pw / 2 - 50,
    y:     ph - 70,
    size:  20,
    font:  fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Đường kẻ phân cách
  tocPage.drawLine({
    start: { x: 50, y: ph - 85 },
    end:   { x: pw - 50, y: ph - 85 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Danh sách các mục
  let currentY = ph - 120;
  const lineH  = 26;

  for (const item of headings.slice(0, 22)) { // tối đa 22 mục / trang
    const indent = (item.level - 1) * 16;
    const fontSize = item.level === 1 ? 12 : 10;
    const itemFont = item.level === 1 ? fontBold : font;

    // Tên mục
    const safeText = item.text.slice(0, 48);
    tocPage.drawText(safeText, {
      x:     50 + indent,
      y:     currentY,
      size:  fontSize,
      font:  itemFont,
      color: rgb(0.15, 0.15, 0.15),
    });

    // Số trang nếu có
    if (item.page) {
      const pageStr = String(item.page + 1); // +1 vì đã chèn trang TOC
      tocPage.drawText(pageStr, {
        x:     pw - 70,
        y:     currentY,
        size:  fontSize,
        font:  itemFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Dấu chấm nối (...)
      const textWidth = font.widthOfTextAtSize(safeText, fontSize);
      const dotsStart = 55 + indent + textWidth;
      const dotsEnd   = pw - 80;
      let dotX        = dotsStart;
      while (dotX < dotsEnd) {
        tocPage.drawText('.', { x: dotX, y: currentY, size: 9, font, color: rgb(0.7, 0.7, 0.7) });
        dotX += 8;
      }
    }

    currentY -= lineH;
    if (currentY < 60) break;
  }

  const out = path.join(OUT, `toc_${uuidv4()}.pdf`);
  fs.writeFileSync(out, await doc.save());
  return { outPath: out, headingCount: headings.length };
}

/**
 * Heuristic phát hiện heading từ text thuần.
 */
function detectByHeuristic(text) {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  const PATTERNS = [
    { re: /^(chương|chapter|phần|part)\s+[\dIVXLCDM]+/i, level: 1 },
    { re: /^(\d+\.)+\s+\S+/,                          level: 2 },
    { re: /^[A-Z\s]{4,40}$/,                             level: 1 },
    { re: /^mục\s+\d+/i,                                level: 2 },
    { re: /^bài\s+\d+/i,                                level: 1 },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 3 || line.length > 80) continue;

    for (const { re, level } of PATTERNS) {
      if (re.test(line)) {
        results.push({ text: line, level, page: Math.floor(i / 35) + 1 });
        break;
      }
    }
  }

  return results;
}

/**
 * Dùng AI phát hiện headings khi heuristic thất bại.
 * Google Gemini primary, Claude backup.
 */
async function detectWithAI(text) {
  const { callAI } = require('./ai.service');

  const prompt = `Phân tích văn bản sau và xác định TẤT CẢ heading/tiêu đề.

Trả về CHÍNH XÁC một JSON array, KHÔNG có markdown, KHÔNG có giải thích:
[{"text":"Tên heading","level":1},{"text":"Tên mục","level":2}]

Quy tắc level:
- level 1: Chương, Phần, Part, Chapter, tên lớn nhất
- level 2: Mục, Section, tiêu đề vừa
- level 3: Tiểu mục, subsection, tiêu đề nhỏ

Chỉ lấy heading thực sự, bỏ qua nội dung thường.

VĂN BẢN:
${text}`;

  try {
    const raw = await callAI(prompt, {
      textLength: text.length,
      maxTokens:  800,
      system:     'Bạn là chuyên gia phân tích cấu trúc tài liệu. Chỉ trả về JSON array, không có gì khác.',
    });

    const clean = raw
      .replace(/\`\`\`json\s*/gi, '')
      .replace(/\`\`\`\s*/g, '')
      .trim();

    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) throw new Error('Kết quả không phải array');

    return parsed
      .filter(item => item?.text && typeof item.text === 'string' && [1, 2, 3].includes(item.level))
      .map(item => ({ text: item.text.trim().slice(0, 80), level: item.level }));

  } catch (err) {
    console.error('[toc] detectWithAI thất bại:', err.message);
    return [];
  }
}

module.exports = { generateTOC, detectByHeuristic, detectWithAI };
