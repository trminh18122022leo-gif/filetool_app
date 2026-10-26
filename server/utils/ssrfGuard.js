'use strict';

/**
 * server/utils/ssrfGuard.js
 * Phòng vệ SSRF, DNS Rebinding và cô lập mạng cho Puppeteer / Renderers.
 * Tuân thủ Finding S-06 & Document Processing Security Spec.
 */

const dns = require('dns');
const net = require('net');

/**
 * Kiểm tra xem một IP (IPv4 hoặc IPv6) có thuộc vùng mạng nội bộ,
 * link-local, cloud metadata, multicast hoặc reserved không.
 */
function isPrivateOrReservedIP(ip) {
  if (!ip || typeof ip !== 'string') return true;
  ip = ip.trim();

  // Xử lý IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const rest = ip.slice(7);
    if (net.isIPv4(rest)) {
      ip = rest;
    }
  }

  // IPv4 Evaluation
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed -> deny
    }

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (RFC 1918 Private)
    if (parts[0] === 10) return true;
    // 100.64.0.0/10 (RFC 6598 Carrier-Grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 127.0.0.0/8 (RFC 1122 Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (RFC 3927 Link-Local & AWS/GCP/Azure/Render Instance Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1 Documentation)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    // 192.88.99.0/24 (6to4 Relay)
    if (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) return true;
    // 192.168.0.0/16 (RFC 1918 Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2 Documentation)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3 Documentation)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 Evaluation
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Unspecified :: or Loopback ::1
    if (lower === '::' || lower === '::1') return true;
    // Unique Local fc00::/7 (fc00 to fdff)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link Local fe80::/10
    if (/^fe[89ab][0-9a-f]/i.test(lower) || lower.startsWith('fe80:')) return true;
    // Multicast ff00::/8
    if (lower.startsWith('ff')) return true;
    // Documentation / benchmark / 6to4
    if (lower.startsWith('2001:db8') || lower.startsWith('2002:')) return true;

    return false;
  }

  // Unknown format -> Fail closed
  return true;
}

/**
 * Kiểm tra các tên miền nguy hiểm hoặc thuộc phạm vi nội bộ
 */
function isForbiddenHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const lower = hostname.toLowerCase().trim();

  // Localhost aliases
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) {
    return true;
  }

  // Internal domain TLDs
  if (lower.endsWith('.internal') || lower.endsWith('.lan') || lower.endsWith('.home') || lower.endsWith('.corp') || lower.endsWith('.arpa')) {
    return true;
  }

  // Cloud metadata domain aliases
  if (lower === 'metadata.google.internal' || lower === 'metadata' || lower === 'instance-data') {
    return true;
  }

  // Dạng IP trực tiếp
  if (net.isIP(lower)) {
    return isPrivateOrReservedIP(lower);
  }

  return false;
}

// DNS Cache tạm thời để tăng tốc nhưng giới hạn TTL
const dnsCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function resolveHostSafely(hostname) {
  if (isForbiddenHostname(hostname)) {
    throw new Error(`Hostname '${hostname}' bị từ chối truy cập (forbidden local/internal domain).`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error(`Địa chỉ IP '${hostname}' thuộc dải mạng nội bộ hoặc hệ thống bảo vệ.`);
    }
    return [hostname];
  }

  const now = Date.now();
  const cached = dnsCache.get(hostname);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.addresses;
  }

  let records;
  try {
    records = await dns.promises.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`Không thể phân giải DNS cho tên miền '${hostname}': ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new Error(`Tên miền '${hostname}' không trả về bản ghi địa chỉ IP hợp lệ.`);
  }

  const addresses = records.map(r => r.address);
  for (const addr of addresses) {
    if (isPrivateOrReservedIP(addr)) {
      throw new Error(`Tên miền '${hostname}' trỏ về địa chỉ IP nội bộ '${addr}' (SSRF/DNS Rebinding blocked).`);
    }
  }

  dnsCache.set(hostname, { addresses, timestamp: now });
  return addresses;
}

/**
 * Kiểm tra và chuẩn hoá URL cho các tác vụ tải tài nguyên từ xa
 */
async function validateSafeUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (_) {
    throw new Error('URL không đúng định dạng');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Giao thức '${parsed.protocol}' bị từ chối. Chỉ chấp nhận HTTP hoặc HTTPS.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('Không chấp nhận thông tin xác thực (credentials) nhúng trong URL.');
  }

  await resolveHostSafely(parsed.hostname);
  return parsed;
}

/**
 * Cấu hình bảo vệ mạng cho Puppeteer page
 * @param {import('puppeteer').Page} page
 * @param {Object} options
 * @param {'deny-all'|'allow-safe-remote'} [options.mode='deny-all']
 * @param {boolean} [options.allowDataUris=true]
 */
async function protectPageNetwork(page, options = {}) {
  const {
    mode = 'deny-all',
    allowDataUris = true,
  } = options;

  await page.setRequestInterception(true);

  page.on('request', async (req) => {
    try {
      const reqUrl = req.url();
      let parsed;
      try {
        parsed = new URL(reqUrl);
      } catch (_) {
        return req.abort('failed');
      }

      // Cho phép data URI hoặc blob cho ảnh nhúng inline
      if (allowDataUris && (parsed.protocol === 'data:' || parsed.protocol === 'blob:')) {
        return req.continue();
      }

      // Tuyệt đối chặn file://, gopher://, ftp://, dict://
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return req.abort('accessdenied');
      }

      // Chế độ Deny-All (mặc định an toàn cho HTML-to-PDF / Markdown-to-PDF)
      if (mode === 'deny-all') {
        return req.abort('accessdenied');
      }

      // Chế độ Allow Safe Remote (cho URL-to-PDF khi đã bật feature flag)
      if (mode === 'allow-safe-remote') {
        if (isForbiddenHostname(parsed.hostname)) {
          return req.abort('accessdenied');
        }
        try {
          await resolveHostSafely(parsed.hostname);
          return req.continue();
        } catch (_) {
          return req.abort('accessdenied');
        }
      }

      return req.abort('accessdenied');
    } catch (_) {
      try { req.abort('failed'); } catch (_) {}
    }
  });
}

/**
 * Kiểm tra feature flag bật URL-to-PDF
 */
function isUrlToPdfEnabled() {
  return process.env.ENABLE_URL_TO_PDF === 'true';
}

module.exports = {
  isPrivateOrReservedIP,
  isForbiddenHostname,
  resolveHostSafely,
  validateSafeUrl,
  protectPageNetwork,
  isUrlToPdfEnabled,
};
