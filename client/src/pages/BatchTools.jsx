import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useJobSocket } from '../hooks/useJobSocket';
import FileDropzone from '../components/FileDropzone';
import ResultDownload from '../components/ResultDownload';
import {
  Layers, Minimize2, RefreshCw, Scaling,
  RotateCw, CheckCircle2, AlertTriangle, Download,
  Trash2, Plus, FileText, Image as ImageIcon,
  Loader2, Check, Sparkles, FolderArchive, ArrowRight,
  Sliders, Eye, HardDrive
} from 'lucide-react';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (_) {}

const ACTIONS = [
  {
    id: 'pdf-compress',
    label: 'Nén PDF hàng loạt',
    description: 'Giảm dung lượng nhiều file PDF cùng lúc mà vẫn giữ chất lượng tối ưu.',
    icon: Minimize2,
    accept: '.pdf,application/pdf',
    typeBadge: 'PDF',
    color: 'from-pink-500 to-rose-600',
    borderActive: 'border-pink-500/50 bg-pink-500/10 text-pink-300',
  },
  {
    id: 'image-convert',
    label: 'Đổi định dạng ảnh hàng loạt',
    description: 'Chuyển đổi đồng loạt định dạng PNG, JPG, WEBP, AVIF cực nhanh.',
    icon: RefreshCw,
    accept: 'image/*',
    typeBadge: 'IMAGE',
    color: 'from-blue-500 to-cyan-600',
    borderActive: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
  },
  {
    id: 'image-compress',
    label: 'Nén ảnh hàng loạt',
    description: 'Tối ưu kích thước file ảnh dung lượng lớn, tăng tốc độ tải web.',
    icon: Minimize2,
    accept: 'image/*',
    typeBadge: 'IMAGE',
    color: 'from-emerald-500 to-teal-600',
    borderActive: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  },
  {
    id: 'image-resize',
    label: 'Resize ảnh hàng loạt',
    description: 'Đổi kích thước chiều rộng/chiều cao đồng bộ cho nhiều hình ảnh.',
    icon: Scaling,
    accept: 'image/*',
    typeBadge: 'IMAGE',
    color: 'from-amber-500 to-orange-600',
    borderActive: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  },
  {
    id: 'pdf-rotate',
    label: 'Xoay PDF hàng loạt',
    description: 'Xoay hướng tất cả các tài liệu PDF 90°, 180° hoặc 270° tự động.',
    icon: RotateCw,
    accept: '.pdf,application/pdf',
    typeBadge: 'PDF',
    color: 'from-purple-500 to-indigo-600',
    borderActive: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
  },
];

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function BatchTools() {
  const [action, setAction] = useState('pdf-compress');
  const [fileItems, setFileItems] = useState([]); // array of { id, file, name, size, type, preview, width, height, pageCount, loading }
  const [jobId, setJobId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState({});
  const addFilesInputRef = useRef(null);

  const { progress, currentFile, completed, total, result, error, isDone, isRunning } =
    useJobSocket(jobId);

  const curAction = ACTIONS.find(a => a.id === action);

  // Set default options whenever action changes
  useEffect(() => {
    if (action === 'pdf-compress') {
      setOptions({ quality: 'ebook' });
    } else if (action === 'image-convert') {
      setOptions({ format: 'webp', quality: 85 });
    } else if (action === 'image-compress') {
      setOptions({ quality: 75 });
    } else if (action === 'image-resize') {
      setOptions({ width: 1200, height: null });
    } else if (action === 'pdf-rotate') {
      setOptions({ angle: 90 });
    }
  }, [action]);

  // Xử lý đọc và trải file ra (extract thumbnail, dimensions, pageCount)
  const processNewFiles = async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;

    const newItems = Array.from(rawFiles).map(file => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file.name);
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: isPdf ? 'pdf' : isImage ? 'image' : 'other',
        preview: null,
        width: null,
        height: null,
        pageCount: null,
        loading: true,
      };
    });

    setFileItems(prev => [...prev, ...newItems]);

    // Asynchronously generate previews and metadata for each item
    for (const item of newItems) {
      if (item.type === 'image') {
        try {
          const previewUrl = URL.createObjectURL(item.file);
          const img = new Image();
          img.src = previewUrl;
          await new Promise(resolve => {
            img.onload = () => {
              setFileItems(prev => prev.map(f => f.id === item.id ? {
                ...f,
                preview: previewUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
                loading: false,
              } : f));
              resolve();
            };
            img.onerror = () => {
              setFileItems(prev => prev.map(f => f.id === item.id ? {
                ...f,
                preview: previewUrl,
                loading: false,
              } : f));
              resolve();
            };
          });
        } catch (_) {
          setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, loading: false } : f));
        }
      } else if (item.type === 'pdf') {
        try {
          const arrayBuffer = await item.file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
            cMapPacked: true,
          });
          const pdf = await loadingTask.promise;
          const pageCount = pdf.numPages;

          // Render first page thumbnail
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;

          const previewUrl = canvas.toDataURL('image/jpeg', 0.8);

          setFileItems(prev => prev.map(f => f.id === item.id ? {
            ...f,
            preview: previewUrl,
            pageCount,
            loading: false,
          } : f));
        } catch (err) {
          console.error('Lỗi tạo thumbnail PDF:', err);
          setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, loading: false } : f));
        }
      } else {
        setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, loading: false } : f));
      }
    }
  };

  const handleInitialFiles = (selectedFiles) => {
    setFileItems([]);
    processNewFiles(selectedFiles);
  };

  const handleAppendFiles = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processNewFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (id) => {
    setFileItems(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFileItems([]);
    setJobId(null);
  };

  const startBatch = async () => {
    if (!fileItems.length) return;
    setUploading(true);

    const fd = new FormData();
    fileItems.forEach(item => fd.append('files', item.file));
    fd.append('action', action);
    fd.append('options', JSON.stringify(options));

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch('/api/batch/process', { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xảy ra lỗi khi gửi yêu cầu xử lý');
      setJobId(data.jobId);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFileItems([]);
    setJobId(null);
  };

  const totalBytes = fileItems.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Layers size={13} /> Batch Processing Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Xử Lý Hàng Loạt Nhiều Tệp
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Tải lên nhiều tệp tin, xem trước toàn bộ danh sách trực quan và xử lý song song với hàng đợi thông minh theo thời gian thực.
          </p>
        </div>
      </div>

      {/* Action Selector Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-2 bg-gray-900/90 border border-gray-800 rounded-2xl backdrop-blur-md shadow-xl">
        {ACTIONS.map(({ id, label, icon: Icon, borderActive }) => {
          const isActive = action === id;
          return (
            <button
              key={id}
              onClick={() => { setAction(id); reset(); }}
              className={`flex flex-col items-center justify-center text-center p-3 rounded-xl text-xs font-medium transition-all gap-2 cursor-pointer ${
                isActive
                  ? `${borderActive} border font-bold shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/80 border border-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg ${isActive ? 'bg-white/10' : 'bg-gray-800'}`}>
                <Icon size={18} className={isActive ? 'text-current' : 'text-gray-400'} />
              </div>
              <span className="line-clamp-2 leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-sm">
        {/* Dropzone if no files selected yet */}
        {fileItems.length === 0 && !isRunning && !isDone && (
          <div className="space-y-4">
            <div className="text-center space-y-1 mb-2">
              <h3 className="text-base font-semibold text-white">{curAction?.label}</h3>
              <p className="text-xs text-gray-400">{curAction?.description}</p>
            </div>
            <FileDropzone
              key={action}
              onFilesSelected={handleInitialFiles}
              multiple
              accept={curAction?.accept}
              label={`Kéo thả hoặc chọn nhiều tệp để ${curAction?.label.toLowerCase()}`}
            />
          </div>
        )}

        {/* Visual Cards Grid ("Trải file ra") */}
        {fileItems.length > 0 && (
          <div className="space-y-6">
            {/* Toolbar above grid */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-950/80 border border-gray-800 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold font-mono">
                  {fileItems.length}
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-white">
                    Đã chọn {fileItems.length} tệp
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Tổng dung lượng: <span className="text-gray-200 font-medium">{formatBytes(totalBytes)}</span>
                  </p>
                </div>
              </div>

              {!isRunning && !isDone && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={addFilesInputRef}
                    onChange={handleAppendFiles}
                    multiple
                    accept={curAction?.accept}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => addFilesInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/60 shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Thêm tệp</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 rounded-xl text-xs font-semibold transition-all border border-red-800/40 shadow-sm cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Xóa tất cả</span>
                  </button>
                </div>
              )}
            </div>

            {/* Grid of file cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {fileItems.map((item, index) => {
                const isCurrentProcessing = isRunning && currentFile === item.name;
                return (
                  <div
                    key={item.id}
                    className={`group relative bg-gray-950/90 border rounded-2xl p-3 flex flex-col justify-between transition-all duration-200 shadow-md ${
                      isCurrentProcessing
                        ? 'border-cyan-400 ring-2 ring-cyan-500/40 shadow-cyan-900/40'
                        : 'border-white/10 hover:border-cyan-500/50'
                    }`}
                  >
                    {/* Top index & delete button */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-gray-800 text-gray-300 flex items-center justify-center text-[10px] font-bold font-mono">
                          #{index + 1}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                          {item.type}
                        </span>
                      </div>

                      {!isRunning && !isDone && (
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          title="Xóa tệp này"
                          className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Thumbnail preview container */}
                    <div className="relative w-full aspect-[4/3] bg-black/40 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center p-1.5">
                      {item.loading ? (
                        <div className="flex flex-col items-center justify-center gap-1 text-gray-500">
                          <Loader2 size={18} className="animate-spin text-cyan-400" />
                          <span className="text-[10px]">Đang đọc...</span>
                        </div>
                      ) : item.preview ? (
                        <img
                          src={item.preview}
                          alt={item.name}
                          className="w-full h-full object-contain rounded-lg pointer-events-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-600 gap-1">
                          {item.type === 'pdf' ? (
                            <FileText size={28} className="text-pink-400/80" />
                          ) : item.type === 'image' ? (
                            <ImageIcon size={28} className="text-blue-400/80" />
                          ) : (
                            <HardDrive size={28} className="text-gray-400/80" />
                          )}
                          <span className="text-[10px] uppercase font-mono">{item.name.split('.').pop()}</span>
                        </div>
                      )}

                      {/* Badge for page count or resolution */}
                      {item.pageCount && (
                        <span className="absolute bottom-1 right-1 bg-pink-900/90 text-pink-200 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-pink-700/50 shadow">
                          {item.pageCount} trang
                        </span>
                      )}
                      {item.width && item.height && (
                        <span className="absolute bottom-1 right-1 bg-blue-900/90 text-blue-200 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-blue-700/50 shadow">
                          {item.width}×{item.height}
                        </span>
                      )}

                      {/* Processing indicator badge */}
                      {isCurrentProcessing && (
                        <div className="absolute inset-0 bg-cyan-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 text-cyan-300">
                          <Loader2 size={20} className="animate-spin text-cyan-400" />
                          <span className="text-[10px] font-bold">Đang xử lý</span>
                        </div>
                      )}
                    </div>

                    {/* File name & size info */}
                    <div className="w-full mt-2">
                      <p className="text-xs font-semibold text-gray-200 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {formatBytes(item.size)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Options Panel */}
            {!isRunning && !isDone && (
              <div className="p-5 bg-gray-950/90 border border-gray-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                  <Sliders size={14} className="text-cyan-400" /> Tùy chọn xử lý ({curAction?.label})
                </div>

                {/* PDF Compress options */}
                {action === 'pdf-compress' && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-300 font-medium">Mức độ nén:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'screen', label: 'Tối đa (72 DPI)', desc: 'File siêu nhẹ' },
                        { id: 'ebook', label: 'Cân bằng (150 DPI)', desc: 'Khuyên dùng' },
                        { id: 'printer', label: 'Chất lượng cao (300 DPI)', desc: 'Dành cho in ấn' },
                        { id: 'prepress', label: 'Gốc (Prepress)', desc: 'Giữ nét tối đa' },
                      ].map(lvl => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setOptions({ ...options, quality: lvl.id })}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                            options.quality === lvl.id
                              ? 'bg-pink-500/20 border-pink-500 text-white shadow-md'
                              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          <div className="font-semibold">{lvl.label}</div>
                          <div className="text-[10px] text-gray-400">{lvl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Convert options */}
                {action === 'image-convert' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-300 font-medium">Đổi tất cả sang định dạng:</label>
                      <select
                        value={options.format || 'webp'}
                        onChange={e => setOptions({ ...options, format: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white mt-1.5 focus:outline-none focus:border-cyan-500 font-medium"
                      >
                        <option value="webp">WEBP (Tối ưu web hiện đại)</option>
                        <option value="jpg">JPG / JPEG (Phổ biến, tương thích cao)</option>
                        <option value="png">PNG (Giữ độ trong suốt)</option>
                        <option value="avif">AVIF (Chuẩn nén thế hệ mới)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 font-medium">
                        <span>Chất lượng ảnh xuất ra:</span>
                        <span className="text-cyan-400 font-bold">{options.quality || 85}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={options.quality || 85}
                        onChange={e => setOptions({ ...options, quality: parseInt(e.target.value, 10) })}
                        className="w-full mt-3 accent-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Image Compress options */}
                {action === 'image-compress' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-300 font-medium">
                      <span>Mức chất lượng sau khi nén:</span>
                      <span className="text-emerald-400 font-bold">{options.quality || 75}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={options.quality || 75}
                      onChange={e => setOptions({ ...options, quality: parseInt(e.target.value, 10) })}
                      className="w-full mt-2 accent-emerald-500"
                    />
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Nén mạnh (Dung lượng nhỏ)</span>
                      <span>Cân bằng</span>
                      <span>Chất lượng cao</span>
                    </div>
                  </div>
                )}

                {/* Image Resize options */}
                {action === 'image-resize' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-300 font-medium">Chiều rộng tối đa (Width px):</label>
                      <input
                        type="number"
                        placeholder="VD: 1920 (để trống nếu giữ nguyên)"
                        value={options.width || ''}
                        onChange={e => setOptions({ ...options, width: e.target.value ? parseInt(e.target.value, 10) : null })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white mt-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-300 font-medium">Chiều cao tối đa (Height px):</label>
                      <input
                        type="number"
                        placeholder="VD: 1080 (để trống nếu auto theo tỉ lệ)"
                        value={options.height || ''}
                        onChange={e => setOptions({ ...options, height: e.target.value ? parseInt(e.target.value, 10) : null })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white mt-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* PDF Rotate options */}
                {action === 'pdf-rotate' && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-300 font-medium">Góc xoay cho tất cả file:</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { angle: 90, label: '90° (Cùng chiều kim đồng hồ)' },
                        { angle: 180, label: '180° (Lộn ngược 180 độ)' },
                        { angle: 270, label: '270° (Ngược chiều kim đồng hồ)' },
                      ].map(item => (
                        <button
                          key={item.angle}
                          type="button"
                          onClick={() => setOptions({ ...options, angle: item.angle })}
                          className={`p-3 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer ${
                            options.angle === item.angle
                              ? 'bg-purple-500/20 border-purple-500 text-white shadow-md'
                              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Start Process Button */}
                <button
                  type="button"
                  onClick={startBatch}
                  disabled={uploading || fileItems.length === 0}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-900/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang khởi tạo tiến trình...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Bắt đầu xử lý {fileItems.length} tệp tin</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Real-time Progress Tracking */}
        {isRunning && (
          <div className="p-6 bg-gray-950 border border-cyan-800/60 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-cyan-400" />
                <span className="font-semibold text-cyan-300 truncate max-w-xs sm:max-w-md">
                  Đang xử lý: {currentFile || 'Đang chuẩn bị file...'}
                </span>
              </div>
              <span className="font-mono font-bold text-cyan-400 text-sm">
                {completed}/{total} ({progress}%)
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-3">
            <AlertTriangle size={18} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Done */}
        {isDone && result && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-b from-gray-900 to-gray-950 border border-green-800/50 rounded-2xl text-center space-y-3">
              <div className="w-14 h-14 bg-green-900/30 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto text-green-400 shadow-lg">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-bold text-white text-lg">
                Hoàn tất xử lý hàng loạt ({result.successCount} tệp thành công)
              </h3>
              {result.failCount > 0 && (
                <p className="text-xs text-yellow-400">
                  {result.failCount} tệp gặp lỗi trong quá trình xử lý.
                </p>
              )}
            </div>

            <ResultDownload
              result={{
                file: result.zipFile,
                originalName: `batch_${action}_results.zip`,
              }}
              onReset={reset}
              label={`Tải xuống toàn bộ file kết quả (ZIP)`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
