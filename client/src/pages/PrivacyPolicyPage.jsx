import MetaTags from '../components/seo/MetaTags';
import { Shield, Eye, Database, Trash2, FileLock, UserCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Chính Sách Quyền Riêng Tư & Bảo Vệ Dữ Liệu"
        description="Chính sách quyền riêng tư minh bạch của FileTools Pro: Không theo dõi quảng cáo, không bán dữ liệu, tự động tiêu hủy tệp sau 24 giờ và tuân thủ GDPR."
        canonicalPath="/privacy"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Chính sách riêng tư', path: '/privacy' },
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-500 dark:text-cyan-400 mb-3">
          <Shield size={14} />
          <span>MINH BẠCH & TRUNG THỰC</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          Chính Sách Quyền Riêng Tư
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Cập nhật lần cuối: Tháng 10 năm 2026 • Tuân thủ các nguyên tắc bảo vệ dữ liệu quốc tế GDPR & CCPA
        </p>
      </div>

      {/* Content Body */}
      <div className="space-y-8 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-10 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye size={18} className="text-cyan-500" />
            <span>1. Tôn Chỉ Bảo Vệ Dữ Liệu Người Dùng</span>
          </h2>
          <p>
            Tại FileTools Pro, chúng tôi xem quyền riêng tư là một quyền cơ bản của con người. Chúng tôi <strong>tuyệt đối không bán</strong>, không cho thuê và không chia sẻ thông tin cá nhân hay nội dung tệp của bạn cho bất kỳ đơn vị quảng cáo hoặc nhà môi giới dữ liệu nào.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database size={18} className="text-cyan-500" />
            <span>2. Dữ Liệu Chúng Tôi Thu Thập</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-400">
            <li><strong>Thông tin tài khoản:</strong> Địa chỉ email và tên hiển thị khi bạn tự nguyện đăng ký tài khoản.</li>
            <li><strong>Tệp tin tải lên:</strong> Dữ liệu tệp chỉ được tiếp nhận tạm thời nhằm mục đích duy nhất là thực thi tác vụ bạn yêu cầu (chuyển đổi, nén, trích xuất văn bản, ký số).</li>
            <li><strong>Nhật ký kỹ thuật ẩn danh:</strong> Mã lỗi HTTP, thời gian hoàn thành tác vụ nhằm bảo đảm chất lượng dịch vụ và độ ổn định hạ tầng.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 size={18} className="text-cyan-500" />
            <span>3. Cơ Chế Tự Động Tiêu Hủy Tệp Tin (Data Retention)</span>
          </h2>
          <p>
            Mọi tệp tin sau khi được xử lý xong sẽ được lưu trữ tạm thời trong kho lưu trữ đám mây riêng tư (Cloudflare R2 Private Bucket) có thời hạn:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
            <li>Người dùng Miễn Phí (Free): Tự động xóa vĩnh viễn sau <strong>24 giờ</strong>.</li>
            <li>Người dùng Gói Plus: Tự động xóa vĩnh viễn sau <strong>72 giờ (3 ngày)</strong>.</li>
            <li>Người dùng Gói Pro: Tự động xóa vĩnh viễn sau <strong>168 giờ (7 ngày)</strong>.</li>
          </ul>
          <p>
            Bạn có toàn quyền nhấn nút <em>"Xóa ngay lập tức"</em> trong Dashboard để tiêu hủy file ngay mà không cần đợi hết hạn.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileLock size={18} className="text-cyan-500" />
            <span>4. Chính Sách Tương Tác Trí Tuệ Nhân Tạo (AI Consent)</span>
          </h2>
          <p>
            Đối với các tính năng trợ lý AI (Tóm tắt, Dịch thuật, Phân tích văn bản):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
            <li>Hệ thống <strong>bắt buộc phải có sự đồng ý rõ ràng</strong> của người dùng (<code className="text-xs font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">aiConsent: true</code>) trước khi gửi đoạn văn bản trích xuất tới nhà cung cấp mô hình.</li>
            <li>Người dùng sử dụng khóa riêng (BYOK) kết nối trực tiếp với nhà cung cấp (OpenAI, Google Gemini, Anthropic) theo thỏa thuận riêng của bạn với các đơn vị này. FileTools Pro không can thiệp hay lưu vết chìa khóa dạng văn bản thô.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCheck size={18} className="text-cyan-500" />
            <span>5. Quyền Lợi Của Bạn Theo Chuẩn GDPR & CCPA</span>
          </h2>
          <p>
            Bạn có đầy đủ các quyền: Quyền yêu cầu trích xuất toàn bộ dữ liệu tài khoản, quyền chỉnh sửa thông tin, và quyền được lãng quên (yêu cầu xóa vĩnh viễn tài khoản cùng toàn bộ lịch sử tệp tin khỏi cơ sở dữ liệu).
          </p>
        </section>
      </div>
    </div>
  );
}
