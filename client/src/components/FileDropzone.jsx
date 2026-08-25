import { useState, useRef } from 'react';
import { Upload, File } from 'lucide-react';

export default function FileDropzone({
  onFilesSelected,
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
    onFilesSelected(multiple ? valid : valid[0]);
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
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
          : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
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
        <div className="p-4 bg-gray-800 rounded-full text-blue-400">
          <Upload size={28} />
        </div>
        <div>
          <p className="font-medium text-gray-200">{label}</p>
          {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
          <p className="text-xs text-gray-500 mt-0.5">Tối đa {maxSizeMB}MB {multiple ? '· Hỗ trợ nhiều file' : ''}</p>
        </div>

        {selectedNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 justify-center max-w-md">
            {selectedNames.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg border border-gray-700">
                <File size={12} className="text-blue-400" />
                <span className="max-w-[150px] truncate">{name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
