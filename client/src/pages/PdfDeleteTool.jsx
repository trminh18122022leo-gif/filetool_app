import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';

export default function PdfDeleteTool() {
  return (
    <div className="space-y-8">
      {/* ── Central PDF Studio Engine (Delete & Assemble Mode) ── */}
      <PdfStudioEngine initialAction="organize" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ xóa trang PDF"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Xóa Trang PDF Trực Tuyến Nhanh Chóng & An Toàn
        </h2>
        <p>
          Loại bỏ các trang trắng, trang thừa hoặc trang tài liệu hỏng khỏi file PDF của bạn trong vài giây. Xem trước từng trang trực quan để đảm bảo không xóa nhầm nội dung quan trọng.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Xóa một hoặc nhiều trang</h3>
            <p className="text-gray-400">Đánh dấu tích chọn các trang cần loại bỏ và bấm xóa hàng loạt tiện lợi.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Hoàn tác linh hoạt (Ctrl+Z)</h3>
            <p className="text-gray-400">Khôi phục lại trang vừa xóa bất kỳ lúc nào với phím tắt hoàn tác tiêu chuẩn.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Bảo toàn kích thước file</h3>
            <p className="text-gray-400">Giảm bớt dung lượng tài liệu sau khi xóa bỏ các trang không cần thiết.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
