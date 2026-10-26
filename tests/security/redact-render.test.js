'use strict';

/**
 * tests/security/redact-render.test.js
 * Verification Suite cho Finding S-04 (Secure Redaction) & Finding S-06 (Renderer Isolation & SSRF Defense).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { execFileSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.SUPPRESS_SANDBOX_WARNING = 'true';

const redactSvc = require('../../server/services/redact.service');
const { validateSafeUrl, isPrivateOrReservedIP, isForbiddenHostname, isUrlToPdfEnabled } = require('../../server/utils/ssrfGuard');
const { getPopplerBinary } = require('../../server/utils/binaries');
const convertSvc = require('../../server/services/convert.service');
const pdfAdv = require('../../server/services/pdfAdvanced.service');
const { closeBrowser } = require('../../server/utils/browser');

describe('🔒 Document Processing Security: Redaction & Renderer Isolation Suite', () => {

  const testDir = path.resolve('outputs', 'test_redact_render');
  const fixturePdfPath = path.join(testDir, 'synthetic_confidential.pdf');
  const secretMarkerCCCD = '012345678901';
  const secretMarkerEmail = 'secret_director@confidential.gov.vn';
  const secretToken = 'TOP_SECRET_MARKER_998877665544';

  before(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Tạo synthetic PDF chứa dữ liệu nhạy cảm PII và metadata
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);

    // Vẽ văn bản chứa thông tin nhạy cảm
    page.drawText(`THONG TIN MAT: CCCD ${secretMarkerCCCD}`, { x: 50, y: 350, size: 14 });
    page.drawText(`Lien he: ${secretMarkerEmail}`, { x: 50, y: 300, size: 12 });
    page.drawText(`Ma dinh danh toi mat: ${secretToken}`, { x: 50, y: 250, size: 12 });

    // Đặt metadata bí mật
    doc.setTitle('CONFIDENTIAL_INTERNAL_REPORT');
    doc.setAuthor('Classified Internal Officer');
    doc.setSubject('Top Secret Document Redaction Test');
    doc.setKeywords(['confidential', 'pii', 'classified']);

    const pdfBytes = await doc.save();
    fs.writeFileSync(fixturePdfPath, pdfBytes);
  });

  after(async () => {
    try {
      await closeBrowser();
    } catch (_) {}
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  describe('1. Finding S-04: Secure Redaction & Content Elimination', () => {

    it('Quét PII tự động nhận diện chính xác CCCD và Email trên synthetic fixture', async () => {
      const scanResult = await redactSvc.scanPdfForPII(fixturePdfPath);
      assert.ok(scanResult.totalFindings >= 2, `Cần tìm thấy ít nhất 2 findings, kết quả thực tế: ${scanResult.totalFindings}`);

      const cccdFinding = scanResult.findings.find(f => f.type === 'cccd');
      const emailFinding = scanResult.findings.find(f => f.type === 'email');

      assert.ok(cccdFinding, 'Phải tìm thấy CCCD 12 số');
      assert.strictEqual(cccdFinding.text, secretMarkerCCCD);
      assert.ok(emailFinding, 'Phải tìm thấy email nhạy cảm');
      assert.strictEqual(emailFinding.text, secretMarkerEmail);
    });

    it('Secure Redact loại bỏ vĩnh viễn vector text stream (unrecoverable by stream extraction)', async () => {
      const scanResult = await redactSvc.scanPdfForPII(fixturePdfPath, {
        customKeywords: [secretToken],
      });

      // Thực hiện che giấu bảo mật
      const redactResult = await redactSvc.redactPdf(fixturePdfPath, scanResult.findings, {
        fillColor: 'black',
        stampLabel: '[REDACTED]',
        flatten: true,
      });

      assert.strictEqual(redactResult.secureRedacted, true);
      assert.strictEqual(redactResult.flattened, true);
      assert.ok(fs.existsSync(redactResult.outputPath), 'File output phải tồn tại');

      // 1. Kiểm tra trích xuất text bằng pdftotext
      let extractedText = '';
      try {
        const pdftotextBin = getPopplerBinary('pdftotext');
        extractedText = execFileSync(pdftotextBin, ['--', redactResult.outputPath, '-']).toString('utf-8');
      } catch (err) {
        assert.fail(`pdftotext execution failed: ${err.message}`);
      }

      assert.ok(!extractedText.includes(secretMarkerCCCD), `LỖI RÒ RỈ: pdftotext vẫn trích xuất được CCCD: ${secretMarkerCCCD}`);
      assert.ok(!extractedText.includes(secretMarkerEmail), `LỖI RÒ RỈ: pdftotext vẫn trích xuất được Email: ${secretMarkerEmail}`);
      assert.ok(!extractedText.includes(secretToken), `LỖI RÒ RỈ: pdftotext vẫn trích xuất được Secret Token: ${secretToken}`);

      // 2. Kiểm tra trực tiếp binary stream (raw buffer scan)
      const outputBuffer = fs.readFileSync(redactResult.outputPath);
      assert.strictEqual(outputBuffer.includes(secretMarkerCCCD), false, 'CCCD vẫn còn tồn tại trong raw PDF buffer!');
      assert.strictEqual(outputBuffer.includes(secretMarkerEmail), false, 'Email vẫn còn tồn tại trong raw PDF buffer!');
      assert.strictEqual(outputBuffer.includes(secretToken), false, 'Secret token vẫn còn tồn tại trong raw PDF buffer!');

      // Dọn dẹp output sau test
      try { fs.unlinkSync(redactResult.outputPath); } catch (_) {}
    });

    it('Tẩy sạch siêu dữ liệu (Metadata Scrubbing) trên tài liệu redacted', async () => {
      const redactResult = await redactSvc.redactPdf(fixturePdfPath, [{ page: 1, box: { x: 50, y: 350, width: 200, height: 20 } }], {
        flatten: true,
      });

      const outputBytes = fs.readFileSync(redactResult.outputPath);
      const outputDoc = await PDFDocument.load(outputBytes);

      assert.strictEqual(outputDoc.getTitle() || '', '', 'Title chưa được tẩy sạch!');
      assert.strictEqual(outputDoc.getAuthor() || '', '', 'Author chưa được tẩy sạch!');
      assert.strictEqual(outputDoc.getSubject() || '', '', 'Subject chưa được tẩy sạch!');
      assert.strictEqual(outputDoc.getKeywords() || '', '', 'Keywords chưa được tẩy sạch!');

      try { fs.unlinkSync(redactResult.outputPath); } catch (_) {}
    });

    it('Ngăn chặn cấm triệt để chế độ che giả vector (flatten=false throws INSECURE_REDACTION_DISALLOWED)', async () => {
      await assert.rejects(
        async () => {
          await redactSvc.redactPdf(
            fixturePdfPath,
            [{ page: 1, box: { x: 50, y: 350, width: 200, height: 20 } }],
            { flatten: false }
          );
        },
        /INSECURE_REDACTION_DISALLOWED/,
        'redactPdf phải quăng lỗi cấm flatten=false khi có danh sách redactions'
      );
    });

    it('Fail-closed: Nếu quá trình rasterize thất bại, không bao giờ fallback về vector overlay', async () => {
      const invalidPdfPath = path.join(testDir, 'corrupted_file.pdf');
      fs.writeFileSync(invalidPdfPath, Buffer.from('%PDF-1.4\n%Malformed and truncated stream'));

      await assert.rejects(
        async () => {
          await redactSvc.redactPdf(invalidPdfPath, [{ page: 1, box: { x: 10, y: 10, width: 50, height: 50 } }]);
        },
        /SECURE_REDACTION_FAILED/,
        'Phải throw SECURE_REDACTION_FAILED và huỷ bỏ thay vì trả file vector không an toàn'
      );

      try { fs.unlinkSync(invalidPdfPath); } catch (_) {}
    });

  });

  describe('2. Finding S-06: SSRF Defense & Renderer Isolation', () => {

    it('isPrivateOrReservedIP chặn toàn diện dải IP nội bộ, loopback và cloud metadata', () => {
      // Loopback
      assert.strictEqual(isPrivateOrReservedIP('127.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('127.255.255.255'), true);
      assert.strictEqual(isPrivateOrReservedIP('::1'), true);

      // Cloud Metadata & Link Local
      assert.strictEqual(isPrivateOrReservedIP('169.254.169.254'), true);
      assert.strictEqual(isPrivateOrReservedIP('169.254.1.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('fe80::1'), true);

      // RFC 1918 Private
      assert.strictEqual(isPrivateOrReservedIP('10.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('172.16.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('172.31.255.255'), true);
      assert.strictEqual(isPrivateOrReservedIP('192.168.1.1'), true);

      // Carrier-Grade NAT (RFC 6598)
      assert.strictEqual(isPrivateOrReservedIP('100.64.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('100.127.255.254'), true);

      // IPv4 Mapped IPv6
      assert.strictEqual(isPrivateOrReservedIP('::ffff:169.254.169.254'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:127.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:10.0.0.1'), true);

      // Public Valid IPs
      assert.strictEqual(isPrivateOrReservedIP('8.8.8.8'), false);
      assert.strictEqual(isPrivateOrReservedIP('1.1.1.1'), false);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:8.8.8.8'), false);
    });

    it('isForbiddenHostname chặn localhost, .internal, .local và cloud metadata domains', () => {
      assert.strictEqual(isForbiddenHostname('localhost'), true);
      assert.strictEqual(isForbiddenHostname('sub.localhost'), true);
      assert.strictEqual(isForbiddenHostname('service.local'), true);
      assert.strictEqual(isForbiddenHostname('api.internal'), true);
      assert.strictEqual(isForbiddenHostname('metadata.google.internal'), true);
      assert.strictEqual(isForbiddenHostname('instance-data'), true);
      assert.strictEqual(isForbiddenHostname('127.0.0.1'), true);
      assert.strictEqual(isForbiddenHostname('169.254.169.254'), true);

      assert.strictEqual(isForbiddenHostname('example.com'), false);
      assert.strictEqual(isForbiddenHostname('google.com'), false);
    });

    it('validateSafeUrl từ chối các URL tới loopback, private IP và cloud metadata', async () => {
      await assert.rejects(
        () => validateSafeUrl('http://169.254.169.254/latest/meta-data'),
        /bị từ chối truy cập|thuộc dải mạng nội bộ/
      );

      await assert.rejects(
        () => validateSafeUrl('http://127.0.0.1:3002/api/health'),
        /bị từ chối truy cập|thuộc dải mạng nội bộ/
      );

      await assert.rejects(
        () => validateSafeUrl('http://10.0.0.1/admin'),
        /bị từ chối truy cập|thuộc dải mạng nội bộ/
      );

      await assert.rejects(
        () => validateSafeUrl('http://localhost:8080'),
        /bị từ chối truy cập|forbidden local\/internal domain/
      );

      await assert.rejects(
        () => validateSafeUrl('file:///etc/passwd'),
        /Chỉ chấp nhận HTTP hoặc HTTPS/
      );

      await assert.rejects(
        () => validateSafeUrl('gopher://127.0.0.1:6379/_flushall'),
        /Chỉ chấp nhận HTTP hoặc HTTPS/
      );
    });

    it('Feature Flag ENABLE_URL_TO_PDF chặn thực thi khi chưa bật cấu hình', async () => {
      const origEnv = process.env.ENABLE_URL_TO_PDF;
      delete process.env.ENABLE_URL_TO_PDF;

      assert.strictEqual(isUrlToPdfEnabled(), false);

      await assert.rejects(
        async () => {
          await convertSvc.urlToPdf('https://example.com');
        },
        (err) => {
          assert.strictEqual(err.code, 'FEATURE_DISABLED');
          assert.strictEqual(err.status, 403);
          return true;
        }
      );

      process.env.ENABLE_URL_TO_PDF = origEnv;
    });

    it('HTML-to-PDF thực thi Deny-All Network Isolation, chặn các tài nguyên SSRF nhúng', async () => {
      const maliciousHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>SSRF Test</title></head>
        <body>
          <h1>Untrusted HTML Content</h1>
          <img src="http://169.254.169.254/latest/meta-data/credentials" alt="metadata-leak">
          <iframe src="http://localhost:3002/api/keys"></iframe>
          <script>fetch('http://169.254.169.254').catch(()=>{});</script>
        </body>
        </html>
      `;

      const tmpHtmlFile = path.join(testDir, 'untrusted_ssrf_test.html');
      fs.writeFileSync(tmpHtmlFile, maliciousHtml, 'utf-8');

      // htmlFileToPdf sẽ kích hoạt protectPageNetwork ở mode 'deny-all' và khử các thẻ nguy hiểm
      const generatedPdf = await pdfAdv.htmlFileToPdf(tmpHtmlFile, { format: 'A4' });

      assert.ok(fs.existsSync(generatedPdf), 'File PDF an toàn phải được tạo ra');

      // Kiểm tra xem iframe/script có bị sanitize và metadata có bị ngăn chặn không
      const pdfBytes = fs.readFileSync(generatedPdf);
      assert.ok(!pdfBytes.includes('credentials'), 'Không được rò rỉ bất kỳ nội dung metadata nào vào PDF');

      try { fs.unlinkSync(tmpHtmlFile); } catch (_) {}
      try { fs.unlinkSync(generatedPdf); } catch (_) {}
    });

  });

});
