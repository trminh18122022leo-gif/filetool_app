/**
 * useCodeRunner — Hook chạy mã nguồn đa ngôn ngữ
 *
 * - JavaScript/TypeScript: Chạy trực tiếp trong sandbox iframe (instant, offline)
 * - Python, C++, Java, Go, Ruby, PHP, Rust, ... (60+ ngôn ngữ): Piston API (free, no key)
 */
import { useState, useCallback, useRef } from 'react';

// Map file extension → Piston language ID
const EXT_TO_PISTON = {
  py: 'python',
  python: 'python',
  c: 'c',
  cpp: 'c++',
  'c++': 'c++',
  cc: 'c++',
  cxx: 'c++',
  java: 'java',
  go: 'go',
  rb: 'ruby',
  ruby: 'ruby',
  rs: 'rust',
  rust: 'rust',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kotlin: 'kotlin',
  scala: 'scala',
  r: 'r',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  sh: 'bash',
  bash: 'bash',
  cs: 'csharp',
  csharp: 'csharp',
  dart: 'dart',
  elixir: 'elixir',
  ex: 'elixir',
  clj: 'clojure',
  clojure: 'clojure',
  hs: 'haskell',
  haskell: 'haskell',
  ts: 'typescript',
  sql: 'sqlite3',
  pas: 'pascal',
  pascal: 'pascal',
  zig: 'zig',
  nim: 'nim',
  d: 'd',
  groovy: 'groovy',
  julia: 'julia',
  jl: 'julia',
  fsharp: 'fsharp',
  fs: 'fsharp',
  vb: 'basic.net',
  cobol: 'cobol',
  fortran: 'fortran',
  f90: 'fortran',
  prolog: 'prolog',
  tcl: 'tcl',
};

// Piston API version hints (latest known stable)
const PISTON_VERSIONS = {
  python: '3.10.0',
  'c++': '10.2.0',
  c: '10.2.0',
  java: '15.0.2',
  go: '1.16.2',
  ruby: '3.0.1',
  rust: '1.68.2',
  php: '8.2.3',
  swift: '5.3.3',
  kotlin: '1.8.20',
  scala: '3.2.2',
  r: '4.1.1',
  lua: '5.4.4',
  perl: '5.36.0',
  bash: '5.2.0',
  csharp: '6.12.0',
  dart: '2.19.6',
  elixir: '1.11.3',
  clojure: '1.10.3',
  haskell: '9.0.1',
  typescript: '5.0.3',
  sqlite3: '3.36.0',
  pascal: '3.2.2',
  zig: '0.10.0',
  nim: '1.6.2',
  d: '10.2.0',
  groovy: '3.0.7',
  julia: '1.8.5',
  fsharp: '5.0',
  'basic.net': '5.0',
  cobol: '3.1.2',
  fortran: '10.2.0',
  prolog: '8.4.3',
  tcl: '8.6.12',
};

const PISTON_API = 'https://emkc.org/api/v2/piston/execute';

export function useCodeRunner() {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runTime, setRunTime] = useState(null);
  const [exitCode, setExitCode] = useState(null);
  const iframeRef = useRef(null);

  const getLanguage = useCallback((filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    return ext;
  }, []);

  // ─── JavaScript / TypeScript: chạy local bằng sandboxed iframe ───
  const runJavaScript = useCallback((code) => {
    return new Promise((resolve) => {
      // Tạo iframe sandbox ẩn
      const iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-scripts';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const logs = [];
      const startTime = performance.now();
      let resolved = false;

      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        window.removeEventListener('message', onMessage);
      };

      // Timeout 10s
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            output: logs.join('\n') + '\n⏱ Timeout: Mã chạy quá 10 giây, đã dừng.',
            exitCode: 1,
            time: ((performance.now() - startTime) / 1000).toFixed(3),
          });
        }
      }, 10000);

      const onMessage = (event) => {
        if (event.source !== iframe.contentWindow) return;
        const { type, data } = event.data || {};
        if (type === 'console') {
          logs.push(data);
        } else if (type === 'error') {
          logs.push(`❌ ${data}`);
        } else if (type === 'done') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve({
              output: logs.join('\n') || '(Không có output)',
              exitCode: 0,
              time: ((performance.now() - startTime) / 1000).toFixed(3),
            });
          }
        }
      };

      window.addEventListener('message', onMessage);

      // Inject code vào iframe
      const wrappedCode = `
        <script>
          const __logs = [];
          const __origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, table: console.table };

          function __stringify(args) {
            return Array.from(args).map(a => {
              if (a === null) return 'null';
              if (a === undefined) return 'undefined';
              if (typeof a === 'object') {
                try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
              }
              return String(a);
            }).join(' ');
          }

          console.log = function() { parent.postMessage({ type: 'console', data: __stringify(arguments) }, '*'); };
          console.warn = function() { parent.postMessage({ type: 'console', data: '⚠️ ' + __stringify(arguments) }, '*'); };
          console.error = function() { parent.postMessage({ type: 'console', data: '❌ ' + __stringify(arguments) }, '*'); };
          console.info = function() { parent.postMessage({ type: 'console', data: 'ℹ️ ' + __stringify(arguments) }, '*'); };
          console.table = function(data) { parent.postMessage({ type: 'console', data: JSON.stringify(data, null, 2) }, '*'); };

          window.onerror = function(msg, url, line, col, err) {
            parent.postMessage({ type: 'error', data: msg + (line ? ' (dòng ' + line + ')' : '') }, '*');
            return true;
          };

          window.onunhandledrejection = function(e) {
            parent.postMessage({ type: 'error', data: 'Unhandled Promise: ' + (e.reason?.message || e.reason || 'unknown') }, '*');
          };

          try {
            ${code}
          } catch(e) {
            parent.postMessage({ type: 'error', data: e.name + ': ' + e.message }, '*');
          }

          // Đợi một chút cho async code (setTimeout, Promise) có cơ hội chạy
          setTimeout(() => parent.postMessage({ type: 'done' }, '*'), 100);
        <\/script>
      `;

      iframe.srcdoc = wrappedCode;
      iframeRef.current = iframe;
    });
  }, []);

  // ─── Multi-language: Piston API (free, 60+ languages) ───
  const runWithPiston = useCallback(async (code, language) => {
    const pistonLang = EXT_TO_PISTON[language] || language;
    const version = PISTON_VERSIONS[pistonLang] || '*';

    const startTime = performance.now();

    const response = await fetch(PISTON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang,
        version: version,
        files: [{ name: `main.${language}`, content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 10000,
      }),
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Piston API lỗi (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Compile errors
    if (data.compile && data.compile.stderr) {
      return {
        output: `⚙️ Compile Error:\n${data.compile.stderr}`,
        exitCode: data.compile.code ?? 1,
        time: elapsed,
      };
    }

    const run = data.run || {};
    const stdout = run.stdout || '';
    const stderr = run.stderr || '';
    const combined = (stdout + (stderr ? `\n⚠️ stderr:\n${stderr}` : '')).trim() || '(Không có output)';

    return {
      output: combined,
      exitCode: run.code ?? 0,
      time: elapsed,
    };
  }, []);

  // ─── Main run function ───
  const runCode = useCallback(async (code, filename) => {
    setIsRunning(true);
    setOutput('');
    setRunTime(null);
    setExitCode(null);

    try {
      const ext = getLanguage(filename);
      let result;

      if (['js', 'javascript', 'jsx', 'mjs'].includes(ext)) {
        // Chạy local bằng sandboxed iframe
        result = await runJavaScript(code);
      } else if (['html', 'htm'].includes(ext)) {
        // HTML: mở preview
        result = {
          output: '🌐 HTML không chạy bằng Console — Hãy dùng trình duyệt để xem. Bạn có thể mở bằng cách lưu file ra máy và mở bằng Chrome.',
          exitCode: 0,
          time: '0.001',
        };
      } else if (EXT_TO_PISTON[ext]) {
        // Gửi tới Piston API
        result = await runWithPiston(code, ext);
      } else {
        result = {
          output: `⚠️ Ngôn ngữ "${ext}" chưa được hỗ trợ chạy trực tiếp.\n\nCác ngôn ngữ hỗ trợ: JavaScript, Python, C, C++, Java, Go, Ruby, Rust, PHP, Swift, Kotlin, Scala, R, Lua, Perl, Bash, C#, Dart, Elixir, Clojure, Haskell, TypeScript, SQL, Pascal, Zig, Nim, Julia, F#, COBOL, Fortran, Prolog, Tcl và nhiều hơn nữa.`,
          exitCode: 1,
          time: '0.000',
        };
      }

      setOutput(result.output);
      setRunTime(result.time);
      setExitCode(result.exitCode);
    } catch (err) {
      setOutput(`❌ Lỗi: ${err.message}`);
      setExitCode(1);
      setRunTime(null);
    } finally {
      setIsRunning(false);
    }
  }, [getLanguage, runJavaScript, runWithPiston]);

  const clearOutput = useCallback(() => {
    setOutput('');
    setRunTime(null);
    setExitCode(null);
  }, []);

  return {
    output,
    isRunning,
    runTime,
    exitCode,
    runCode,
    clearOutput,
  };
}
