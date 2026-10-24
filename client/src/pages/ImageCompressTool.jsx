import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MetaTags from '../components/seo/MetaTags';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { Minimize2, Image as ImageIcon, Sparkles, Sliders, ArrowRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function ImageCompressTool() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(80);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCompress = async () => {
    if (!file) return setError('Vui lòng chọn hình ảnh cần nén');
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('quality', quality);

    try {
      setProgress(60);
      const res = await axios.post(`${API}/api/image/compress`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 45) / e.total));
          }
        },
      });
      setProgress(100);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi nén hình ảnh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Nén Hình Ảnh Trực Tuyến — Giảm Dung Lượng WebP, PNG, JPEG"
        description="Nén hình ảnh trực tuyến thông minh với công nghệ Sharp. Giảm kích thước dung lượng đến 85% giữ nguyên độ sắc nét cho website và mạng xã hội."
        canonicalPath="/image/compress"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Studio Hình Ảnh', path: '/image' },
          { name: 'Nén hình ảnh', path: '/image/compress' },
        ]}
      />

      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-600 dark:text-cyan-400 mb-3">
          <Minimize2 size={14} />
          <span>IMAGE OPTIMIZER ENGINE</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          Nén Hình Ảnh Trực Tuyến
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Tối ưu dung lượng hình ảnh WebP, PNG, JPEG, SVG tốc độ cao không làm vỡ điểm ảnh.
        </p>
      </div>

      <div className="rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-8 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl mb-12">
        <FileDropzone
          accept="image/*"
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
                🖼️ {file.name}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                <span>Chất lượng hình ảnh: {quality}%</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-mono">
                  {quality >= 80 ? 'Cao (Giữ nét tối đa)' : quality >= 60 ? 'Cân bằng (Khuyên dùng)' : 'Nén cao (Siêu nhẹ)'}
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleCompress}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold liquid-gold-button flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang tối ưu hình ảnh...</span>
              ) : (
                <>
                  <Minimize2 size={16} />
                  <span>Bắt Đầu Nén Hình Ảnh</span>
                </>
              )}
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-6">
            <ProgressBar progress={progress} label="Đang nén và tái mã hóa dữ liệu hình ảnh..." />
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

      <div className="flex items-center justify-between p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <ImageIcon size={20} className="text-cyan-500" />
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
            Cần xóa nền hoặc xóa vật thể trong ảnh?
          </span>
        </div>
        <Link
          to="/image"
          className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
        >
          <span>Mở Image Studio</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
