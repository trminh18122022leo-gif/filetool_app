/**
 * File System Access API — đọc/ghi trực tiếp file máy tính.
 * Không cần upload/download. Hoạt động trên Chrome/Edge/Opera (Chromium).
 * Fallback sang download cho Firefox / Safari.
 */
import { useRef, useState, useCallback } from 'react';

export const isSupported = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const FILE_TYPES = {
  code: [
    {
      description: 'Source Code',
      accept: {
        'text/*': [
          '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c',
          '.go', '.rs', '.php', '.rb', '.cs', '.html', '.css', '.scss',
          '.json', '.yaml', '.yml', '.xml', '.sql', '.sh'
        ]
      }
    }
  ],
  text: [
    {
      description: 'Text & Markdown files',
      accept: { 'text/plain': ['.txt', '.md', '.csv', '.log'] }
    }
  ],
  data: [
    {
      description: 'Data files',
      accept: {
        'application/json': ['.json'],
        'text/csv': ['.csv'],
        'application/x-yaml': ['.yml', '.yaml']
      }
    }
  ],
  all: [],
};

export function useFileSystemAccess() {
  const handleRef = useRef(null);
  const [filename, setFilename]   = useState(null);
  const [isDirty,  setIsDirty]    = useState(false);

  // Mở file từ máy tính
  const openFile = useCallback(async (typeGroup = 'all') => {
    if (!isSupported) return null;
    try {
      const [handle] = await window.showOpenFilePicker({
        types:                  FILE_TYPES[typeGroup] || [],
        excludeAcceptAllOption: false,
      });
      handleRef.current = handle;

      const file    = await handle.getFile();
      const content = await file.text();
      setFilename(file.name);
      setIsDirty(false);

      return { content, filename: file.name, size: file.size, type: file.type };
    } catch (err) {
      if (err.name === 'AbortError') return null; // User cancelled
      throw err;
    }
  }, []);

  // Lưu với tên/vị trí mới (Ctrl+Shift+S hoặc fallback)
  const saveFileAs = useCallback(async (content, suggestedName = 'document.txt') => {
    if (!isSupported) {
      // Fallback: download qua Blob
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      return { saved: true, filename: suggestedName };
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'All Files', accept: { 'text/plain': [] } }],
      });
      handleRef.current = handle;
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      setFilename(handle.name);
      setIsDirty(false);
      return { saved: true, filename: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return { saved: false };
      throw err;
    }
  }, []);

  // Lưu vào file đang mở (Ctrl+S)
  const saveFile = useCallback(async (content, defaultName = 'document.txt') => {
    if (handleRef.current) {
      try {
        const writable = await handleRef.current.createWritable();
        await writable.write(content);
        await writable.close();
        setIsDirty(false);
        return { saved: true, filename: handleRef.current.name };
      } catch (_) {
        // Permission bị thu hồi hoặc đổi vị trí → fallback sang Save As
        return saveFileAs(content, handleRef.current.name || defaultName);
      }
    }
    return saveFileAs(content, filename || defaultName);
  }, [filename, saveFileAs]);

  // Mở thư mục
  const openDirectory = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) return null;
    try {
      const dirHandle = await window.showDirectoryPicker();
      const entries   = [];
      for await (const [name, handle] of dirHandle.entries()) {
        entries.push({ name, type: handle.kind, handle });
      }
      return { name: dirHandle.name, entries, handle: dirHandle };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);

  return {
    openFile,
    saveFile,
    saveFileAs,
    openDirectory,
    markDirty,
    filename,
    isDirty,
    hasHandle: !!handleRef.current,
    isSupported,
  };
}
