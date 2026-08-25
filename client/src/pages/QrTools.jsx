import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { QrCode, FileText, Image } from 'lucide-react';

const TABS = [
  { id: 'generate',    label: 'Tạo Mã QR',         icon: QrCode,   accept: null },
  { id: 'embed-pdf',   label: 'Nhúng QR vào PDF',  icon: FileText, accept: '.pdf' },
  { id: 'embed-image', label: 'Nhúng QR vào Ảnh',  icon: Image,    accept: 'image/*' },
];

export default function QrTools() {
  const [activeTab, setActiveTab] = useState('generate');
  const [file, setFile]           = useState(null);
  const [qrText, setQrText]       = useState('https://filetools.pro');
  const [qrSize, setQrSize]       = useState(250);
  const [qrColor, setQrColor]     = useState('#000000');
  const [qrBg, setQrBg]           = useState('#ffffff');
  const [position, setPosition]   = useState('bottom-right');

  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

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

  const handleSubmit = async () => {
    if (!qrText.trim()) return setError('Vui lòng nhập nội dung mã QR');
    if (activeTab !== 'generate' && !file) return setError('Vui lòng chọn file');

    setLoading(true);
    setError(null);
    setProgress(30);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let res;

    try {
      if (activeTab === 'generate') {
        res = await fetch('/api/qr/generate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body:    JSON.stringify({ data: qrText, size: qrSize, color: qrColor, bg: qrBg }),
        });
      } else {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('qrData', qrText);
        fd.append('size', qrSize);

        if (activeTab === 'embed-image') {
          fd.append('position', position);
        }

        res = await fetch(`/api/qr/${activeTab}`, {
          method: 'POST',
          headers,
          body: fd,
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo QR thất bại');

      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">QR Code Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Tạo mã QR chất lượng cao, tùy chỉnh màu sắc và nhúng trực tiếp vào tài liệu PDF hoặc hình ảnh.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        {activeTab !== 'generate' && (
          <FileDropzone
            key={activeTab}
            onFilesSelected={setFile}
            accept={curTab?.accept}
            label={`Chọn file để nhúng mã QR (${curTab?.label})`}
          />
        )}

        <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-300">Nội dung mã QR (URL, text, số điện thoại)</label>
            <input
              type="text"
              value={qrText}
              onChange={e => setQrText(e.target.value)}
              placeholder="VD: https://example.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-300">Kích thước (px)</label>
              <input
                type="number"
                value={qrSize}
                onChange={e => setQrSize(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-300">Màu mã QR</label>
              <input
                type="color"
                value={qrColor}
                onChange={e => setQrColor(e.target.value)}
                className="w-full h-9 bg-transparent rounded-lg cursor-pointer mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-300">Màu nền</label>
              <input
                type="color"
                value={qrBg}
                onChange={e => setQrBg(e.target.value)}
                className="w-full h-9 bg-transparent rounded-lg cursor-pointer mt-1"
              />
            </div>
          </div>

          {activeTab === 'embed-image' && (
            <div>
              <label className="text-xs text-gray-300">Vị trí nhúng trên ảnh</label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
              >
                <option value="bottom-right">Góc dưới - phải</option>
                <option value="bottom-left">Góc dưới - trái</option>
                <option value="top-right">Góc trên - phải</option>
              </select>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-teal-900/30 disabled:opacity-50"
          >
            {loading ? 'Đang tạo QR...' : activeTab === 'generate' ? 'Tạo mã QR' : 'Nhúng QR vào file'}
          </button>
        </div>

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {result && <ResultDownload result={result} onReset={reset} label="Tải kết quả QR" />}
      </div>
    </div>
  );
}
