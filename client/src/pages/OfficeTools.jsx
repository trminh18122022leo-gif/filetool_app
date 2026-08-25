import { useState } from 'react';
import FileDropzone   from '../components/FileDropzone';
import ProgressBar    from '../components/ProgressBar';
import ResultDownload from '../components/ResultDownload';
import { FileText, FileSpreadsheet, Presentation, Code2 } from 'lucide-react';

const TABS = [
  { id: 'docx-to-pdf', label: 'DOCX -> PDF', icon: FileText,        accept: '.docx,.doc' },
  { id: 'xlsx-to-pdf', label: 'XLSX -> PDF', icon: FileSpreadsheet, accept: '.xlsx,.xls' },
  { id: 'pptx-to-pdf', label: 'PPTX -> PDF', icon: Presentation,    accept: '.pptx,.ppt' },
  { id: 'xlsx-to-csv', label: 'XLSX -> CSV', icon: FileSpreadsheet, accept: '.xlsx,.xls' },
  { id: 'csv-to-xlsx', label: 'CSV -> XLSX', icon: FileSpreadsheet, accept: '.csv' },
  { id: 'pdf-to-docx', label: 'PDF -> DOCX', icon: FileText,        accept: '.pdf' },
  { id: 'pdf-to-html', label: 'PDF -> HTML', icon: Code2,           accept: '.pdf' },
];

export default function OfficeTools() {
  const [activeTab, setActiveTab] = useState('docx-to-pdf');
  const [file, setFile]           = useState(null);
  const [htmlMode, setHtmlMode]   = useState('complex');
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const curTab = TABS.find(t => t.id === activeTab);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    reset();
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(30);

    const fd = new FormData();
    fd.append('file', file);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let endpoint = `/api/office/${activeTab}`;
    if (activeTab === 'pdf-to-html') {
      endpoint = '/api/convert/pdf-to-html';
      fd.append('mode', htmlMode);
    }

    try {
      setProgress(60);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chuyển đổi Office thất bại');

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
        <h1 className="text-2xl font-bold text-white">Office Tools</h1>
        <p className="text-sm text-gray-400 mt-1">
          Chuyển đổi các định dạng Word, Excel, PowerPoint và PDF thực tế bằng LibreOffice headless.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-900 border border-gray-800 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
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
          key={activeTab}
          onFilesSelected={setFile}
          accept={curTab?.accept}
          label={`Tải file cho thao tác: ${curTab?.label}`}
        />

        {file && (
          <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-4">
            {activeTab === 'pdf-to-html' && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300">Chế độ xuất HTML</label>
                <select
                  value={htmlMode}
                  onChange={e => setHtmlMode(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="complex">Complex (Giữ nguyên font chữ, layout và hình ảnh)</option>
                  <option value="single">Single (Gom vào 1 file HTML duy nhất)</option>
                </select>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {loading ? 'Đang chuyển đổi...' : `Bắt đầu chuyển đổi (${curTab?.label})`}
            </button>
          </div>
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
