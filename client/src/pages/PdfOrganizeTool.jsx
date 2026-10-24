import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';

export default function PdfOrganizeTool() {
  return (
    <div className="space-y-8">
      {/* ── Central PDF Studio Engine (Organize Mode) ── */}
      <PdfStudioEngine initialAction="organize" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ sắp xếp trang PDF"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Sắp Xếp & Đảo Thứ Tự Trang PDF Trực Quan
        </h2>
        <p>
          Kéo thả sắp xếp lại các trang trong tài liệu PDF theo thứ tự mong muốn, xoay trang theo chiều kim đồng hồ hoặc xóa bỏ những trang tài liệu không cần thiết chỉ bằng một cú nhấp chuột.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Kéo thả mượt mà</h3>
            <p className="text-gray-400">Giao diện drag-and-drop gia tốc phần cứng mang lại trải nghiệm tương tác tự nhiên.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Hỗ trợ tệp lớn 300+ trang</h3>
            <p className="text-gray-400">Công nghệ cuộn ảo Virtualized Rail tối ưu bộ nhớ, không làm đơ trình duyệt.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Xoay & Xóa tức thời</h3>
            <p className="text-gray-400">Các thay đổi được áp dụng ngay lập tức trong bộ nhớ đệm trước khi bạn bấm xuất file.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
