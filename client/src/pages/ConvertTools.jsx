import { useState, useEffect, useRef } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import axios          from 'axios';
import {
  Images, Globe, FileCode, Table2,
  FileJson, BarChart3, ArrowRightLeft, ArrowLeft,
  Trash2, Plus, ArrowLeftRight, ChevronLeft, ChevronRight, GripVertical, File
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const TOOLS = [
  { id: 'images-to-pdf',   icon: Images,          label: 'Ảnh → PDF',       desc: 'Nhiều ảnh gộp thành 1 PDF với thứ tự tùy chỉnh', needFiles: true,  multi: true,  accept: 'image/*',         endpoint: '/api/convert/images-to-pdf' },
  { id: 'pdf-to-images',   icon: Images,          label: 'PDF → Ảnh',       desc: 'Mỗi trang PDF thành 1 ảnh (ZIP)',              needFiles: true,  multi: false, accept: '.pdf',            endpoint: '/api/convert/pdf-to-images' },
  { id: 'url-to-pdf',      icon: Globe,           label: 'URL → PDF',       desc: 'Chụp trang web thành PDF',                    needFiles: false, multi: false, accept: '',                endpoint: '/api/convert/url-to-pdf' },
  { id: 'markdown-to-pdf', icon: FileCode,        label: 'Markdown → PDF',  desc: 'File .md thành PDF đẹp',                      needFiles: true,  multi: false, accept: '.md,.txt',        endpoint: '/api/convert/markdown-to-pdf' },
  { id: 'json-to-excel',   icon: FileJson,        label: 'JSON → Excel',    desc: 'Array JSON thành bảng XLSX',                  needFiles: false, multi: false, accept: '',                endpoint: '/api/convert/json-to-excel' },
  { id: 'csv-to-excel',    icon: Table2,          label: 'CSV → Excel',     desc: 'File CSV thành XLSX',                         needFiles: true,  multi: false, accept: '.csv',            endpoint: '/api/convert/csv-to-excel' },
  { id: 'doc-stats',       icon: BarChart3,       label: 'Thống kê PDF',    desc: 'Đếm từ, trang, thời gian đọc',               needFiles: true,  multi: false, accept: '.pdf',            endpoint: '/api/convert/doc-stats' },
];

export default function ConvertTools() {
  const [active,     setActive]     = useState(null);
  const [files,      setFiles]      = useState([]);
  const [previews,   setPreviews]   = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [options,    setOptions]    = useState({ url: '', jsonData: '', pageSize: 'A4', format: 'jpg', theme: 'github' });
  const [status,     setStatus]     = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [result,     setResult]     = useState(null);
  const [stats,      setStats]      = useState(null);

  const extraInputRef = useRef(null);
  const tool = TOOLS.find(t => t.id === active);

  // Sync previews with files array
  useEffect(() => {
    if (active === 'images-to-pdf' && files.length > 0) {
      const urls = files.map(f => ({
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
        sizeKb: (f.size / 1024).toFixed(0),
      }));
      setPreviews(urls);
      return () => {
        urls.forEach(u => URL.revokeObjectURL(u.url));
      };
    } else {
      setPreviews([]);
    }
  }, [files, active]);

  const handleFilesSelected = (selected) => {
    if (!selected) return;
    if (Array.isArray(selected)) {
      setFiles(prev => [...prev, ...selected]);
    } else {
      setFiles([selected]);
    }
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const moveFile = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= files.length) return;
    setFiles(prev => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, movedItem);
      return updated;
    });
  };

  const reverseFiles = () => {
    setFiles(prev => [...prev].reverse());
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    moveFile(draggedIdx, targetIdx);
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handle = async () => {
    setStatus('processing'); setProgress(30); setResult(null); setStats(null);

    const fd = new FormData();
    if (tool.needFiles) {
      if (tool.multi) {
        files.forEach(f => fd.append('files', f));
      } else if (files[0]) {
        fd.append('file', files[0]);
      }
    }

    if (active === 'url-to-pdf')      fd.append('url',      options.url);
    if (active === 'json-to-excel')   fd.append('data',     options.jsonData);
    if (active === 'pdf-to-images')   fd.append('format',   options.format);
    if (active === 'images-to-pdf')   fd.append('pageSize', options.pageSize);
    if (active === 'markdown-to-pdf') fd.append('theme',    options.theme);

    try {
      setProgress(65);
      const { data } = await axios.post(`${API}${tool.endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setProgress(100); setStatus('done');
      if (data.stats) setStats(data.stats);
      else setResult(data);
    } catch (err) {
      setStatus('error'); setProgress(0);
      setResult({ error: err.response?.data?.error || err.message || 'Lỗi xử lý chuyển đổi file' });
    }
  };

  const canSubmit = () => {
    if (!tool) return false;
    if (tool.needFiles) return files.length > 0;
    if (active === 'url-to-pdf') return !!options.url.trim();
    if (active === 'json-to-excel') return !!options.jsonData.trim();
    return true;
  };

  if (!active) return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
          <ArrowRightLeft size={30} className="text-cyan-400" /> Convert Tools
        </h2>
        <p className="text-gray-400 mt-2">Chuyển đổi linh hoạt giữa ảnh, PDF, Markdown, URL, CSV và Excel với công cụ xử lý mạnh mẽ</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => { setActive(t.id); setFiles([]); setResult(null); setStats(null); setStatus(null); }}
            className="glass-panel p-6 text-left transition-all hover:border-cyan-500/50 hover:scale-[1.02] group">
            <t.icon size={28} className="text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-white text-base">{t.label}</p>
            <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button onClick={() => { setActive(null); setFiles([]); }} className="glass-button px-4 py-2 text-xs font-semibold flex items-center gap-2">
        <ArrowLeft size={16} /> Quay lại danh sách công cụ
      </button>

      <div className="glass-panel p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-2xl font-bold text-gradient flex items-center gap-3">
            <tool.icon size={26} className="text-cyan-400" /> {tool.label}
          </h2>
          {files.length > 0 && (
            <button onClick={() => setFiles([])} className="text-xs text-red-400 hover:text-red-300 transition-colors">
              Xóa tất cả file ({files.length})
            </button>
          )}
        </div>

        {/* Upload dropzone */}
        {tool.needFiles && files.length === 0 && (
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            accept={tool.accept}
            multiple={tool.multi}
            label={tool.multi ? 'Nhấp hoặc kéo thả nhiều ảnh vào đây' : 'Nhấp hoặc kéo thả file cần xử lý'}
          />
        )}

        {/* Visual Thumbnail Gallery with Reordering for images-to-pdf */}
        {active === 'images-to-pdf' && previews.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  🖼️ Danh sách ảnh ({previews.length} ảnh)
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Kéo thả hoặc dùng nút ◀ ▶ để sắp xếp thứ tự từng trang PDF
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files?.length && handleFilesSelected(Array.from(e.target.files))}
                />
                <button
                  type="button"
                  onClick={() => extraInputRef.current?.click()}
                  className="glass-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-cyan-400 hover:border-cyan-400/50"
                >
                  <Plus size={14} /> Thêm ảnh
                </button>
                <button
                  type="button"
                  onClick={reverseFiles}
                  className="glass-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-gray-300 hover:text-white"
                  title="Đảo ngược thứ tự các trang"
                >
                  <ArrowLeftRight size={14} /> Đảo thứ tự
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {previews.map((item, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative group rounded-2xl overflow-hidden border transition-all cursor-grab active:cursor-grabbing bg-black/50 shadow-lg ${
                    draggedIdx === idx ? 'opacity-40 scale-95 border-cyan-500' : 'border-white/10 hover:border-cyan-500/50 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="h-36 w-full bg-black/60 relative overflow-hidden flex items-center justify-center">
                    <img src={item.url} alt={`Trang ${idx + 1}`} className="w-full h-full object-cover" />
                    
                    {/* Page badge */}
                    <span className="absolute top-2 left-2 text-[11px] bg-black/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-lg font-bold">
                      Trang {idx + 1}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      title="Xóa ảnh này"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="p-2.5 bg-gray-950/80 border-t border-white/5 flex items-center justify-between gap-1 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-gray-200 font-medium text-[11px]">{item.name}</p>
                      <p className="text-[10px] text-gray-500">{item.sizeKb} KB</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); moveFile(idx, idx - 1); }}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-20 text-gray-300 hover:text-white"
                        title="Di chuyển sang trái"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === previews.length - 1}
                        onClick={(e) => { e.stopPropagation(); moveFile(idx, idx + 1); }}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-20 text-gray-300 hover:text-white"
                        title="Di chuyển sang phải"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single file badge for non-multi tools */}
        {!tool.multi && files.length > 0 && (
          <div className="flex items-center justify-between p-4 glass-card">
            <div className="flex items-center gap-3">
              <File size={22} className="text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white">{files[0].name}</p>
                <p className="text-xs text-gray-400">{(files[0].size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
              Đổi file khác
            </button>
          </div>
        )}

        {/* Options */}
        {active === 'url-to-pdf' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-medium">URL trang web cần chụp thành PDF</label>
            <input value={options.url} onChange={e => setOptions(o => ({ ...o, url: e.target.value }))}
              placeholder="https://example.com"
              className="glass-input text-sm py-2.5" />
          </div>
        )}

        {active === 'json-to-excel' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-medium">JSON Array (Mảng đối tượng JSON)</label>
            <textarea value={options.jsonData} onChange={e => setOptions(o => ({ ...o, jsonData: e.target.value }))}
              placeholder={'[\n  {"name": "Alice", "age": 30, "city": "Hà Nội"},\n  {"name": "Bob", "age": 25, "city": "TP.HCM"}\n]'}
              rows={6}
              className="glass-input font-mono text-xs p-3 leading-relaxed" />
          </div>
        )}

        {active === 'images-to-pdf' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">Khổ giấy PDF</p>
            <div className="flex gap-2 flex-wrap">
              {['A4','A3','Letter','auto'].map(s => (
                <button key={s} onClick={() => setOptions(o => ({ ...o, pageSize: s }))}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${options.pageSize === s ? 'bg-cyan-600 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'glass-button'}`}>
                  {s === 'auto' ? 'Tự động (kích thước ảnh)' : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {active === 'pdf-to-images' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">Định dạng ảnh xuất</p>
            <div className="flex gap-2">
              {['jpg','png'].map(f => (
                <button key={f} onClick={() => setOptions(o => ({ ...o, format: f }))}
                  className={`px-4 py-2 rounded-xl text-xs uppercase font-bold transition-all ${options.format === f ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'glass-button'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {active === 'markdown-to-pdf' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">Giao diện (Theme)</p>
            <div className="flex gap-2">
              {['github','dark'].map(t => (
                <button key={t} onClick={() => setOptions(o => ({ ...o, theme: t }))}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${options.theme === t ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'glass-button'}`}>
                  {t === 'github' ? '☀️ Giao diện Sáng (GitHub)' : '🌙 Giao diện Tối (Dark)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {status && status !== 'done' && <ProgressBar progress={progress} />}

        {stats && (
          <div className="glass-card p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['📄 Số trang',         stats.pages],
              ['📝 Tổng từ',          stats.words.toLocaleString()],
              ['🔤 Số ký tự',        stats.chars.toLocaleString()],
              ['📖 Thời gian đọc',   stats.readTime],
              ['📊 Độ dễ đọc',       stats.readability],
              ['💾 Dung lượng',      `${stats.sizeKb} KB`],
              ['✍️ Số câu',          stats.sentences.toLocaleString()],
              ['📐 Từ/trang',        stats.avgWordsPerPage],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                <p className="text-gray-400 text-xs">{label}</p>
                <p className="font-bold text-lg text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {result?.error && (
          <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl text-red-400 text-xs flex items-start gap-2">
            <span>{result.error}</span>
          </div>
        )}
        {result && status === 'done' && !result.error && <ResultDownload result={result} />}

        {active !== 'doc-stats' && (
          <button onClick={handle} disabled={!canSubmit() || status === 'processing'}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-xl py-3.5 font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all text-sm">
            {status === 'processing' ? '⏳ Đang xử lý...' : `Chuyển đổi: ${tool.label}`}
          </button>
        )}
        {active === 'doc-stats' && (
          <button onClick={handle} disabled={!files.length || status === 'processing'}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-xl py-3.5 font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all text-sm">
            {status === 'processing' ? '⏳ Đang phân tích...' : '📊 Phân tích tài liệu'}
          </button>
        )}
      </div>
    </div>
  );
}
