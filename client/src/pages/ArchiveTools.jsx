import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import axios          from 'axios';
import { Archive, FolderArchive } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function ArchiveTools() {
  const [activeTab, setActiveTab] = useState('zip');
  const [files, setFiles]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const reset = () => {
    setFiles(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleSubmit = async () => {
    if (!files) return setError('Vui lòng chọn file');
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    let endpoint = '';

    if (activeTab === 'zip') {
      endpoint = '/api/archive/zip';
      const fileList = Array.isArray(files) ? files : [files];
      fileList.forEach(f => fd.append('files', f));
    } else {
      endpoint = '/api/archive/unzip';
      fd.append('file', Array.isArray(files) ? files[0] : files);
    }

    try {
      setProgress(65);
      const { data } = await axios.post(`${API}${endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });

      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Thao tác nén/giải nén thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gradient">Archive Tools</h1>
        <p className="text-sm text-gray-400 mt-1.5">
          Đóng gói file thành định dạng ZIP hoặc giải nén an toàn trực tiếp trên máy.
        </p>
      </div>

      <div className="flex gap-2 p-2 glass-panel w-fit">
        <button
          onClick={() => { setActiveTab('zip'); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'zip'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Archive size={14} />
          <span>Tạo file ZIP</span>
        </button>
        <button
          onClick={() => { setActiveTab('unzip'); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'unzip'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FolderArchive size={14} />
          <span>Giải nén ZIP</span>
        </button>
      </div>

      <div className="glass-panel p-6 sm:p-8 space-y-6">
        <FileDropzone
          key={activeTab}
          onFilesSelected={setFiles}
          multiple={activeTab === 'zip'}
          accept={activeTab === 'unzip' ? '.zip' : '*'}
          label={activeTab === 'zip' ? 'Chọn nhiều file để nén thành ZIP' : 'Chọn file .zip để giải nén'}
        />

        {files && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)] disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : activeTab === 'zip' ? 'Nén thành file ZIP' : 'Giải nén file'}
          </button>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {result && <ResultDownload result={result} onReset={reset} />}
      </div>
    </div>
  );
}
