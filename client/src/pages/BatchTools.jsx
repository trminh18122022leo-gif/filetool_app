import { useState } from 'react';
import { useJobSocket } from '../hooks/useJobSocket';
import FileDropzone   from '../components/FileDropzone';
import {
  Layers, Minimize2, RefreshCw, Scaling,
  RotateCw, CheckCircle, AlertTriangle, Download
} from 'lucide-react';

const ACTIONS = [
  { id: 'pdf-compress',   label: 'Nén PDF hàng loạt',        icon: Minimize2, accept: '.pdf' },
  { id: 'image-convert',  label: 'Đổi định dạng ảnh hàng loạt', icon: RefreshCw, accept: 'image/*' },
  { id: 'image-compress', label: 'Nén ảnh hàng loạt',        icon: Minimize2, accept: 'image/*' },
  { id: 'image-resize',   label: 'Resize ảnh hàng loạt',     icon: Scaling,   accept: 'image/*' },
  { id: 'pdf-rotate',     label: 'Xoay PDF hàng loạt',       icon: RotateCw,  accept: '.pdf' },
];

export default function BatchTools() {
  const [action, setAction]       = useState('pdf-compress');
  const [files, setFiles]         = useState([]);
  const [jobId, setJobId]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions]     = useState({});

  const { progress, currentFile, completed, total, result, error, isDone, isRunning } =
    useJobSocket(jobId);

  const curAction = ACTIONS.find(a => a.id === action);

  const startBatch = async () => {
    if (!files.length) return;
    setUploading(true);

    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('action', action);
    fd.append('options', JSON.stringify(options));

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res  = await fetch('/api/batch/process', { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setJobId(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Batch Processing</h1>
        <p className="text-sm text-gray-400 mt-1">
          Xử lý song song nhiều tệp tin với hàng đợi thông minh và theo dõi tiến độ thời gian thực qua Socket.io.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setAction(id); reset(); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              action === id
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <FileDropzone
          key={action}
          onFilesSelected={setFiles}
          multiple
          accept={curAction?.accept}
          label={`Chọn nhiều file để: ${curAction?.label}`}
        />

        {files.length > 0 && !isRunning && !isDone && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            <p className="text-xs text-gray-400 font-semibold">Đã chọn {files.length} file.</p>

            {action === 'image-convert' && (
              <div>
                <label className="text-xs text-gray-300">Đổi tất cả sang:</label>
                <select
                  onChange={e => setOptions({ format: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mt-1"
                >
                  <option value="webp">WEBP</option>
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="avif">AVIF</option>
                </select>
              </div>
            )}

            <button
              onClick={startBatch}
              disabled={uploading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-900/30 disabled:opacity-50"
            >
              {uploading ? 'Đang gửi files...' : `Bắt đầu xử lý ${files.length} files`}
            </button>
          </div>
        )}

        {/* Real-time Progress */}
        {isRunning && (
          <div className="p-5 bg-gray-950 border border-cyan-800/40 rounded-xl space-y-3">
            <div className="flex justify-between text-xs text-gray-300">
              <span className="font-semibold text-cyan-400">Đang xử lý: {currentFile || 'Chuẩn bị...'}</span>
              <span>{completed}/{total} ({progress}%)</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Done */}
        {isDone && result && (
          <div className="p-6 bg-gray-950 border border-green-800/50 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto text-green-400">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-bold text-white text-base">Hoàn thành {result.successCount} file!</h3>
            {result.failCount > 0 && (
              <p className="text-xs text-yellow-400">{result.failCount} file bị lỗi</p>
            )}
            <a
              href={`/api/download/${result.zipFile}`}
              download={result.zipFile}
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-cyan-900/30"
            >
              <Download size={15} /> Tải tất cả (ZIP)
            </a>
            <button
              onClick={reset}
              className="text-xs text-gray-500 hover:text-gray-300 block mx-auto"
            >
              Xử lý lô khác
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
