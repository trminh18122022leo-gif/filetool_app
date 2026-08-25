'use strict';

const { execSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Chuyển PDF sang nền tối (Dark Mode).
 * 
 * Pipeline:
 * 1. Ghostscript render từng trang thành PNG
 * 2. Sharp negate màu (đảo sáng <-> tối) + điều chỉnh tương phản
 * 3. pdf-lib gom các trang đã xử lý thành PDF mới
 */
async function convertToDarkMode(filePath, opts = {}) {
  const { bg = 'dark', contrast = 1.1 } = opts;
  // bg: 'dark' (đen hoàn toàn #121212) | 'sepia-dark' (vàng đậm ấm)

  const tmpId   = uuidv4();
  const pageDir = path.join(OUT, `dark_tmp_${tmpId}`);
  fs.mkdirSync(pageDir, { recursive: true });

  const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';
  const renderCmd =
    `${gsCmd} -dNOPAUSE -dBATCH -sDEVICE=png16m -r200 ` +
    `-sOutputFile="${path.join(pageDir, 'page_%04d.png')}" "${filePath}"`;
  execSync(renderCmd, { stdio: 'pipe' });

  const pageFiles = fs.readdirSync(pageDir).sort();
  const newPdf    = await PDFDocument.create();

  for (const pf of pageFiles) {
    const rawPng = path.join(pageDir, pf);

    // Đảo màu bằng sharp: trắng -> đen, đen -> trắng
    let img = sharp(rawPng).negate({ alpha: false });

    if (bg === 'sepia-dark') {
      // Tông vàng tối: dễ đọc ban đêm
      img = img.tint({ r: 240, g: 220, b: 180 }).modulate({ brightness: 0.9 });
    }

    const processedBuf = await img.png().toBuffer();
    const pdfImg       = await newPdf.embedPng(processedBuf);
    const page         = newPdf.addPage([pdfImg.width, pdfImg.height]);
    page.drawImage(pdfImg, { x: 0, y: 0, width: pdfImg.width, height: pdfImg.height });
  }

  // Dọn dẹp thư mục tạm
  fs.rmSync(pageDir, { recursive: true, force: true });

  const outPath = path.join(OUT, `dark_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await newPdf.save());
  return outPath;
}

module.exports = { convertToDarkMode };
