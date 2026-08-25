import { Download, Cloud, RefreshCw } from 'lucide-react';

export default function ResultDownload({
  result,
  onReset,
  label = 'Tải file kết quả',
}) {
  if (!result) return null;

  const isBatch = Array.isArray(result.files);

  const getDownloadHref = (file) => {
    if (result.downloadUrl) return result.downloadUrl;
    return `/api/download/${encodeURIComponent(file)}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Xử lý hoàn tất!</h3>
        {result.cloud && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full">
            <Cloud size={11} /> Đã lưu vào Cloud
          </span>
        )}
      </div>

      {isBatch ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Đã tạo {result.files.length} file:</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.files.map((f, i) => (
              <a
                key={i}
                href={getDownloadHref(f)}
                download={f}
                className="flex items-center justify-between p-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
              >
                <span className="truncate max-w-[240px]">{f}</span>
                <Download size={13} className="text-blue-400 shrink-0 ml-2" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <a
          href={getDownloadHref(result.file)}
          download={result.file}
          target={result.cloud ? '_blank' : '_self'}
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-900/30"
        >
          <Download size={16} />
          {label}
        </a>
      )}

      {onReset && (
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-xs font-medium transition-colors"
        >
          <RefreshCw size={13} />
          Xử lý file khác
        </button>
      )}
    </div>
  );
}
