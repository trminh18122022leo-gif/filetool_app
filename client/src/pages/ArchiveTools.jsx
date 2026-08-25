import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { Archive, FolderArchive } from 'lucide-react';

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
    if (!files) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let endpoint = '';
    if (activeTab === 'zip') {
      endpoint = '/api/archive/zip';
      Array.from(files).forEach(f => fd.append('files', f));
    } else {
      endpoint = '/api/archive/unzip';
      fd.append('file', files);
    }

    try {
      setProgress(65);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thao tác nén/giải nén thất bại');

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
        <h1 className="text-2xl font-bold text-white">Archive Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Đóng gói file thành định dạng ZIP hoặc giải nén an toàn trực tiếp trên máy.
        </p>
      </div>

      <div className="flex gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab('zip'); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'zip'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Archive size={14} />
          <span>Tạo file ZIP</span>
        </button>
        <button
          onClick={() => { setActiveTab('unzip'); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'unzip'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <FolderArchive size={14} />
          <span>Giải nén ZIP</span>
        </button>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : activeTab === 'zip' ? 'Nén thành file ZIP' : 'Giải nén file'}
          </button>
        )}

        {loading && <ProgressBar progress={progress} />}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {result && <ResultDownload result={result} onReset={reset} />}
      </div>
    </div>
  );
}
