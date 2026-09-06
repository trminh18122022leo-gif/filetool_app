
import { useState, useRef } from 'react';
import { usePdfThumbnails } from '../hooks/usePdfThumbnails';
import axios from 'axios';
import { PenTool, Loader2, Upload, AlertCircle, Check, Image as ImageIcon, Type, RefreshCw } from 'lucide-react';
import ResultDownload from '../components/ResultDownload';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfSignTool() {
  const [file, setFile] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  
  const [signMode, setSignMode] = useState('text'); // 'text' | 'image'
  const [signText, setSignText] = useState('Chữ ký của tôi');
  const [signImage, setSignImage] = useState(null);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 }); // relative 0-1

  const { thumbnails, pageCount, loading, error } = usePdfThumbnails(file, 1.0); // full resolution for selected page
  const { thumbnails: gridThumbs } = usePdfThumbnails(file, 0.2); // low res for grid

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSignImage(e.target.files[0]);
    }
  };

  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPosition({ x, y });
  };

  const handleSign = async () => {
    if (!file || !selectedPage) return;
    setStatus('processing'); setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('page', selectedPage);
    fd.append('x', position.x);
    fd.append('y', position.y);
    
    if (signMode === 'text') fd.append('signatureText', signText);
    else if (signImage) fd.append('signature', signImage);

    try {
      const { data } = await axios.post(`${API}/api/pdf/sign`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setStatus('done');
      setResult(data);
    } catch (err) {
      setStatus('error');
      setResult({ error: err.response?.data?.error || 'Lỗi ký PDF' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-gradient flex items-center gap-3">
          <PenTool size={28} /> Ký PDF (Visual)
        </h2>
        <p className="text-gray-400 mt-2">Mở file, chọn trang, và nhấp để đặt vị trí chữ ký trực quan.</p>
      </div>

      {!file ? (
        <div onClick={() => document.getElementById('sign-input').click()}
          className="glass-panel p-12 text-center cursor-pointer hover:border-pink-500/50 transition-all border-dashed">
          <Upload size={40} className="mx-auto mb-4 text-gray-500" />
          <p className="text-white text-lg">Nhấp hoặc kéo thả file PDF vào đây</p>
          <input id="sign-input" type="file" accept=".pdf" className="hidden"
            onChange={e => { setFile(e.target.files[0]); setSelectedPage(null); setResult(null); }} />
        </div>
      ) : (
        <div className="flex items-center justify-between glass-panel px-5 py-4">
          <div className="flex-1">
            <p className="font-semibold text-white">{file.name}</p>
            <p className="text-gray-400 text-sm">{pageCount} trang</p>
          </div>
          <button onClick={() => { setFile(null); setSelectedPage(null); setResult(null); setStatus(null); }}
            className="glass-button px-4 py-2 text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Đổi file
          </button>
        </div>
      )}

      {file && !selectedPage && (
        <div className="glass-panel p-6">
          <h3 className="text-lg font-medium text-white mb-4">Chọn trang để ký:</h3>
          {loading && gridThumbs.length === 0 ? (
             <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" /> Đang đọc PDF...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {gridThumbs.map((src, i) => (
                <button key={i} onClick={() => setSelectedPage(i + 1)}
                  className="glass-card overflow-hidden group hover:border-pink-500 transition-all">
                  <img src={src} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100" />
                  <div className="p-2 text-center text-xs font-semibold text-gray-300">Trang {i + 1}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPage && thumbnails[selectedPage - 1] && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-panel p-4 flex flex-col items-center overflow-hidden">
            <div className="flex items-center justify-between w-full mb-4">
               <h3 className="text-white font-medium">Trang {selectedPage}</h3>
               <button onClick={() => setSelectedPage(null)} className="text-pink-400 text-sm hover:underline">Quay lại chọn trang</button>
            </div>
            <div className="relative border border-white/10 shadow-2xl cursor-crosshair bg-white" onClick={handleCanvasClick}>
              <img src={thumbnails[selectedPage - 1]} className="max-h-[600px] w-auto pointer-events-none" />
              
              {/* Fake signature marker */}
              <div className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-pink-500/80 text-white px-2 py-1 rounded text-xs font-bold pointer-events-none shadow-lg border border-pink-400"
                   style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}>
                CHỮ KÝ
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-3">Nhấp vào trang để đặt vị trí chữ ký.</p>
          </div>

          <div className="glass-panel p-6 space-y-6">
            <h3 className="text-lg font-medium text-white border-b border-white/10 pb-3">Tùy chỉnh chữ ký</h3>
            
            <div className="flex gap-2">
              <button onClick={() => setSignMode('text')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${signMode === 'text' ? 'bg-pink-600 text-white' : 'glass-button'}`}><Type size={16} className="inline mr-1"/> Văn bản</button>
              <button onClick={() => setSignMode('image')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${signMode === 'image' ? 'bg-pink-600 text-white' : 'glass-button'}`}><ImageIcon size={16} className="inline mr-1"/> Hình ảnh</button>
            </div>

            {signMode === 'text' ? (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Nội dung chữ ký</label>
                <input value={signText} onChange={e => setSignText(e.target.value)} className="glass-input" />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Tải ảnh chữ ký (PNG/JPG)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="glass-input text-sm p-2" style={{display: 'block'}} />
              </div>
            )}

            <div className="pt-4">
               {result?.error && <div className="text-red-400 bg-red-900/20 p-3 rounded-xl text-sm mb-4">{result.error}</div>}
               {result && status === 'done' ? <ResultDownload result={result} /> : (
                 <button onClick={handleSign} disabled={status === 'processing'} className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl text-white font-bold shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all flex items-center justify-center gap-2">
                   {status === 'processing' ? <><Loader2 size={18} className="animate-spin" /> Đang xử lý...</> : 'Ký PDF Ngay'}
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
