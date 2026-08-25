import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import SignaturePad   from '../components/SignaturePad';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { PenLine, CheckCircle } from 'lucide-react';

export default function SignaturePage() {
  const [file, setFile]           = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [page, setPage]           = useState(0);
  const [posX, setPosX]           = useState(50);
  const [posY, setPosY]           = useState(700);
  const [sigWidth, setSigWidth]   = useState(180);
  const [sigHeight, setSigHeight] = useState(70);

  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const reset = () => {
    setFile(null);
    setSignatureData(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleSubmit = async () => {
    if (!file || !signatureData) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('signature', signatureData);
    fd.append('page', page);
    fd.append('x', posX);
    fd.append('y', posY);
    fd.append('width', sigWidth);
    fd.append('height', sigHeight);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      setProgress(60);
      const res = await fetch('/api/signature/sign', {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ký tài liệu thất bại');

      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">E-Signature (Ký Điện Tử)</h1>
        <p className="text-sm text-gray-400 mt-1">
          Ký trực tiếp bằng chuột, trackpad hoặc ngón tay và nhúng chữ ký vào trang PDF bất kỳ.
        </p>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cột 1: Chọn PDF */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">1. Chọn file PDF cần ký</h3>
            <FileDropzone
              onFilesSelected={setFile}
              accept=".pdf"
              label="Tải file PDF cần chèn chữ ký"
            />
          </div>

          {/* Cột 2: Bảng ký tay */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">2. Tạo chữ ký tay</h3>
            <SignaturePad onSave={setSignatureData} />
            {signatureData && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/40 p-2.5 rounded-xl border border-green-800/40">
                <CheckCircle size={15} />
                <span>Đã lưu mẫu chữ ký thành công!</span>
              </div>
            )}
          </div>
        </div>

        {/* Tùy chỉnh vị trí ký */}
        {file && signatureData && (
          <div className="p-5 bg-gray-950 border border-gray-800 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">3. Vị trí đặt chữ ký</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-400">Trang (từ 0)</label>
                <input
                  type="number"
                  min="0"
                  value={page}
                  onChange={e => setPage(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tọa độ X</label>
                <input
                  type="number"
                  value={posX}
                  onChange={e => setPosX(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tọa độ Y</label>
                <input
                  type="number"
                  value={posY}
                  onChange={e => setPosY(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Rộng (px)</label>
                <input
                  type="number"
                  value={sigWidth}
                  onChange={e => setSigWidth(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Cao (px)</label>
                <input
                  type="number"
                  value={sigHeight}
                  onChange={e => setSigHeight(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-pink-900/30 disabled:opacity-50"
            >
              {loading ? 'Đang chèn chữ ký...' : 'Nhúng chữ ký vào PDF & Xuất file'}
            </button>
          </div>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {result && <ResultDownload result={result} onReset={reset} label="Tải PDF Đã Ký" />}
      </div>
    </div>
  );
}
