import MetaTags from '../components/seo/MetaTags';
import {
  ShieldCheck, Lock, EyeOff, Server, HardDrive,
  Key, RefreshCw, FileCheck2, AlertCircle, CheckCircle2
} from 'lucide-react';

export default function SecurityPage() {
  const securityPillars = [
    {
      icon: EyeOff,
      title: 'Bảo Mật Che Dữ Liệu PII Thực Sự (True Redaction)',
      desc: 'Công nghệ Redaction loại bỏ vĩnh viễn dòng văn bản vector và tẩy sạch Metadata (EXIF, tác giả, lịch sử). Tuyệt đối không sử dụng lớp phủ hình chữ nhật đen giả (fake overlay) có thể bôi đen copy ngược lại.',
    },
    {
      icon: HardDrive,
      title: 'Kho Lưu Trữ Tệp Riêng Tư Mặc Định (Private Storage)',
      desc: 'Toàn bộ tệp tin được lưu trên Cloudflare R2 với quyền truy cập riêng tư (Private Bucket). Mọi lượt tải đều sử dụng chữ ký có thời hạn ngắn (Signed Window URL). Không lưu thư mục tĩnh công khai.',
    },
    {
      icon: Key,
      title: 'Mã Hóa Khóa Riêng BYOK Chuẩn Quân Đội (AES-256-GCM)',
      desc: 'Khóa API AI của người dùng được mã hóa qua kho bảo mật (Vault) độc lập bằng thuật toán AES-256-GCM kèm Auth Tag chống giả mạo. Khóa không bao giờ hiển thị lại sau khi lưu.',
    },
    {
      icon: Server,
      title: 'Phòng Thủ SSRF & Cách Ly Sandbox Tuyệt Đối',
      desc: 'Tính năng chuyển đổi URL sang PDF thực thi chính sách Network Deny-All, chặn đứng toàn diện dải IP loopback (127.0.0.1), mạng nội bộ RFC1918 và Cloud Metadata (169.254.169.254).',
    },
    {
      icon: Lock,
      title: 'Tuân Thủ PCI-DSS: Không Lưu Dữ Liệu Thẻ Tín Dụng',
      desc: 'Mọi giao dịch thanh toán được xử lý trực tiếp qua cổng Stripe Checkout được mã hóa TLS 1.3. Máy chủ FileTools Pro không bao giờ chạm tới số thẻ, CVV hay ngày hết hạn của khách hàng.',
    },
    {
      icon: RefreshCw,
      title: 'Tự Động Tiêu Hủy Dữ Liệu Sau 24 Giờ',
      desc: 'Các tệp xử lý tạm thời và kết quả xuất ra được dịch vụ dọn dẹp chạy nền tự động xóa vĩnh viễn sau 24h (hoặc theo cấu hình gói), đảm bảo không để lại dấu vết dữ liệu nhạy cảm.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Kiến Trúc An Ninh & Bảo Mật Dữ Liệu"
        description="Tìm hiểu kiến trúc an ninh, bảo vệ quyền riêng tư, mã hóa AES-256-GCM và chính sách tiêu hủy dữ liệu tệp tin của FileTools Pro."
        canonicalPath="/security"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Bảo mật & An ninh', path: '/security' },
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 mb-3">
          <ShieldCheck size={14} />
          <span>BẢO MẬT DOANH NGHIỆP & QUYỀN RIÊNG TƯ</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
          An Toàn Tối Đa Cho <br className="hidden sm:inline" />
          <span className="text-gradient">Tài Liệu Của Bạn</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          Chúng tôi xây dựng FileTools Pro với nguyên tắc phòng thủ đa lớp (Defense-in-Depth). Dữ liệu của bạn là tài sản của bạn, không bao giờ được dùng để huấn luyện mô hình hay bán cho bên thứ ba.
        </p>
      </div>

      {/* Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {securityPillars.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  {p.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invariants Summary */}
      <div className="p-8 rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileCheck2 size={20} className="text-cyan-500" />
          <span>Cam Kết An Ninh Bất Biến (Security Invariants)</span>
        </h2>
        <div className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p><strong>Không lưu vĩnh viễn tệp tải lên:</strong> Mọi tệp nguồn và kết quả đều tự động xóa sau khi hết hạn lưu trữ hoặc khi người dùng yêu cầu xóa ngay.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p><strong>Xác thực Fail-Closed:</strong> Nếu máy chủ cơ sở dữ liệu xác thực gặp sự cố, hệ thống trả về mã 503 thay vì hạ cấp quyền hay cấp đặc quyền Pro giả định.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p><strong>Mã hóa đường truyền TLS 1.3:</strong> 100% dữ liệu truyền tải giữa trình duyệt người dùng, CDN Cloudflare và API Render đều được mã hóa bằng chứng chỉ TLS 1.3 tối tân.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
