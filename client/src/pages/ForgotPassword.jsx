import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-10 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-900/30 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-800/40">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">Quên mật khẩu</h1>
          <p className="text-xs text-gray-400">Nhập email để nhận liên kết đặt lại mật khẩu của bạn</p>
        </div>

        {sent ? (
          <div className="p-5 bg-green-950/40 border border-green-800/60 rounded-xl text-center space-y-3">
            <CheckCircle size={24} className="text-green-400 mx-auto" />
            <p className="text-xs text-green-300">
              Nếu email tồn tại, link đặt lại mật khẩu đã được gửi đến <b>{email}</b>. Vui lòng kiểm tra hộp thư.
            </p>
            <Link to="/login" className="inline-block text-xs text-blue-400 hover:underline pt-2">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Email của bạn</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tenban@email.com"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi link khôi phục'}
            </button>

            <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white pt-2">
              <ArrowLeft size={13} /> Quay lại đăng nhập
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
