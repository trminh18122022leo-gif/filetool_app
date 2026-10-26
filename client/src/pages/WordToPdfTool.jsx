import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MetaTags from '../components/seo/MetaTags';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { FileText, ArrowRight, CheckCircle2, Shield, Layers } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function WordToPdfTool() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleConvert = async () => {
    if (!file) return setError('Vui lòng chọn tệp Word (.docx hoặc .doc)');
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);

    try {
      setProgress(60);
      const res = await axios.post(`${API}/api/office/docx-to-pdf`, fd, {
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
      setError(err.response?.data?.message || err.message || 'Lỗi khi chuyển đổi Word sang PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="Chuyển Đổi Word Sang PDF Trực Tuyến — Giữ Nguyên Định Dạng"
        description="Chuyển đổi tệp Microsoft Word (.docx, .doc) sang định dạng PDF trực tuyến miễn phí. Giữ nguyên 100% font chữ, hình ảnh, bảng biểu và căn lề."
        canonicalPath="/convert/word-to-pdf"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Chuyển đổi tệp', path: '/convert' },
          { name: 'Word sang PDF', path: '/convert/word-to-pdf' },
        ]}
      />

      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-600 dark:text-cyan-400 mb-3">
          <FileText size={14} />
          <span>MICROSOFT WORD → PDF ENGINE</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          Chuyển Đổi Word Sang PDF
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Tạo tài liệu PDF chuyên nghiệp từ file Word (.docx, .doc) với độ chính xác cao và an toàn dữ liệu tuyệt đối.
        </p>
      </div>

      <div className="rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-8 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl mb-12">
        <FileDropzone
          accept=".docx,.doc"
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
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>

            <button
              type="button"
              onClick={handleConvert}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold liquid-gold-button flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang kết xuất PDF...</span>
              ) : (
                <>
                  <FileText size={16} />
                  <span>Chuyển Đổi Sang PDF Ngay</span>
                </>
              )}
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-6">
            <ProgressBar progress={progress} label="Đang chuyển đổi tài liệu Word sang PDF..." />
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

      <div className="p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Shield size={16} className="text-emerald-500" />
          <span>Tại sao nên chuyển Word sang PDF trên FileTools Pro?</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
          <p>✓ <strong>Bảo toàn bố cục:</strong> Giữ nguyên tiêu đề, lề trang, bảng biểu và chú thích chân trang.</p>
          <p>✓ <strong>Không lưu lại tệp:</strong> Tự động xóa vĩnh viễn tệp Word gốc sau khi tải xuống hoàn tất.</p>
          <p>✓ <strong>Tốc độ tức thì:</strong> Xử lý trong vài giây thông qua công cụ dựng hình độc lập.</p>
        </div>
      </div>
    </div>
  );
}
