'use strict';

const puppeteer = require('puppeteer');

// singleton browser instance & launch lock
let browserInstance = null;
let launchPromise = null;

// flags tối ưu ram & bảo mật cho chromium headless
function getBrowserArgs() {
  const args = [
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--safebrowsing-disable-auto-update',
  ];

  // Chỉ bật --no-sandbox khi được chỉ định rõ qua biến môi trường hoặc trong container root
  const isRootInLinux = process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0;
  const explicitNoSandbox = process.env.CHROMIUM_NO_SANDBOX === 'true' || process.env.RENDER === 'true';

  if (explicitNoSandbox || isRootInLinux) {
    if (!process.env.SUPPRESS_SANDBOX_WARNING) {
      console.warn('[SECURITY WARNING] Chromium sandbox disabled. Running in no-sandbox mode. Ensure network isolation.');
    }
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  return args;
}

// lay hoac khoi tao browser singleton, auto reconnect neu crash
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: getBrowserArgs(),
      });

      browser.on('disconnected', () => {
        browserInstance = null;
        launchPromise = null;
      });

      browserInstance = browser;
      return browser;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

// chay task tren tab moi, tu dong dong tab tranh leak mem va enforce timeout
async function withPage(fn, options = {}) {
  const { timeoutMs = 30000 } = options;
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Thiết lập timeout mặc định cho toàn bộ thao tác trong tab
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  try {
    return await fn(page, browser);
  } finally {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (_) {}
  }
}

// dong browser khi tat app
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (_) {}
    browserInstance = null;
    launchPromise = null;
  }
}

module.exports = {
  getBrowser,
  withPage,
  closeBrowser,
};
