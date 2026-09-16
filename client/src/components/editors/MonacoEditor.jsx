/**
 * Monaco Editor với đầy đủ tính năng:
 * - Syntax highlighting 100+ ngôn ngữ
 * - Auto-completion, linting
 * - Minimap, code folding
 * - Live Markdown preview (Split view & Full preview)
 * - Find & Replace nâng cao
 */
import { useRef, useState, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import {
  Split, Eye, EyeOff, RotateCcw, RotateCw,
  Settings, Copy, Check
} from 'lucide-react';

const THEME = 'vs-dark';

// Detect language từ filename
function detectLanguage(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', pyw: 'python',
    java: 'java', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    go: 'go', rs: 'rust',
    php: 'php', rb: 'ruby', cs: 'csharp', swift: 'swift', kt: 'kotlin',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', svg: 'xml',
    md: 'markdown', markdown: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell',
    sql: 'sql', graphql: 'graphql', gql: 'graphql',
    dockerfile: 'dockerfile', makefile: 'makefile',
    ini: 'ini', env: 'shell', log: 'plaintext',
    txt: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

export default function MonacoEditorWrapper({
  value,
  onChange,
  filename,
  language: forcedLang,
  readOnly = false,
  onSave,
  editorRef: externalEditorRef,
}) {
  const internalEditorRef = useRef(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const monaco = useMonaco();
  const lang = forcedLang || detectLanguage(filename);
  const isMarkdown = lang === 'markdown';

  const [showPreview, setShowPreview] = useState(isMarkdown);
  const [splitView,   setSplitView]   = useState(isMarkdown);
  const [fontSize,    setFontSize]    = useState(14);
  const [showSettings,setShowSettings]= useState(false);
  const [wordWrap,    setWordWrap]    = useState('on');
  const [copied,      setCopied]      = useState(false);

  const { push: pushHistory, undo, redo, canUndo, canRedo } = useVersionHistory(value || '');

  // Thiết lập Monaco khi load
  const handleMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;

    // Keyboard shortcut: Ctrl/Cmd + S
    editor.addAction({
      id: 'save-action',
      label: 'Save File',
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
      run: () => onSave?.(editor.getValue()),
    });

    // Keyboard shortcut: Alt + Shift + F
    editor.addAction({
      id: 'format-document-action',
      label: 'Format Document',
      keybindings: [monacoInstance.KeyMod.Alt | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF],
      run: () => editor.getAction('editor.action.formatDocument')?.run(),
    });

    // Cập nhật cấu hình editor
    editor.updateOptions({
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      renderWhitespace: 'selection',
    });
  }, [onSave, editorRef]);

  // Sync value từ undo/redo
  const handleUndo = () => {
    const prev = undo();
    if (prev !== null && editorRef.current) {
      editorRef.current.setValue(prev);
    }
  };

  const handleRedo = () => {
    const next = redo();
    if (next !== null && editorRef.current) {
      editorRef.current.setValue(next);
    }
  };

  const handleChange = (newValue = '') => {
    onChange?.(newValue);
    pushHistory(newValue);
  };

  const handleCopy = () => {
    const val = editorRef.current ? editorRef.current.getValue() : (value || '');
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white border border-[#2d2d2d] rounded-xl overflow-hidden shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#252526] border-b border-[#1a1a1a] flex-shrink-0">
        {/* File info */}
        <span className="text-gray-300 font-medium text-xs mr-2 truncate max-w-[200px]">
          {filename || 'Untitled'}
        </span>
        <span className="text-amber-300 text-xs bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded font-mono font-medium">
          {lang}
        </span>

        <div className="flex-1" />

        {/* Copy button */}
        <button
          onClick={handleCopy}
          title="Sao chép toàn bộ"
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-all"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>

        {/* Undo/Redo */}
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 hover:text-white transition-all"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Y)"
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 hover:text-white transition-all"
        >
          <RotateCw size={14} />
        </button>

        {/* Markdown preview toggle */}
        {isMarkdown && (
          <>
            <div className="w-px h-4 bg-gray-700 mx-1" />
            <button
              onClick={() => setSplitView(s => !s)}
              title="Chia đôi màn hình Preview"
              className={`p-1.5 rounded transition-all ${splitView ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'hover:bg-white/10 text-gray-300'}`}
            >
              <Split size={14} />
            </button>
            <button
              onClick={() => setShowPreview(p => !p)}
              title="Bật/Tắt xem trước Markdown"
              className={`p-1.5 rounded transition-all ${showPreview && !splitView ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'hover:bg-white/10 text-gray-300'}`}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </>
        )}

        <div className="w-px h-4 bg-gray-700 mx-1" />

        {/* Settings */}
        <button
          onClick={() => setShowSettings(s => !s)}
          title="Tùy chỉnh font & word wrap"
          className={`p-1.5 rounded transition-all ${showSettings ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-gray-300'}`}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="flex flex-wrap items-center gap-6 px-4 py-2.5 bg-[#252526] border-b border-[#1a1a1a] text-xs flex-shrink-0">
          <label className="flex items-center gap-2 text-gray-300">
            <span>Cỡ chữ:</span>
            <input
              type="range"
              min="11"
              max="24"
              value={fontSize}
              onChange={e => {
                const val = Number(e.target.value);
                setFontSize(val);
                editorRef.current?.updateOptions({ fontSize: val });
              }}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-amber-300 font-mono w-6">{fontSize}px</span>
          </label>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={wordWrap === 'on'}
              onChange={e => {
                const val = e.target.checked ? 'on' : 'off';
                setWordWrap(val);
                editorRef.current?.updateOptions({ wordWrap: val });
              }}
              className="accent-amber-500 rounded"
            />
            <span>Tự động xuống dòng (Word wrap)</span>
          </label>
        </div>
      )}

      {/* Editor + Preview Body */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Editor container */}
        <div
          className={
            splitView && isMarkdown
              ? 'w-1/2 border-r border-[#2d2d2d] h-full'
              : showPreview && isMarkdown
              ? 'hidden'
              : 'w-full h-full'
          }
        >
          <Editor
            height="100%"
            language={lang}
            value={value}
            theme={THEME}
            onChange={handleChange}
            onMount={handleMount}
            options={{
              readOnly,
              fontSize,
              wordWrap,
              minimap: { enabled: true, scale: 0.8 },
              lineNumbers: 'on',
              folding: true,
              foldingStrategy: 'indentation',
              renderLineHighlight: 'all',
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              formatOnPaste: true,
              formatOnType: false,
              tabSize: 2,
              detectIndentation: true,
              bracketPairColorization: { enabled: true },
              suggestOnTriggerCharacters: true,
              quickSuggestions: { other: true, comments: false, strings: false },
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {/* Markdown Live Preview */}
        {isMarkdown && (showPreview || splitView) && (
          <div className={`${splitView ? 'w-1/2' : 'w-full'} overflow-auto bg-[#1a1a1c] p-6 h-full text-gray-100`}>
            <div className="prose prose-invert prose-amber max-w-none prose-pre:bg-[#252526] prose-pre:border prose-pre:border-white/10 prose-headings:text-amber-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value || '*Chưa có nội dung xem trước...*'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
