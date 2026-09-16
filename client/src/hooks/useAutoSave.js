/**
 * Auto-save hook: lưu vào IndexedDB sau mỗi khoảng idle.
 * Thông báo trạng thái lưu cho user.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { saveDraft, saveVersion } from '../services/indexeddb.service';

export function useAutoSave(draftId, content, opts = {}) {
  const {
    delay        = 2000,   // ms chờ sau khi user ngừng gõ
    versionEvery = 60000,  // ms tự tạo version (0 = tắt)
    filename     = 'Untitled',
    language     = 'plaintext',
  } = opts;

  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSaved,  setLastSaved]  = useState(null);
  const timerRef        = useRef(null);
  const versionTimerRef = useRef(null);
  const prevContent     = useRef(content);

  const doSave = useCallback(async (createVersion = false) => {
    if (!draftId || (content === prevContent.current && !createVersion)) return;
    setSaveStatus('saving');
    try {
      await saveDraft(draftId, { content, filename, language });
      if (createVersion) {
        await saveVersion(draftId, content);
      }
      prevContent.current = content;
      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      console.error('[AutoSave] Failed:', err);
    }
  }, [draftId, content, filename, language]);

  // Auto-save khi content thay đổi
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(false), delay);
    return () => clearTimeout(timerRef.current);
  }, [content, doSave, delay]);

  // Tạo version định kỳ
  useEffect(() => {
    if (!versionEvery) return;
    versionTimerRef.current = setInterval(() => doSave(true), versionEvery);
    return () => clearInterval(versionTimerRef.current);
  }, [doSave, versionEvery]);

  // Ctrl+S force save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave(true); // Tạo version khi Ctrl+S
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSave]);

  return { saveStatus, lastSaved, forceSave: () => doSave(true) };
}
