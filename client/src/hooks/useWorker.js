/**
 * Hook dùng Web Worker với Promise-based API.
 */
import { useCallback } from 'react';

let workerInstance = null;
const pendingCallbacks = new Map();
let callId = 0;

function getWorker() {
  if (!workerInstance && typeof window !== 'undefined') {
    workerInstance = new Worker(
      new URL('../workers/fileProcessor.worker.js', import.meta.url),
      { type: 'module' }
    );
    workerInstance.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const callbacks = pendingCallbacks.get(id);
      if (callbacks) {
        pendingCallbacks.delete(id);
        if (success) {
          callbacks.resolve(result);
        } else {
          callbacks.reject(new Error(error));
        }
      }
    };
  }
  return workerInstance;
}

export function useWorker() {
  const run = useCallback((category, action, data) => {
    return new Promise((resolve, reject) => {
      const worker = getWorker();
      if (!worker) {
        return reject(new Error('Web Worker không được hỗ trợ trong môi trường này'));
      }
      const id = ++callId;
      pendingCallbacks.set(id, { resolve, reject });
      worker.postMessage({ id, category, action, data });
    });
  }, []);

  return { run };
}

// Convenience hook cho JSON
export function useJsonWorker() {
  const { run } = useWorker();
  return {
    parse:    (content) => run('JSON', 'PARSE',    { content }),
    format:   (content, indent = 2) => run('JSON', 'FORMAT',  { content, indent }),
    minify:   (content) => run('JSON', 'MINIFY',   { content }),
    validate: (content) => run('JSON', 'VALIDATE', { content }),
    flatten:  (content) => run('JSON', 'FLATTEN',  { content }),
  };
}

// Convenience hook cho CSV
export function useCsvWorker() {
  const { run } = useWorker();
  return {
    parse:  (content, separator) => run('CSV', 'PARSE',    { content, separator }),
    toJson: (content)            => run('CSV', 'TO_JSON',  { content }),
    sort:   (content, column, desc) => run('CSV', 'SORT',  { content, column, desc }),
    stats:  (content)            => run('CSV', 'STATS',    { content }),
  };
}
