import { useState, useRef } from 'react';
import { Upload, File } from 'lucide-react';

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
  const [selectedNames, setSelectedNames] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const valid = fileArray.filter(f => f.size <= maxSizeMB * 1024 * 1024);
    
    if (valid.length < fileArray.length) {
      alert(`Một số file vượt quá giới hạn ${maxSizeMB}MB`);
    }

    setSelectedNames(valid.map(f => f.name));
    const payload = multiple ? valid : valid[0];
    if (onFilesSelected) onFilesSelected(payload);
    if (onFiles) onFiles(payload);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
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
          <p className="text-xs text-gray-500 mt-1">Tối đa {maxSizeMB}MB {multiple ? '· Hỗ trợ nhiều file' : ''}</p>
        </div>

        {selectedNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 justify-center max-w-md">
            {selectedNames.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-white/10 text-gray-200 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur">
                <File size={13} className="text-pink-400 flex-shrink-0" />
                <span className="max-w-[160px] truncate">{name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
