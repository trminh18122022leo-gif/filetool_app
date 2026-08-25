'use strict';

const archiver = require('archiver');
const unzipper = require('unzipper');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const OUT = path.resolve('outputs');

/**
 * Nén danh sách files thành file ZIP.
 * @param {Array<{path: string, originalname: string}>} files
 * @returns {Promise<string>} - đường dẫn file .zip trong outputs/
 */
async function createZip(files) {
  if (!files || files.length === 0) throw new Error('Không có file để nén');

  const zipName = `archive_${uuidv4()}.zip`;
  const zipPath = path.join(OUT, zipName);
  const output  = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', err => reject(err));
    archive.pipe(output);

    for (const f of files) {
      archive.file(f.path, { name: f.originalname || path.basename(f.path) });
    }

    archive.finalize();
  });
}

/**
 * Giải nén file ZIP, trả về danh sách đường dẫn các file đã bung.
 * @param {string} zipPath
 * @returns {Promise<string[]>}
 */
async function extractZip(zipPath) {
  const extractDir = path.join(OUT, `unzip_${uuidv4()}`);
  fs.mkdirSync(extractDir, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);
  const extractedFiles = [];

  for (const file of directory.files) {
    if (file.type === 'File') {
      const safeName = path.basename(file.path);
      const outPath  = path.join(extractDir, safeName);
      const content  = await file.buffer();
      fs.writeFileSync(outPath, content);
      extractedFiles.push(outPath);
    }
  }

  return extractedFiles;
}

module.exports = { createZip, extractZip };
