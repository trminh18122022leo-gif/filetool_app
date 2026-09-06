import { useState }        from 'react';
import { usePdfThumbnails } from '../hooks/usePdfThumbnails';
import ResultDownload       from '../components/ResultDownload';
import axios                from 'axios';
import { Trash2, Loader2, Upload, AlertCircle, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfDeleteTool() {
  const [file,    setFile]    = useState(null);
  const [toDelete,setDelete]  = useState(new Set());
  const [status,  setStatus]  = useState(null);
  const [result,  setResult]  = useState(null);

  const { thumbnails, pageCount, loading, error } = usePdfThumbnails(file);

  const toggle = (num) => setDelete(prev => {
    const next = new Set(prev);
    next.has(num) ? next.delete(num) : next.add(num);
    return next;
  });

  const handle = async () => {
    if (!file || !toDelete.size) return;
    setStatus('processing'); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('pages', Array.from(toDelete).join(','));
    try {
      const { data } = await axios.post(`${API}/api/pdf/delete-pages`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true,
      });
      setStatus('done'); setResult(data);
    } catch (err) {
      setStatus('error');
      setResult({ error: err.response?.data?.error || 'Lỗi xóa trang' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-gradient flex items-center gap-3">
          <Trash2 size={28} className="text-red-400" /> Xóa Trang PDF (Visual)
        </h2>
        <p className="text-gray-400 mt-2">Nhấp trực quan vào các trang bạn muốn loại bỏ khỏi tài liệu PDF</p>
      </div>

      {!file ? (
        <div onClick={() => document.getElementById('del-input').click()}
          className="glass-panel p-12 text-center cursor-pointer transition-all border-dashed hover:border-red-500/50">
          <Upload size={36} className="mx-auto mb-3 text-gray-500" />
          <p className="text-white text-lg">Nhấp hoặc kéo thả file PDF vào đây</p>
          <input id="del-input" type="file" accept=".pdf" className="hidden"
            onChange={e => { setFile(e.target.files[0]); setDelete(new Set()); setResult(null); }} />
        </div>
      ) : (
        <div className="flex items-center justify-between glass-panel px-5 py-4">
          <div className="flex-1">
            <p className="font-semibold text-white">{file.name}</p>
            <p className="text-gray-400 text-sm">{pageCount} trang</p>
          </div>
          <button onClick={() => { setFile(null); setDelete(new Set()); setResult(null); setStatus(null); }}
            className="glass-button px-4 py-2 text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Đổi file
          </button>
        </div>
      )}

      {file && (
        <div className="glass-panel p-6 space-y-6">
          {toDelete.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-300">
                Đã đánh dấu xóa <strong>{toDelete.size}</strong> trang:
                <span className="text-white font-mono ml-2">[{Array.from(toDelete).sort((a,b)=>a-b).join(', ')}]</span>
              </p>
              <button onClick={() => setDelete(new Set())} className="text-xs text-gray-400 hover:text-white underline">Bỏ chọn tất cả</button>
            </div>
          )}

          <div>
            {loading && thumbnails.length === 0 && <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" /> Đang đọc PDF...</div>}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {thumbnails.map((src, i) => {
                const num        = i + 1;
                const isSelected = toDelete.has(num);
                return (
                  <button key={i} onClick={() => toggle(num)}
                    className={`relative rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all group ${isSelected ? 'border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border border-white/10'}`}>
                    <img src={src} alt={`Trang ${num}`} className={`w-full h-auto object-cover ${isSelected ? 'opacity-40 grayscale' : ''}`} />
                    {isSelected && (
                      <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center">
                        <Trash2 size={24} className="text-white drop-shadow-md animate-bounce" />
                      </div>
                    )}
                    <div className={`absolute bottom-0 inset-x-0 py-1 text-center text-[11px] font-medium backdrop-blur ${isSelected ? 'bg-red-600 text-white' : 'bg-black/60 text-gray-300'}`}>
                      {isSelected ? '✕ XÓA' : `Trang ${num}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {result?.error && (
        <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {result.error}
        </div>
      )}
      {result && status === 'done' && (
        <ResultDownload result={result} extra={`Đã xóa ${result.removedCount} trang · Còn lại ${result.remainingPages} trang`} />
      )}

      {file && (
        <button onClick={handle}
          disabled={!toDelete.size || status === 'processing'}
          className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 rounded-xl py-3.5 font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 transition-all">
          {status === 'processing'
            ? <><Loader2 size={18} className="animate-spin" /> Đang xóa...</>
            : <><Trash2 size={18} /> Xóa {toDelete.size} trang đã chọn</>}
        </button>
      )}
    </div>
  );
}
