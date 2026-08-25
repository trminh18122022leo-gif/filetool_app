import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-5">
        <div className="w-16 h-16 bg-red-950/50 border border-red-800/40 rounded-3xl flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-5xl font-extrabold text-white">404</h1>
        <h2 className="text-lg font-bold text-gray-200">Không tìm thấy trang yêu cầu</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển sang địa chỉ khác.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30"
        >
          <Home size={15} /> Trở về trang chủ
        </Link>
      </div>
    </div>
  );
}
