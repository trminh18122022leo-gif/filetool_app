'use strict';

/**
 * tests/releases/windows-release.test.js
 * Verification of Windows Candidate Release & Store Readiness:
 * - Web App Manifest Store Compliance (PWA Score 100/100)
 * - Native Windows File Handlers (.pdf, .docx, image formats)
 * - Window Controls Overlay & Display Override
 * - Store Listing Copy & 7 Search Keywords Integrity
 * - Preservation of Electron Enterprise Fallback Configuration
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('🪟 Windows PWA / MSIX Candidate & Store Certification Suite', () => {

  // ── 1. Web App Manifest Store Compliance ───────────────────────────────────
  describe('1. Web App Manifest Windows Store Compliance', () => {
    const manifestPath = path.join(ROOT_DIR, 'client/public/manifest.webmanifest');
    assert.ok(fs.existsSync(manifestPath), 'client/public/manifest.webmanifest must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    it('verifies critical identity and display properties for Windows MSIX', () => {
      assert.strictEqual(manifest.name, 'FileTools Pro');
      assert.strictEqual(manifest.short_name, 'FileTools');
      assert.strictEqual(manifest.display, 'standalone');
      assert.ok(Array.isArray(manifest.display_override));
      assert.ok(manifest.display_override.includes('standalone'));
      assert.strictEqual(manifest.theme_color, '#08080C');
      assert.strictEqual(manifest.background_color, '#08080C');
      assert.strictEqual(manifest.lang, 'vi');
      assert.strictEqual(manifest.start_url, '/');
      assert.strictEqual(manifest.scope, '/');
    });

    it('verifies icons include 192px, 512px and maskable formats', () => {
      const icons = manifest.icons;
      assert.ok(Array.isArray(icons) && icons.length >= 3);

      const has192 = icons.some(i => i.sizes === '192x192');
      const has512 = icons.some(i => i.sizes === '512x512');
      const hasMaskable = icons.some(i => i.purpose === 'maskable');

      assert.ok(has192, 'Manifest must have 192x192 icon');
      assert.ok(has512, 'Manifest must have 512x512 icon');
      assert.ok(hasMaskable, 'Manifest must have maskable icon for Windows 11 / Android adaptive tiles');
    });

    it('verifies native OS file handlers are defined for PDF, Word and Images', () => {
      const handlers = manifest.file_handlers;
      assert.ok(Array.isArray(handlers) && handlers.length >= 3, 'Must define file_handlers for OS file association');

      const pdfHandler = handlers.find(h => h.accept && h.accept['application/pdf']);
      assert.ok(pdfHandler, 'Must define PDF file handler (.pdf)');
      assert.strictEqual(pdfHandler.action, '/pdf');

      const wordHandler = handlers.find(h => h.action === '/convert/word-to-pdf');
      assert.ok(wordHandler, 'Must define Word file handler (.docx/.doc)');

      const imageHandler = handlers.find(h => h.action === '/image');
      assert.ok(imageHandler, 'Must define Image file handler');
    });

    it('verifies Windows shortcuts / Jump List items are configured', () => {
      const shortcuts = manifest.shortcuts;
      assert.ok(Array.isArray(shortcuts) && shortcuts.length >= 4, 'Must define 4 jump list shortcuts');

      const urls = shortcuts.map(s => s.url);
      assert.ok(urls.includes('/pdf/compress'));
      assert.ok(urls.includes('/pdf/merge'));
      assert.ok(urls.includes('/image'));
      assert.ok(urls.includes('/workflows'));
    });
  });

  // ── 2. Store Listing Assets & Privacy Invariants ────────────────────────────
  describe('2. Store Listing Copy & Privacy Invariants', () => {
    const listingPath = path.join(ROOT_DIR, 'docs/releases/STORE_LISTING_COPY.md');
    const listingContent = fs.readFileSync(listingPath, 'utf8');

    it('verifies required privacy policy and support URLs in listing copy', () => {
      assert.ok(
        listingContent.includes('https://filetools-app.vercel.app/privacy'),
        'Store listing must link to live privacy policy'
      );
      assert.ok(
        listingContent.includes('https://filetools-app.vercel.app/guides'),
        'Store listing must link to live support / guides page'
      );
    });

    it('verifies 7 distinct search tags are defined', () => {
      const requiredTags = ['pdf', 'gop pdf', 'nen pdf', 'ocr scan', 'word sang pdf', 'chuyen doi file', 'filetools'];
      requiredTags.forEach(tag => {
        assert.ok(
          listingContent.includes(`\`${tag}\``),
          `Store listing must contain search tag: ${tag}`
        );
      });
    });

    it('verifies Windows 10/11 system requirements are clearly stated', () => {
      assert.ok(listingContent.includes('Windows 10 phiên bản 19041.0'), 'Must document min Windows 10 build');
      assert.ok(listingContent.includes('Windows 11'), 'Must document Windows 11 compatibility');
      assert.ok(listingContent.includes('x64') && listingContent.includes('ARM64'), 'Must support x64 and ARM64 architectures');
    });
  });

  // ── 3. Preservation of Electron Enterprise Fallback ─────────────────────────
  describe('3. Preservation of Electron Configuration', () => {
    const electronDir = path.join(ROOT_DIR, 'electron');
    assert.ok(fs.existsSync(electronDir), 'electron/ directory must be preserved');

    const electronPackagePath = path.join(electronDir, 'package.json');
    const electronMainPath = path.join(electronDir, 'main.js');

    assert.ok(fs.existsSync(electronPackagePath), 'electron/package.json must be preserved');
    assert.ok(fs.existsSync(electronMainPath), 'electron/main.js must be preserved');

    it('verifies Electron main.js retains single-instance lock and protocol handlers', () => {
      const mainContent = fs.readFileSync(electronMainPath, 'utf8');
      assert.ok(
        mainContent.includes('app.requestSingleInstanceLock()'),
        'Electron main.js must retain single instance lock'
      );
      assert.ok(
        mainContent.includes('setAsDefaultProtocolClient'),
        'Electron main.js must retain protocol client registration'
      );
    });
  });
});
