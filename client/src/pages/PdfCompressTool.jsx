import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MetaTags from '../components/seo/MetaTags';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { Minimize2, Sparkles, Layers, Scissors, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfCompressTool() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState('ebook');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCompress = async () => {
    if (!file) return setError('Vui lòng chọn tệp PDF cần nén');
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('quality', quality);

    try {
      setProgress(60);
      const res = await axios.post(`${API}/api/pdf/compress`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 50) / e.total));
          }
        },
      });
      setProgress(100);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi nén PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Nén PDF Trực Tuyến — Giảm Dung Lượng Giữ Nguyên Độ Nét"
        description="Nén tệp PDF trực tuyến an toàn, giảm kích thước dung lượng đến 80% mà vẫn giữ nguyên độ nét chữ và hình ảnh. Miễn phí, không quảng cáo và tự động xóa file sau 24h."
        canonicalPath="/pdf/compress"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'PDF Hub', path: '/pdf' },
          { name: 'Nén PDF', path: '/pdf/compress' },
        ]}
      />

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-600 dark:text-cyan-400 mb-3">
          <Minimize2 size={14} />
          <span>CÔNG CỤ NÉN PDF TỐC ĐỘ CAO</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          Nén Tệp PDF Trực Tuyến
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Tối ưu hóa dung lượng tệp PDF để dễ dàng gửi qua Email hoặc đăng tải web mà không làm mờ tài liệu.
        </p>
      </div>

      {/* Main Tool Card */}
      <div className="rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-8 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl mb-12">
        <FileDropzone
          accept=".pdf"
          multiple={false}
          onFilesSelected={(selected) => {
            const f = Array.isArray(selected) ? selected[0] : selected;
            setFile(f);
            setResult(null);
            setError(null);
          }}
        />

        {file && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[250px] sm:max-w-md">
                📄 {file.name}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>

            {/* Quality Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Mức độ nén tài liệu:
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ebook">Ebook (150 dpi) — Khuyên dùng (Cân bằng chất lượng & dung lượng tối ưu)</option>
                <option value="screen">Screen (72 dpi) — Nén tối đa, dung lượng siêu nhẹ cho web</option>
                <option value="printer">Printer (300 dpi) — Chất lượng cao nhất, thích hợp in ấn</option>
              </select>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleCompress}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold liquid-gold-button flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang xử lý nén PDF...</span>
              ) : (
                <>
                  <Minimize2 size={16} />
                  <span>Bắt Đầu Nén PDF</span>
                </>
              )}
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-6">
            <ProgressBar progress={progress} label="Đang tối ưu cấu trúc tài liệu PDF..." />
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <ResultDownload result={result} />
          </div>
        )}
      </div>

      {/* Feature Highlights & Cross-Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/pdf/merge"
          className="p-4 rounded-2xl border border-black/10 dark:border-white/10 hover:border-cyan-500/40 bg-white/40 dark:bg-white/[0.02] flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 group"
        >
          <div className="flex items-center gap-2.5">
            <Layers size={18} className="text-cyan-500" />
            <span>Gộp PDF</span>
          </div>
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          to="/pdf/split"
          className="p-4 rounded-2xl border border-black/10 dark:border-white/10 hover:border-cyan-500/40 bg-white/40 dark:bg-white/[0.02] flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 group"
        >
          <div className="flex items-center gap-2.5">
            <Scissors size={18} className="text-cyan-500" />
            <span>Tách PDF</span>
          </div>
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          to="/pdf/redact"
          className="p-4 rounded-2xl border border-black/10 dark:border-white/10 hover:border-cyan-500/40 bg-white/40 dark:bg-white/[0.02] flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 group"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={18} className="text-cyan-500" />
            <span>Che PII Bảo Mật</span>
          </div>
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
