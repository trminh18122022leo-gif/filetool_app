import { useState, useEffect, useRef }   from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import axios          from 'axios';
import { Palette, Droplets, Grid3x3, Barcode, Wand2, ArrowLeft, Copy, Check, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const BCID_OPTIONS = [
  { value: 'code128', label: 'Code 128 (Mã vạch chuẩn)' },
  { value: 'ean13',   label: 'EAN-13 (Mã vạch hàng hóa)' },
  { value: 'qrcode',  label: 'QR Code' },
  { value: 'upca',    label: 'UPC-A' },
  { value: 'datamatrix', label: 'Data Matrix' },
];

const TOOLS = [
  { id: 'palette',         icon: Palette,   label: 'Trích màu ảnh',  desc: 'Lấy bảng màu chủ đạo (Color Palette) từ ảnh' },
  { id: 'image-watermark', icon: Droplets,  label: 'Watermark ảnh',  desc: 'Đóng dấu bản quyền chữ mờ vào ảnh' },
  { id: 'collage',         icon: Grid3x3,   label: 'Ghép ảnh Collage',desc: 'Tạo lưới ghép đẹp mắt từ nhiều ảnh' },
  { id: 'barcode',         icon: Barcode,   label: 'Tạo mã vạch',    desc: 'Tạo Barcode Code128, EAN-13, QR Code' },
];

export default function CreativeTools() {
  const [active,     setActive]     = useState(null);
  const [files,      setFiles]      = useState([]);
  const [previews,   setPreviews]   = useState([]);
  const [opts,       setOpts]       = useState({ text: 'CONFIDENTIAL', opacity: 0.4, color: 'white', fontSize: 48, cols: 2, bcid: 'code128', barcodeText: '' });
  const [status,     setStatus]     = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [result,     setResult]     = useState(null);
  const [palette,    setPalette]    = useState(null);
  const [copiedHex,  setCopiedHex]  = useState(null);

  const extraInputRef = useRef(null);
  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  const tool = TOOLS.find(t => t.id === active);

  useEffect(() => {
    if (active === 'collage' && files.length > 0) {
      const urls = files.map(f => ({
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
      setPreviews(urls);
      return () => {
        urls.forEach(u => URL.revokeObjectURL(u.url));
      };
    } else {
      setPreviews([]);
    }
  }, [files, active]);

  const handleFiles = (incoming) => {
    if (!incoming) return;
    if (Array.isArray(incoming)) {
      setFiles(prev => [...prev, ...incoming]);
    } else {
      setFiles([incoming]);
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

  const handle = async () => {
    setStatus('processing'); setProgress(30); setResult(null); setPalette(null);
    const fd = new FormData();
    if (['palette','image-watermark'].includes(active)) fd.append('file', files[0]);
    if (active === 'collage') files.forEach(f => fd.append('files', f));
    Object.entries(opts).forEach(([k,v]) => fd.append(k, v));
    if (active === 'barcode') fd.append('text', opts.barcodeText);

    const endpointMap = {
      'palette':         '/api/creative/palette',
      'image-watermark': '/api/creative/image-watermark',
      'collage':         '/api/creative/collage',
      'barcode':         '/api/creative/barcode',
    };

    try {
      setProgress(65);
      const { data } = await axios.post(`${API}${endpointMap[active]}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true,
      });
      setProgress(100); setStatus('done');
      if (data.colors) setPalette(data.colors);
      else setResult(data);
    } catch (err) {
      setStatus('error'); setProgress(0);
      setResult({ error: err.response?.data?.error || 'Lỗi xử lý công cụ sáng tạo' });
    }
  };

  const copyToClipboard = (hex) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  if (!active) return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
          <Wand2 size={30} className="text-pink-400" /> Creative Tools
        </h2>
        <p className="text-gray-400 mt-2">Công cụ sáng tạo: Trích màu, Watermark, Collage và Barcode Generator</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => { setActive(t.id); setFiles([]); setResult(null); setPalette(null); setStatus(null); }}
            className="glass-panel p-6 text-left transition-all hover:border-pink-500/50 hover:scale-[1.02] group">
            <t.icon size={28} className="text-pink-400 mb-3 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-white text-lg">{t.label}</p>
            <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <button onClick={() => setActive(null)} className="glass-button px-4 py-2 text-xs font-semibold flex items-center gap-2">
        <ArrowLeft size={16} /> Quay lại danh sách
      </button>

      <div className="glass-panel p-6 sm:p-8 space-y-6">
        <h2 className="text-2xl font-bold text-gradient flex items-center gap-3">
          <tool.icon size={24} className="text-pink-400" /> {tool.label}
        </h2>

        {['palette','image-watermark'].includes(active) && (
          <FileDropzone onFilesSelected={handleFiles} accept="image/*" label="Chọn ảnh tải lên" />
        )}

        {active === 'collage' && files.length === 0 && (
          <FileDropzone onFilesSelected={handleFiles} accept="image/*" multiple label="Chọn nhiều ảnh để ghép thành lưới" />
        )}

        {/* Collage Thumbnail Preview Gallery with Reordering */}
        {active === 'collage' && previews.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-white">🖼️ Đã chọn {previews.length} ảnh ghép:</p>
                <p className="text-[11px] text-gray-400">Dùng ◀ ▶ để sắp xếp vị trí các ảnh trong lưới</p>
              </div>
              <div className="flex gap-2">
                <input ref={extraInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files?.length && handleFiles(Array.from(e.target.files))} />
                <button type="button" onClick={() => extraInputRef.current?.click()} className="glass-button px-3 py-1 text-xs text-pink-400 flex items-center gap-1">
                  <Plus size={13} /> Thêm ảnh
                </button>
                <button type="button" onClick={() => setFiles([])} className="text-xs text-red-400 hover:text-red-300">
                  Xóa hết
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previews.map((item, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg">
                  <img src={item.url} alt={`Ảnh ${idx + 1}`} className="w-full h-24 object-cover" />
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 backdrop-blur text-white px-1.5 py-0.5 rounded font-bold">
                    #{idx + 1}
                  </span>
                  <button onClick={() => removeFile(idx)} className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 flex justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" disabled={idx === 0} onClick={() => moveFile(idx, idx - 1)} className="p-0.5 text-gray-300 hover:text-white disabled:opacity-20"><ChevronLeft size={14} /></button>
                    <button type="button" disabled={idx === previews.length - 1} onClick={() => moveFile(idx, idx + 1)} className="p-0.5 text-gray-300 hover:text-white disabled:opacity-20"><ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === 'image-watermark' && (
          <div className="space-y-4 glass-card p-5">
            <div>
              <label className="text-xs text-gray-300 block mb-1 font-medium">Nội dung chữ Watermark</label>
              <input value={opts.text} onChange={e => set('text', e.target.value)} placeholder="CONFIDENTIAL"
                className="glass-input text-sm py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-300 block mb-1 font-medium">Độ mờ: {Math.round(opts.opacity * 100)}%</label>
              <input type="range" min="0.1" max="0.8" step="0.05" value={opts.opacity}
                onChange={e => set('opacity', parseFloat(e.target.value))} className="w-full accent-pink-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-300 block mb-1 font-medium">Màu chữ</label>
                <div className="flex gap-2 flex-wrap">
                  {['white','black','red','blue','yellow'].map(c => (
                    <button key={c} onClick={() => set('color', c)}
                      className={`w-8 h-8 rounded-xl border-2 transition-all ${opts.color === c ? 'border-pink-500 scale-110 shadow-lg' : 'border-white/10'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-300 block mb-1 font-medium">Cỡ chữ (px)</label>
                <input type="number" min="12" max="200" value={opts.fontSize}
                  onChange={e => set('fontSize', e.target.value)}
                  className="glass-input text-sm py-1.5" />
              </div>
            </div>
          </div>
        )}

        {active === 'collage' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">Số cột hiển thị</p>
            <div className="flex gap-2">
              {[2,3,4].map(c => (
                <button key={c} onClick={() => set('cols', c)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${opts.cols === c ? 'bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'glass-button'}`}>
                  {c} cột
                </button>
              ))}
            </div>
          </div>
        )}

        {active === 'barcode' && (
          <div className="space-y-4 glass-card p-5">
            <div>
              <label className="text-xs text-gray-300 block mb-1 font-medium">Nội dung mã vạch / Text</label>
              <input value={opts.barcodeText} onChange={e => set('barcodeText', e.target.value)}
                placeholder="Nhập chuỗi số hoặc văn bản..."
                className="glass-input text-sm py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-300 block mb-1 font-medium">Loại định dạng mã</label>
              <select value={opts.bcid} onChange={e => set('bcid', e.target.value)}
                className="glass-input bg-black/80 text-sm py-2">
                {BCID_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {status && status !== 'done' && <ProgressBar progress={progress} />}

        {palette && (
          <div className="glass-card p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Bảng màu trích xuất ({palette.length} màu chủ đạo):</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {palette.map((c, i) => (
                <button key={i} onClick={() => copyToClipboard(c.hex)}
                  className="glass-panel p-3 flex flex-col items-center gap-2 hover:border-pink-500/50 hover:scale-105 transition-all group">
                  <div className="w-12 h-12 rounded-xl border border-white/20 shadow-md" style={{ background: c.hex }} />
                  <span className="text-xs font-mono text-white flex items-center gap-1">
                    {c.hex} {copiedHex === c.hex ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="opacity-40 group-hover:opacity-100" />}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-gray-400 text-xs text-center">Click vào ô màu để sao chép mã HEX</p>
          </div>
        )}

        {result?.error && <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-400 text-xs">{result.error}</div>}
        {result && status === 'done' && !result.error && <ResultDownload result={result} />}

        <button onClick={handle}
          disabled={(['palette','image-watermark'].includes(active) && !files[0]) ||
                    (active === 'collage' && files.length < 2) ||
                    (active === 'barcode' && !opts.barcodeText.trim()) ||
                    status === 'processing'}
          className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 rounded-xl py-3.5 font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all text-sm">
          {status === 'processing' ? '⏳ Đang xử lý...' : `Thực hiện ${tool.label}`}
        </button>
      </div>
    </div>
  );
}
