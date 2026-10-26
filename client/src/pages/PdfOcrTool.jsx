import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MetaTags from '../components/seo/MetaTags';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { ScanText, Copy, Check, FileSearch, ArrowRight, ShieldCheck } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function PdfOcrTool() {
  const [file, setFile] = useState(null);
  const [lang, setLang] = useState('vie+eng');
  const [mode, setMode] = useState('searchable-pdf'); // 'searchable-pdf' | 'text'
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [textResult, setTextResult] = useState('');
  const [fileResult, setFileResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!textResult) return;
    navigator.clipboard.writeText(textResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProcess = async () => {
    if (!file) return setError('Vui lòng chọn tệp PDF cần OCR');
    setLoading(true);
    setError(null);
    setTextResult('');
    setFileResult(null);
    setProgress(25);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);

    const endpoint = mode === 'searchable-pdf'
      ? '/api/ocr/searchable-pdf'
      : '/api/ocr/pdf-scan';

    try {
      setProgress(55);
      const res = await axios.post(`${API}${endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 40) / e.total));
          }
        },
      });
      setProgress(100);

      if (res.data?.text) {
        setTextResult(res.data.text);
      }
      if (res.data?.downloadUrl || res.data?.outputPath || res.data?.file) {
        setFileResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi nhận dạng chữ PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
      <MetaTags
        title="OCR Nhận Dạng Văn Bản PDF Trực Tuyến — Chuyển PDF Scan Sang Text"
        description="Trích xuất chữ từ tài liệu PDF scan và tạo file Searchable PDF có thể sao chép, tìm kiếm văn bản trực tuyến. Hỗ trợ nhận diện tiếng Việt và tiếng Anh chuẩn xác."
        canonicalPath="/pdf/ocr"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'PDF Hub', path: '/pdf' },
          { name: 'OCR Nhận dạng PDF', path: '/pdf/ocr' },
        ]}
      />

      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-600 dark:text-cyan-400 mb-3">
          <ScanText size={14} />
          <span>TESSERACT OCR & PDF TEXT LAYER</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
          OCR Nhận Dạng Chữ PDF Scan
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Biến tài liệu scan, bản chụp tài liệu PDF thành văn bản tìm kiếm, bôi đen và sao chép được.
        </p>
      </div>

      <div className="rounded-3xl border border-black/10 dark:border-white/10 p-6 sm:p-8 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl mb-12">
        <FileDropzone
          accept=".pdf"
          multiple={false}
          onFilesSelected={(selected) => {
            const f = Array.isArray(selected) ? selected[0] : selected;
            setFile(f);
            setTextResult('');
            setFileResult(null);
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Định dạng đầu ra:
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="searchable-pdf">Tạo Searchable PDF (Giữ nguyên trang + thêm lớp chữ)</option>
                  <option value="text">Trích xuất văn bản thô (Text / Copy)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Ngôn ngữ tài liệu:
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="vie+eng">Tiếng Việt + Tiếng Anh (Khuyên dùng)</option>
                  <option value="vie">Chỉ Tiếng Việt</option>
                  <option value="eng">Chỉ Tiếng Anh</option>
                  <option value="fra">Tiếng Pháp</option>
                  <option value="jpn">Tiếng Nhật</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProcess}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold liquid-gold-button flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang quét OCR từng trang...</span>
              ) : (
                <>
                  <ScanText size={16} />
                  <span>Bắt Đầu Nhận Dạng OCR</span>
                </>
              )}
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-6">
            <ProgressBar progress={progress} label="Đang nhận dạng ký tự quang học qua worker..." />
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
            ❌ {error}
          </div>
        )}

        {fileResult && (
          <div className="mt-6">
            <ResultDownload result={fileResult} />
          </div>
        )}

        {textResult && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Văn bản đã nhận diện:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép văn bản'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={textResult}
              className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
