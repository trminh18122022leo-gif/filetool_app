import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function PdfPasswordModal({ isOpen, onSubmit, onCancel, fileName }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) {
      setError('Vui lòng nhập mật khẩu tài liệu');
      return;
    }
    setError('');
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <Lock size={22} />
          </div>
          <div>
            <h3 id="password-modal-title" className="font-bold text-base">
              Tài Liệu Được Bảo Mật
            </h3>
            <p className="text-xs text-gray-400 truncate max-w-[260px]">
              {fileName || 'Tệp PDF'}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-300 mb-4 leading-relaxed">
          File PDF này được mã hóa bảo vệ. Vui lòng nhập mật khẩu mở file để đọc và thực hiện các thao tác xử lý trong PDF Studio.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập mật khẩu PDF..."
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all pr-10"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: error ? '#EF4444' : 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-400 hover:text-white"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#FFFFFF',
              }}
            >
              Mở Khóa Tài Liệu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
