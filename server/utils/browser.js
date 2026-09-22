'use strict';

const puppeteer = require('puppeteer');

// singleton browser instance & launch lock
let browserInstance = null;
let launchPromise = null;

// flags toi uu ram & cpu cho chromium headless
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
];

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
        args: BROWSER_ARGS,
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

// chay task tren tab moi, tu dong dong tab tranh leak mem
async function withPage(fn) {
  const browser = await getBrowser();
  const page = await browser.newPage();
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
