import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  FileText, Layers, Scissors, RotateCw, ShieldAlert, Minimize2,
  Stamp, Lock, ArrowRightLeft, Undo2, Redo2, Download, AlertCircle,
  Sparkles, CheckCircle2, ChevronRight, Upload
} from 'lucide-react';
import { useVirtualPdfThumbnails } from '../../hooks/useVirtualPdfThumbnails';
import ThumbnailRail from './ThumbnailRail';
import PdfViewport from './PdfViewport';
import PdfInspector from './PdfInspector';
import PdfPasswordModal from './PdfPasswordModal';
import ProgressBar from '../ProgressBar';
import ResultDownload from '../ResultDownload';
import FileDropzone from '../FileDropzone';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfStudioEngine({
  initialFile = null,
  initialAction = 'organize',
  onBack,
}) {
  const [file, setFile] = useState(initialFile);
  const [activeAction, setActiveAction] = useState(initialAction);

  // Studio Document & Page State
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedPageIds, setSelectedPageIds] = useState(new Set());

  // History Undo / Redo Stack
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Inspector Action Parameters
  const [actionParams, setActionParams] = useState({
    compressQuality: 'ebook',
    splitRange: '',
    watermarkText: 'CONFIDENTIAL',
    watermarkOpacity: 0.3,
    userPassword: '',
    targetFormat: 'markdown',
    customKeywords: [],
  });

  // PII Redaction matches & active redactions
  const [piiMatches, setPiiMatches] = useState([]);
  const [redactions, setRedactions] = useState([]);
  const [scanningPii, setScanningPii] = useState(false);

  // Execution & Progress State
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Virtualized Thumbnail Hook
  const {
    pageCount,
    thumbnails,
    ensurePagesRendered,
    needsPassword,
    loading: thumbLoading,
    error: thumbError,
  } = useVirtualPdfThumbnails(file);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (needsPassword) {
      setPasswordModalOpen(true);
    }
  }, [needsPassword]);

  // Initialize Page State when a new file loads
  useEffect(() => {
    if (pageCount > 0) {
      const initialPages = Array.from({ length: pageCount }, (_, i) => ({
        id: uuidv4(),
        originalPageNum: i + 1,
        rotation: 0,
      }));
      setPages(initialPages);
      setActivePageIndex(0);
      setSelectedPageIds(new Set());
      setHistory([initialPages]);
      setHistoryIndex(0);
      setRedactions([]);
      setPiiMatches([]);
    }
  }, [pageCount]);

  // Record a state change snapshot for Undo/Redo
  const pushHistory = useCallback((newPages) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newPages];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setPages(history[targetIndex]);
      setHistoryIndex(targetIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setPages(history[targetIndex]);
      setHistoryIndex(targetIndex);
    }
  };

  // Keyboard shortcut Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [historyIndex, history]);

  // Page Operations
  const handleRotatePage = (pageId) => {
    const next = pages.map(p => {
      if (p.id === pageId) {
        return { ...p, rotation: (p.rotation + 90) % 360 };
      }
      return p;
    });
    setPages(next);
    pushHistory(next);
  };

  const handleDeletePage = (pageId) => {
    if (pages.length <= 1) {
      setError('Tài liệu phải giữ lại ít nhất 1 trang.');
      return;
    }
    const next = pages.filter(p => p.id !== pageId);
    setPages(next);
    pushHistory(next);
    if (activePageIndex >= next.length) {
      setActivePageIndex(Math.max(0, next.length - 1));
    }
  };

  const handleReorderPages = (oldIndex, newIndex) => {
    const next = [...pages];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setPages(next);
    pushHistory(next);
    setActivePageIndex(newIndex);
  };

  const handleToggleSelectPage = (pageId) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedPageIds(new Set(pages.map(p => p.id)));
  const handleDeselectAll = () => setSelectedPageIds(new Set());

  // Redaction Handlers
  const handleScanPii = async () => {
    if (!file) return;
    setScanningPii(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (actionParams.customKeywords?.length) {
        formData.append('customKeywords', JSON.stringify(actionParams.customKeywords));
      }

      const res = await axios.post(`${API}/api/pdf/redact-scan`, formData);
      if (res.data.success) {
        const matches = (res.data.piiMatches || []).map(m => ({ ...m, checked: true }));
        setPiiMatches(matches);

        // Convert PII matches to visual redaction rectangles
        const initialRedacts = matches.map(m => ({
          pageNum: m.pageNum || 1,
          x: m.bbox?.x || 50,
          y: m.bbox?.y || 100,
          width: m.bbox?.width || 120,
          height: m.bbox?.height || 20,
          label: `${m.label}: ${m.value}`,
        }));
        setRedactions(initialRedacts);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Quét PII thất bại. Vui lòng thử lại.');
    } finally {
      setScanningPii(false);
    }
  };

  const handleTogglePiiMatch = (idx) => {
    setPiiMatches(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], checked: !next[idx].checked };
      return next;
    });
  };

  const handleAddRedaction = (newRect) => {
    setRedactions(prev => [...prev, newRect]);
  };

  // Execute & Export Action
  const handleExecuteAction = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(20);
    setError(null);
    setResult(null);

    try {
      let endpoint = '';
      const formData = new FormData();

      if (activeAction === 'organize' || activeAction === 'merge') {
        endpoint = `${API}/api/pdf/merge`;
        formData.append('files', file);
        // Pass complete page order and rotation instructions
        const pageOrder = pages.map((p, idx) => ({
          fileIndex: 0,
          pageNum: p.originalPageNum,
          rotation: p.rotation || 0,
        }));
        formData.append('pageOrder', JSON.stringify(pageOrder));
      } else if (activeAction === 'compress') {
        endpoint = `${API}/api/pdf/compress`;
        formData.append('file', file);
        formData.append('quality', actionParams.compressQuality || 'ebook');
      } else if (activeAction === 'split') {
        endpoint = `${API}/api/pdf/split`;
        formData.append('file', file);
      } else if (activeAction === 'redact') {
        endpoint = `${API}/api/pdf/redact`;
        formData.append('file', file);
        formData.append('flatten', 'true');
        formData.append('redactions', JSON.stringify(redactions));
      } else if (activeAction === 'watermark') {
        endpoint = `${API}/api/pdf/watermark`;
        formData.append('file', file);
        formData.append('text', actionParams.watermarkText || 'CONFIDENTIAL');
        formData.append('opacity', String(actionParams.watermarkOpacity || 0.3));
      } else if (activeAction === 'protect') {
        endpoint = `${API}/api/pdf/protect`;
        formData.append('file', file);
        formData.append('userPassword', actionParams.userPassword);
      } else if (activeAction === 'convert') {
        if (actionParams.targetFormat === 'markdown') endpoint = `${API}/api/pdf/to-markdown`;
        else if (actionParams.targetFormat === 'excel') endpoint = `${API}/api/pdf/to-excel`;
        else if (actionParams.targetFormat === 'pptx') endpoint = `${API}/api/pdf/to-pptx`;
        else endpoint = `${API}/api/pdf/to-pdfa`;
        formData.append('file', file);
      }

      setProgress(60);
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(Math.round((evt.loaded / evt.total) * 40));
          }
        },
      });

      setProgress(100);
      setResult(res.data);
    } catch (err) {
      console.error('[PdfStudio] Execution error:', err);
      setError(err.response?.data?.error || err.message || 'Xử lý thất bại. Vui lòng kiểm tra lại file.');
    } finally {
      setLoading(false);
    }
  };

  // If no file loaded yet, show the unified Smart Dropzone
  if (!file) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-3">
            <Sparkles size={14} />
            <span>PDF Studio Engine 2026</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-gradient">
            Trung Tâm Xử Lý PDF Trực Quan
          </h1>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            Gộp, tách, sắp xếp, che giấu thông tin nhạy cảm PII và chuyển đổi tài liệu với giao diện chuẩn Apple Desktop.
          </p>
        </div>

        <FileDropzone
          onFilesSelected={(selectedFiles) => {
            if (selectedFiles && selectedFiles.length > 0) {
              setFile(selectedFiles[0]);
            }
          }}
          accept=".pdf"
          multiple={false}
          maxSize={100 * 1024 * 1024}
        />
      </div>
    );
  }

  const activePage = pages[activePageIndex];

  return (
    <div
      className="flex flex-col h-[calc(100vh-10rem)] min-h-[600px] rounded-2xl border shadow-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* ── 1. COMMAND TOOLBAR ── */}
      <div
        className="h-14 px-4 border-b flex items-center justify-between shrink-0 select-none backdrop-blur-xl"
        style={{
          backgroundColor: 'var(--bg-overlay)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Left: Document Name & Page Stats */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <FileText size={18} />
          </div>
          <div className="truncate max-w-[200px] sm:max-w-xs">
            <div className="font-bold text-xs truncate text-gray-200">{file.name}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {pages.length} trang · {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>

        {/* Center: Action Switcher Tabs */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5">
          {[
            { id: 'organize', label: 'Sắp xếp', icon: Layers },
            { id: 'redact', label: 'Che PII', icon: ShieldAlert },
            { id: 'split', label: 'Tách file', icon: Scissors },
            { id: 'compress', label: 'Nén', icon: Minimize2 },
            { id: 'watermark', label: 'Watermark', icon: Stamp },
            { id: 'protect', label: 'Mật khẩu', icon: Lock },
            { id: 'convert', label: 'Chuyển đổi', icon: ArrowRightLeft },
          ].map(tool => {
            const active = activeAction === tool.id;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveAction(tool.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-500 text-slate-900 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={13} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Undo / Redo & File Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-xl border border-inherit hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none text-gray-300 cursor-pointer"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-xl border border-inherit hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none text-gray-300 cursor-pointer"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="ml-2 px-3 py-1.5 rounded-xl border border-inherit text-xs text-gray-400 hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            Đổi File
          </button>
        </div>
      </div>

      {/* ── 2. THREE-PANE STUDIO WORKBENCH ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Virtualized Thumbnail Rail */}
        <ThumbnailRail
          pages={pages}
          activePageIndex={activePageIndex}
          selectedPageIds={selectedPageIds}
          thumbnails={thumbnails}
          onActivatePage={(idx) => setActivePageIndex(idx)}
          onToggleSelectPage={handleToggleSelectPage}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onRotatePage={handleRotatePage}
          onDeletePage={handleDeletePage}
          onReorderPages={handleReorderPages}
          onEnsureVisible={ensurePagesRendered}
        />

        {/* Center: High-Fidelity PDF.js Viewport */}
        <PdfViewport
          file={file}
          activePage={activePage}
          pageIndex={activePageIndex}
          totalPages={pages.length}
          rotation={activePage?.rotation || 0}
          redactions={redactions}
          onAddRedaction={handleAddRedaction}
          isRedactMode={activeAction === 'redact'}
          onPrevPage={() => setActivePageIndex(p => Math.max(0, p - 1))}
          onNextPage={() => setActivePageIndex(p => Math.min(pages.length - 1, p + 1))}
        />

        {/* Right: Contextual Inspector */}
        <PdfInspector
          activeAction={activeAction}
          actionParams={actionParams}
          onChangeParams={setActionParams}
          onExecuteAction={handleExecuteAction}
          onScanPii={handleScanPii}
          scanningPii={scanningPii}
          piiMatches={piiMatches}
          redactions={redactions}
          onTogglePiiMatch={handleTogglePiiMatch}
          loading={loading}
          error={error}
        />
      </div>

      {/* ── 3. BOTTOM EXPORT / PROGRESS OVERLAY ── */}
      {loading && (
        <div className="absolute inset-x-0 bottom-0 p-4 bg-black/80 backdrop-blur-md border-t border-cyan-500/30 z-50">
          <ProgressBar progress={progress} label="Đang hoàn thiện tài liệu..." />
        </div>
      )}

      {result && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl p-6 border shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base">Xử Lý Hoàn Tất!</h3>
                <p className="text-xs text-gray-400">File đã được tạo thành công và bảo mật.</p>
              </div>
            </div>

            <ResultDownload result={result} />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
              >
                Tiếp tục chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Protection Modal */}
      <PdfPasswordModal
        isOpen={passwordModalOpen}
        fileName={file?.name}
        onSubmit={(pwd) => {
          setPasswordModalOpen(false);
          // Try loading with entered password
        }}
        onCancel={() => {
          setPasswordModalOpen(false);
          setFile(null);
        }}
      />
    </div>
  );
}
