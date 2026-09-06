'use strict';

const { PDFDocument, rgb, degrees } = require('pdf-lib');
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

// Helper: Chạy command và throw error rõ ràng
function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Lệnh thất bại: ${cmd}\nChi tiết: ${err.stderr?.toString() || err.message}`);
  }
}

// 1. Gộp PDF (hỗ trợ sắp xếp từng trang cụ thể & xoay trang)
async function mergePDFs(filePaths, options = {}) {
  const merged = await PDFDocument.create();
  const docs = [];
  for (const fp of filePaths) {
    const bytes = fs.readFileSync(fp);
    const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });
    docs.push(doc);
  }

  const pageOrder = options?.pageOrder;
  if (Array.isArray(pageOrder) && pageOrder.length > 0) {
    for (const item of pageOrder) {
      const fIdx = Number(item.fileIndex !== undefined ? item.fileIndex : item.fileIdx);
      const pNum = Number(item.pageNum !== undefined ? item.pageNum : (item.pageIndex !== undefined ? item.pageIndex + 1 : 1));
      const rot  = Number(item.rotation || 0);

      if (docs[fIdx]) {
        const srcDoc = docs[fIdx];
        const total = srcDoc.getPageCount();
        if (pNum >= 1 && pNum <= total) {
          const [copiedPage] = await merged.copyPages(srcDoc, [pNum - 1]);
          if (rot) {
            const curRot = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((curRot + rot) % 360));
          }
          merged.addPage(copiedPage);
        }
      }
    }
  } else {
    for (const doc of docs) {
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
  }

  const outPath = path.join(OUT, `merged_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await merged.save());
  return outPath;
}

// 2. Tách PDF thành từng trang
async function splitPDF(filePath) {
  const bytes   = fs.readFileSync(filePath);
  const doc     = await PDFDocument.load(bytes);
  const total   = doc.getPageCount();
  const outputs = [];

  for (let i = 0; i < total; i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [i]);
    single.addPage(page);
    const outPath = path.join(OUT, `page_${i + 1}_${uuidv4().slice(0, 8)}.pdf`);
    fs.writeFileSync(outPath, await single.save());
    outputs.push(outPath);
  }
  return outputs;
}

// 3. Nén PDF bằng Ghostscript (nén thực sự, giảm 50-80% dung lượng)
async function compressPDF(filePath, quality = 'ebook') {
  const qualities = {
    screen:  '/screen',   // 72 dpi  — nhỏ nhất, xem màn hình
    ebook:   '/ebook',    // 150 dpi — cân bằng (khuyến nghị)
    printer: '/printer',  // 300 dpi — chất lượng cao
    prepress:'/prepress', // 300 dpi — giữ nguyên màu sắc
  };
  const setting = qualities[quality] || qualities.ebook;
  const outPath = path.join(OUT, `compressed_${uuidv4()}.pdf`);

  const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';
  const cmd = `${gsCmd} -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 ` +
              `-dPDFSETTINGS=${setting} -dNOPAUSE -dQUIET -dBATCH ` +
              `-sOutputFile="${outPath}" "${filePath}"`;
  run(cmd);
  return outPath;
}

// 4. Chuyển PDF -> Word (dùng LibreOffice headless)
async function pdfToWord(filePath) {
  const outPath = path.join(OUT, `doc_${uuidv4()}.docx`);
  const loCmd   = process.platform === 'win32'
    ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"'
    : 'libreoffice';
  run(`${loCmd} --headless --infilter="writer_pdf_import" --convert-to docx "${filePath}" --outdir "${OUT}"`);
  
  const baseName = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.docx`);
  if (fs.existsSync(defaultOut)) {
    fs.renameSync(defaultOut, outPath);
  }
  return outPath;
}

// 5. Chuyển Word -> PDF (LibreOffice)
async function wordToPdf(filePath) {
  const outPath = path.join(OUT, `pdf_${uuidv4()}.pdf`);
  const loCmd   = process.platform === 'win32'
    ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"'
    : 'libreoffice';
  run(`${loCmd} --headless --convert-to pdf "${filePath}" --outdir "${OUT}"`);
  
  const baseName = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.pdf`);
  if (fs.existsSync(defaultOut)) {
    fs.renameSync(defaultOut, outPath);
  }
  return outPath;
}

// 6. Trích xuất trang cụ thể (vd: "1,3,5-8")
async function extractPages(filePath, pageRanges) {
  const bytes = fs.readFileSync(filePath);
  const doc   = await PDFDocument.load(bytes);
  const total = doc.getPageCount();

  const indices = new Set();
  const parts = pageRanges.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()) - 1);
      for (let i = Math.max(0, start); i <= Math.min(total - 1, end); i++) indices.add(i);
    } else {
      const idx = parseInt(part.trim()) - 1;
      if (idx >= 0 && idx < total) indices.add(idx);
    }
  }

  const extracted = await PDFDocument.create();
  const pages     = await extracted.copyPages(doc, Array.from(indices).sort((a,b) => a - b));
  pages.forEach(p => extracted.addPage(p));

  const outPath = path.join(OUT, `extracted_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await extracted.save());
  return outPath;
}

// 7. Xoay trang PDF
async function rotatePDF(filePath, angle = 90) {
  const bytes = fs.readFileSync(filePath);
  const doc   = await PDFDocument.load(bytes);
  doc.getPages().forEach(p => p.setRotation(degrees(p.getRotation().angle + angle)));
  const outPath = path.join(OUT, `rotated_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

// 8. Đóng dấu Watermark
async function addWatermark(filePath, text, opts = {}) {
  const { opacity = 0.3, size = 48, color = [0.5, 0.5, 0.5] } = opts;
  const bytes = fs.readFileSync(filePath);
  const doc   = await PDFDocument.load(bytes);

  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 4,
      y: height / 2,
      size,
      color: rgb(...color),
      opacity,
      rotate: degrees(45),
    });
  });

  const outPath = path.join(OUT, `watermarked_${uuidv4()}.pdf`);
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

// 9. Đặt mật khẩu PDF (dùng qpdf — bảo mật tiêu chuẩn)
async function protectPDF(filePath, userPassword, ownerPassword = null) {
  const owner = ownerPassword || userPassword;
  const outPath = path.join(OUT, `protected_${uuidv4()}.pdf`);
  run(`qpdf --encrypt "${userPassword}" "${owner}" 256 -- "${filePath}" "${outPath}"`);
  return outPath;
}

// 10. Gỡ mật khẩu PDF (dùng qpdf)
async function unlockPDF(filePath, password) {
  const outPath = path.join(OUT, `unlocked_${uuidv4()}.pdf`);
  run(`qpdf --password="${password}" --decrypt "${filePath}" "${outPath}"`);
  return outPath;
}

module.exports = {
  mergePDFs,
  splitPDF,
  compressPDF,
  pdfToWord,
  wordToPdf,
  extractPages,
  rotatePDF,
  addWatermark,
  protectPDF,
  unlockPDF,
};


exports.signPdf = async (inputPath, outputPath, options) => {
  const { PDFDocument, rgb } = require('pdf-lib');
  const fs = require('fs');
  const path = require('path');
  
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const pageIdx = options.page ? parseInt(options.page) - 1 : 0;
  if (pageIdx < 0 || pageIdx >= pages.length) throw new Error('Trang không hợp lệ');
  
  const page = pages[pageIdx];
  const { width, height } = page.getSize();
  
  // X, Y provided as percentages (0.0 to 1.0)
  const px = parseFloat(options.x) || 0;
  const py = parseFloat(options.y) || 0;
  const actualX = px * width;
  const actualY = height - (py * height); // PDF-lib Y is bottom-up, web is top-down
  
  if (options.signatureText) {
    page.drawText(options.signatureText, {
      x: actualX,
      y: actualY,
      size: 24,
      color: rgb(0, 0, 0.8), // dark blue
    });
  } else if (options.signatureImage) {
    const imgBytes = fs.readFileSync(options.signatureImage);
    let pdfImage;
    if (options.signatureImage.toLowerCase().endsWith('.png')) {
      pdfImage = await pdfDoc.embedPng(imgBytes);
    } else {
      pdfImage = await pdfDoc.embedJpg(imgBytes);
    }
    const imgDims = pdfImage.scale(0.5); // scale down
    page.drawImage(pdfImage, {
      x: actualX,
      y: actualY - imgDims.height, // anchor top-left
      width: imgDims.width,
      height: imgDims.height,
    });
  }
  
  const modifiedPdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, modifiedPdfBytes);
};
