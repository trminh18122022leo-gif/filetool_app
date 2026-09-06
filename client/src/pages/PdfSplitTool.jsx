
import { useState } from 'react';
import { usePdfThumbnails } from '../hooks/usePdfThumbnails';
import ResultDownload from '../components/ResultDownload';
import axios from 'axios';
import { Scissors, Loader2, Upload, Check, AlertCircle, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfSplitTool() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('select'); // 'select' | 'range'
  const [selected, setSelected] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  const { thumbnails, pageCount, loading, error } = usePdfThumbnails(file);

  const togglePage = (pageNum) => {
    setSelected(prev => { const next = new Set(prev); next.has(pageNum) ? next.delete(pageNum) : next.add(pageNum); return next; });
  };

  const parseRange = (str) => {
    const pages = new Set();
    str.split(',').forEach(part => {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [s, e] = trimmed.split('-').map(Number);
        for (let i = s; i <= Math.min(e, pageCount); i++) pages.add(i);
      } else {
        const n = Number(trimmed);
        if (n >= 1 && n <= pageCount) pages.add(n);
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const getSelectedPages = () => mode === 'select' ? Array.from(selected).sort((a, b) => a - b) : parseRange(rangeInput);
  
  const handle = async () => {
    if (!file) return;
    const pages = getSelectedPages();
    if (!pages.length) return;
    setStatus('processing'); setResult(null);
    const fd = new FormData();
    fd.append('file', file); fd.append('pages', pages.join(','));
    try {
      const { data } = await axios.post(`${API}/api/pdf/split`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true });
      setStatus('done'); setResult(data);
    } catch (err) { setStatus('error'); setResult({ error: err.response?.data?.error || 'Lỗi tách PDF' }); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-gradient flex items-center gap-3">
          <Scissors size={28} /> Tách PDF (Visual)
        </h2>
        <p className="text-gray-400 mt-2">Xem preview toàn bộ trang · Click chọn trang cần tách</p>
      </div>

      {!file ? (
        <div onClick={() => document.getElementById('split-input').click()}
          className="glass-panel p-12 text-center cursor-pointer transition-all border-dashed hover:border-pink-500/50">
          <Upload size={36} className="mx-auto mb-3 text-gray-500" />
          <p className="text-white text-lg">Nhấp hoặc kéo thả file PDF vào đây</p>
          <input id="split-input" type="file" accept=".pdf" className="hidden"
            onChange={e => { setFile(e.target.files[0]); setSelected(new Set()); setResult(null); }} />
        </div>
      ) : (
        <div className="flex items-center justify-between glass-panel px-5 py-4">
          <div className="flex-1">
            <p className="font-semibold text-white">{file.name}</p>
            <p className="text-gray-400 text-sm">{pageCount} trang</p>
          </div>
          <button onClick={() => { setFile(null); setSelected(new Set()); setResult(null); setStatus(null); }}
            className="glass-button px-4 py-2 text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Đổi file
          </button>
        </div>
      )}

      {file && pageCount > 0 && (
        <div className="glass-panel p-6 space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => setMode('select')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'select' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/30' : 'glass-button'}`}>🖱️ Click chọn trang</button>
              <button onClick={() => setMode('range')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'range' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/30' : 'glass-button'}`}>⌨️ Nhập range</button>
            </div>
            {mode === 'select' && (
              <div className="flex gap-3 ml-auto">
                <button onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)))} className="text-sm text-pink-400 hover:underline">Chọn tất cả</button>
                <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:text-white">Bỏ chọn</button>
              </div>
            )}
          </div>

          {mode === 'range' && (
            <div>
              <input value={rangeInput} onChange={e => setRangeInput(e.target.value)} placeholder="vd: 1-3, 5, 7-9" className="glass-input" />
            </div>
          )}

          <div>
            {loading && thumbnails.length === 0 && <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" /> Đang đọc PDF...</div>}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {thumbnails.map((src, i) => {
                const pageNum = i + 1;
                const isSelected = mode === 'select' ? selected.has(pageNum) : parseRange(rangeInput).includes(pageNum);
                return (
                  <button key={i} onClick={() => mode === 'select' && togglePage(pageNum)} disabled={mode === 'range'}
                    className={`relative rounded-xl overflow-hidden transition-all group ${mode === 'select' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'} ${isSelected ? 'border-2 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'border border-white/10'}`}>
                    <img src={src} className="w-full h-auto object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-pink-500/20 flex items-start justify-end p-1">
                        <div className="bg-pink-500 rounded-full p-1 shadow-lg"><Check size={12} className="text-white" /></div>
                      </div>
                    )}
                    <div className={`absolute bottom-0 inset-x-0 py-1 text-center text-[11px] font-medium backdrop-blur ${isSelected ? 'bg-pink-600/90 text-white' : 'bg-black/60 text-gray-300'}`}>{pageNum}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {result?.error && <div className="text-red-400 bg-red-900/20 p-3 rounded-xl text-sm">{result.error}</div>}
      {result && status === 'done' && <ResultDownload result={result} />}

      <button onClick={handle} disabled={!getSelectedPages().length || status === 'processing'}
        className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40
                   rounded-xl py-4 font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] flex items-center justify-center gap-2 transition-all">
        {status === 'processing' ? <><Loader2 size={20} className="animate-spin" /> Đang tách...</> : <><Scissors size={20} /> Tách {getSelectedPages().length} trang</>}
      </button>
    </div>
  );
}
