/**
 * Creative tools: Color palette, Watermark image, Collage, Barcode, Add Page Numbers, Header/Footer, Delete Pages, Excel/CSV
 */
'use strict';

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUT = path.resolve('outputs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function extractPalette(imagePath) {
  const { data } = await sharp(imagePath)
    .resize(100, 100, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colors = {};
  const step   = 3;

  for (let i = 0; i < data.length; i += step) {
    const r = Math.round(data[i]     / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = r + ',' + g + ',' + b;
    colors[key] = (colors[key] || 0) + 1;
  }

  const sorted = Object.entries(colors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number);
      const hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return { hex, r, g, b, brightness: Math.round(brightness), count };
    });

  return sorted;
}

async function watermarkImage(imagePath, opts = {}) {
  const {
    text     = 'WATERMARK',
    opacity  = 0.4,
    color    = 'white',
    fontSize = 48,
  } = opts;

  const meta = await sharp(imagePath).metadata();
  const { width, height } = meta;

  const textSvg = Buffer.from(
    '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">' +
      '<style>text { font-family: Arial, sans-serif; font-size: ' + fontSize + 'px; font-weight: bold; fill: ' + color + '; fill-opacity: ' + opacity + '; }</style>' +
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" transform="rotate(-35, ' + (width/2) + ', ' + (height/2) + ')">' + text + '</text>' +
    '</svg>'
  );

  const ext = path.extname(imagePath).toLowerCase() || '.jpg';
  const out = path.join(OUT, 'wm_' + uuidv4() + ext);

  await sharp(imagePath)
    .composite([{ input: textSvg, blend: 'over' }])
    .toFile(out);

  return out;
}

async function makeCollage(imagePaths, opts = {}) {
  const { cols = 2, gap = 10, background = '#0f172a' } = opts;

  const THUMB_SIZE = 400;
  const rows       = Math.ceil(imagePaths.length / cols);
  const totalW     = cols * THUMB_SIZE + (cols + 1) * gap;
  const totalH     = rows * THUMB_SIZE + (rows + 1) * gap;

  let canvas = sharp({
    create: { width: totalW, height: totalH, channels: 3, background },
  });

  const composites = await Promise.all(
    imagePaths.map(async (fp, idx) => {
      const col  = idx % cols;
      const row  = Math.floor(idx / cols);
      const left = gap + col * (THUMB_SIZE + gap);
      const top  = gap + row * (THUMB_SIZE + gap);

      const buf = await sharp(fp)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();

      return { input: buf, left, top };
    })
  );

  const outPath = path.join(OUT, 'collage_' + uuidv4() + '.jpg');
  await canvas.composite(composites).jpeg({ quality: 90 }).toFile(outPath);

  return outPath;
}

async function generateBarcode(text, opts = {}) {
  const { bcid = 'code128', scale = 3, height = 10, includetext = true } = opts;
  const bwipjs = require('bwip-js');

  const buffer = await new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid,
      text,
      scale,
      height,
      includetext,
      textxalign: 'center',
    }, (err, buf) => err ? reject(err) : resolve(buf));
  });

  const outPath = path.join(OUT, 'barcode_' + uuidv4() + '.png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function addPageNumbers(pdfPath, opts = {}) {
  const {
    position  = 'bottom-center',
    startFrom = 1,
    fontSize  = 11,
    format    = '{n}',
    color     = '#444444',
    margin    = 30,
  } = opts;

  const bytes  = fs.readFileSync(pdfPath);
  const doc    = await PDFDocument.load(bytes);
  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const pages  = doc.getPages();
  const total  = pages.length;

  const hexToRgb = (hex) => {
    const clean = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(clean.slice(0,2) || '00', 16) / 255;
    const g = parseInt(clean.slice(2,4) || '00', 16) / 255;
    const b = parseInt(clean.slice(4,6) || '00', 16) / 255;
    return rgb(r, g, b);
  };

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const num  = idx + Number(startFrom);
    const text = format.replace('{n}', num).replace('{total}', total);
    const w    = font.widthOfTextAtSize(text, fontSize);

    let x, y;
    const isTop    = position.startsWith('top');
    const isCenter = position.endsWith('center');
    const isRight  = position.endsWith('right');

    y = isTop ? height - margin : margin - fontSize / 2;
    x = isCenter ? (width - w) / 2 : isRight ? width - margin - w : margin;

    page.drawText(text, { x, y, size: fontSize, font, color: hexToRgb(color) });
  });

  const outPath = path.join(OUT, 'numbered_' + uuidv4() + '.pdf');
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

async function addHeaderFooter(pdfPath, opts = {}) {
  const {
    headerText = '',
    footerText = '',
    fontSize   = 10,
    color      = '#888888',
    margin     = 25,
  } = opts;

  const bytes  = fs.readFileSync(pdfPath);
  const doc    = await PDFDocument.load(bytes);
  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const clr    = (() => {
    const clean = color.startsWith('#') ? color.slice(1) : color;
    const r = parseInt(clean.slice(0,2) || '88', 16) / 255;
    const g = parseInt(clean.slice(2,4) || '88', 16) / 255;
    const b = parseInt(clean.slice(4,6) || '88', 16) / 255;
    return rgb(r, g, b);
  })();

  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();

    if (headerText) {
      const hw = font.widthOfTextAtSize(headerText, fontSize);
      page.drawText(headerText, {
        x: (width - hw) / 2,
        y: height - margin,
        size: fontSize, font, color: clr,
      });
      page.drawLine({
        start: { x: margin, y: height - margin - 8 },
        end:   { x: width - margin, y: height - margin - 8 },
        thickness: 0.5, color: clr,
      });
    }

    if (footerText) {
      const fw = font.widthOfTextAtSize(footerText, fontSize);
      page.drawLine({
        start: { x: margin, y: margin + fontSize + 5 },
        end:   { x: width - margin, y: margin + fontSize + 5 },
        thickness: 0.5, color: clr,
      });
      page.drawText(footerText, {
        x: (width - fw) / 2,
        y: margin,
        size: fontSize, font, color: clr,
      });
    }
  });

  const outPath = path.join(OUT, 'hf_' + uuidv4() + '.pdf');
  fs.writeFileSync(outPath, await doc.save());
  return outPath;
}

async function deletePages(pdfPath, deletePageNums) {
  const deleteSet = new Set(deletePageNums.map(Number));
  const bytes  = fs.readFileSync(pdfPath);
  const doc    = await PDFDocument.load(bytes);
  const total  = doc.getPageCount();

  const keepIndices = Array.from({ length: total }, (_, i) => i)
    .filter(i => !deleteSet.has(i + 1));

  if (!keepIndices.length) throw new Error('Không thể xóa tất cả các trang');

  const newDoc = await PDFDocument.create();
  const pages  = await newDoc.copyPages(doc, keepIndices);
  pages.forEach(p => newDoc.addPage(p));

  const outPath = path.join(OUT, 'deleted_' + uuidv4() + '.pdf');
  fs.writeFileSync(outPath, await newDoc.save());
  return { path: outPath, removedCount: deletePageNums.length, remainingPages: keepIndices.length };
}

async function jsonToExcel(jsonData, opts = {}) {
  const XLSX    = require('xlsx');
  const { sheetName = 'Sheet1' } = opts;

  let data;
  if (typeof jsonData === 'string') {
    data = JSON.parse(jsonData);
  } else {
    data = jsonData;
  }

  if (!Array.isArray(data)) throw new Error('JSON phải là array of objects');

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const outPath = path.join(OUT, 'json_' + uuidv4() + '.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

async function csvToExcel(csvPath) {
  const XLSX = require('xlsx');
  const wb   = XLSX.readFile(csvPath);
  const outPath = path.join(OUT, 'csv_' + uuidv4() + '.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

module.exports = {
  extractPalette, watermarkImage, makeCollage, generateBarcode,
  addPageNumbers, addHeaderFooter, deletePages, jsonToExcel, csvToExcel,
};
