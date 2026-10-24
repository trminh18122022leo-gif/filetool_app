import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';
import MetaTags from '../components/seo/MetaTags';

export default function PdfMergeTool() {
  return (
    <div className="space-y-8">
      <MetaTags
        title="Gộp PDF Trực Tuyến — Ghép Nhiều File PDF Thành Một"
        description="Gộp nhiều file PDF thành một tài liệu duy nhất trực tuyến miễn phí. Sắp xếp thứ tự trang trực quan, an toàn và bảo mật dữ liệu tuyệt đối."
        canonicalPath="/pdf/merge"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'PDF Hub', path: '/pdf' },
          { name: 'Gộp PDF', path: '/pdf/merge' },
        ]}
      />
      {/* ── Central PDF Studio Engine (Merge Mode) ── */}
      <PdfStudioEngine initialAction="merge" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ gộp PDF"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Gộp Nhiều File PDF Thành Một Tài Liệu Duy Nhất
        </h2>
        <p>
          FileTools Pro cung cấp công cụ gộp PDF trực quan, cho phép kết hợp tối đa 50 tệp PDF độc lập với độ chính xác tuyệt đối. Hệ thống bảo toàn 100% định dạng vector, phông chữ nhúng và mục lục liên kết mà không làm suy giảm chất lượng hiển thị.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">1. Tải lên tệp nhanh</h3>
            <p className="text-gray-400">Kéo thả tài liệu từ máy tính hoặc bộ nhớ đám mây vào bàn làm việc.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">2. Tùy biến trang</h3>
            <p className="text-gray-400">Kéo thả sắp xếp lại thứ tự, xoay trang bị lệch hoặc xóa trang thừa trước khi ghép.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">3. Xuất file tức thì</h3>
            <p className="text-gray-400">Tạo tài liệu hoàn chỉnh qua bộ xử lý PDF-Lib tốc độ cao với mã hóa bảo mật.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
