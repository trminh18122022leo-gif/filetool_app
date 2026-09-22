import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Image, Archive, Sparkles,
  FileOutput, ScanText, PenLine, Layers,
  QrCode, Mic, Upload, ArrowUpRight, CheckCircle2, Lock, Zap, FileCode, ChevronDown
} from 'lucide-react';

const TOOL_GROUPS = [
  {
    id: 'pdf',
    label: 'PDF Tools',
    icon: FileText,
    to: '/pdf',
    accentColor: 'text-amber-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(245,158,11,0.18)] hover:border-amber-400/40',
    desc: 'Gộp, tách, nén và bảo vệ tài liệu PDF chỉ trong vài giây.',
    tools: ['Merge', 'Split', 'Compress', 'Rotate', 'Watermark', 'Protect'],
  },
  {
    id: 'image',
    label: 'Image Tools',
    icon: Image,
    to: '/image',
    accentColor: 'text-rose-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(251,113,133,0.18)] hover:border-rose-400/40',
    desc: 'Chuyển đổi, thay đổi kích thước và tối ưu hình ảnh hàng loạt.',
    tools: ['Convert', 'Resize', 'Compress', 'Crop', 'Filter', 'Remove BG'],
  },
  {
    id: 'editor',
    label: 'Advanced Editor',
    icon: FileCode,
    to: '/editor',
    accentColor: 'text-amber-300',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(245,158,11,0.18)] hover:border-amber-400/40',
    desc: 'Monaco VS Code engine, Data Table CSV/JSON, Auto-Save & AI Code Assistant.',
    tools: ['Monaco VS Code', 'Live Markdown', 'Data Table', 'IndexedDB', 'AI Code', 'Yjs Collab'],
  },
  {
    id: 'office',
    label: 'Office',
    icon: FileOutput,
    to: '/office',
    accentColor: 'text-amber-300',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(245,158,11,0.18)] hover:border-amber-400/40',
    desc: 'Chuyển đổi qua lại giữa Word, Excel, PowerPoint và PDF.',
    tools: ['DOCX→PDF', 'XLSX→PDF', 'PPTX→PDF', 'PDF→DOCX', 'XLSX→CSV'],
  },
  {
    id: 'ocr',
    label: 'OCR',
    icon: ScanText,
    to: '/ocr',
    accentColor: 'text-yellow-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(234,179,8,0.18)] hover:border-yellow-400/40',
    desc: 'Nhận dạng văn bản từ ảnh và PDF scan với độ chính xác cao.',
    tools: ['Ảnh → Text', 'PDF Scan', 'PDF Searchable', 'Tiếng Việt & Anh'],
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    to: '/archive',
    accentColor: 'text-orange-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(249,115,22,0.18)] hover:border-orange-400/40',
    desc: 'Tạo và giải nén file ZIP cho hàng loạt tệp cùng lúc.',
    tools: ['Tạo ZIP', 'Giải nén ZIP', 'Tối đa 50 files'],
  },
  {
    id: 'ai',
    label: 'AI Tools',
    icon: Sparkles,
    to: '/ai',
    accentColor: 'text-amber-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(245,158,11,0.18)] hover:border-amber-400/40',
    desc: 'Tóm tắt, dịch thuật và trò chuyện trực tiếp với tài liệu.',
    tools: ['Tóm tắt', 'Dịch thuật', 'Chat với PDF', 'Chữ viết tay'],
  },
  {
    id: 'signature',
    label: 'E-Signature',
    icon: PenLine,
    to: '/signature',
    accentColor: 'text-rose-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(251,113,133,0.18)] hover:border-rose-400/40',
    desc: 'Ký tay và đặt chữ ký số vào đúng vị trí trên tài liệu.',
    tools: ['Ký tay', 'Đặt chữ ký', 'Tùy chỉnh vị trí'],
  },
  {
    id: 'speech',
    label: 'Speech to Text',
    icon: Mic,
    to: '/speech',
    accentColor: 'text-coral-400 text-rose-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(244,63,94,0.18)] hover:border-rose-400/40',
    desc: 'Ghi âm trực tiếp hoặc tải lên để chuyển thành văn bản.',
    tools: ['Ghi âm trực tiếp', 'MP3/WAV/MP4', 'Xuất PDF / SRT / TXT'],
  },
  {
    id: 'batch',
    label: 'Batch Processing',
    icon: Layers,
    to: '/batch',
    accentColor: 'text-amber-500',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(217,119,6,0.18)] hover:border-amber-500/40',
    desc: 'Xử lý hàng loạt với hàng đợi song song theo thời gian thực.',
    tools: ['Hàng loạt', 'Queue song song', 'Export ZIP'],
  },
  {
    id: 'qr',
    label: 'QR Code',
    icon: QrCode,
    to: '/qr',
    accentColor: 'text-amber-400',
    haloColor: 'hover:shadow-[0_20px_45px_rgba(245,158,11,0.18)] hover:border-amber-400/40',
    desc: 'Tạo mã QR nhanh chóng và nhúng trực tiếp vào tài liệu.',
    tools: ['Tạo mã QR', 'Nhúng vào PDF', 'Nhúng vào ảnh'],
  },
];

const MARQUEE_ITEMS = [
  'MONACO CODE EDITOR', 'DATA TABLE CSV', 'AI CODE ASSISTANT', 'REMOVE BG', 'SPEECH TO TEXT',
  'ZIP ARCHIVE', 'QR CODE', 'E-SIGNATURE', 'PDF MERGE', 'SPLIT & ROTATE',
  'COMPRESS', 'OCR SCAN', 'AI SUMMARY', 'TRANSLATE', 'DOCX → PDF', 'EXCEL CONVERT'
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // File Drop & Select routing logic
  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (['pdf'].includes(ext)) {
      navigate('/pdf');
    } else if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'svg'].includes(ext)) {
      navigate('/image');
    } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'csv', 'md', 'html', 'css', 'sql', 'txt', 'yml', 'yaml'].includes(ext)) {
      navigate('/editor');
    } else if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)) {
      navigate('/office');
    } else if (['mp3', 'wav', 'm4a', 'ogg', 'mp4', 'webm'].includes(ext)) {
      navigate('/speech');
    } else if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) {
      navigate('/archive');
    } else {
      navigate('/convert');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const [isLight, setIsLight] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('light');
    }
    return false;
  });

  useEffect(() => {
    const handleTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
    };
    window.addEventListener('theme-change', handleTheme);
    window.addEventListener('storage', handleTheme);
    return () => {
      window.removeEventListener('theme-change', handleTheme);
      window.removeEventListener('storage', handleTheme);
    };
  }, []);

  return (
    <>
      <div className="space-y-16 py-2 relative z-10">
        {/* ── 1. HERO SECTION ── */}
        {/* ── 1. EDITORIAL HERO SECTION (Ảnh 2) ── */}
        <section id="hero" className="pt-6 sm:pt-10 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Editorial Typography & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="luxury-badge">
                <Sparkles size={13} className="text-amber-400" />
                <span>FileTools Pro Full-Stack 2.0</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                Mọi công cụ xử lý file{' '}
                <span className="gold-gradient-text block mt-1">
                  trên một nền tảng
                </span>
              </h1>

              <p className="text-base sm:text-lg text-gray-200 dark:text-gray-300/90 max-w-xl leading-relaxed font-normal drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">
                Nén, chuyển đổi, gộp, OCR, ký điện tử và dịch tài liệu bằng AI thông minh — tất cả với tốc độ tối đa, ngay trên thiết bị của bạn.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href="#tools"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="liquid-gold-button px-7 py-3.5 text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={16} className="text-black" />
                  <span>Khám phá công cụ</span>
                </a>

                {!user ? (
                  <Link
                    to="/register"
                    className="glass-button px-6 py-3.5 text-sm font-semibold text-gray-200 hover:text-white"
                  >
                    Đăng ký miễn phí
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="glass-button px-6 py-3.5 text-sm font-semibold text-gray-200 hover:text-white flex items-center gap-1.5"
                  >
                    <span>Vào Dashboard</span>
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 pt-3 text-xs text-gray-300 dark:text-gray-400 font-medium">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-amber-400" />
                  <span>Không lưu file của bạn</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-400" />
                  <span>Xử lý tức thì</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-400" />
                  <span>Miễn phí bắt đầu</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Interactive Dropzone Card */}
            <div className="lg:col-span-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`liquid-glass-card specular-sheen p-6 sm:p-8 cursor-pointer text-center relative group transition-all duration-300 ${
                  dragOver
                    ? 'border-amber-400 bg-amber-500/10 scale-[1.02] shadow-[0_0_35px_rgba(245,158,11,0.3)]'
                    : ''
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />

                {/* Top Card Badge */}
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2 text-gray-300 dark:text-gray-400 font-medium">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Kéo & thả tệp</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                </div>

                {/* Upload Icon & Action */}
                <div className="py-4 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-rose-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.2)] group-hover:scale-110 group-hover:border-amber-400/60 transition-all duration-300">
                    <Upload size={28} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                      Thả tệp vào đây để bắt đầu
                    </h3>
                    <p className="text-xs text-gray-300 dark:text-gray-400">
                      Hỗ trợ PDF, Ảnh, Office, Audio và nhiều hơn nữa
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      className="liquid-gold-button px-5 py-2.5 text-xs inline-flex items-center gap-1.5"
                    >
                      <span>Chọn tệp từ máy</span>
                    </button>
                  </div>
                </div>

                {/* Supported Formats Pills */}
                <div className="pt-6 mt-4 border-t border-white/10 flex flex-wrap justify-center gap-1.5">
                  {['.pdf', '.word', '.excel', '.jpg', '.png', '.mp3', '.zip'].map((ext) => (
                    <span
                      key={ext}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-gray-300 dark:text-gray-400 group-hover:border-amber-400/30 group-hover:text-amber-200 transition-colors"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* ── 2. INFINITE MARQUEE TICKER (Jacob & Co Editorial) ── */}
      <section className="py-2 border-y border-white/10 bg-black/40 backdrop-blur-xl -mx-4 sm:-mx-6 px-4">
        <div className="marquee-container">
          <div className="marquee-track py-3 font-mono text-xs uppercase tracking-widest text-gray-400 font-bold">
            {MARQUEE_ITEMS.concat(MARQUEE_ITEMS).map((item, idx) => (
              <span key={idx} className="flex items-center gap-8 hover:text-amber-300 transition-colors">
                <span>{item}</span>
                <span className="text-amber-400/70 select-none">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. TOOL LIBRARY (10 Tool Groups) ── */}
      <section id="tools" className="scroll-mt-24 space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold tracking-widest uppercase text-amber-400 font-mono">
              Thư viện công cụ
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Nhóm công cụ
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              10 nhóm chức năng được thiết kế để bạn xử lý mọi loại tệp chỉ trong vài cú nhấp.
            </p>
          </div>
          <div className="shrink-0">
            <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-300">
              {TOOL_GROUPS.length} danh mục
            </span>
          </div>
        </div>

        {/* 10 Tool Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOL_GROUPS.map(({ id, label, icon: Icon, to, accentColor, haloColor, desc, tools }) => (
            <Link
              key={id}
              to={to}
              className={`liquid-glass-card specular-sheen p-6 flex flex-col justify-between group ${haloColor}`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 group-hover:border-amber-400/40 group-hover:bg-amber-500/10 transition-all duration-300">
                    <Icon size={24} className={`${accentColor} transition-transform group-hover:scale-110 duration-300`} />
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 group-hover:text-amber-300 group-hover:border-amber-400/40 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
                    <ArrowUpRight size={16} />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  {label}
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed font-normal">
                  {desc}
                </p>
              </div>

              {/* Sub-tool tags */}
              <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-white/5">
                {tools.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-white/5 text-gray-400 px-2.5 py-1 rounded-lg border border-white/5 group-hover:border-white/15 group-hover:text-gray-200 transition-all"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      </div>
    </>
  );
}
