import { useState } from 'react';
import { Link } from 'react-router-dom';
import MetaTags from '../components/seo/MetaTags';
import {
  BookOpen, ChevronRight, CheckCircle2, ShieldAlert,
  Minimize2, Layers, FileText, Key, ArrowRight
} from 'lucide-react';

const GUIDES = [
  {
    id: 'merge-pdf',
    title: 'Cách Gộp Nhiều File PDF Thành Một File Duy Nhất',
    category: 'Tài Liệu & PDF',
    readTime: '3 phút đọc',
    toolLink: '/pdf/merge',
    toolName: 'Công cụ Gộp PDF',
    icon: Layers,
    steps: [
      'Truy cập công cụ Gộp PDF tại FileTools Pro.',
      'Kéo và thả tất cả các file PDF bạn muốn ghép vào khung tải lên (hoặc nhấn Chọn tệp).',
      'Kéo các thẻ tài liệu để sắp xếp lại thứ tự xuất hiện mong muốn trong file thành phẩm.',
      'Nhấn nút "Gộp PDF" để hệ thống tự động kết nối và xử lý.',
      'Tải xuống tệp PDF hoàn chỉnh hoặc lưu trữ an toàn trong kho tệp của bạn.',
    ],
  },
  {
    id: 'compress-pdf',
    title: 'Cách Nén File PDF Giảm Dung Lượng Mà Vẫn Giữ Nguyên Độ Nét',
    category: 'Tài Liệu & PDF',
    readTime: '2 phút đọc',
    toolLink: '/pdf/compress',
    toolName: 'Công cụ Nén PDF',
    icon: Minimize2,
    steps: [
      'Chọn công cụ Nén PDF trên thanh công cụ hoặc trang chủ.',
      'Tải lên tài liệu PDF cần giảm kích thước dung lượng (hỗ trợ file lên tới 1 GB cho gói Pro).',
      'Chọn mức độ nén phù hợp: Khuyên dùng (cân bằng chất lượng/kích thước) hoặc Nén tối đa.',
      'Hệ thống tối ưu hóa luồng nhị phân và nén hình ảnh nhúng bên trong.',
      'Kiểm tra tỷ lệ tiết kiệm dung lượng (thường từ 40% - 80%) và tải tệp về máy.',
    ],
  },
  {
    id: 'redact-pii',
    title: 'Cách Che Thông Tin Nhạy Cảm (CCCD, Số Thẻ, Email) Không Thể Phục Hồi',
    category: 'Bảo Mật & An Ninh',
    readTime: '4 phút đọc',
    toolLink: '/pdf/redact',
    toolName: 'Công cụ Che PII Redact',
    icon: ShieldAlert,
    steps: [
      'Mở công cụ Che PII Bảo Mật (Redact) trên PDF Studio.',
      'Tải tệp PDF chứa thông tin cá nhân cần bảo vệ lên hệ thống.',
      'Sử dụng tính năng "Tự động phát hiện PII": Hệ thống sẽ quét thông minh số CCCD, Mã định danh, Email và Số điện thoại.',
      'Hoặc vẽ khung đen thủ công lên vùng chữ/hình ảnh cần che.',
      'Nhấn "Xác nhận Che vĩnh viễn": Hệ thống loại bỏ hoàn toàn các vector chữ khỏi cấu trúc tài liệu và tẩy sạch metadata trước khi xuất file.',
    ],
  },
  {
    id: 'word-to-pdf',
    title: 'Hướng Dẫn Chuyển Đổi Word (DOCX) Sang PDF Chuẩn In Ấn',
    category: 'Chuyển Đổi Văn Phòng',
    readTime: '2 phút đọc',
    toolLink: '/convert/word-to-pdf',
    toolName: 'Công cụ Word → PDF',
    icon: FileText,
    steps: [
      'Vào công cụ chuyển đổi Word sang PDF.',
      'Tải file tài liệu định dạng .docx hoặc .doc lên vùng làm việc.',
      'Công cụ tự động chuyển đổi thông qua công cụ dựng hình độc lập, bảo đảm giữ 100% font chữ, bảng biểu và căn lề.',
      'Nhấn tải xuống ngay khi file PDF được tạo thành công.',
    ],
  },
  {
    id: 'byok-setup',
    title: 'Hướng Dẫn Cấu Hình Khóa Riêng AI (BYOK - Bring Your Own Key)',
    category: 'Trí Tuệ Nhân Tạo',
    readTime: '3 phút đọc',
    toolLink: '/dashboard',
    toolName: 'Cài Đặt Tài Khoản',
    icon: Key,
    steps: [
      'Đăng nhập vào tài khoản FileTools Pro của bạn và vào mục Cài đặt / API Keys.',
      'Chọn nhà cung cấp bạn muốn liên kết: OpenAI (ChatGPT), Google Gemini hoặc Anthropic Claude.',
      'Nhập API Key bạn đã lấy từ bảng điều khiển của nhà cung cấp.',
      'Khóa của bạn được mã hóa an toàn bằng thuật toán AES-256-GCM tại máy chủ.',
      'Bây giờ bạn có thể sử dụng các tính năng Tóm tắt, Dịch thuật, Trò chuyện với tài liệu không giới hạn và hoàn toàn miễn phí credit.',
    ],
  },
];

export default function GuidesPage() {
  const [selectedGuide, setSelectedGuide] = useState(GUIDES[0]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Trung Tâm Hướng Dẫn & Thủ Thuật Xử Lý Tệp"
        description="Tổng hợp các bài viết hướng dẫn chi tiết cách gộp PDF, nén tệp, che thông tin nhạy cảm CCCD, chuyển đổi Word sang PDF và thiết lập AI BYOK."
        canonicalPath="/guides"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Hướng dẫn sử dụng', path: '/guides' },
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-500 dark:text-cyan-400 mb-3">
          <BookOpen size={14} />
          <span>KIẾN THỨC & THỦ THUẬT THỰC HÀNH</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
          Hướng Dẫn Sử Dụng <br className="hidden sm:inline" />
          <span className="text-gradient">FileTools Pro Chi Tiết</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          Nắm vững từng bước thao tác để làm chủ các công cụ xử lý file hiện đại, nhanh chóng và an toàn.
        </p>
      </div>

      {/* Main Guides Layout (Sidebar + Reader) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Guide Cards List */}
        <div className="space-y-3">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            const isSelected = selectedGuide.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGuide(g)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex items-start gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/50 dark:bg-cyan-950/30 dark:border-cyan-400/50 shadow-sm'
                    : 'bg-white/60 dark:bg-white/[0.02] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  isSelected ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-black/5 dark:bg-white/5 text-gray-500'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {g.category}
                  </span>
                  <h3 className={`text-xs sm:text-sm font-bold truncate mt-0.5 ${
                    isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {g.title}
                  </h3>
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    {g.readTime}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Detailed Reader View */}
        <div className="lg:col-span-2 rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-8 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-black/10 dark:border-white/10">
            <div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                {selectedGuide.category}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
                {selectedGuide.title}
              </h2>
            </div>
            <Link
              to={selectedGuide.toolLink}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold liquid-gold-button shrink-0 shadow-sm"
            >
              <span>{selectedGuide.toolName}</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Thực hiện theo các bước cụ thể dưới đây để đạt được kết quả chất lượng tốt nhất với thời gian xử lý nhanh nhất:
          </p>

          {/* Steps List */}
          <div className="space-y-4 mb-8">
            {selectedGuide.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-0.5">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-black/10 dark:border-white/10 sm:hidden">
            <Link
              to={selectedGuide.toolLink}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold liquid-gold-button flex items-center justify-center gap-2"
            >
              <span>Mở {selectedGuide.toolName}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
