'use strict';

const puppeteer = require('puppeteer');

// singleton browser instance & launch lock
let browserInstance = null;
let launchPromise = null;

/**
 * Returns optimized security and resource limiting flags for headless Chromium.
 * 
 * Invariants:
 * - Sandbox is PREFERRED and enabled by default.
 * - Does NOT disable sandbox merely because process.env.RENDER === 'true'.
 * - Disables dev-shm-usage, GPU, background networking, and audio for containment.
 * 
 * @param {object} [options]
 * @param {boolean} [options.forceNoSandbox=false]
 * @returns {string[]}
 */
function getBrowserArgs(options = {}) {
  const { forceNoSandbox = false } = options;
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

  // Explicit dual authorization required: Admin must specify CHROMIUM_NO_SANDBOX=true
  // AND container isolation must be verified with ALLOW_SANDBOX_FALLBACK=true.
  // Unconditional Linux fallback (process.platform === 'linux') is strictly forbidden.
  const isFallbackAuthorized = process.env.CHROMIUM_NO_SANDBOX === 'true' && process.env.ALLOW_SANDBOX_FALLBACK === 'true';
  const explicitNoSandbox = isFallbackAuthorized || forceNoSandbox;

  // Sandbox is ONLY disabled when both administrative flags are verified or forced by authorized caller
  if (explicitNoSandbox) {
    if (!process.env.SUPPRESS_SANDBOX_WARNING) {
      console.warn('[SECURITY WARNING] Chromium running in no-sandbox mode. Strict compensating network and container isolation must be verified.');
    }
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  return args;
}

/**
 * Retrieves or launches the singleton Puppeteer Chromium browser instance.
 * Attempts sandboxed execution first; falls back ONLY if kernel denies user namespaces
 * AND explicit dual authorization (CHROMIUM_NO_SANDBOX=true + ALLOW_SANDBOX_FALLBACK=true) is present.
 * If sandboxing is unavailable and authorization is missing, FAILS CLOSED with HTML_RENDERING_DISABLED_NO_SANDBOX.
 * 
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    try {
      let browser;
      try {
        // 1. Primary attempt: Sandboxed launch (highest security guarantee)
        browser = await puppeteer.launch({
          headless: true,
          args: getBrowserArgs({ forceNoSandbox: false }),
        });
      } catch (launchErr) {
        const isSandboxError = /No usable sandbox|zygote_host_impl_linux|setuid sandbox|running as root without --no-sandbox/i.test(launchErr.message);
        const isDualAuthorized = process.env.CHROMIUM_NO_SANDBOX === 'true' && process.env.ALLOW_SANDBOX_FALLBACK === 'true';

        if (isSandboxError) {
          if (isDualAuthorized) {
            console.warn('[APPSEC AUDIT] Operating system kernel does not support unprivileged user namespaces. Activating compensating container isolation and no-sandbox fallback.');
            browser = await puppeteer.launch({
              headless: true,
              args: getBrowserArgs({ forceNoSandbox: true }),
            });
          } else {
            console.error('[APPSEC FAIL-CLOSED] Chromium sandbox unavailable and container isolation fallback is unauthorized. Failing closed.');
            const error = new Error('HTML rendering disabled: Chromium sandbox unavailable and container isolation fallback is unauthorized (HTML_RENDERING_DISABLED_NO_SANDBOX)');
            error.code = 'HTML_RENDERING_DISABLED_NO_SANDBOX';
            error.statusCode = 503;
            throw error;
          }
        } else {
          throw launchErr;
        }
      }

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

/**
 * Runs a task inside an isolated browser page context with automatic cleanup,
 * strict navigation timeouts, and lifecycle protection.
 * 
 * @param {Function} fn - async (page, browser) => Promise<any>
 * @param {object} [options]
 * @param {number} [options.timeoutMs=30000]
 * @returns {Promise<any>}
 */
async function withPage(fn, options = {}) {
  const { timeoutMs = 30000 } = options;
  const browser = await getBrowser();
  const page = await browser.newPage();

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

/**
 * Closes singleton browser instance gracefully during shutdown
 */
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
  getBrowserArgs,
  withPage,
  closeBrowser,
};
