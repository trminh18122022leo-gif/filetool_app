import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus2, Scissors, PenTool, Trash2, Hash, AlignCenter, BarChart3,
  Minimize2, FileOutput, RotateCw, Stamp, Lock, Unlock, Moon, BookOpen
} from 'lucide-react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';

const TABS = [
  { id: 'merge',        label: 'Gộp PDF',      icon: FilePlus2,  special: true },
  { id: 'split',        label: 'Tách PDF',     icon: Scissors,   special: true },
  { id: 'sign',         label: 'Ký PDF',       icon: PenTool,    special: true },
  { id: 'delete',       label: 'Xóa trang',    icon: Trash2,     special: true },
  { id: 'page-numbers', label: 'Số trang',     icon: Hash,       multiple: false, accept: '.pdf' },
  { id: 'header-footer',label: 'Header/Footer',icon: AlignCenter,multiple: false, accept: '.pdf' },
  { id: 'stats',        label: 'Thống kê',     icon: BarChart3,  multiple: false, accept: '.pdf' },
  { id: 'compress',     label: 'Nén PDF',      icon: Minimize2,  multiple: false, accept: '.pdf' },
  { id: 'to-word',      label: 'PDF -> Word',  icon: FileOutput, multiple: false, accept: '.pdf' },
  { id: 'from-word',    label: 'Word -> PDF',  icon: FileOutput, multiple: false, accept: '.docx,.doc' },
  { id: 'rotate',       label: 'Xoay PDF',     icon: RotateCw,   multiple: false, accept: '.pdf' },
  { id: 'watermark',    label: 'Watermark',    icon: Stamp,      multiple: false, accept: '.pdf' },
  { id: 'protect',      label: 'Đặt mật khẩu', icon: Lock,       multiple: false, accept: '.pdf' },
  { id: 'unlock',       label: 'Gỡ mật khẩu',  icon: Unlock,     multiple: false, accept: '.pdf' },
  { id: 'dark',         label: 'Dark Mode',    icon: Moon,       multiple: false, accept: '.pdf' },
  { id: 'toc',          label: 'Tạo Mục Lục',  icon: BookOpen,   multiple: false, accept: '.pdf' },
];

export default function PdfTools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('compress');
  const [files, setFiles]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  // Form options
  const [compressQuality, setCompressQuality] = useState('ebook');
  const [rotateAngle, setRotateAngle]         = useState(90);
  const [watermarkText, setWatermarkText]     = useState('CONFIDENTIAL');
  const [userPassword, setUserPassword]       = useState('');
  const [unlockPassword, setUnlockPassword]   = useState('');
  const [darkModeBg, setDarkModeBg]           = useState('dark');
  const [tocTitle, setTocTitle]               = useState('MỤC LỤC');
  const [tocAI, setTocAI]                     = useState(false);
  const [pagePosition, setPagePosition]       = useState('bottom-center');
  const [pageStartFrom, setPageStartFrom]     = useState(1);
  const [pageFormat, setPageFormat]           = useState('{n}');
  const [headerText, setHeaderText]           = useState('');
  const [footerText, setFooterText]           = useState('');

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFiles(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    if (id === 'merge') return navigate('/pdf/merge');
    if (id === 'split') return navigate('/pdf/split');
    if (id === 'sign') return navigate('/pdf/sign');
    if (id === 'delete') return navigate('/pdf/delete');
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

    if (activeTab === 'compress') {
      endpoint = '/api/pdf/compress';
      fd.append('file', files);
      fd.append('quality', compressQuality);
    } else if (activeTab === 'page-numbers') {
      endpoint = '/api/pdf/page-numbers';
      fd.append('file', files);
      fd.append('position', pagePosition);
      fd.append('startFrom', pageStartFrom);
      fd.append('format', pageFormat);
    } else if (activeTab === 'header-footer') {
      endpoint = '/api/pdf/header-footer';
      fd.append('file', files);
      fd.append('headerText', headerText);
      fd.append('footerText', footerText);
    } else if (activeTab === 'stats') {
      endpoint = '/api/pdf/stats';
      fd.append('file', files);
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
      const { data } = await axios.post(`${API}${endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Có lỗi xảy ra trong quá trình xử lý');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gradient">PDF Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Xử lý toàn diện tài liệu PDF: Gộp, tách, ký, xóa trang, số trang, header/footer, nén và bảo mật.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-2 glass-panel">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="glass-panel p-6 sm:p-10 space-y-8">
        <FileDropzone
          key={activeTab}
          onFilesSelected={setFiles}
          accept={curTab?.accept}
          multiple={curTab?.multiple}
          label={`Tải file cho chức năng: ${curTab?.label}`}
        />

        {/* Options */}
        {files && (
          <div className="p-6 glass-card space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pink-400">Tùy chọn cấu hình</h3>

            {activeTab === 'compress' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Mức độ nén (Ghostscript)</label>
                <select
                  value={compressQuality}
                  onChange={e => setCompressQuality(e.target.value)}
                  className="glass-input bg-black/80 text-xs"
                >
                  <option value="screen">Screen (72 dpi) — Nén tối đa, dung lượng nhỏ nhất</option>
                  <option value="ebook">Ebook (150 dpi) — Khuyến nghị, cân bằng đẹp & nhẹ</option>
                  <option value="printer">Printer (300 dpi) — Chất lượng cao để in ấn</option>
                  <option value="prepress">Prepress (300 dpi) — Giữ nguyên màu sắc chuẩn</option>
                </select>
              </div>
            )}

            {activeTab === 'page-numbers' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Vị trí đánh số</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['bottom-center','↓ Giữa dưới'],['bottom-right','↓ Phải dưới'],['bottom-left','↓ Trái dưới'],
                      ['top-center','↑ Giữa trên'],['top-right','↑ Phải trên'],['top-left','↑ Trái trên']
                    ].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setPagePosition(v)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${pagePosition === v ? 'bg-pink-600 text-white font-bold' : 'glass-button'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Bắt đầu từ trang số</label>
                    <input type="number" min="1" value={pageStartFrom} onChange={e => setPageStartFrom(e.target.value)} className="glass-input text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Định dạng số</label>
                    <input type="text" value={pageFormat} onChange={e => setPageFormat(e.target.value)} placeholder="{n} / {total}" className="glass-input text-xs" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'header-footer' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tiêu đề đầu trang (Header)</label>
                  <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="VD: BÁO CÁO NỘI BỘ" className="glass-input text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Chân trang (Footer)</label>
                  <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="VD: Bảo mật · Không sao chép" className="glass-input text-xs" />
                </div>
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
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        rotateAngle === a
                          ? 'bg-pink-600 text-white shadow-lg'
                          : 'glass-button'
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
                  className="glass-input text-xs"
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
                  className="glass-input text-xs"
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
                  className="glass-input text-xs"
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
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      darkModeBg === 'dark' ? 'bg-pink-600 text-white' : 'glass-button'
                    }`}
                  >
                    🌙 Nền Đen Thuần (#121212)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkModeBg('sepia-dark')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      darkModeBg === 'sepia-dark' ? 'bg-amber-800 text-white' : 'glass-button'
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
                    className="glass-input text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tocAI}
                    onChange={e => setTocAI(e.target.checked)}
                    className="rounded border-white/20 text-pink-600"
                  />
                  <span className="text-xs text-gray-300">Dùng AI nhận dạng cấu trúc nâng cao (nếu tài liệu phức tạp)</span>
                </label>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50"
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

        {result && (
          <div>
            {result.stats ? (
              <div className="glass-card p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ['📄 Số trang',         result.stats.pages],
                  ['📝 Tổng từ',          result.stats.words?.toLocaleString()],
                  ['🔤 Số ký tự',        result.stats.chars?.toLocaleString()],
                  ['📖 Thời gian đọc',   result.stats.readTime],
                  ['📊 Độ dễ đọc',       result.stats.readability],
                  ['💾 Dung lượng',      `${result.stats.sizeKb} KB`],
                  ['✍️ Số câu',          result.stats.sentences?.toLocaleString()],
                  ['📐 Từ/trang',        result.stats.avgWordsPerPage],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-gray-400 text-xs">{label}</p>
                    <p className="font-bold text-lg text-white mt-1">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <ResultDownload result={result} onReset={reset} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
