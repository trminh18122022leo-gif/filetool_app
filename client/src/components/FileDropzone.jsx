import { useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, X } from 'lucide-react';

export default function FileDropzone({
  onFilesSelected,
  onFiles,
  accept = '*',
  multiple = false,
  maxSizeMB = 100,
  label = 'Kéo thả file vào đây hoặc nhấn để chọn',
  hint,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (incomingFiles) => {
    setErrorMessage(null);
    const fileArray = Array.from(incomingFiles);
    if (!fileArray.length) return;

    // 1. Kiểm tra kích thước file
    const oversized = fileArray.filter(f => f.size > maxSizeMB * 1024 * 1024);
    if (oversized.length > 0) {
      setErrorMessage(`Tệp "${oversized[0].name}" vượt quá dung lượng tối đa cho phép (${maxSizeMB}MB)`);
      return;
    }

    // 2. Chống trùng lặp tệp trong cùng một lượt chọn
    const seen = new Set();
    const uniqueFiles = [];
    const duplicates = [];

    for (const f of fileArray) {
      const key = `${f.name}_${f.size}_${f.lastModified}`;
      if (seen.has(key)) {
        duplicates.push(f.name);
      } else {
        seen.add(key);
        uniqueFiles.push(f);
      }
    }

    if (duplicates.length > 0) {
      setErrorMessage(`Đã bỏ qua ${duplicates.length} tệp trùng lặp: ${duplicates.slice(0, 2).join(', ')}${duplicates.length > 2 ? '...' : ''}`);
    }

    if (!uniqueFiles.length) return;

    setSelectedFiles(uniqueFiles.map(f => ({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(2) })));
    const payload = multiple ? uniqueFiles : uniqueFiles[0];
    if (onFilesSelected) onFilesSelected(payload);
    if (onFiles) onFiles(payload);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (idx, e) => {
    e.stopPropagation();
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    if (updated.length === 0 && inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all relative ${
        isDragging
          ? 'border-pink-500 bg-pink-500/10 scale-[1.01]'
          : 'border-white/10 hover:border-pink-500/50 bg-black/30 backdrop-blur-xl'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />

      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-white/5 rounded-2xl text-pink-400 border border-white/10 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
          <Upload size={28} />
        </div>
        <div>
          <p className="font-semibold text-white text-base">{label}</p>
          {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
          <p className="text-xs text-gray-500 mt-1">Giới hạn {maxSizeMB}MB · Bảo mật cách ly tự động {multiple ? '· Hỗ trợ nhiều file' : ''}</p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3 py-1.5 rounded-xl text-xs max-w-md animate-fade-in">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 justify-center max-w-md">
            {selectedFiles.map((file, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-white/10 text-gray-200 pl-3 pr-2 py-1.5 rounded-xl border border-white/10 backdrop-blur">
                <File size={13} className="text-pink-400 flex-shrink-0" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <span className="text-gray-400 text-[10px]">({file.size}MB)</span>
                <button
                  type="button"
                  onClick={(e) => removeFile(i, e)}
                  className="hover:text-rose-400 text-gray-400 p-0.5 rounded transition"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
