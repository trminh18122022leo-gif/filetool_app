'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

function getLoExecutable() {
  if (process.platform === 'win32') {
    const winPath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
    if (fs.existsSync(winPath)) return winPath;
  }
  return 'libreoffice';
}

function runSafe(executable, args = []) {
  try {
    return execFileSync(executable, args, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`LibreOffice lỗi: ${err.stderr?.toString() || err.message}`);
  }
}

// 1. DOCX -> PDF
async function docToPdf(filePath) {
  const loExe = getLoExecutable();
  runSafe(loExe, ['--headless', '--convert-to', 'pdf', filePath, '--outdir', OUT]);
  const baseName   = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.pdf`);
  const finalOut   = path.join(OUT, `doc_${uuidv4()}.pdf`);
  fs.renameSync(defaultOut, finalOut);
  return finalOut;
}

// 2. XLSX -> PDF
async function xlsxToPdf(filePath) {
  const loExe = getLoExecutable();
  runSafe(loExe, ['--headless', '--convert-to', 'pdf', filePath, '--outdir', OUT]);
  const baseName   = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.pdf`);
  const finalOut   = path.join(OUT, `sheet_${uuidv4()}.pdf`);
  fs.renameSync(defaultOut, finalOut);
  return finalOut;
}

// 3. PPTX -> PDF
async function pptxToPdf(filePath) {
  const loExe = getLoExecutable();
  runSafe(loExe, ['--headless', '--convert-to', 'pdf', filePath, '--outdir', OUT]);
  const baseName   = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.pdf`);
  const finalOut   = path.join(OUT, `slide_${uuidv4()}.pdf`);
  fs.renameSync(defaultOut, finalOut);
  return finalOut;
}

// 4. XLSX -> CSV (dùng thư viện xlsx thuần JS, nhanh không cần LibreOffice)
async function xlsxToCsv(filePath) {
  const workbook  = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const csvData   = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
  const outPath   = path.join(OUT, `data_${uuidv4()}.csv`);
  fs.writeFileSync(outPath, csvData, 'utf8');
  return outPath;
}

// 5. CSV -> XLSX
async function csvToXlsx(filePath) {
  const csvContent = fs.readFileSync(filePath, 'utf8');
  const workbook   = xlsx.read(csvContent, { type: 'string' });
  const outPath    = path.join(OUT, `data_${uuidv4()}.xlsx`);
  xlsx.writeFile(workbook, outPath);
  return outPath;
}

// 6. PDF -> DOCX (LibreOffice Writer PDF Import)
async function pdfToDocx(filePath) {
  const loExe = getLoExecutable();
  runSafe(loExe, ['--headless', '--infilter=writer_pdf_import', '--convert-to', 'docx', filePath, '--outdir', OUT]);
  const baseName   = path.basename(filePath, path.extname(filePath));
  const defaultOut = path.join(OUT, `${baseName}.docx`);
  const finalOut   = path.join(OUT, `doc_${uuidv4()}.docx`);
  fs.renameSync(defaultOut, finalOut);
  return finalOut;
}

module.exports = {
  docToPdf,
  xlsxToPdf,
  pptxToPdf,
  xlsxToCsv,
  csvToXlsx,
  pdfToDocx,
};
