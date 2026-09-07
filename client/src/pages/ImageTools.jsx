import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  RefreshCw, Minimize2, Scaling, Crop, Wand2, Sparkles,
  Download, Copy, Check, ExternalLink, Image as ImageIcon,
  Eraser, Paintbrush, Trash2, Layers, Sliders, CheckCircle2,
  AlertCircle, Loader2, ZoomIn, Move
} from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';

const API = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'remove-object', label: 'Xóa Vật Thể (AI)', icon: Eraser,    accept: 'image/*' },
  { id: 'removebg',      label: 'Xóa Phông (AI)',    icon: Sparkles,  accept: 'image/*' },
  { id: 'crop',          label: 'Cắt Ảnh (Crop)',    icon: Crop,      accept: 'image/*' },
  { id: 'resize',        label: 'Đổi Kích Thước',    icon: Scaling,   accept: 'image/*' },
  { id: 'filter',        label: 'Bộ Lọc Ảnh',        icon: Wand2,     accept: 'image/*' },
  { id: 'convert',       label: 'Đổi Định Dạng',     icon: RefreshCw, accept: 'image/*' },
  { id: 'compress',      label: 'Nén Ảnh',           icon: Minimize2, accept: 'image/*' },
];

const FILTER_PRESETS = [
  { id: 'grayscale', name: 'Trắng đen', css: 'grayscale(100%)', desc: 'Đơn sắc cổ điển' },
  { id: 'sepia',     name: 'Cổ điển (Sepia)', css: 'sepia(100%)', desc: 'Tông màu hoài niệm' },
  { id: 'blur',      name: 'Làm mờ (Blur)', css: 'blur(4px)', desc: 'Làm mờ nền' },
  { id: 'sharpen',   name: 'Sắc nét (Sharpen)', css: 'contrast(130%) brightness(105%)', desc: 'Tăng chi tiết viền' },
  { id: 'invert',    name: 'Đảo màu (Invert)', css: 'invert(100%)', desc: 'Hiệu ứng âm bản' },
  { id: 'vintage',   name: 'Vintage Film', css: 'sepia(40%) contrast(120%) brightness(95%)', desc: 'Phong cách máy film' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', css: 'hue-rotate(180deg) saturate(180%) contrast(120%)', desc: 'Tương phản rực rỡ' },
  { id: 'warm',      name: 'Tông ấm (Warm)', css: 'sepia(30%) saturate(140%) brightness(105%)', desc: 'Ánh nắng ấm áp' },
  { id: 'cool',      name: 'Tông lạnh (Cool)', css: 'hue-rotate(190deg) saturate(120%)', desc: 'Xanh băng thanh mát' },
];

const ASPECT_RATIOS = [
  { label: 'Tự do', ratio: null },
  { label: '1:1 (Avatar)', ratio: 1 / 1 },
  { label: '16:9 (Slide/YT)', ratio: 16 / 9 },
  { label: '4:3 (Chuẩn)', ratio: 4 / 3 },
  { label: '9:16 (Story/TikTok)', ratio: 9 / 16 },
  { label: '3:2 (Ảnh chụp)', ratio: 3 / 2 },
];

export default function ImageTools() {
  const [activeTab, setActiveTab] = useState('remove-object');
  const [file, setFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form params
  const [format, setFormat] = useState('webp');
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);

  // Crop params
  const [selectedRatio, setSelectedRatio] = useState(null);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropTop, setCropTop] = useState(0);
  const [cropW, setCropW] = useState(300);
  const [cropH, setCropH] = useState(300);

  // Filter params
  const [filterType, setFilterType] = useState('grayscale');

  // AI Object Removal / Brush Mask State
  const [brushSize, setBrushSize] = useState(35);
  const [brushMode, setBrushMode] = useState('brush'); // 'brush' | 'eraser'
  const [hasMaskDrawn, setHasMaskDrawn] = useState(false);

  // Refs
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const dragModeRef = useRef(null); // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e' | 'draw'
  const dragStartRef = useRef({ x: 0, y: 0, cropLeft: 0, cropTop: 0, cropW: 0, cropH: 0 });

  const curTab = TABS.find(t => t.id === activeTab);

  // Load preview and image dimensions when a new file is selected
  useEffect(() => {
    if (!file) {
      setImagePreviewUrl(null);
      setNaturalDimensions({ width: 0, height: 0 });
      return;
    }

    let isSubscribed = true;
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!isSubscribed) return;
      const dataUrl = e.target.result;
      setImagePreviewUrl(dataUrl);

      const img = new Image();
      img.onload = () => {
        if (!isSubscribed) return;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        setNaturalDimensions({ width: w, height: h });
        setWidth(w);
        setHeight(h);
        // Initialize centered crop
        const initialCropSize = Math.min(w, h, 400);
        setCropW(initialCropSize);
        setCropH(initialCropSize);
        setCropLeft(Math.max(0, Math.floor((w - initialCropSize) / 2)));
        setCropTop(Math.max(0, Math.floor((h - initialCropSize) / 2)));

        // Initialize mask canvas size
        if (maskCanvasRef.current) {
          maskCanvasRef.current.width = w;
          maskCanvasRef.current.height = h;
          const ctx = maskCanvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, w, h);
        }
        setHasMaskDrawn(false);
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);

    return () => {
      isSubscribed = false;
    };
  }, [file]);

  // Synchronize canvas size when image dimensions change
  useEffect(() => {
    if (naturalDimensions.width && maskCanvasRef.current) {
      maskCanvasRef.current.width = naturalDimensions.width;
      maskCanvasRef.current.height = naturalDimensions.height;
    }
  }, [naturalDimensions, activeTab]);

  // Helper: Convert displayed client coordinates to natural image pixel coordinates
  const getNaturalCoords = useCallback((clientX, clientY) => {
    if (!imgRef.current || !naturalDimensions.width) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = naturalDimensions.width / rect.width;
    const scaleY = naturalDimensions.height / rect.height;
    const x = Math.max(0, Math.min(naturalDimensions.width, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(naturalDimensions.height, (clientY - rect.top) * scaleY));
    return { x, y };
  }, [naturalDimensions]);

  // ── 🎨 BRUSH MASK DRAWING (SnapEdit Style Object Removal & Mask Selection) ──
  const startDrawing = (e) => {
    if (activeTab !== 'remove-object' && activeTab !== 'removebg') return;
    isDrawingRef.current = true;
    drawBrushStroke(e);
  };

  const drawBrushStroke = (e) => {
    if (!isDrawingRef.current || !maskCanvasRef.current || !naturalDimensions.width) return;
    const { x, y } = getNaturalCoords(e.clientX, e.clientY);
    const ctx = maskCanvasRef.current.getContext('2d');

    ctx.save();
    if (brushMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(236, 72, 153, 0.75)'; // Glowing pink mask
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      setHasMaskDrawn(true);
    }
    ctx.restore();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearBrushMask = () => {
    if (!maskCanvasRef.current || !naturalDimensions.width) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, naturalDimensions.width, naturalDimensions.height);
    setHasMaskDrawn(false);
  };

  // ── ✂️ INTERACTIVE DRAG & RESIZE CROP ENGINE ────────────────────────────────
  const handleCropPointerDown = (mode, e) => {
    e.stopPropagation();
    e.preventDefault();
    dragModeRef.current = mode;
    const { x, y } = getNaturalCoords(e.clientX, e.clientY);
    dragStartRef.current = {
      x,
      y,
      cropLeft,
      cropTop,
      cropW,
      cropH,
    };

    window.addEventListener('pointermove', handleCropPointerMove);
    window.addEventListener('pointerup', handleCropPointerUp);
  };

  const handleCropPointerMove = (e) => {
    if (!dragModeRef.current || !naturalDimensions.width) return;
    const { x, y } = getNaturalCoords(e.clientX, e.clientY);
    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;
    const imgW = naturalDimensions.width;
    const imgH = naturalDimensions.height;

    const start = dragStartRef.current;
    let newLeft = start.cropLeft;
    let newTop = start.cropTop;
    let newW = start.cropW;
    let newH = start.cropH;

    if (dragModeRef.current === 'move') {
      newLeft = Math.max(0, Math.min(imgW - start.cropW, start.cropLeft + dx));
      newTop = Math.max(0, Math.min(imgH - start.cropH, start.cropTop + dy));
    } else if (dragModeRef.current === 'draw') {
      const x1 = Math.min(start.x, x);
      const y1 = Math.min(start.y, y);
      const x2 = Math.max(start.x, x);
      const y2 = Math.max(start.y, y);
      newLeft = x1;
      newTop = y1;
      newW = Math.max(20, x2 - x1);
      newH = Math.max(20, y2 - y1);
      if (selectedRatio) {
        newH = Math.round(newW / selectedRatio);
      }
    } else {
      const mode = dragModeRef.current;
      if (mode.includes('e')) newW = Math.max(30, Math.min(imgW - start.cropLeft, start.cropW + dx));
      if (mode.includes('s')) newH = Math.max(30, Math.min(imgH - start.cropTop, start.cropH + dy));
      if (mode.includes('w')) {
        const potentialW = Math.max(30, start.cropW - dx);
        if (start.cropLeft + start.cropW - potentialW >= 0) {
          newLeft = start.cropLeft + (start.cropW - potentialW);
          newW = potentialW;
        }
      }
      if (mode.includes('n')) {
        const potentialH = Math.max(30, start.cropH - dy);
        if (start.cropTop + start.cropH - potentialH >= 0) {
          newTop = start.cropTop + (start.cropH - potentialH);
          newH = potentialH;
        }
      }

      if (selectedRatio) {
        newH = Math.round(newW / selectedRatio);
        if (newTop + newH > imgH) {
          newH = imgH - newTop;
          newW = Math.round(newH * selectedRatio);
        }
      }
    }

    setCropLeft(Math.round(Math.max(0, Math.min(imgW - newW, newLeft))));
    setCropTop(Math.round(Math.max(0, Math.min(imgH - newH, newTop))));
    setCropW(Math.round(Math.max(20, Math.min(imgW, newW))));
    setCropH(Math.round(Math.max(20, Math.min(imgH, newH))));
  };

  const handleCropPointerUp = () => {
    dragModeRef.current = null;
    window.removeEventListener('pointermove', handleCropPointerMove);
    window.removeEventListener('pointerup', handleCropPointerUp);
  };

  const handleRatioSelect = (ratio) => {
    setSelectedRatio(ratio);
    if (!naturalDimensions.width) return;
    const w = naturalDimensions.width;
    const h = naturalDimensions.height;

    if (ratio === null) return;

    let targetW = cropW;
    let targetH = Math.round(cropW / ratio);

    if (targetH > h) {
      targetH = h;
      targetW = Math.round(h * ratio);
    }
    if (targetW > w) {
      targetW = w;
      targetH = Math.round(w / ratio);
    }

    setCropW(targetW);
    setCropH(targetH);
    setCropLeft(Math.min(cropLeft, Math.max(0, w - targetW)));
    setCropTop(Math.min(cropTop, Math.max(0, h - targetH)));
  };

  // ── FORM HANDLERS ──────────────────────────────────────────────────────────
  const handleWidthChange = (newW) => {
    const val = Number(newW) || '';
    setWidth(val);
    if (lockAspectRatio && naturalDimensions.width && naturalDimensions.height && val) {
      const ratio = naturalDimensions.height / naturalDimensions.width;
      setHeight(Math.round(val * ratio));
    }
  };

  const handleHeightChange = (newH) => {
    const val = Number(newH) || '';
    setHeight(val);
    if (lockAspectRatio && naturalDimensions.width && naturalDimensions.height && val) {
      const ratio = naturalDimensions.width / naturalDimensions.height;
      setWidth(Math.round(val * ratio));
    }
  };

  const applyScalePreset = (pct) => {
    if (!naturalDimensions.width) return;
    const newW = Math.round(naturalDimensions.width * (pct / 100));
    const newH = Math.round(naturalDimensions.height * (pct / 100));
    setWidth(newW);
    setHeight(newH);
  };

  const reset = () => {
    setFile(null);
    setImagePreviewUrl(null);
    setResult(null);
    setError(null);
    setProgress(0);
    clearBrushMask();
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    setResult(null);
    setError(null);
  };

  // ── SUBMISSION ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);

    let endpoint = '';

    if (activeTab === 'remove-object') {
      endpoint = '/api/image/remove-object';
      if (!maskCanvasRef.current || !hasMaskDrawn) {
        setLoading(false);
        return setError('Vui lòng dùng cọ tô lên vật thể bạn muốn xóa trước khi bấm thực hiện.');
      }
      // Create high-contrast binary mask
      const binaryCanvas = document.createElement('canvas');
      binaryCanvas.width = naturalDimensions.width;
      binaryCanvas.height = naturalDimensions.height;
      const bCtx = binaryCanvas.getContext('2d');
      bCtx.fillStyle = '#000000';
      bCtx.fillRect(0, 0, binaryCanvas.width, binaryCanvas.height);

      const srcCtx = maskCanvasRef.current.getContext('2d');
      const imgData = srcCtx.getImageData(0, 0, naturalDimensions.width, naturalDimensions.height);
      const bImgData = bCtx.getImageData(0, 0, naturalDimensions.width, naturalDimensions.height);

      for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i + 3] > 10) { // Painted area
          bImgData.data[i] = 255;
          bImgData.data[i + 1] = 255;
          bImgData.data[i + 2] = 255;
          bImgData.data[i + 3] = 255;
        }
      }
      bCtx.putImageData(bImgData, 0, 0);
      const maskDataUrl = binaryCanvas.toDataURL('image/png');
      fd.append('mask', maskDataUrl);
    } else if (activeTab === 'removebg') {
      endpoint = '/api/image/remove-bg';
      if (hasMaskDrawn && maskCanvasRef.current) {
        const binaryCanvas = document.createElement('canvas');
        binaryCanvas.width = naturalDimensions.width;
        binaryCanvas.height = naturalDimensions.height;
        const bCtx = binaryCanvas.getContext('2d');
        bCtx.fillStyle = '#000000';
        bCtx.fillRect(0, 0, binaryCanvas.width, binaryCanvas.height);

        const srcCtx = maskCanvasRef.current.getContext('2d');
        const imgData = srcCtx.getImageData(0, 0, naturalDimensions.width, naturalDimensions.height);
        const bImgData = bCtx.getImageData(0, 0, naturalDimensions.width, naturalDimensions.height);

        for (let i = 0; i < imgData.data.length; i += 4) {
          if (imgData.data[i + 3] > 10) {
            bImgData.data[i] = 255;
            bImgData.data[i + 1] = 255;
            bImgData.data[i + 2] = 255;
            bImgData.data[i + 3] = 255;
          }
        }
        bCtx.putImageData(bImgData, 0, 0);
        fd.append('mask', binaryCanvas.toDataURL('image/png'));
      }
    } else if (activeTab === 'convert') {
      endpoint = '/api/image/convert';
      fd.append('format', format);
      fd.append('quality', quality);
    } else if (activeTab === 'compress') {
      endpoint = '/api/image/compress';
      fd.append('quality', quality);
    } else if (activeTab === 'resize') {
      endpoint = '/api/image/resize';
      if (width) fd.append('width', width);
      if (height) fd.append('height', height);
    } else if (activeTab === 'crop') {
      endpoint = '/api/image/crop';
      fd.append('left', Math.max(0, Math.floor(cropLeft)));
      fd.append('top', Math.max(0, Math.floor(cropTop)));
      fd.append('width', Math.max(1, Math.floor(cropW)));
      fd.append('height', Math.max(1, Math.floor(cropH)));
    } else if (activeTab === 'filter') {
      endpoint = '/api/image/filter';
      fd.append('filter', filterType);
    }

    try {
      setProgress(65);
      const { data } = await axios.post(`${API}${endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Xử lý ảnh thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!result?.file && !result?.dataUrl) return;
    try {
      const viewUrl = result.dataUrl || result.viewUrl || `${API}/api/download/${encodeURIComponent(result.file)}`;
      const res = await fetch(viewUrl);
      const blob = await res.blob();

      if (blob.type === 'image/png') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (pngBlob) => {
            if (pngBlob) {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }
          }, 'image/png');
        };
        img.src = viewUrl;
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy warning:', err);
      const viewUrl = result.downloadUrl || `${window.location.origin}/api/download/${encodeURIComponent(result.file)}`;
      await navigator.clipboard.writeText(viewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleUseResultAsInput = async () => {
    if (!result?.file && !result?.dataUrl) return;
    try {
      const viewUrl = result.dataUrl || result.viewUrl || `${API}/api/download/${encodeURIComponent(result.file)}`;
      const res = await fetch(viewUrl);
      const blob = await res.blob();
      const newFile = new File([blob], result.file || 'edited_image.png', { type: blob.type || 'image/png' });
      setFile(newFile);
      setResult(null);
      clearBrushMask();
    } catch (err) {
      console.error('Use as input error:', err);
    }
  };

  const getResultDisplayUrl = () => {
    if (!result) return '';
    if (result.dataUrl) return result.dataUrl;
    if (result.viewUrl) return result.viewUrl;
    if (result.downloadUrl && result.cloud) return result.downloadUrl;
    return `${API}/api/download/${encodeURIComponent(result.file)}`;
  };

  const getResultDownloadUrl = () => {
    if (!result) return '';
    if (result.downloadUrl) return result.downloadUrl;
    return `${API}/api/download/${encodeURIComponent(result.file)}`;
  };

  const activeFilterCss = FILTER_PRESETS.find(f => f.id === filterType)?.css || 'none';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
          <ImageIcon size={30} className="text-pink-500" /> Image Studio AI Pro
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Xóa vật thể AI SnapEdit, xóa phông nền, cắt ảnh tự do kéo thả, đổi kích thước & bộ lọc màu trực quan.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-2 glass-panel">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="glass-panel p-6 sm:p-8 space-y-6">
        {!file ? (
          <FileDropzone
            key={activeTab}
            onFilesSelected={setFile}
            accept={curTab?.accept}
            label={`Tải ảnh để thực hiện: ${curTab?.label}`}
          />
        ) : (
          <div className="space-y-6">
            {/* Inspector Bar */}
            <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreviewUrl}
                  alt="Original Preview"
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-md bg-black/50"
                />
                <div>
                  <p className="text-xs font-bold text-white truncate max-w-xs">{file.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {naturalDimensions.width > 0 && `${naturalDimensions.width} × ${naturalDimensions.height} px · `}
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
                >
                  Chọn ảnh khác
                </button>
              </div>
            </div>

            {/* Visual Live Preview Box & Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Visual Canvas / Live Preview Display */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                    <ZoomIn size={14} /> Ảnh xem trước trực quan
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {activeTab === 'remove-object' && '🎨 Di chuột & tô cọ lên vật thể/người/chữ cần xóa'}
                    {activeTab === 'removebg' && '✨ Xóa phông AI tự động (hoặc dùng cọ tô để xóa thêm)'}
                    {activeTab === 'crop' && '✂️ Kéo trực tiếp trên ảnh để chọn & co giãn khung cắt'}
                    {activeTab === 'filter' && `Bộ lọc: ${FILTER_PRESETS.find(f => f.id === filterType)?.name}`}
                    {activeTab === 'resize' && `Kích thước: ${width || naturalDimensions.width} × ${height || naturalDimensions.height} px`}
                  </span>
                </div>

                {/* Preview & Interactive Canvas Container */}
                <div
                  ref={containerRef}
                  onPointerMove={(e) => {
                    if (isDrawingRef.current) drawBrushStroke(e);
                  }}
                  onPointerLeave={stopDrawing}
                  className="relative w-full aspect-[4/3] bg-black/80 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-4 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] select-none"
                >
                  {imagePreviewUrl && (
                    <div className="relative max-w-full max-h-full flex items-center justify-center">
                      <img
                        ref={imgRef}
                        src={imagePreviewUrl}
                        alt="Workspace Preview"
                        draggable={false}
                        style={{
                          filter: activeTab === 'filter' ? activeFilterCss : 'none',
                          transition: 'filter 0.2s ease',
                        }}
                        className={`max-w-full max-h-[380px] object-contain rounded-xl shadow-2xl pointer-events-none ${
                          activeTab === 'removebg' ? 'bg-checkered' : ''
                        }`}
                      />

                      {/* 🎨 INTERACTIVE BRUSH MASK CANVAS OVERLAY (SnapEdit Style & Remove BG) */}
                      {(activeTab === 'remove-object' || activeTab === 'removebg') && (
                        <canvas
                          ref={maskCanvasRef}
                          onPointerDown={startDrawing}
                          onPointerUp={stopDrawing}
                          className="absolute inset-0 w-full h-full object-contain cursor-crosshair z-20 touch-none"
                          style={{
                            width: imgRef.current ? `${imgRef.current.clientWidth}px` : '100%',
                            height: imgRef.current ? `${imgRef.current.clientHeight}px` : '100%',
                          }}
                        />
                      )}

                      {/* ✂️ INTERACTIVE CROP BOX OVERLAY (Drag & 8-Point Resizer) */}
                      {activeTab === 'crop' && naturalDimensions.width > 0 && imgRef.current && (
                        <div
                          onPointerDown={(e) => handleCropPointerDown('draw', e)}
                          className="absolute inset-0 z-20 cursor-crosshair"
                        >
                          {/* Active Crop Box */}
                          <div
                            onPointerDown={(e) => handleCropPointerDown('move', e)}
                            className="absolute border-2 border-pink-500 bg-pink-500/15 shadow-[0_0_20px_rgba(236,72,153,0.5)] cursor-move transition-shadow"
                            style={{
                              left: `${(cropLeft / naturalDimensions.width) * 100}%`,
                              top: `${(cropTop / naturalDimensions.height) * 100}%`,
                              width: `${(cropW / naturalDimensions.width) * 100}%`,
                              height: `${(cropH / naturalDimensions.height) * 100}%`,
                            }}
                          >
                            {/* Dimensions Label */}
                            <span className="absolute -top-7 left-0 bg-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none flex items-center gap-1">
                              <Move size={10} /> {cropW} × {cropH} px
                            </span>

                            {/* 8 Drag Handles */}
                            <div onPointerDown={(e) => handleCropPointerDown('nw', e)} className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-nwse-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('ne', e)} className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-nesw-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('sw', e)} className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-nesw-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('se', e)} className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-nwse-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('n', e)} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-ns-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('s', e)} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-ns-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('w', e)} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-ew-resize shadow" />
                            <div onPointerDown={(e) => handleCropPointerDown('e', e)} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-pink-600 rounded-sm cursor-ew-resize shadow" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Configuration & Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-card p-5 space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                      <Sliders size={14} /> Cấu hình: {curTab?.label}
                    </h3>

                    {/* 1. 🪄 AI OBJECT REMOVAL (SNAPEDIT STYLE) */}
                    {activeTab === 'remove-object' && (
                      <div className="space-y-4">
                        <div className="p-3 bg-pink-950/20 border border-pink-500/20 rounded-xl text-xs text-pink-300">
                          <p className="font-bold flex items-center gap-1.5">
                            <Sparkles size={13} /> Xóa Vật Thể AI (SnapEdit Magic Eraser)
                          </p>
                          <p className="text-[11px] text-gray-300 mt-1">
                            Dùng cọ vẽ tô lên người, chữ, đồ vật, hình mờ... AI sẽ tự động xóa sạch và tái tạo nền tự nhiên.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs text-gray-300 font-medium block mb-1.5">Công cụ cọ vẽ</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setBrushMode('brush')}
                              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                brushMode === 'brush'
                                  ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40'
                                  : 'glass-button text-gray-300'
                              }`}
                            >
                              <Paintbrush size={14} /> Cọ vẽ vật thể
                            </button>
                            <button
                              type="button"
                              onClick={() => setBrushMode('eraser')}
                              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                brushMode === 'eraser'
                                  ? 'bg-purple-600 text-white shadow-md'
                                  : 'glass-button text-gray-300'
                              }`}
                            >
                              <Eraser size={14} /> Tẩy cọ
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-gray-300">
                            <span>Kích thước cọ</span>
                            <span className="font-bold text-pink-400 font-mono">{brushSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={e => setBrushSize(Number(e.target.value))}
                            className="w-full accent-pink-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={clearBrushMask}
                          className="w-full py-2 px-3 glass-button text-xs rounded-xl flex items-center justify-center gap-1.5 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                        >
                          <Trash2 size={13} /> Xóa toàn bộ nét cọ đã vẽ
                        </button>
                      </div>
                    )}

                    {/* 2. ✂️ CROP TAB */}
                    {activeTab === 'crop' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-300 font-medium block mb-1.5">Tỉ lệ khung hình (Aspect Ratio)</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {ASPECT_RATIOS.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleRatioSelect(item.ratio)}
                                className={`py-2 px-2 text-[11px] font-semibold rounded-xl transition-all ${
                                  selectedRatio === item.ratio
                                    ? 'bg-pink-600 text-white shadow-md'
                                    : 'glass-button text-gray-300'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-300 space-y-1">
                          <p className="font-bold text-pink-400 flex items-center gap-1">
                            💡 Hướng dẫn cắt ảnh tự do:
                          </p>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            • Kéo rê bên trong khung để di chuyển vùng cắt.<br />
                            • Kéo 8 chốt vuông ở góc và cạnh để co giãn kích thước.<br />
                            • Nhấp kéo trên vùng trống để vẽ khung cắt mới.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-gray-400 block mb-1">Rộng (Width px)</label>
                            <input
                              type="number"
                              min="10"
                              max={naturalDimensions.width || 5000}
                              value={cropW}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setCropW(val);
                                if (selectedRatio) setCropH(Math.round(val / selectedRatio));
                              }}
                              className="glass-input text-xs py-2 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-400 block mb-1">Cao (Height px)</label>
                            <input
                              type="number"
                              min="10"
                              max={naturalDimensions.height || 5000}
                              value={cropH}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setCropH(val);
                                if (selectedRatio) setCropW(Math.round(val * selectedRatio));
                              }}
                              className="glass-input text-xs py-2 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. 🪄 REMOVE BG TAB */}
                    {activeTab === 'removebg' && (
                      <div className="space-y-4">
                        <div className="p-3.5 bg-pink-950/20 border border-pink-500/20 rounded-xl text-xs text-pink-300 space-y-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <Sparkles size={14} /> AI Xóa Phông Tự Động & Tùy Chọn
                          </p>
                          <p className="text-[11px] text-gray-300 leading-relaxed">
                            Bấm nút thực hiện để AI tự động tách nền trong suốt, hoặc dùng cọ vẽ tô thêm vùng cần xóa.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs text-gray-300 font-medium block mb-1.5">Cọ tùy chọn xóa thêm vùng thừa (tùy chọn)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setBrushMode('brush')}
                              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                brushMode === 'brush'
                                  ? 'bg-pink-600 text-white shadow-md'
                                  : 'glass-button text-gray-300'
                              }`}
                            >
                              <Paintbrush size={13} /> Cọ xóa thêm
                            </button>
                            <button
                              type="button"
                              onClick={() => setBrushMode('eraser')}
                              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                brushMode === 'eraser'
                                  ? 'bg-purple-600 text-white shadow-md'
                                  : 'glass-button text-gray-300'
                              }`}
                            >
                              <Eraser size={13} /> Tẩy cọ
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-gray-300">
                            <span>Kích thước cọ</span>
                            <span className="font-bold text-pink-400 font-mono">{brushSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={e => setBrushSize(Number(e.target.value))}
                            className="w-full accent-pink-500"
                          />
                        </div>

                        {hasMaskDrawn && (
                          <button
                            type="button"
                            onClick={clearBrushMask}
                            className="w-full py-2 px-3 glass-button text-xs rounded-xl flex items-center justify-center gap-1.5 text-gray-400 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={13} /> Xóa các nét cọ đã vẽ
                          </button>
                        )}
                      </div>
                    )}

                    {/* 4. RESIZE TAB */}
                    {activeTab === 'resize' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-300 font-medium block mb-1.5">Tỉ lệ phần trăm nhanh</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {[25, 50, 75, 100, 150, 200].map(pct => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => applyScalePreset(pct)}
                                className="px-3 py-1.5 glass-button text-xs rounded-lg hover:text-pink-400 font-mono"
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="text-[11px] text-gray-400 block mb-1">Rộng (Width px)</label>
                            <input
                              type="number"
                              value={width}
                              onChange={e => handleWidthChange(e.target.value)}
                              className="glass-input text-xs py-2 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-400 block mb-1">Cao (Height px)</label>
                            <input
                              type="number"
                              value={height}
                              onChange={e => handleHeightChange(e.target.value)}
                              className="glass-input text-xs py-2 font-mono"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={lockAspectRatio}
                            onChange={e => setLockAspectRatio(e.target.checked)}
                            className="rounded border-white/20 text-pink-600 accent-pink-500"
                          />
                          <span>Khóa tỉ lệ khung hình (Aspect Ratio Lock)</span>
                        </label>
                      </div>
                    )}

                    {/* 5. FILTER TAB */}
                    {activeTab === 'filter' && (
                      <div className="space-y-3">
                        <label className="text-xs text-gray-300 font-medium block">Chọn bộ lọc nghệ thuật</label>
                        <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                          {FILTER_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setFilterType(p.id)}
                              className={`p-2 rounded-xl text-left transition-all border ${
                                filterType === p.id
                                  ? 'border-pink-500 bg-pink-950/30 text-white shadow-md'
                                  : 'border-white/5 bg-white/5 text-gray-300 hover:border-white/20'
                              }`}
                            >
                              <div className="w-full h-10 rounded-lg overflow-hidden mb-1.5 bg-black/40">
                                {imagePreviewUrl && (
                                  <img
                                    src={imagePreviewUrl}
                                    alt={p.name}
                                    style={{ filter: p.css }}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <p className="text-[11px] font-bold truncate">{p.name}</p>
                              <p className="text-[9px] text-gray-400 truncate">{p.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. CONVERT TAB */}
                    {activeTab === 'convert' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-300 font-medium block mb-1.5">Định dạng đích</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['webp', 'png', 'jpg', 'avif', 'tiff'].map((fmt) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={() => setFormat(fmt)}
                                className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                                  format === fmt
                                    ? 'bg-pink-600 text-white shadow-lg'
                                    : 'glass-button text-gray-300'
                                }`}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {format !== 'png' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-300">
                              <span>Chất lượng ảnh</span>
                              <span className="font-bold text-pink-400">{quality}%</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={quality}
                              onChange={e => setQuality(Number(e.target.value))}
                              className="w-full accent-pink-500"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. COMPRESS TAB */}
                    {activeTab === 'compress' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-gray-300">
                            <span>Mức chất lượng nén</span>
                            <span className="font-bold text-pink-400">{quality}%</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="90"
                            value={quality}
                            onChange={e => setQuality(Number(e.target.value))}
                            className="w-full accent-pink-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.35)] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Đang xử lý...
                      </>
                    ) : (
                      <>
                        <curTab.icon size={16} /> Thực hiện: {curTab?.label}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 🌟 INSTANT FINISHED PRODUCT SHOWCASE CARD */}
        {result && (result.file || result.dataUrl) && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-pink-500/40 shadow-[0_0_30px_rgba(236,72,153,0.2)] space-y-6 animate-in fade-in-50 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Sản phẩm hoàn thành!
                  </h3>
                  <p className="text-gray-400 text-xs">
                    File: <span className="font-mono text-pink-300">{result.file || 'image_processed.png'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyImage}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép!' : 'Sao chép ảnh'}</span>
                </button>
                <a
                  href={getResultDisplayUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-all"
                  title="Mở ảnh trong tab mới"
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            {/* Render Finished Image Directly On Screen */}
            <div className="relative w-full min-h-[260px] max-h-[460px] bg-black/80 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-4 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
              <img
                src={getResultDisplayUrl()}
                alt="Finished Product Preview"
                className="max-w-full max-h-[420px] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Comparison Metrics & Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href={getResultDownloadUrl()}
                download={result.file || 'processed_image.png'}
                className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] transition-all uppercase tracking-wider"
              >
                <Download size={18} /> Tải ảnh hoàn thiện xuống
              </a>

              <button
                onClick={handleUseResultAsInput}
                className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-bold text-sm border border-white/10 transition-all"
              >
                <Layers size={18} className="text-pink-400" /> Tiếp tục chỉnh sửa ảnh này
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
