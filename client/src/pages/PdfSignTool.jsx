import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';

export default function PdfSignTool() {
  return (
    <div className="space-y-8">
      {/* ── Central PDF Studio Engine (Sign Mode) ── */}
      <PdfStudioEngine initialAction="watermark" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ ký PDF"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Ký Số & Đóng Dấu Tài Liệu PDF Trực Tuyến
        </h2>
        <p>
          Tạo và chèn chữ ký tay trực quan, con dấu điện tử hoặc chữ mờ bảo mật lên tài liệu PDF của bạn mà không cần cài đặt phần mềm bên thứ ba.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Chữ ký cá nhân hóa</h3>
            <p className="text-gray-400">Vẽ chữ ký trực tiếp bằng ngón tay/bút cảm ứng hoặc tải lên ảnh chữ ký PNG trong suốt.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Định vị chính xác</h3>
            <p className="text-gray-400">Kéo thả vị trí chữ ký và điều chỉnh kích thước trực tiếp trên từng trang tài liệu.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Bảo toàn văn bản</h3>
            <p className="text-gray-400">Nội dung hợp đồng và văn bản gốc được giữ nguyên vẹn với chất lượng nét chuẩn vector.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
