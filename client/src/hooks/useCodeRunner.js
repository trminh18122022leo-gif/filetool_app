/**
 * useCodeRunner — Hook chạy mã nguồn đa ngôn ngữ
 *
 * - JavaScript/TypeScript: Chạy trực tiếp trong sandbox iframe (instant, offline)
 * - Python, C++, Java, Go, Ruby, PHP, Rust, ... (60+ ngôn ngữ): Piston API (free, no key)
 */
import { useState, useCallback, useRef } from 'react';

// Map file extension → Judge0 Language ID
const EXT_TO_JUDGE0 = {
  py: 100, // Python 3.12.5
  python: 100,
  c: 103, // C (GCC 14.1.0)
  cpp: 105, // C++ (GCC 14.1.0)
  'c++': 105,
  cc: 105,
  cxx: 105,
  java: 91, // Java (JDK 17.0.6)
  go: 107, // Go (1.23.5)
  rb: 72, // Ruby
  ruby: 72,
  rs: 108, // Rust (1.85.0)
  rust: 108,
  php: 98, // PHP 8.3.11
  swift: 83,
  kt: 111, // Kotlin 2.1.10
  kotlin: 111,
  scala: 112, // Scala 3.4.2
  r: 99, // R 4.4.1
  lua: 64,
  perl: 85,
  pl: 85,
  sh: 46, // Bash
  bash: 46,
  cs: 51, // C#
  csharp: 51,
  dart: 90,
  elixir: 57,
  ex: 57,
  clj: 86, // Clojure
  clojure: 86,
  hs: 61, // Haskell
  haskell: 61,
  ts: 101, // TypeScript 5.6.2
  typescript: 101,
  sql: 82, // SQLite
  pas: 67, // Pascal
  pascal: 67,
  fsharp: 87, // F#
  fs: 87,
  vb: 84, // VB.Net
  cobol: 77,
  fortran: 59,
  f90: 59,
  prolog: 69,
};

const JUDGE0_API = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';

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

  // ─── Multi-language: Judge0 API (free public instance) ───
  const runWithJudge0 = useCallback(async (code, language) => {
    const langId = EXT_TO_JUDGE0[language];
    
    if (!langId) {
      throw new Error(`Ngôn ngữ ${language} không được hỗ trợ trên API này.`);
    }

    const response = await fetch(JUDGE0_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: code,
        language_id: langId,
        stdin: ''
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Judge0 API lỗi (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Status ID 3 = Accepted
    const isError = data.status && data.status.id !== 3;
    const time = data.time || '0.000';
    
    let combined = '';
    if (data.compile_output) combined += `⚙️ Compile Output:\n${data.compile_output}\n`;
    if (data.stdout) combined += data.stdout;
    if (data.stderr) combined += (combined ? '\n' : '') + `⚠️ stderr:\n${data.stderr}`;
    if (data.message) combined += (combined ? '\n' : '') + `❌ Error:\n${data.message}`;
    
    combined = combined.trim() || '(Không có output)';

    return {
      output: combined,
      exitCode: isError ? 1 : 0,
      time: time,
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
      } else if (EXT_TO_JUDGE0[ext]) {
        // Gửi tới Judge0 API
        result = await runWithJudge0(code, ext);
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
  }, [getLanguage, runJavaScript, runWithJudge0]);

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
