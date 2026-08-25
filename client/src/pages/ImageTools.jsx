import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { RefreshCw, Minimize2, Scaling, Crop, Wand2, Sparkles } from 'lucide-react';

const TABS = [
  { id: 'convert',   label: 'Đổi Định Dạng',  icon: RefreshCw, accept: 'image/*' },
  { id: 'compress',  label: 'Nén Ảnh',        icon: Minimize2, accept: 'image/*' },
  { id: 'resize',    label: 'Đổi Kích Thước', icon: Scaling,   accept: 'image/*' },
  { id: 'crop',      label: 'Cắt Ảnh (Crop)', icon: Crop,      accept: 'image/*' },
  { id: 'filter',    label: 'Bộ Lọc Ảnh',     icon: Wand2,     accept: 'image/*' },
  { id: 'removebg',  label: 'Xóa Phông (AI)', icon: Sparkles,  accept: 'image/*' },
];

export default function ImageTools() {
  const [activeTab, setActiveTab] = useState('convert');
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  // Form params
  const [format, setFormat]       = useState('webp');
  const [quality, setQuality]     = useState(85);
  const [width, setWidth]         = useState('');
  const [height, setHeight]       = useState('');
  const [cropLeft, setCropLeft]   = useState(0);
  const [cropTop, setCropTop]     = useState(0);
  const [cropW, setCropW]         = useState(300);
  const [cropH, setCropH]         = useState(300);
  const [filterType, setFilterType] = useState('grayscale');

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
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let endpoint = '';
    if (activeTab === 'convert') {
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
      fd.append('left', cropLeft);
      fd.append('top', cropTop);
      fd.append('width', cropW);
      fd.append('height', cropH);
    } else if (activeTab === 'filter') {
      endpoint = '/api/image/filter';
      fd.append('filter', filterType);
    } else if (activeTab === 'removebg') {
      endpoint = '/api/image/remove-bg';
    }

    try {
      setProgress(65);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xử lý ảnh thất bại');

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
        <h1 className="text-2xl font-bold text-white">Image Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Chuyển đổi, tối ưu dung lượng và xử lý ảnh hiệu năng cao bằng thư viện Sharp & AI Remove.bg.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <FileDropzone
          key={activeTab}
          onFilesSelected={setFile}
          accept={curTab?.accept}
          label={`Tải ảnh cho chức năng: ${curTab?.label}`}
        />

        {file && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Cấu hình thao tác</h3>

            {activeTab === 'convert' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Định dạng đích</label>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  >
                    <option value="webp">WEBP (Khuyến nghị cho web)</option>
                    <option value="avif">AVIF (Siêu nén thế hệ mới)</option>
                    <option value="png">PNG (Chất lượng nguyên gốc)</option>
                    <option value="jpg">JPG (Phổ biến)</option>
                    <option value="tiff">TIFF (In ấn)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Chất lượng ({quality}%)</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>
            )}

            {activeTab === 'compress' && (
              <div>
                <label className="text-xs text-gray-300">Chất lượng nén ({quality}%)</label>
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
                  className="w-full mt-2"
                />
              </div>
            )}

            {activeTab === 'resize' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Chiều rộng (px)</label>
                  <input
                    type="number"
                    value={width}
                    onChange={e => setWidth(e.target.value)}
                    placeholder="Auto nếu để trống"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300">Chiều cao (px)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="Auto nếu để trống"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                  />
                </div>
              </div>
            )}

            {activeTab === 'crop' && (
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-300">Left (X)</label>
                  <input
                    type="number"
                    value={cropLeft}
                    onChange={e => setCropLeft(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300">Top (Y)</label>
                  <input
                    type="number"
                    value={cropTop}
                    onChange={e => setCropTop(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300">Width</label>
                  <input
                    type="number"
                    value={cropW}
                    onChange={e => setCropW(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300">Height</label>
                  <input
                    type="number"
                    value={cropH}
                    onChange={e => setCropH(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1"
                  />
                </div>
              </div>
            )}

            {activeTab === 'filter' && (
              <div>
                <label className="text-xs text-gray-300">Chọn bộ lọc</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                >
                  <option value="grayscale">Trắng đen (Grayscale)</option>
                  <option value="sepia">Cổ điển (Sepia)</option>
                  <option value="blur">Làm mờ (Blur)</option>
                  <option value="sharpen">Làm sắc nét (Sharpen)</option>
                  <option value="invert">Đảo màu (Invert)</option>
                </select>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : `Thực hiện: ${curTab?.label}`}
            </button>
          </div>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {result && <ResultDownload result={result} onReset={reset} />}
      </div>
    </div>
  );
}
