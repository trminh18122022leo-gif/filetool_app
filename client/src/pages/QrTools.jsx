import { useState } from 'react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import axios from 'axios';
import {
  QrCode, FileText, Image as ImageIcon, Download, Copy, Check,
  ExternalLink, Globe, Wifi, Phone, Mail, Sparkles, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'generate',    label: 'Tạo Mã QR',         icon: QrCode,    accept: null },
  { id: 'embed-image', label: 'Nhúng QR vào Ảnh',  icon: ImageIcon, accept: 'image/*' },
  { id: 'embed-pdf',   label: 'Nhúng QR vào PDF',  icon: FileText,  accept: '.pdf' },
];

const PRESETS = [
  { label: 'Website / URL', icon: Globe, placeholder: 'https://example.com', defaultVal: 'https://filetools.pro' },
  { label: 'Số điện thoại', icon: Phone, placeholder: 'tel:+84987654321', defaultVal: 'tel:0901234567' },
  { label: 'Email', icon: Mail, placeholder: 'mailto:contact@example.com', defaultVal: 'mailto:contact@filetools.pro' },
  { label: 'WiFi Network', icon: Wifi, placeholder: 'WIFI:S:MyWifi;T:WPA;P:MyPassword;;', defaultVal: 'WIFI:S:Office-Wifi;T:WPA;P:12345678;;' },
];

export default function QrTools() {
  const [activeTab, setActiveTab] = useState('generate');
  const [file, setFile] = useState(null);
  const [qrText, setQrText] = useState('https://filetools.pro');
  const [qrSize, setQrSize] = useState(300);
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBg, setQrBg] = useState('#ffffff');
  const [qrFormat, setQrFormat] = useState('png');
  const [position, setPosition] = useState('bottom-right');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    reset();
  };

  const handlePresetSelect = (preset) => {
    setQrText(preset.defaultVal);
  };

  const handleSubmit = async () => {
    if (!qrText.trim()) return setError('Vui lòng nhập nội dung mã QR');
    if (activeTab !== 'generate' && !file) return setError('Vui lòng chọn file');

    setLoading(true);
    setError(null);
    setProgress(30);

    try {
      let data;
      setProgress(65);

      if (activeTab === 'generate') {
        const res = await axios.post(`${API}/api/qr/generate`, {
          data: qrText.trim(),
          size: qrSize,
          color: qrColor,
          bg: qrBg,
          format: qrFormat,
        }, { withCredentials: true });
        data = res.data;
      } else {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('qrData', qrText.trim());
        fd.append('size', qrSize);
        if (activeTab === 'embed-image') {
          fd.append('position', position);
        }

        const res = await axios.post(`${API}/api/qr/${activeTab}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        });
        data = res.data;
      }

      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Tạo QR thất bại');
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

  const getResultDisplayUrl = () => {
    if (!result) return '';
    if (result.dataUrl) return result.dataUrl;
    if (result.viewUrl) return result.viewUrl;
    if (result.downloadUrl && result.cloud) return result.downloadUrl;
    return `/outputs/${encodeURIComponent(result.file)}`;
  };

  const getResultDownloadUrl = () => {
    if (!result) return '';
    if (result.downloadUrl) return result.downloadUrl;
    return `${API}/api/download/${encodeURIComponent(result.file)}`;
  };

  const isImageResult = result?.dataUrl || (result?.file && /\.(png|jpe?g|webp|svg)$/i.test(result.file));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3">
          <QrCode size={30} className="text-pink-500" /> QR Code Studio
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Tạo mã QR độ phân giải cao, tùy biến màu sắc, định dạng và nhúng trực tiếp vào tài liệu hoặc hình ảnh.
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
        {activeTab !== 'generate' && (
          <FileDropzone
            key={activeTab}
            onFilesSelected={setFile}
            accept={curTab?.accept}
            label={`Chọn file để nhúng mã QR (${curTab?.label})`}
          />
        )}

        {/* Form Fields */}
        <div className="p-6 glass-card space-y-5">
          {/* Quick Presets for Text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300 font-medium">Nội dung mã QR (URL, text, liên hệ...)</label>
              <span className="text-[10px] text-gray-400 font-mono">{qrText.length} ký tự</span>
            </div>
            
            {activeTab === 'generate' && (
              <div className="flex gap-2 flex-wrap mb-2">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-button text-[11px] rounded-lg hover:text-pink-400 transition-all"
                  >
                    <p.icon size={12} /> {p.label}
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              value={qrText}
              onChange={e => setQrText(e.target.value)}
              placeholder="VD: https://example.com"
              className="glass-input text-sm py-3"
            />
          </div>

          {/* Color & Size Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">Kích thước (px)</label>
              <input
                type="number"
                min="100"
                max="1000"
                step="50"
                value={qrSize}
                onChange={e => setQrSize(Number(e.target.value))}
                className="glass-input text-xs py-2 font-mono"
              />
            </div>

            {activeTab === 'generate' && (
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Định dạng file</label>
                <div className="flex gap-1.5">
                  {['png', 'svg'].map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setQrFormat(fmt)}
                      className={`flex-1 py-2 text-xs font-bold uppercase rounded-xl transition-all ${
                        qrFormat === fmt
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'glass-button text-gray-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">Màu mã QR</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={qrColor}
                  onChange={e => setQrColor(e.target.value)}
                  className="w-10 h-9 bg-transparent rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={qrColor}
                  onChange={e => setQrColor(e.target.value)}
                  className="glass-input text-xs py-1.5 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">Màu nền</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={qrBg}
                  onChange={e => setQrBg(e.target.value)}
                  className="w-10 h-9 bg-transparent rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={qrBg}
                  onChange={e => setQrBg(e.target.value)}
                  className="glass-input text-xs py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          {activeTab === 'embed-image' && (
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1.5">Vị trí nhúng trên ảnh</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['bottom-right', 'Góc dưới - Phải'],
                  ['bottom-left', 'Góc dưới - Trái'],
                  ['top-right', 'Góc trên - Phải'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPosition(val)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                      position === val ? 'bg-pink-600 text-white font-bold' : 'glass-button'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Đang xử lý...
              </>
            ) : (
              <>
                <curTab.icon size={16} />
                {activeTab === 'generate' ? 'Tạo mã QR hoàn chỉnh' : `Nhúng QR vào file (${curTab.label})`}
              </>
            )}
          </button>
        </div>

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-2xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 🌟 INSTANT FINISHED PRODUCT SHOWCASE CARD */}
        {result && (result.file || result.dataUrl) && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-pink-500/40 shadow-[0_0_30px_rgba(236,72,153,0.25)] space-y-6 animate-in fade-in-50 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Mã QR đã tạo thành công!
                  </h3>
                  <p className="text-gray-400 text-xs">
                    File: <span className="font-mono text-pink-300">{result.file || 'qrcode.png'}</span>
                  </p>
                </div>
              </div>

              {isImageResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyImage}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Đã sao chép!' : 'Sao chép ảnh QR'}</span>
                  </button>
                  <a
                    href={getResultDisplayUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-all"
                    title="Mở tab mới"
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>

            {/* Large Sharp Preview of Product */}
            {isImageResult && (
              <div className="relative w-full min-h-[260px] max-h-[420px] bg-black/80 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-6 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
                <img
                  src={getResultDisplayUrl()}
                  alt="QR Code Result"
                  className="max-w-full max-h-[360px] object-contain rounded-xl shadow-2xl p-2 bg-white"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href={getResultDownloadUrl()}
                download={result.file || 'qrcode.png'}
                className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] transition-all uppercase tracking-wider"
              >
                <Download size={18} /> Tải mã QR về máy
              </a>

              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-2xl font-bold text-sm border border-white/10 transition-all"
              >
                <Sparkles size={18} className="text-pink-400" /> Tạo mã QR mới
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
