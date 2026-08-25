export default function ProgressBar({ progress, status = 'Đang xử lý...' }) {
  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 shadow-inner">
      <div className="flex justify-between text-xs text-gray-400 font-medium">
        <span>{status}</span>
        <span className="text-blue-400">{progress}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
