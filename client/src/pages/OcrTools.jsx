import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { ScanText, FileSearch, Copy, Check } from 'lucide-react';

const TABS = [
  { id: 'image',          label: 'Ảnh -> Text',          icon: ScanText,   accept: 'image/*' },
  { id: 'pdf-scan',       label: 'PDF Scan -> Text',     icon: ScanText,   accept: '.pdf' },
  { id: 'searchable-pdf', label: 'Tạo Searchable PDF',   icon: FileSearch, accept: '.pdf,image/*' },
];

export default function OcrTools() {
  const [activeTab, setActiveTab] = useState('image');
  const [file, setFile]           = useState(null);
  const [lang, setLang]           = useState('vie+eng');
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [textResult, setTextResult] = useState('');
  const [fileResult, setFileResult] = useState(null);
  const [error, setError]         = useState(null);
  const [copied, setCopied]       = useState(false);

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFile(null);
    setTextResult('');
    setFileResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    reset();
  };

  const handleCopy = () => {
    if (!textResult) return;
    navigator.clipboard.writeText(textResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setTextResult('');
    setFileResult(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const endpoint = `/api/ocr/${activeTab}`;

    try {
      setProgress(60);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nhận dạng OCR thất bại');

      setProgress(100);
      if (data.text) setTextResult(data.text);
      if (data.file || data.downloadUrl) setFileResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">OCR Tools (Tesseract)</h1>
        <p className="text-sm text-gray-400 mt-1">
          Nhận dạng chữ quang học từ ảnh scan và PDF scan với độ chính xác cao (hỗ trợ Tiếng Việt & Tiếng Anh).
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
          label={`Tải file cho chức năng: ${curTab?.label}`}
        />

        {file && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300">Ngôn ngữ nhận dạng</label>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="vie+eng">Tiếng Việt + Tiếng Anh (Khuyến nghị)</option>
                <option value="vie">Chỉ Tiếng Việt</option>
                <option value="eng">Chỉ Tiếng Anh</option>
              </select>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {loading ? 'Đang nhận dạng OCR...' : 'Bắt đầu nhận dạng'}
            </button>
          </div>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {textResult && (
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Kết quả nhận diện văn bản:</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1 bg-gray-900 border border-gray-800 rounded-lg transition-colors"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={textResult}
              rows={12}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-200 font-mono focus:outline-none"
            />
          </div>
        )}

        {fileResult && <ResultDownload result={fileResult} onReset={reset} label="Tải Searchable PDF" />}
      </div>
    </div>
  );
}
