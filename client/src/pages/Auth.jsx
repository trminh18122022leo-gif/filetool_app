import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function Auth({ defaultMode = 'login' }) {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(defaultMode === 'register');
  const navigate = useNavigate();
  const location = useLocation();

  // Login form state
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);
  const [loginError, setLoginError]       = useState(null);

  // 2FA Challenge state
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [twoFactorUserId, setTwoFactorUserId]       = useState(null);
  const [totpCode, setTotpCode]                     = useState('');
  const [twoFactorLoading, setTwoFactorLoading]     = useState(false);
  const [twoFactorError, setTwoFactorError]         = useState(null);

  // Register form state
  const [regName, setRegName]             = useState('');
  const [regEmail, setRegEmail]           = useState('');
  const [regPassword, setRegPassword]     = useState('');
  const [regLoading, setRegLoading]       = useState(false);
  const [regError, setRegError]           = useState(null);
  const [regSuccess, setRegSuccess]       = useState(null);

  const urlError = new URLSearchParams(location.search).get('error');

  useEffect(() => {
    setIsRegister(location.pathname === '/register' || defaultMode === 'register');
  }, [location.pathname, defaultMode]);

  const toggleMode = (targetIsRegister) => {
    setIsRegister(targetIsRegister);
    setLoginError(null);
    setRegError(null);
    setRegSuccess(null);
    setTwoFactorChallenge(null);
    const newPath = targetIsRegister ? '/register' : '/login';
    window.history.replaceState(null, '', newPath);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const { data } = await axios.post(`${API}/api/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      }, { withCredentials: true });

      if (data.requires2FA) {
        setTwoFactorUserId(data.userId);
        setTwoFactorChallenge(data.challenge);
        return;
      }

      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError(null);

    try {
      const { data } = await axios.post(`${API}/api/auth/2fa/complete`, {
        userId: twoFactorUserId,
        challenge: twoFactorChallenge,
        token: totpCode.trim(),
      }, { withCredentials: true });

      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setTwoFactorError(err.response?.data?.error || 'Mã xác thực 2FA không chính xác hoặc đã hết hạn.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    try {
      const { data } = await axios.post(`${API}/api/auth/register`, {
        name: regName,
        email: regEmail,
        password: regPassword,
      }, { withCredentials: true });

      login(data.user, data.token);
      setRegSuccess('Đăng ký thành công! Đang chuyển hướng...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    } catch (err) {
      setRegError(err.response?.data?.error || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleTelegramLogin = () => {
    const botId = '8432535340';
    const callbackUrl = `${API}/api/auth/telegram/callback`;
    const url = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(window.location.origin)}&embed=1&request_access=write&return_to=${encodeURIComponent(callbackUrl)}`;
    window.open(
      url,
      'telegram_login',
      'width=550,height=480,scrollbars=yes'
    );
  };

  const SocialButtons = () => (
    <div className="grid grid-cols-3 gap-2 mt-4">
      <a
        href={`${API}/api/auth/google`}
        className="glass-button flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
        title="Tiếp tục với Google"
      >
        <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="truncate">Google</span>
      </a>

      <a
        href={`${API}/api/auth/github`}
        className="glass-button flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
        title="Tiếp tục với GitHub"
      >
        <svg className="w-4 h-4 fill-white flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        <span className="truncate">GitHub</span>
      </a>

      <button
        onClick={handleTelegramLogin}
        className="glass-button flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
        title="Tiếp tục với Telegram"
      >
        <svg className="w-4 h-4 fill-[#229ED9] flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z"/>
        </svg>
        <span className="truncate">Telegram</span>
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto py-4">
      {/* Mobile Mode Switcher */}
      <div className="md:hidden mb-6 flex p-1.5 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-xl">
        <button
          onClick={() => toggleMode(false)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            !isRegister
              ? 'liquid-gold-button text-black shadow-[0_0_15px_rgba(245,158,11,0.35)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <LogIn size={14} /> Đăng Nhập
        </button>
        <button
          onClick={() => toggleMode(true)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            isRegister
              ? 'liquid-gold-button text-black shadow-[0_0_15px_rgba(245,158,11,0.35)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <UserPlus size={14} /> Đăng Ký
        </button>
      </div>

      {/* Main Container */}
      <div className="relative overflow-hidden rounded-3xl liquid-glass shadow-[0_0_50px_rgba(0,0,0,0.7)] border border-white/10 min-h-[620px] flex">

        {/* 1. Left Section: Login Form */}
        <div className={`w-full md:w-1/2 p-8 sm:p-10 flex flex-col justify-center transition-all duration-500 ${
          isRegister ? 'hidden md:flex opacity-30 pointer-events-none md:pointer-events-auto' : 'flex opacity-100'
        }`}>
          <div className="max-w-sm mx-auto w-full">

            {twoFactorChallenge ? (
              // 2FA Verification View
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto">
                  <ShieldCheck size={26} />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white">Xác thực 2 Bước (2FA)</h2>
                  <p className="text-xs text-gray-400 mt-1">Nhập mã 6 chữ số từ ứng dụng Authenticator của bạn</p>
                </div>

                {twoFactorError && (
                  <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{twoFactorError}</span>
                  </div>
                )}

                <form onSubmit={handle2FASubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      maxLength="6"
                      autoFocus
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      className="glass-input text-center text-2xl tracking-[0.5em] font-mono py-3 focus:border-amber-400"
                      placeholder="000000"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={twoFactorLoading || totpCode.length < 6}
                    className="w-full liquid-gold-button py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {twoFactorLoading ? <><Loader2 size={18} className="animate-spin" /> Đang xác thực...</> : 'Xác Nhận & Đăng Nhập'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTwoFactorChallenge(null)}
                    className="w-full text-xs text-gray-400 hover:text-white py-1 transition-colors cursor-pointer"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </form>
              </div>
            ) : (
              // Normal Login View
              <>
                <h2 className="text-3xl font-extrabold gold-gradient-text flex items-center gap-2.5 mb-2">
                  <LogIn size={26} className="text-amber-400" /> Đăng Nhập
                </h2>
                <p className="text-xs text-gray-400 mb-6">Chào mừng bạn quay lại với FileTools Pro!</p>

                {(loginError || urlError) && (
                  <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{loginError || urlError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="glass-input text-sm py-2.5"
                      placeholder="name@company.com"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-medium text-gray-300">Mật khẩu</label>
                      <Link to="/forgot-password" className="text-[11px] text-amber-400 hover:underline">
                        Quên mật khẩu?
                      </Link>
                    </div>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="glass-input text-sm py-2.5"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full mt-2 liquid-gold-button py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loginLoading ? <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</> : 'Đăng Nhập'}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-gray-400 text-[11px] uppercase font-medium">Hoặc tiếp tục với</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <SocialButtons />

                <p className="mt-6 text-center text-xs text-gray-400 md:hidden">
                  Chưa có tài khoản?{' '}
                  <button onClick={() => toggleMode(true)} className="text-amber-400 hover:underline font-bold ml-1 cursor-pointer">
                    Đăng ký ngay
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        {/* 2. Right Section: Register Form */}
        <div className={`w-full md:w-1/2 p-8 sm:p-10 flex flex-col justify-center transition-all duration-500 ${
          !isRegister ? 'hidden md:flex opacity-30 pointer-events-none md:pointer-events-auto' : 'flex opacity-100'
        }`}>
          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-3xl font-extrabold gold-gradient-text flex items-center gap-2.5 mb-2">
              <UserPlus size={26} className="text-amber-400" /> Tạo Tài Khoản
            </h2>
            <p className="text-xs text-gray-400 mb-6">Đăng ký tài khoản miễn phí trải nghiệm toàn bộ tính năng</p>

            {regError && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="mb-4 p-3 bg-green-950/50 border border-green-800/60 rounded-xl flex items-start gap-2.5 text-green-400 text-xs">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Họ và tên</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="glass-input text-sm py-2.5"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="glass-input text-sm py-2.5"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Mật khẩu</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="glass-input text-sm py-2.5"
                  placeholder="Tối thiểu 6 ký tự"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full mt-2 liquid-gold-button py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {regLoading ? <><Loader2 size={18} className="animate-spin" /> Đang tạo tài khoản...</> : 'Tạo Tài Khoản'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-400 text-[11px] uppercase font-medium">Hoặc tiếp tục với</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <SocialButtons />

            <p className="mt-6 text-center text-xs text-gray-400 md:hidden">
              Đã có tài khoản?{' '}
              <button onClick={() => toggleMode(false)} className="text-amber-400 hover:underline font-bold ml-1 cursor-pointer">
                Đăng nhập ngay
              </button>
            </p>
          </div>
        </div>

        {/* 3. Sliding Overlay (Desktop Only >= md) */}
        <div
          className={`hidden md:flex absolute top-0 w-1/2 h-full bg-gradient-to-br from-amber-600 via-orange-700 to-rose-900 z-20 transition-all duration-700 ease-in-out items-center justify-center text-center p-12 text-white shadow-2xl backdrop-blur-3xl ${
            isRegister ? 'translate-x-0 left-0 rounded-r-3xl' : 'translate-x-full left-0 rounded-l-3xl'
          }`}
        >
          <div className="space-y-6 max-w-xs">
            {isRegister ? (
              <>
                <h3 className="text-3xl font-black tracking-tight">Đã Có Tài Khoản?</h3>
                <p className="text-sm text-amber-100/90 leading-relaxed">
                  Đăng nhập để tiếp tục làm việc với các file của bạn và tận hưởng tính năng Pro!
                </p>
                <button
                  onClick={() => toggleMode(false)}
                  className="px-8 py-3 rounded-xl bg-white text-black font-extrabold hover:bg-amber-50 transition-all shadow-xl hover:scale-105 active:scale-95 text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <ArrowLeft size={16} /> Đăng Nhập Ngay
                </button>
              </>
            ) : (
              <>
                <h3 className="text-3xl font-black tracking-tight">Chào Bạn Mới!</h3>
                <p className="text-sm text-amber-100/90 leading-relaxed">
                  Tạo tài khoản miễn phí để mở khóa xử lý hàng loạt, lưu trữ đám mây và bảo vệ file.
                </p>
                <button
                  onClick={() => toggleMode(true)}
                  className="px-8 py-3 rounded-xl bg-white text-black font-extrabold hover:bg-amber-50 transition-all shadow-xl hover:scale-105 active:scale-95 text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  Đăng Ký Ngay <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
