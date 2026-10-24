import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';
import MetaTags from '../components/seo/MetaTags';

export default function PdfRedactTool() {
  return (
    <div className="space-y-8">
      <MetaTags
        title="Che Thông Tin Nhạy Cảm PII Trực Tuyến — Redact PDF Bảo Mật"
        description="Xóa vĩnh viễn số CCCD, Email, Số điện thoại và thông tin bí mật khỏi tài liệu PDF. Cam kết loại bỏ hoàn toàn dòng văn bản nhị phân và tẩy sạch metadata."
        canonicalPath="/pdf/redact"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'PDF Hub', path: '/pdf' },
          { name: 'Che PII Redact', path: '/pdf/redact' },
        ]}
      />
      {/* ── Central PDF Studio Engine (Redact PII Mode) ── */}
      <PdfStudioEngine initialAction="redact" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ che thông tin nhạy cảm PII"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Che Thông Tin Nhạy Cảm PII (Bảo Mật Tiêu Chuẩn Doanh Nghiệp)
        </h2>
        <p>
          Hệ thống quét thông minh tự động nhận diện số Căn cước công dân (CCCD 12 số), Chứng minh nhân dân cũ, số điện thoại, địa chỉ email và thẻ tín dụng. Công nghệ Secure Redaction loại bỏ vĩnh viễn dữ liệu vector và tẩy sạch siêu dữ liệu (metadata), đảm bảo không thể khôi phục nội dung đã che dưới bất kỳ hình thức nào.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Quét tự động thông minh</h3>
            <p className="text-gray-400">Poppler TSV & biểu thức chính quy nhận diện tức thời các mẫu thông tin định danh cá nhân.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Xóa sạch luồng dữ liệu</h3>
            <p className="text-gray-400">Không dùng lớp hộp đen che phủ giả lập; tiêu hủy hoàn toàn các ký tự nhạy cảm khỏi cấu trúc file.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Tẩy rửa siêu dữ liệu</h3>
            <p className="text-gray-400">Làm sạch tên tác giả, tiêu đề, phần mềm tạo file và các trường biểu mẫu AcroForm ẩn.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
