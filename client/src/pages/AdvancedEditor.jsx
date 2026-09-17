/**
 * Advanced Editor — Monaco VS Code Engine · Data Table · AI Assistant · Auto-Save
 * Hỗ trợ mở/lưu trực tiếp file qua File System Access API, Yjs Collaboration và Web Worker.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import MonacoEditorWrapper from '../components/editors/MonacoEditor';
import DataTableEditor from '../components/editors/DataTableEditor';
import { useAutoSave } from '../hooks/useAutoSave';
import { useFileSystemAccess } from '../hooks/useFileSystemAccess';
import { useJsonWorker, useCsvWorker } from '../hooks/useWorker';
import { useCollaboration } from '../hooks/useCollaboration';
import { useAuth } from '../context/AuthContext';
import {
  getDraft,
  getVersions,
  restoreVersion,
  listDrafts,
  saveVersion,
} from '../services/indexeddb.service';
import axios from 'axios';
import {
  FolderOpen, Save, History, Sparkles, Code2, Table2,
  HardDrive, Users, Check, X, Clock, Loader2, Play,
  FileCode2, ShieldAlert, CheckCircle, HelpCircle, ArrowRight,
  Terminal, ChevronDown, ChevronUp, Trash2, Square
} from 'lucide-react';
import { useCodeRunner } from '../hooks/useCodeRunner';

const API = import.meta.env.VITE_API_URL || '';
const DRAFT_ID = 'filetools-advanced-editor-main';

const DEFAULT_SAMPLE_CODE = `// ⚡ FileTools Pro — Advanced Code & Data Editor
// Hỗ trợ 100+ ngôn ngữ lập trình, Markdown Live Preview, và Bảng dữ liệu CSV/JSON.

function calculateFileMetrics(files) {
  return files.reduce((acc, file) => {
    acc.totalSize += file.size || 0;
    acc.count += 1;
    return acc;
  }, { totalSize: 0, count: 0 });
}

console.log("FileTools Pro Advanced Editor sẵn sàng!");
`;

function detectEditorType(fname = '', content = '') {
  const ext = fname.split('.').pop()?.toLowerCase();
  if (['csv', 'tsv'].includes(ext)) return 'datatable-csv';
  if (['json'].includes(ext)) {
    try {
      const d = JSON.parse(content);
      if (Array.isArray(d)) return 'datatable-json';
    } catch (_) {}
    return 'code';
  }
  return 'code';
}

export default function AdvancedEditor() {
  const { user } = useAuth();
  const [content,    setContent]    = useState(DEFAULT_SAMPLE_CODE);
  const [filename,   setFilename]   = useState('main.js');
  const [editorType, setEditorType] = useState('code');

  // Modals & Sidebars
  const [showHistory, setShowHistory] = useState(false);
  const [dbVersions,  setDbVersions]  = useState([]);
  const [showAI,      setShowAI]      = useState(false);
  const [aiPrompt,    setAiPrompt]    = useState('');
  const [aiResult,    setAiResult]    = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiAction,    setAiAction]    = useState('');
  const [showDrafts,  setShowDrafts]  = useState(false);
  const [draftsList,  setDraftsList]  = useState([]);
  const [showConsole, setShowConsole] = useState(false);

  // Code Runner
  const { output: consoleOutput, isRunning, runTime, exitCode, runCode, clearOutput } = useCodeRunner();

  // Real-time Collaboration (Yjs)
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [roomId,        setRoomId]        = useState('filetools-collab-room');
  const [showCollabModal, setShowCollabModal] = useState(false);
  const editorInstanceRef = useRef(null);

  const { connected: collabConnected, peerCount, peers } = useCollaboration(
    roomId,
    editorInstanceRef,
    {
      enabled: collabEnabled,
      username: user?.name || 'User ' + Math.floor(Math.random() * 1000),
      color: '#f59e0b',
    }
  );

  // File System Access API
  const fsAccess = useFileSystemAccess();

  // Auto-save vào IndexedDB
  const { saveStatus, lastSaved, forceSave } = useAutoSave(DRAFT_ID, content, {
    filename,
    language: editorType === 'code' ? undefined : editorType,
  });

  // Web Workers
  const jsonWorker = useJsonWorker();
  const csvWorker  = useCsvWorker();

  // Khôi phục bản nháp từ IndexedDB khi mở trang lần đầu
  useEffect(() => {
    let mounted = true;
    getDraft(DRAFT_ID).then(draft => {
      if (mounted && draft?.content) {
        setContent(draft.content);
        if (draft.filename) {
          setFilename(draft.filename);
          setEditorType(detectEditorType(draft.filename, draft.content));
        }
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Keyboard shortcut: Ctrl+Enter to run code
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning) {
          setShowConsole(true);
          runCode(content, filename);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, filename, isRunning, runCode]);

  // Mở file từ máy tính
  const handleOpenFile = async () => {
    try {
      const result = await fsAccess.openFile('all');
      if (result) {
        setContent(result.content);
        setFilename(result.filename);
        setEditorType(detectEditorType(result.filename, result.content));
      }
    } catch (err) {
      console.warn('Mở file không thành công:', err);
    }
  };

  // Lưu file vào máy
  const handleSaveToDisk = async () => {
    try {
      const result = await fsAccess.saveFile(content, filename);
      if (result?.saved) {
        forceSave();
      }
    } catch (err) {
      console.warn('Lưu file không thành công:', err);
    }
  };

  // Lấy danh sách Versions
  const handleShowHistory = async () => {
    const versions = await getVersions(DRAFT_ID);
    setDbVersions(versions || []);
    setShowHistory(true);
  };

  // Khôi phục một Version
  const handleRestoreVersion = async (versionId) => {
    const version = await restoreVersion(versionId);
    if (version) {
      setContent(version.content);
      setShowHistory(false);
    }
  };

  // Tạo Snapshot Version thủ công
  const handleCreateSnapshot = async () => {
    await saveVersion(DRAFT_ID, content, `Snapshot (${new Date().toLocaleTimeString('vi-VN')})`);
    handleShowHistory();
  };

  // AI Assistant Request
  const handleAIRequest = async (type, customText = '') => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiResult('');
    setAiAction(type);

    const codeSnippet = content.slice(0, 6000);
    let endpoint = '/api/ai/chat';
    let body = {};

    if (type === 'explain') {
      endpoint = '/api/ai/explain-code';
      body = { code: codeSnippet, language: filename.split('.').pop() || 'javascript' };
    } else if (type === 'security') {
      endpoint = '/api/ai/security-audit';
      body = { code: codeSnippet, language: filename.split('.').pop() || 'javascript' };
    } else if (type === 'tests') {
      endpoint = '/api/ai/generate-tests';
      body = { code: codeSnippet, language: filename.split('.').pop() || 'javascript' };
    } else if (type === 'text-to-data') {
      endpoint = '/api/ai/text-to-data';
      body = { text: customText || aiPrompt, format: 'json' };
    } else {
      endpoint = '/api/ai/chat';
      body = { text: customText || aiPrompt, language: 'vi' };
    }

    try {
      const { data } = await axios.post(`${API}${endpoint}`, body, { withCredentials: true });
      if (type === 'security' && Array.isArray(data.issues)) {
        setAiResult(JSON.stringify(data.issues, null, 2));
      } else {
        setAiResult(data.answer || data.tests || data.data || data.text || 'Hoàn tất phân tích.');
      }
    } catch (err) {
      setAiResult(`Lỗi kết nối AI: ${err.response?.data?.error || err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Quick Worker Formatting
  const handleFormatJson = async () => {
    try {
      const { formatted } = await jsonWorker.format(content, 2);
      if (formatted) setContent(formatted);
    } catch (err) {
      alert(`Lỗi JSON: ${err.message}`);
    }
  };

  const handleMinifyJson = async () => {
    try {
      const { minified } = await jsonWorker.minify(content);
      if (minified) setContent(minified);
    } catch (err) {
      alert(`Lỗi JSON: ${err.message}`);
    }
  };

  const handleCsvToJson = async () => {
    try {
      const { json } = await csvWorker.toJson(content);
      if (json) {
        setContent(json);
        setFilename(filename.replace(/\.csv$/i, '.json') || 'data.json');
        setEditorType('code');
      }
    } catch (err) {
      alert(`Lỗi chuyển đổi CSV: ${err.message}`);
    }
  };

  // Status text display
  const statusText = saveStatus === 'saving' ? 'Đang lưu bản nháp...'
    : saveStatus === 'saved'   ? `Đã lưu lúc ${lastSaved?.toLocaleTimeString('vi-VN')}`
    : saveStatus === 'error'   ? 'Lỗi lưu IndexedDB'
    : fsAccess.isDirty         ? 'Chưa lưu vào ổ cứng'
    : '';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[620px] bg-[#0c0c12] text-white rounded-2xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">

      {/* ── TOP CONTROL BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#14141c]/90 backdrop-blur-xl border-b border-white/10 flex-shrink-0 z-20">
        
        {/* Left: File actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenFile}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          >
            <FolderOpen size={14} />
            <span>Mở file</span>
          </button>

          <button
            onClick={handleSaveToDisk}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-xl text-xs font-medium transition-all"
            title="Lưu file vào máy tính (Ctrl+S)"
          >
            <HardDrive size={14} />
            <span>Lưu máy</span>
          </button>

          {/* Filename Input */}
          <div className="relative flex items-center">
            <input
              value={filename}
              onChange={e => {
                const val = e.target.value;
                setFilename(val);
                setEditorType(detectEditorType(val, content));
              }}
              placeholder="Tên file (vd: script.js, data.csv)"
              className="bg-black/40 border border-white/10 focus:border-amber-400/50 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-mono w-44 sm:w-52 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Center: View Switcher & Quick Worker Tools */}
        <div className="flex items-center gap-2">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setEditorType('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                editorType === 'code'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code2 size={13} />
              <span>Code / Markdown</span>
            </button>
            <button
              onClick={() => setEditorType('datatable-csv')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                editorType.startsWith('datatable')
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Table2 size={13} />
              <span>Bảng Dữ Liệu</span>
            </button>
          </div>

          {/* Worker quick actions */}
          {filename.endsWith('.json') && (
            <div className="hidden md:flex items-center gap-1 text-xs">
              <button
                onClick={handleFormatJson}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 text-[11px]"
              >
                Format
              </button>
              <button
                onClick={handleMinifyJson}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 text-[11px]"
              >
                Minify
              </button>
            </div>
          )}

          {filename.endsWith('.csv') && (
            <button
              onClick={handleCsvToJson}
              className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 text-[11px]"
            >
              CSV → JSON
            </button>
          )}
        </div>

        {/* Right: Run, Console, History, Collaboration, AI */}
        <div className="flex items-center gap-2">
          {/* Run Code Button */}
          <button
            onClick={() => {
              setShowConsole(true);
              runCode(content, filename);
            }}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isRunning
                ? 'bg-orange-500/30 text-orange-300 border border-orange-400/40 animate-pulse cursor-wait'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            }`}
            title="Chạy mã nguồn (Ctrl+Enter)"
          >
            {isRunning ? <Square size={13} /> : <Play size={13} className="fill-current" />}
            <span>{isRunning ? 'Đang chạy...' : 'Run'}</span>
          </button>

          {/* Console Toggle */}
          <button
            onClick={() => setShowConsole(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              showConsole
                ? 'bg-gray-700/50 text-white border-white/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
            }`}
            title="Hiện/ẩn bảng Console"
          >
            <Terminal size={14} />
            <span className="hidden sm:inline">Console</span>
            {consoleOutput && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />}
          </button>

          {/* History */}
          <button
            onClick={handleShowHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 text-xs font-medium transition-all"
            title="Xem lịch sử phiên bản lưu tự động"
          >
            <History size={14} />
            <span className="hidden sm:inline">Lịch sử</span>
          </button>

          {/* Collab Button */}
          <button
            onClick={() => setShowCollabModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              collabEnabled && collabConnected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
            }`}
            title="Đồng chỉnh sửa nhóm theo thời gian thực"
          >
            <Users size={14} />
            <span className="hidden sm:inline">
              {collabEnabled ? `Collab (${peerCount + 1})` : 'Collab'}
            </span>
          </button>

          {/* AI Assistant Toggle */}
          <button
            onClick={() => setShowAI(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              showAI
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                : 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 text-amber-300 border border-amber-400/40'
            }`}
          >
            <Sparkles size={14} />
            <span>AI Code</span>
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Editor Central Area */}
        <div className={`flex-1 overflow-hidden p-2 sm:p-3 transition-all ${showAI ? 'lg:w-2/3' : 'w-full'}`}>
          {editorType === 'code' ? (
            <MonacoEditorWrapper
              value={content}
              filename={filename}
              onChange={val => {
                setContent(val || '');
                fsAccess.markDirty();
              }}
              onSave={handleSaveToDisk}
              editorRef={editorInstanceRef}
            />
          ) : (
            <DataTableEditor
              content={content}
              contentType={editorType === 'datatable-json' ? 'json' : 'csv'}
              onChange={val => {
                setContent(val);
                fsAccess.markDirty();
              }}
            />
          )}
        </div>

        {/* ── AI SIDEBAR ── */}
        {showAI && (
          <aside className="w-full lg:w-1/3 max-w-md border-l border-white/10 bg-[#121218]/95 backdrop-blur-2xl flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
                <Sparkles size={16} />
                <span>AI Code Assistant</span>
              </div>
              <button
                onClick={() => setShowAI(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="p-3 border-b border-white/10 bg-white/[0.02]">
              <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-2 font-semibold">
                Thao tác nhanh
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'explain',  label: 'Giải thích code', icon: HelpCircle,  desc: 'Tóm tắt & phân tích logic' },
                  { id: 'security', label: 'Lỗi bảo mật',     icon: ShieldAlert, desc: 'Quét lỗ hổng tiềm ẩn' },
                  { id: 'tests',    label: 'Viết Unit Test', icon: CheckCircle, desc: 'Sinh mã test tự động' },
                  { id: 'improve',  label: 'Tối ưu hoá',     icon: Sparkles,    desc: 'Cải thiện hiệu năng' },
                ].map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => handleAIRequest(id)}
                    disabled={aiLoading}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-400/30 text-left transition-all group disabled:opacity-40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 group-hover:text-amber-300">
                      <Icon size={13} className="text-amber-400" />
                      <span>{label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom AI Chat Input */}
            <div className="p-3 border-b border-white/10 space-y-2">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Nhập yêu cầu cho AI (vd: 'Viết hàm lọc danh sách này', 'Chuyển JSON sang TypeScript Interface'...)"
                rows={3}
                className="w-full bg-black/40 border border-white/10 focus:border-amber-400/50 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 outline-none resize-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAIRequest('chat')}
                  disabled={!aiPrompt.trim() || aiLoading}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>{aiLoading ? 'Đang phân tích...' : 'Gửi yêu cầu'}</span>
                </button>
                <button
                  onClick={() => handleAIRequest('text-to-data')}
                  disabled={!aiPrompt.trim() || aiLoading}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs rounded-xl border border-white/10 transition-all"
                  title="Chuyển mô tả tiếng Việt thành JSON"
                >
                  <span>→ JSON</span>
                </button>
              </div>
            </div>

            {/* AI Result Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-10 text-amber-300 gap-3">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-xs font-mono animate-pulse">AI đang suy nghĩ và tạo phản hồi...</span>
                </div>
              )}

              {aiResult && !aiLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-300/80 uppercase font-semibold">Kết quả AI:</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(aiResult)}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Sao chép
                    </button>
                  </div>
                  <pre className="p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-[350px] overflow-y-auto selection:bg-amber-500 selection:text-black">
                    {aiResult}
                  </pre>
                </div>
              )}

              {!aiResult && !aiLoading && (
                <div className="py-12 text-center text-gray-500 text-xs">
                  Chọn một thao tác nhanh phía trên hoặc nhập câu hỏi để trò chuyện trực tiếp cùng AI về đoạn mã này.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── VERSION HISTORY MODAL ── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#14141c] border border-amber-400/30 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <History size={16} className="text-amber-400" />
                <span>Lịch Sử Phiên Bản (Snapshots)</span>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Tự động lưu tối đa 30 phiên bản gần nhất</span>
              <button
                onClick={handleCreateSnapshot}
                className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-all"
              >
                + Tạo Snapshot ngay
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {dbVersions.length === 0 ? (
                <p className="text-center py-8 text-gray-500 text-xs">Chưa có phiên bản nào được lưu trong IndexedDB.</p>
              ) : (
                dbVersions.map(v => (
                  <div
                    key={v.id}
                    onClick={() => handleRestoreVersion(v.id)}
                    className="p-3 bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-400/30 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-white group-hover:text-amber-300">{v.label}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Clock size={11} /> {new Date(v.savedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-gray-400">{(v.size / 1024).toFixed(1)} KB</span>
                      <span className="block text-[10px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Khôi phục →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COLLABORATION MODAL ── */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#14141c] border border-amber-400/30 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users size={16} className="text-amber-400" />
                <span>Đồng chỉnh sửa thời gian thực (Yjs CRDT)</span>
              </div>
              <button onClick={() => setShowCollabModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Mã phòng làm việc (Room ID):</label>
                <input
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-300 font-medium">Trạng thái kết nối:</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${collabEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                  {collabEnabled ? (collabConnected ? 'ĐANG KẾT NỐI' : 'ĐANG ĐỢI...') : 'TẮT'}
                </span>
              </div>

              <button
                onClick={() => {
                  setCollabEnabled(prev => !prev);
                  setShowCollabModal(false);
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  collabEnabled
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                }`}
              >
                {collabEnabled ? 'Rời phòng cộng tác' : 'Bật phòng cộng tác ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONSOLE OUTPUT PANEL ── */}
      {showConsole && (
        <div className="flex-shrink-0 border-t border-white/10 bg-[#0a0a10] z-20" style={{ maxHeight: '40%' }}>
          {/* Console Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
                <Terminal size={14} className="text-emerald-400" />
                <span>Console Output</span>
              </div>
              {runTime && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  exitCode === 0
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {exitCode === 0 ? '✓' : '✗'} {runTime}s
                </span>
              )}
              {isRunning && (
                <span className="text-[10px] font-mono text-orange-400 flex items-center gap-1 animate-pulse">
                  <Loader2 size={11} className="animate-spin" />
                  Đang thực thi...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearOutput}
                className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Xoá output"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Ẩn Console"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Console Body */}
          <div className="overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ maxHeight: 'calc(40vh - 40px)', minHeight: '120px' }}>
            {consoleOutput ? (
              <pre className="whitespace-pre-wrap text-gray-200 selection:bg-emerald-500 selection:text-black">
                {consoleOutput.split('\n').map((line, i) => (
                  <div key={i} className={`py-0.5 ${
                    line.startsWith('❌') ? 'text-red-400' :
                    line.startsWith('⚠️') ? 'text-yellow-400' :
                    line.startsWith('ℹ️') ? 'text-blue-400' :
                    line.startsWith('⏱') ? 'text-orange-400' :
                    line.startsWith('⚙️') ? 'text-rose-400' :
                    'text-emerald-100'
                  }`}>
                    <span className="text-gray-600 select-none mr-3">{String(i + 1).padStart(3)}</span>
                    {line}
                  </div>
                ))}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-600 gap-2">
                <Terminal size={24} className="opacity-30" />
                <p className="text-[11px]">Bấm <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-semibold">▶ Run</kbd> hoặc <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-semibold">Ctrl+Enter</kbd> để chạy mã nguồn</p>
                <p className="text-[10px] text-gray-700">Hỗ trợ: JS · Python · C/C++ · Java · Go · Rust · Ruby · PHP · 60+ ngôn ngữ</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER STATUS BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-1.5 bg-[#0e0e14] border-t border-white/10 text-[11px] text-gray-400 flex-shrink-0 z-20 font-mono">
        <div className="flex items-center gap-4">
          <span className="text-amber-400/90 font-semibold">
            {editorType === 'code' ? detectEditorType(filename) : 'Data Table Mode'}
          </span>
          <span>{content.split('\n').length} dòng</span>
          <span>{content.length} ký tự</span>
          {statusText && <span className="text-gray-400">● {statusText}</span>}
        </div>

        <div className="flex items-center gap-3">
          {collabEnabled && (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Collab: {peerCount + 1} người
            </span>
          )}
          <span>{fsAccess.isSupported ? 'Native File System API' : 'Browser Mode'}</span>
        </div>
      </div>
    </div>
  );
}
