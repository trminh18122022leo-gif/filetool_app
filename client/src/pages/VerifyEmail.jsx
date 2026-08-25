import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!token) {
      setError('Thiếu token xác thực');
      setLoading(false);
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setSuccess(true);
        else setError(d.error || 'Xác thực thất bại');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-10 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
        {loading && (
          <div className="space-y-3">
            <RefreshCw className="animate-spin text-blue-400 mx-auto" size={32} />
            <p className="text-xs text-gray-400">Đang kiểm tra token xác thực...</p>
          </div>
        )}

        {success && (
          <div className="space-y-4">
            <CheckCircle className="text-green-400 mx-auto" size={40} />
            <h2 className="text-xl font-bold text-white">Xác thực thành công!</h2>
            <p className="text-xs text-gray-400">Tài khoản của bạn đã được kích hoạt hoàn toàn.</p>
            <Link
              to="/login"
              className="inline-block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow"
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <AlertCircle className="text-red-400 mx-auto" size={40} />
            <h2 className="text-xl font-bold text-white">Xác thực không thành công</h2>
            <p className="text-xs text-red-300">{error}</p>
            <Link to="/" className="inline-block text-xs text-gray-400 hover:underline">
              Về trang chủ
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
