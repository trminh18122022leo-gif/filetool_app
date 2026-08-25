import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import {
  FilePlus2, Scissors, Minimize2, FileOutput,
  RotateCw, Stamp, Lock, Unlock, Moon, BookOpen
} from 'lucide-react';

const TABS = [
  { id: 'merge',     label: 'Gộp PDF',      icon: FilePlus2,  multiple: true,  accept: '.pdf' },
  { id: 'split',     label: 'Tách PDF',     icon: Scissors,   multiple: false, accept: '.pdf' },
  { id: 'compress',  label: 'Nén PDF',      icon: Minimize2,  multiple: false, accept: '.pdf' },
  { id: 'to-word',   label: 'PDF -> Word',  icon: FileOutput, multiple: false, accept: '.pdf' },
  { id: 'from-word', label: 'Word -> PDF',  icon: FileOutput, multiple: false, accept: '.docx,.doc' },
  { id: 'rotate',    label: 'Xoay PDF',     icon: RotateCw,   multiple: false, accept: '.pdf' },
  { id: 'watermark', label: 'Watermark',    icon: Stamp,      multiple: false, accept: '.pdf' },
  { id: 'protect',   label: 'Đặt mật khẩu', icon: Lock,       multiple: false, accept: '.pdf' },
  { id: 'unlock',    label: 'Gỡ mật khẩu',  icon: Unlock,     multiple: false, accept: '.pdf' },
  { id: 'dark',      label: 'Dark Mode',    icon: Moon,       multiple: false, accept: '.pdf' },
  { id: 'toc',       label: 'Tạo Mục Lục',  icon: BookOpen,   multiple: false, accept: '.pdf' },
];

export default function PdfTools() {
  const [activeTab, setActiveTab] = useState('merge');
  const [files, setFiles]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  // Form states
  const [compressQuality, setCompressQuality] = useState('ebook');
  const [rotateAngle, setRotateAngle]         = useState(90);
  const [watermarkText, setWatermarkText]     = useState('CONFIDENTIAL');
  const [userPassword, setUserPassword]       = useState('');
  const [unlockPassword, setUnlockPassword]   = useState('');
  const [darkModeBg, setDarkModeBg]           = useState('dark');
  const [tocTitle, setTocTitle]               = useState('MỤC LỤC');
  const [tocAI, setTocAI]                     = useState(false);

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFiles(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    reset();
  };

  const handleSubmit = async () => {
    if (!files) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let endpoint = '';

    if (activeTab === 'merge') {
      endpoint = '/api/pdf/merge';
      Array.from(files).forEach(f => fd.append('files', f));
    } else if (activeTab === 'split') {
      endpoint = '/api/pdf/split';
      fd.append('file', files);
    } else if (activeTab === 'compress') {
      endpoint = '/api/pdf/compress';
      fd.append('file', files);
      fd.append('quality', compressQuality);
    } else if (activeTab === 'to-word') {
      endpoint = '/api/pdf/to-word';
      fd.append('file', files);
    } else if (activeTab === 'from-word') {
      endpoint = '/api/pdf/from-word';
      fd.append('file', files);
    } else if (activeTab === 'rotate') {
      endpoint = '/api/pdf/rotate';
      fd.append('file', files);
      fd.append('angle', rotateAngle);
    } else if (activeTab === 'watermark') {
      endpoint = '/api/pdf/watermark';
      fd.append('file', files);
      fd.append('text', watermarkText);
    } else if (activeTab === 'protect') {
      endpoint = '/api/pdf/protect';
      fd.append('file', files);
      fd.append('userPassword', userPassword);
    } else if (activeTab === 'unlock') {
      endpoint = '/api/pdf/unlock';
      fd.append('file', files);
      fd.append('password', unlockPassword);
    } else if (activeTab === 'dark') {
      endpoint = '/api/pdf/dark-mode';
      fd.append('file', files);
      fd.append('bg', darkModeBg);
    } else if (activeTab === 'toc') {
      endpoint = '/api/pdf/auto-toc';
      fd.append('file', files);
      fd.append('title', tocTitle);
      fd.append('useAI', tocAI);
    }

    try {
      setProgress(60);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra trong quá trình xử lý');

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
        <h1 className="text-2xl font-bold text-white">PDF Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Xử lý toàn diện các tài liệu PDF bằng công nghệ native (Ghostscript, qpdf, pdf-lib).
        </p>
      </div>

      {/* Tabs */}
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

      {/* Main Workspace */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <FileDropzone
          key={activeTab}
          onFilesSelected={setFiles}
          accept={curTab?.accept}
          multiple={curTab?.multiple}
          label={`Tải file cho chức năng: ${curTab?.label}`}
        />

        {/* Options */}
        {files && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Tùy chọn cấu hình</h3>

            {activeTab === 'compress' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mức độ nén (Ghostscript)</label>
                <select
                  value={compressQuality}
                  onChange={e => setCompressQuality(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="screen">Screen (72 dpi) — Nén tối đa, dung lượng nhỏ nhất</option>
                  <option value="ebook">Ebook (150 dpi) — Khuyến nghị, cân bằng đẹp & nhẹ</option>
                  <option value="printer">Printer (300 dpi) — Chất lượng cao để in ấn</option>
                  <option value="prepress">Prepress (300 dpi) — Giữ nguyên màu sắc chuẩn</option>
                </select>
              </div>
            )}

            {activeTab === 'rotate' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Góc xoay</label>
                <div className="flex gap-2">
                  {[90, 180, 270].map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setRotateAngle(a)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        rotateAngle === a
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'watermark' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Chữ đóng dấu (Watermark text)</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  placeholder="VD: BẢN QUYỀN / CONFIDENTIAL"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {activeTab === 'protect' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mật khẩu bảo vệ (qpdf 256-bit)</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  placeholder="Nhập mật khẩu cần đặt cho file PDF"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {activeTab === 'unlock' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mật khẩu hiện tại của file</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={e => setUnlockPassword(e.target.value)}
                  placeholder="Nhập mật khẩu để gỡ bỏ khóa"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {activeTab === 'dark' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Tông màu Dark Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDarkModeBg('dark')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      darkModeBg === 'dark'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                    }`}
                  >
                    🌙 Nền Đen Thuần (#121212)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkModeBg('sepia-dark')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      darkModeBg === 'sepia-dark'
                        ? 'bg-amber-800 text-white border-amber-600'
                        : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                    }`}
                  >
                    📜 Sepia Đậm (Chống mỏi mắt)
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'toc' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300">Tiêu đề trang mục lục</label>
                  <input
                    type="text"
                    value={tocTitle}
                    onChange={e => setTocTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tocAI}
                    onChange={e => setTocAI(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600"
                  />
                  <span className="text-xs text-gray-300">Dùng AI nhận dạng cấu trúc nâng cao (nếu tài liệu phức tạp)</span>
                </label>
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
