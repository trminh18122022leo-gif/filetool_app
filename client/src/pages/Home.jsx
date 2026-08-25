import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Image, Archive, Sparkles,
  FileOutput, ScanText, PenLine, Layers,
  QrCode, ChevronRight, Zap, Shield, Cloud
} from 'lucide-react';

const TOOL_GROUPS = [
  {
    label: 'PDF Tools', icon: FileText, to: '/pdf', color: 'from-red-900/40 to-red-800/20 border-red-800/50',
    tools: ['Merge', 'Split', 'Compress', 'Rotate', 'Watermark', 'Protect', 'Dark Mode', 'Auto TOC'],
  },
  {
    label: 'Image Tools', icon: Image, to: '/image', color: 'from-blue-900/40 to-blue-800/20 border-blue-800/50',
    tools: ['Convert', 'Resize', 'Compress', 'Crop', 'Filter', 'Remove BG'],
  },
  {
    label: 'Office', icon: FileOutput, to: '/office', color: 'from-green-900/40 to-green-800/20 border-green-800/50',
    tools: ['DOCX→PDF', 'XLSX→PDF', 'PPTX→PDF', 'PDF→DOCX', 'XLSX→CSV', 'PDF→HTML'],
  },
  {
    label: 'OCR', icon: ScanText, to: '/ocr', color: 'from-yellow-900/40 to-yellow-800/20 border-yellow-800/50',
    tools: ['Ảnh → Text', 'PDF Scan', 'PDF Searchable', 'Tiếng Việt & Anh'],
  },
  {
    label: 'Archive', icon: Archive, to: '/archive', color: 'from-orange-900/40 to-orange-800/20 border-orange-800/50',
    tools: ['Tạo ZIP', 'Giải nén ZIP', 'Tối đa 50 files'],
  },
  {
    label: 'AI Tools', icon: Sparkles, to: '/ai', color: 'from-purple-900/40 to-purple-800/20 border-purple-800/50',
    tools: ['Tóm tắt', 'Dịch thuật', 'Chat với PDF', 'Chữ viết tay'],
  },
  {
    label: 'E-Signature', icon: PenLine, to: '/signature', color: 'from-pink-900/40 to-pink-800/20 border-pink-800/50',
    tools: ['Ký tay', 'Đặt chữ ký', 'Tùy chỉnh vị trí'],
  },
  {
    label: 'Batch Processing', icon: Layers, to: '/batch', color: 'from-cyan-900/40 to-cyan-800/20 border-cyan-800/50',
    tools: ['Hàng loạt', 'Queue song song', 'Export ZIP', 'Real-time Socket'],
  },
  {
    label: 'QR Code', icon: QrCode, to: '/qr', color: 'from-teal-900/40 to-teal-800/20 border-teal-800/50',
    tools: ['Tạo mã QR', 'Nhúng vào PDF', 'Nhúng vào ảnh'],
  },
];

const FEATURES = [
  { icon: Zap,    title: 'Xử lý thực tế 100%', desc: 'Tích hợp Ghostscript, LibreOffice và Tesseract trên máy bạn.' },
  { icon: Shield, title: 'Bảo mật & Riêng tư', desc: 'File được bảo vệ an toàn và tự động xóa sau 1 giờ xử lý.' },
  { icon: Cloud,  title: 'Lưu trữ Cloud R2',  desc: 'Đăng nhập để đồng bộ file trên Cloudflare R2 tốc độ cao.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-16 py-4">
      {/* Hero */}
      <div className="text-center space-y-5 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/80 border border-blue-800/60 rounded-full text-xs text-blue-300 font-medium">
          <Sparkles size={13} />
          <span>Phiên bản FileTools Pro Full-Stack 2.0</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Mọi công cụ xử lý file{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            trên một nền tảng
          </span>
        </h1>
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Nén, chuyển đổi, gộp, OCR, ký điện tử và dịch thuật tài liệu bằng AI thông minh với tốc độ tối đa.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/pdf"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/40 hover:-translate-y-0.5"
          >
            Khám phá PDF Tools
          </Link>
          {!user ? (
            <Link
              to="/register"
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-medium rounded-xl text-sm transition-all hover:-translate-y-0.5"
            >
              Đăng ký miễn phí
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-medium rounded-xl text-sm transition-all hover:-translate-y-0.5"
            >
              Vào Dashboard →
            </Link>
          )}
        </div>
      </div>

      {/* Tool Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Nhóm công cụ</h2>
          <span className="text-xs text-gray-500">{TOOL_GROUPS.length} danh mục</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOL_GROUPS.map(({ label, icon: Icon, to, color, tools }) => (
            <Link
              key={to}
              to={to}
              className={`group relative p-5 bg-gradient-to-br ${color} bg-gray-900/40 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-gray-950/60 rounded-xl border border-white/5 text-white">
                  <Icon size={22} />
                </div>
                <ChevronRight size={16} className="text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">
                {label}
              </h3>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {tools.map((t, idx) => (
                  <span key={idx} className="text-[11px] bg-gray-950/60 text-gray-400 px-2 py-0.5 rounded-md border border-white/5">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-900">
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <div key={i} className="flex gap-4 p-5 bg-gray-900/30 rounded-2xl border border-gray-850">
            <div className="p-3 bg-blue-950/60 border border-blue-800/40 rounded-xl text-blue-400 shrink-0 h-fit">
              <Icon size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">{title}</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
