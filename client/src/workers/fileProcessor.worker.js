/**
 * Web Worker: xử lý tác vụ nặng ngoài Main Thread.
 * Parse JSON lớn, format code, validate schema, encode file, phân tích CSV.
 */

// ── JSON operations ───────────────────────────────────────────────────────────

function handleJson(action, data) {
  switch (action) {
    case 'PARSE': {
      const parsed = JSON.parse(data.content);
      return { parsed, size: JSON.stringify(parsed).length };
    }
    case 'FORMAT': {
      const parsed    = JSON.parse(data.content);
      const formatted = JSON.stringify(parsed, null, data.indent || 2);
      return { formatted };
    }
    case 'MINIFY': {
      const parsed   = JSON.parse(data.content);
      const minified = JSON.stringify(parsed);
      return { minified, savedBytes: data.content.length - minified.length };
    }
    case 'VALIDATE': {
      JSON.parse(data.content); // Throws nếu invalid
      return { valid: true };
    }
    case 'FLATTEN': {
      function flatten(obj, prefix = '') {
        return Object.entries(obj).reduce((acc, [k, v]) => {
          const key = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(acc, flatten(v, key));
          } else {
            acc[key] = v;
          }
          return acc;
        }, {});
      }
      const parsed    = JSON.parse(data.content);
      const flattened = flatten(parsed);
      return { flattened: JSON.stringify(flattened, null, 2) };
    }
    default:
      throw new Error(`Hành động JSON không xác định: ${action}`);
  }
}

// ── CSV operations ────────────────────────────────────────────────────────────

function handleCsv(action, data) {
  switch (action) {
    case 'PARSE': {
      const lines  = data.content.split('\n').filter(l => l.trim());
      if (!lines.length) return { header: [], rows: [], rowCount: 0 };
      const sep    = data.separator || ',';
      const header = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      const rows   = lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
        return header.reduce((obj, h, i) => { obj[h] = vals[i] || ''; return obj; }, {});
      });
      return { header, rows, rowCount: rows.length };
    }
    case 'TO_JSON': {
      const { rows } = handleCsv('PARSE', data);
      return { json: JSON.stringify(rows, null, 2) };
    }
    case 'SORT': {
      const { rows, header } = handleCsv('PARSE', data);
      const sorted = [...rows].sort((a, b) => {
        const va = a[data.column] || '';
        const vb = b[data.column] || '';
        return data.desc ? vb.localeCompare(va) : va.localeCompare(vb);
      });
      const csvLines = [
        header.join(','),
        ...sorted.map(r => header.map(h => `"${r[h]}"`).join(',')),
      ];
      return { sorted: csvLines.join('\n') };
    }
    case 'STATS': {
      const { header, rows } = handleCsv('PARSE', data);
      const stats = header.map(col => {
        const vals    = rows.map(r => r[col]).filter(Boolean);
        const numVals = vals.map(Number).filter(v => !isNaN(v));
        return {
          column:    col,
          count:     vals.length,
          empty:     rows.length - vals.length,
          isNumeric: numVals.length === vals.length && vals.length > 0,
          ...(numVals.length ? {
            min: Math.min(...numVals),
            max: Math.max(...numVals),
            avg: numVals.reduce((s, v) => s + v, 0) / numVals.length,
          } : {}),
        };
      });
      return { stats };
    }
    default:
      throw new Error(`Hành động CSV không xác định: ${action}`);
  }
}

// ── File encoding & helpers ───────────────────────────────────────────────────

function handleFile(action, data) {
  switch (action) {
    case 'ENCODE_BASE64': {
      const encoder = new TextEncoder();
      const bytes   = encoder.encode(data.content);
      let binary    = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      return { encoded: btoa(binary) };
    }
    case 'DECODE_BASE64': {
      const decoded = atob(data.content);
      const bytes   = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      const decoder = new TextDecoder();
      return { decoded: decoder.decode(bytes) };
    }
    case 'LINE_COUNT': {
      const lines    = data.content.split('\n');
      const nonEmpty = lines.filter(l => l.trim()).length;
      const words    = data.content.trim().split(/\s+/).filter(Boolean).length;
      return { lines: lines.length, nonEmpty, words, chars: data.content.length };
    }
    case 'FIND_REPLACE': {
      const regex  = new RegExp(data.find, data.flags || 'g');
      const result = data.content.replace(regex, data.replace);
      const count  = (data.content.match(regex) || []).length;
      return { result, count };
    }
    default:
      throw new Error(`Hành động FILE không xác định: ${action}`);
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e) => {
  const { id, category, action, data } = e.data;
  try {
    let result;
    switch (category) {
      case 'JSON': result = handleJson(action, data); break;
      case 'CSV':  result = handleCsv(action, data); break;
      case 'FILE': result = handleFile(action, data); break;
      default:     throw new Error(`Unknown category: ${category}`);
    }
    self.postMessage({ id, success: true, result });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
