import PdfStudioEngine from '../components/pdf-studio/PdfStudioEngine';
import MetaTags from '../components/seo/MetaTags';

export default function PdfSplitTool() {
  return (
    <div className="space-y-8">
      <MetaTags
        title="Tách PDF Trực Tuyến — Chia Nhỏ & Trích Xuất Dải Trang"
        description="Tách trang PDF trực tuyến nhanh chóng. Trích xuất một hoặc nhiều dải trang theo ý muốn mà không giảm chất lượng tài liệu."
        canonicalPath="/pdf/split"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'PDF Hub', path: '/pdf' },
          { name: 'Tách PDF', path: '/pdf/split' },
        ]}
      />
      {/* ── Central PDF Studio Engine (Split Mode) ── */}
      <PdfStudioEngine initialAction="split" />

      {/* ── SEO & Crawlable Semantic Information ── */}
      <section
        className="mt-12 p-6 rounded-2xl border text-xs leading-relaxed space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Thông tin công cụ tách PDF"
      >
        <h2 className="text-sm font-bold text-gray-200">
          Tách File PDF Trực Tuyến & Trích Xuất Dải Trang
        </h2>
        <p>
          Dễ dàng chia nhỏ tài liệu PDF dung lượng lớn thành từng trang riêng lẻ hoặc trích xuất các dải trang cụ thể theo nhu cầu. File xuất ra được đóng gói dưới dạng tệp nén ZIP tiện lợi.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Tách trang linh hoạt</h3>
            <p className="text-gray-400">Chọn dải trang tùy ý (vd: 1-5, 8, 12-15) hoặc trích xuất từng trang đơn lẻ.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Xem trước trực quan</h3>
            <p className="text-gray-400">Bộ hiển thị PDF.js hỗ trợ xem trước nội dung trang trước khi quyết định trích xuất.</p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit">
            <h3 className="font-semibold text-gray-200 mb-1">Bảo vệ quyền riêng tư</h3>
            <p className="text-gray-400">Tệp tin được tự động dọn dẹp sau khi xử lý theo chu kỳ lưu trữ an toàn.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
