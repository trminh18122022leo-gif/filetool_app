import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import FileDropzone from '../components/FileDropzone';
import ResultDownload from '../components/ResultDownload';
import {
  PenTool, Upload, RefreshCw, CheckCircle2, AlertCircle,
  Loader2, Type, Image as ImageIcon, Trash2, ArrowLeft,
  Move, Maximize2, Sparkles, Check
} from 'lucide-react';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (_) {}

const API = import.meta.env.VITE_API_URL || '';

export default function SignaturePage() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // array of { pageNum, thumbnail }
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null); // page number (1-based)

  // Signature creation mode: 'draw' | 'text' | 'image'
  const [signType, setSignType] = useState('draw');

  // Draw signature canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnSignatureData, setDrawnSignatureData] = useState(null);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(3);

  // Text signature
  const [textSignature, setTextSignature] = useState('Nguyễn Văn A');
  const [textFont, setTextFont] = useState('cursive');

  // Image signature
  const [imageSignature, setImageSignature] = useState(null);
  const [imageSignaturePreview, setImageSignaturePreview] = useState(null);

  // Signature position & size on selected page (percentage relative 0-1)
  const [pos, setPos] = useState({ x: 0.5, y: 0.75, width: 0.35, height: 0.15 });
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Processing state
  const [status, setStatus] = useState(null); // 'processing' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 1. Khi chọn file PDF: đọc và trải toàn bộ các trang ra dưới dạng thumbnails
  useEffect(() => {
    if (!file) {
      setPages([]);
      setSelectedPage(null);
      return;
    }

    let isMounted = true;
    setLoadingPdf(true);
    setError(null);
    setPages([]);
    setSelectedPage(null);

    const renderPages = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const rendered = [];

        for (let i = 1; i <= totalPages; i++) {
          if (!isMounted) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push({
            pageNum: i,
            thumbnail: canvas.toDataURL('image/jpeg', 0.8),
            width: viewport.width,
            height: viewport.height,
          });

          if (isMounted) setPages([...rendered]);
        }
      } catch (err) {
        console.error('Lỗi đọc PDF:', err);
        if (isMounted) setError('Không thể đọc file PDF. Vui lòng thử file khác.');
      } finally {
        if (isMounted) setLoadingPdf(false);
      }
    };

    renderPages();
    return () => { isMounted = false; };
  }, [file]);

  // 2. Canvas drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setDrawnSignatureData(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDrawnSignatureData(null);
  };

  const handleImageUpload = (e) => {
    const uploaded = e.target.files?.[0];
    if (uploaded) {
      setImageSignature(uploaded);
      const reader = new FileReader();
      reader.onload = () => setImageSignaturePreview(reader.result);
      reader.readAsDataURL(uploaded);
    }
  };

  // 3. Tạo data URL chữ ký cuối cùng để gửi lên server
  const generateFinalSignatureDataUrl = () => {
    if (signType === 'draw') {
      return drawnSignatureData;
    }
    if (signType === 'image') {
      return imageSignaturePreview;
    }
    if (signType === 'text') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 600;
      tempCanvas.height = 200;
      const ctx = tempCanvas.getContext('2d');
      ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.font = `italic 60px ${textFont === 'cursive' ? 'Brush Script MT, Segoe Script, cursive' : 'sans-serif'}`;
      ctx.fillStyle = penColor || '#1a365d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textSignature, 300, 100);
      return tempCanvas.toDataURL('image/png');
    }
    return null;
  };

  // 4. Gửi yêu cầu ký PDF
  const handleSignPdf = async () => {
    if (!file || !selectedPage) return;
    const sigDataUrl = generateFinalSignatureDataUrl();
    if (!sigDataUrl) {
      setError('Vui lòng tạo hoặc tải mẫu chữ ký trước khi thực hiện nhúng.');
      return;
    }

    setStatus('processing');
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('signature', sigDataUrl);
    fd.append('page', selectedPage - 1); // 0-based
    fd.append('x', pos.x);
    fd.append('y', pos.y);
    fd.append('width', pos.width);
    fd.append('height', pos.height);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${API}/api/signature/sign`, {
        method: 'POST',
        headers,
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nhúng chữ ký vào PDF thất bại');

      setStatus('done');
      setResult(data);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  const handlePageCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Giữ chữ ký nằm gọn trong trang
    const newX = Math.max(0, Math.min(clickX - pos.width / 2, 1 - pos.width));
    const newY = Math.max(0, Math.min(clickY - pos.height / 2, 1 - pos.height));
    setPos(p => ({ ...p, x: newX, y: newY }));
  };

  const resetAll = () => {
    setFile(null);
    setPages([]);
    setSelectedPage(null);
    setDrawnSignatureData(null);
    setImageSignature(null);
    setImageSignaturePreview(null);
    setStatus(null);
    setResult(null);
    setError(null);
  };

  const activePageObj = pages.find(p => p.pageNum === selectedPage);
  const activeSignaturePreview = generateFinalSignatureDataUrl();

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
          <PenTool size={30} className="text-pink-400" /> E-Signature (Ký Điện Tử Trực Quan)
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Đọc và trải tất cả các trang PDF, chọn trang và kéo thả trực quan vị trí chữ ký trước khi xuất file.
        </p>
      </div>

      {/* 1. Upload File Zone */}
      {!file ? (
        <div className="glass-panel p-6 sm:p-10">
          <FileDropzone
            onFilesSelected={(f) => { setFile(f); setSelectedPage(null); }}
            accept=".pdf"
            label="Kéo thả hoặc nhấn để chọn file PDF cần ký"
            hint="Hỗ trợ xem trước trực quan toàn bộ các trang tài liệu"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between glass-panel px-6 py-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0">
              <PenTool size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate max-w-md">{file.name}</p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {pages.length} trang
              </p>
            </div>
          </div>

          <button
            onClick={resetAll}
            className="glass-button px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-2"
          >
            <RefreshCw size={14} /> Đổi file khác
          </button>
        </div>
      )}

      {/* 2. Trải toàn bộ các trang ra dưới dạng Grid */}
      {file && !selectedPage && (
        <div className="glass-panel p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-pink-400" /> Chọn trang cần đặt chữ ký
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Nhấp vào một trang bất kỳ để mở trình xem & định vị chữ ký trực tiếp</p>
            </div>
            <span className="text-xs text-pink-400 font-bold px-3 py-1 bg-pink-950/60 rounded-full border border-pink-800/50">
              {pages.length} trang đã sẵn sàng
            </span>
          </div>

          {loadingPdf && pages.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 size={36} className="animate-spin text-pink-400" />
              <p className="text-sm font-medium">Đang đọc và tạo bản xem trước từng trang PDF...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((p) => (
                <div
                  key={p.pageNum}
                  onClick={() => setSelectedPage(p.pageNum)}
                  className="group relative cursor-pointer glass-card p-2 rounded-2xl border border-white/10 hover:border-pink-500 hover:scale-[1.03] transition-all duration-200 shadow-lg flex flex-col items-center"
                >
                  <div className="relative w-full aspect-[3/4] bg-black/40 rounded-xl overflow-hidden flex items-center justify-center">
                    <img
                      src={p.thumbnail}
                      alt={`Trang ${p.pageNum}`}
                      className="w-full h-full object-contain pointer-events-none group-hover:opacity-95 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-pink-600/0 group-hover:bg-pink-600/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-pink-600 text-white font-bold text-xs rounded-lg shadow-lg transition-opacity">
                        Ký trang này
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs font-bold text-gray-300 group-hover:text-pink-300">
                    Trang {p.pageNum}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Chế độ Xem Trang Chi Tiết & Tương Tác Vị Trí Chữ Ký */}
      {selectedPage && activePageObj && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột Trái: Trình xem trực quan trang đã chọn */}
          <div className="lg:col-span-2 glass-panel p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <button
                onClick={() => setSelectedPage(null)}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft size={16} /> Quay lại danh sách trang
              </button>
              <span className="text-xs font-bold text-white px-3 py-1 bg-white/10 rounded-full border border-white/10">
                Đang ký: Trang {selectedPage} / {pages.length}
              </span>
            </div>

            {/* Khung tài liệu và hộp chữ ký kéo thả */}
            <div className="relative border border-white/20 shadow-2xl rounded-xl overflow-hidden bg-white max-w-full">
              <div
                className="relative cursor-crosshair select-none"
                onClick={handlePageCanvasClick}
              >
                <img
                  src={activePageObj.thumbnail}
                  alt={`Trang ${selectedPage}`}
                  className="max-h-[640px] w-auto pointer-events-none block"
                />

                {/* Hộp chữ ký tương tác */}
                <div
                  className="absolute border-2 border-dashed border-pink-500 bg-pink-500/10 rounded-lg flex items-center justify-center shadow-2xl transition-all"
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    width: `${pos.width * 100}%`,
                    height: `${pos.height * 100}%`,
                  }}
                  title="Nhấp vào trang để chuyển vị trí chữ ký"
                >
                  {activeSignaturePreview ? (
                    <img
                      src={activeSignaturePreview}
                      alt="Chữ ký"
                      className="w-full h-full object-contain p-1 pointer-events-none"
                    />
                  ) : (
                    <div className="text-[11px] text-pink-500 font-bold bg-white/90 px-2 py-0.5 rounded shadow">
                      Vị trí đặt chữ ký
                    </div>
                  )}

                  <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-pink-600 text-white flex items-center justify-center shadow">
                    <Move size={12} />
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              💡 <span className="font-semibold text-gray-300">Hướng dẫn:</span> Nhấp vào bất kỳ điểm nào trên trang để di chuyển chữ ký tới đó.
            </p>
          </div>

          {/* Cột Phải: Tạo Mẫu Chữ Ký & Tùy Chỉnh */}
          <div className="glass-panel p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3">
                Thiết Kế Chữ Ký
              </h3>

              {/* Tabs chọn kiểu chữ ký */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/40 border border-white/10 rounded-xl">
                <button
                  onClick={() => setSignType('draw')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    signType === 'draw' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <PenTool size={13} /> Ký tay
                </button>
                <button
                  onClick={() => setSignType('text')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    signType === 'text' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Type size={13} /> Gõ tên
                </button>
                <button
                  onClick={() => setSignType('image')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    signType === 'image' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ImageIcon size={13} /> Tải ảnh
                </button>
              </div>

              {/* 1. Ký tay trên Canvas */}
              {signType === 'draw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Vẽ chữ ký bằng chuột hoặc cảm ứng:</span>
                    <button
                      onClick={clearCanvas}
                      className="text-pink-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Xóa vẽ lại
                    </button>
                  </div>
                  <div className="border border-white/20 rounded-xl overflow-hidden bg-white/95">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={160}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[140px] cursor-crosshair touch-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">Màu mực:</span>
                    {['#000000', '#1e3a8a', '#b91c1c'].map(c => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === c ? 'scale-125 border-white' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Gõ tên dạng chữ ký */}
              {signType === 'text' && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400">Nhập họ tên chữ ký:</label>
                  <input
                    type="text"
                    value={textSignature}
                    onChange={e => setTextSignature(e.target.value)}
                    className="glass-input text-sm"
                    placeholder="Nguyễn Văn A"
                  />
                  <div className="p-4 bg-white/95 rounded-xl text-center border border-white/20">
                    <p
                      className="text-2xl text-gray-900 tracking-wider font-medium select-none"
                      style={{ fontFamily: textFont === 'cursive' ? 'Brush Script MT, Segoe Script, cursive' : 'sans-serif' }}
                    >
                      {textSignature || 'Chữ ký xem trước'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTextFont('cursive')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${textFont === 'cursive' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-black/30 border-white/10 text-gray-400'}`}
                    >
                      Chữ nghệ thuật
                    </button>
                    <button
                      onClick={() => setTextFont('standard')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${textFont === 'standard' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-black/30 border-white/10 text-gray-400'}`}
                    >
                      Chữ chuẩn
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Tải ảnh chữ ký */}
              {signType === 'image' && (
                <div className="space-y-3">
                  <label className="text-xs text-gray-400">Tải tệp ảnh con dấu / chữ ký (PNG, JPG):</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
                  />
                  {imageSignaturePreview && (
                    <div className="p-3 bg-white/95 rounded-xl flex items-center justify-center border border-white/20">
                      <img src={imageSignaturePreview} alt="Preview" className="max-h-24 object-contain" />
                    </div>
                  )}
                </div>
              )}

              {/* Kích thước chữ ký */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Kích thước chữ ký:</span>
                  <span className="text-pink-400 font-bold">{Math.round(pos.width * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.15"
                  max="0.6"
                  step="0.05"
                  value={pos.width}
                  onChange={e => {
                    const w = parseFloat(e.target.value);
                    setPos(p => ({ ...p, width: w, height: w * 0.45 }));
                  }}
                  className="w-full accent-pink-500"
                />
              </div>
            </div>

            {/* Nút hành động Submit */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <button
                onClick={handleSignPdf}
                disabled={status === 'processing'}
                className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <><Loader2 size={18} className="animate-spin" /> Đang nhúng chữ ký & xuất file...</>
                ) : (
                  <><CheckCircle2 size={18} /> Nhúng Chữ Ký & Xuất File</>
                )}
              </button>

              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Kết quả tải về */}
      {status === 'done' && result && (
        <div className="glass-panel p-6 sm:p-8">
          <ResultDownload
            result={result}
            onReset={resetAll}
            label="Tải Tài Liệu PDF Đã Ký"
          />
        </div>
      )}
    </div>
  );
}
