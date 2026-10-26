import { useState } from 'react';
import { Link } from 'react-router-dom';
import MetaTags from '../components/seo/MetaTags';
import {
  FileText, Scissors, PenTool, Trash2, ShieldAlert,
  ArrowRightLeft, FileCode, ScanText, Archive, QrCode,
  Sparkles, Film, Mic, Wand2, Search, ArrowRight,
  Layers, Minimize2, Image, Terminal
} from 'lucide-react';

const CATEGORIES = [
  {
    name: 'Tài Liệu & PDF Chuyên Sâu',
    description: 'Các công cụ PDF chuẩn studio, xử lý trực tiếp trên trình duyệt hoặc qua render worker bảo mật.',
    tools: [
      { to: '/pdf/merge', label: 'Gộp PDF', desc: 'Ghép nhiều tệp PDF thành một tài liệu duy nhất với thứ tự tùy chỉnh.', icon: Layers },
      { to: '/pdf/split', label: 'Tách PDF', desc: 'Trích xuất dải trang hoặc chia nhỏ tài liệu PDF theo nhu cầu.', icon: Scissors },
      { to: '/pdf/compress', label: 'Nén PDF', desc: 'Giảm dung lượng tệp PDF giữ độ nét chữ và hình ảnh tối ưu.', icon: Minimize2 },
      { to: '/pdf/ocr', label: 'OCR Nhận Dạng Văn Bản', desc: 'Nhận dạng chữ quang học trên tài liệu PDF scan sang văn bản tìm kiếm được.', icon: ScanText },
      { to: '/pdf/sign', label: 'Ký Số & Con Dấu', desc: 'Ký số trực tiếp trên tài liệu PDF với chữ ký vẽ tay hoặc ảnh dấu tròn.', icon: PenTool },
      { to: '/pdf/delete', label: 'Xóa Trang PDF', desc: 'Loại bỏ các trang không cần thiết khỏi tài liệu trong vài giây.', icon: Trash2 },
      { to: '/pdf/organize', label: 'Sắp Xếp & Xoay Trang', desc: 'Kéo thả sắp xếp lại thứ tự trang và xoay hướng tài liệu trực quan.', icon: Layers },
      { to: '/pdf/redact', label: 'Che PII Bảo Mật', desc: 'Loại bỏ vĩnh viễn thông tin nhạy cảm (CCCD, Email, SĐT) không thể phục hồi.', icon: ShieldAlert },
    ],
  },
  {
    name: 'Chuyển Đổi & Văn Phòng',
    description: 'Chuyển đổi qua lại giữa định dạng Office DOCX, XLSX, PPTX và PDF chuẩn tài liệu.',
    tools: [
      { to: '/convert/word-to-pdf', label: 'Word → PDF', desc: 'Chuyển đổi tệp Microsoft Word (.docx, .doc) sang PDF nguyên bản.', icon: FileText },
      { to: '/office', label: 'Office Converter', desc: 'Chuyển đổi toàn diện Word, Excel, PowerPoint sang PDF và ngược lại.', icon: FileText },
      { to: '/convert', label: 'Convert Đa Năng', desc: 'Chuyển đổi Markdown, HTML, URL, JSON, CSV sang PDF hoặc Excel.', icon: ArrowRightLeft },
      { to: '/archive', label: 'Nén & Giải Nén ZIP', desc: 'Nén tệp tin tốc độ cao thành file ZIP hoặc giải nén an toàn.', icon: Archive },
    ],
  },
  {
    name: 'Hình Ảnh & Media AI',
    description: 'Xử lý hình ảnh, video clip, bóc tách âm thanh và tạo hiệu ứng đồ họa cao cấp.',
    tools: [
      { to: '/image/compress', label: 'Nén Hình Ảnh', desc: 'Tối ưu hóa dung lượng ảnh WebP, PNG, JPEG không giảm chất lượng.', icon: Minimize2 },
      { to: '/image', label: 'Studio Chỉnh Sửa Ảnh', desc: 'Tách nền AI, xóa chi tiết thừa Inpainting, nâng cấp độ phân giải.', icon: Image },
      { to: '/video', label: 'Video Studio', desc: 'Cắt ghép, nén video, trích xuất âm thanh và render phụ đề.', icon: Film },
      { to: '/speech', label: 'Speech-to-Text', desc: 'Chuyển đổi giọng nói thành văn bản chuẩn xác với công nghệ Whisper.', icon: Mic },
      { to: '/creative', label: 'Creative Shorts', desc: 'Tự động tạo video ngắn kèm hiệu ứng âm thanh và phụ đề nổi bật.', icon: Wand2 },
    ],
  },
  {
    name: 'Tự Động Hóa & Lập Trình Viên',
    description: 'Quy trình xử lý hàng loạt theo đồ thị DAG, soạn thảo mã nguồn và REST API.',
    tools: [
      { to: '/features/workflow-studio', label: 'Workflow Studio', desc: 'Thiết kế chuỗi xử lý tài liệu tự động nhiều bước không cần viết mã.', icon: Wand2 },
      { to: '/editor', label: 'Monaco Code Editor', desc: 'Trình biên tập mã nguồn VS Code trên nền web hỗ trợ đa ngôn ngữ.', icon: FileCode },
      { to: '/api-docs', label: 'REST API & Webhooks', desc: 'Tích hợp toàn bộ API xử lý tệp vào hệ thống của doanh nghiệp bạn.', icon: Terminal },
      { to: '/qr', label: 'QR Code Studio', desc: 'Tạo mã QR tĩnh và động hỗ trợ logo thương hiệu tùy biến.', icon: QrCode },
    ],
  },
];

export default function ToolsDirectoryPage() {
  const [search, setSearch] = useState('');

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    tools: cat.tools.filter(t =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.tools.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <MetaTags
        title="Danh Mục Tất Cả Công Cụ Trực Tuyến"
        description="Khám phá hơn 30+ công cụ xử lý PDF, chuyển đổi Office Word sang PDF, nén ảnh, OCR văn bản và tự động hóa file tốc độ cao trên FileTools Pro."
        canonicalPath="/tools"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Danh mục công cụ', path: '/tools' },
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-500 dark:text-cyan-400 mb-3">
          <Sparkles size={14} />
          <span>DANH MỤC CÔNG CỤ FILETOOLS PRO</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
          Mọi Công Cụ Bạn Cần <br className="hidden sm:inline" />
          <span className="text-gradient">Tại Một Nơi Duy Nhất</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          Tối ưu hóa, chuyển đổi và bảo mật dữ liệu tốc độ cao. Chọn công cụ bên dưới để bắt đầu ngay lập tức.
        </p>

        {/* Search Bar */}
        <div className="mt-8 relative max-w-lg mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm công cụ (gộp PDF, nén ảnh, word to pdf, ocr...)"
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-cyan-500 focus:outline-none text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-12">
        {filteredCategories.map((cat, idx) => (
          <div key={idx} className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {cat.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {cat.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cat.tools.map((tool, tIdx) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tIdx}
                    to={tool.to}
                    className="group p-5 rounded-2xl border border-black/10 dark:border-white/10 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Icon size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                      <span>Mở công cụ</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
