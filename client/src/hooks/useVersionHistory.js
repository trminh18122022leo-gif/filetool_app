/**
 * Version history hook: in-memory undo/redo + IndexedDB snapshot.
 */
import { useState, useCallback, useRef } from 'react';

const MAX_MEMORY_HISTORY = 100; // Số bước undo/redo trong RAM

export function useVersionHistory(initialValue = '') {
  const [history, setHistory] = useState([{ content: initialValue, ts: Date.now() }]);
  const [pointer, setPointer] = useState(0);
  const skipRef               = useRef(false); // Skip push khi undo/redo

  const currentContent = history[pointer]?.content ?? initialValue;

  // Thêm state mới (khi user chỉnh sửa)
  const push = useCallback((content) => {
    if (skipRef.current) return;
    setHistory(prev => {
      const truncated = prev.slice(0, pointer + 1);
      const newEntry  = { content, ts: Date.now() };
      const newHist   = [...truncated, newEntry].slice(-MAX_MEMORY_HISTORY);
      return newHist;
    });
    setPointer(prev => Math.min(prev + 1, MAX_MEMORY_HISTORY - 1));
  }, [pointer]);

  // Undo
  const undo = useCallback(() => {
    if (pointer <= 0) return null;
    skipRef.current = true;
    const newPtr    = pointer - 1;
    setPointer(newPtr);
    setTimeout(() => { skipRef.current = false; }, 50);
    return history[newPtr]?.content;
  }, [pointer, history]);

  // Redo
  const redo = useCallback(() => {
    if (pointer >= history.length - 1) return null;
    skipRef.current = true;
    const newPtr    = pointer + 1;
    setPointer(newPtr);
    setTimeout(() => { skipRef.current = false; }, 50);
    return history[newPtr]?.content;
  }, [pointer, history]);

  // Nhảy đến version cụ thể
  const jumpTo = useCallback((index) => {
    if (index < 0 || index >= history.length) return null;
    skipRef.current = true;
    setPointer(index);
    setTimeout(() => { skipRef.current = false; }, 50);
    return history[index]?.content;
  }, [history]);

  return {
    push, undo, redo, jumpTo,
    canUndo:     pointer > 0,
    canRedo:     pointer < history.length - 1,
    totalSteps:  history.length,
    currentStep: pointer + 1,
    history:     history.map((h, i) => ({ ...h, isCurrent: i === pointer })),
    content:     currentContent,
  };
}
