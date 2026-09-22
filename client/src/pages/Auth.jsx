import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2,
  ArrowRight, ArrowLeft, ShieldCheck, Sparkles
} from 'lucide-react';
import { JellyBlobMascot } from 'feral-blob';
import 'feral-blob/blob.css';
import { ClawCaptcha } from 'playcaptcha';
import 'playcaptcha/clawcaptcha.css';
import GlassyWisteriaBackground from '../components/backgrounds/GlassyWisteriaBackground';

const API = import.meta.env.VITE_API_URL || (!!(window.Capacitor?.isNativePlatform?.() || window.electronAPI) ? 'https://filetool-app.vercel.app' : '');
const isNative = !!(window.Capacitor?.isNativePlatform?.() || window.electronAPI);
const platform = window.electronAPI ? 'electron' : (window.Capacitor?.isNativePlatform?.() ? 'android' : '');
const platformQuery = platform ? `?platform=${platform}` : '';

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

  // Feral-Blob Mascot Companion states (Image 1 & 2)
  const [mascotMood, setMascotMood]       = useState('neutral');
  const [mascotGaze, setMascotGaze]       = useState({ x: 0, y: 0 });
  const [mascotNod, setMascotNod]         = useState(false);
  const [celebrateCount, setCelebrateCount] = useState(0);
  const [mascotNotice, setMascotNotice]   = useState('FileTools Companion luôn đồng hành cùng bạn!');

  // PlayCaptcha Claw Machine state & Password Complexity validation
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const hasMinLength = regPassword.length >= 8;
  const hasUpper     = /[A-Z]/.test(regPassword);
  const hasLower     = /[a-z]/.test(regPassword);
  const hasNumber    = /[0-9]/.test(regPassword);
  const hasSpecial   = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const isFormReady = regName.trim().length >= 2 && regEmail.trim().includes('@') && isPasswordValid;

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

  // Companion interactive handlers
  const handleEmailFocus = () => {
    setMascotMood('neutral');
    setMascotGaze({ x: 22, y: -6 });
    setMascotNod(true);
    setMascotNotice('Đang quan sát bạn nhập thông tin...');
  };

  const handlePasswordFocus = () => {
    setMascotMood('password');
    setMascotGaze({ x: -24, y: -10 });
    setMascotNod(false);
    setMascotNotice('Mascot nhắm mắt quay đi để giữ bí mật mật khẩu! 🙈');
  };

  const handleInputBlur = () => {
    setMascotMood('neutral');
    setMascotGaze({ x: 0, y: 0 });
    setMascotNod(false);
    setMascotNotice('');
  };

  const handleMascotPoke = () => {
    const pokeMoods = ['curious', 'surprised', 'shy', 'happy', 'sideEye'];
    const randomMood = pokeMoods[Math.floor(Math.random() * pokeMoods.length)];
    setMascotMood(randomMood);
    setMascotNotice('Boop! Bạn vừa tương tác với mascot!');
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

      setMascotMood('happy');
      setCelebrateCount(c => c + 1);
      setMascotNotice('Đăng nhập thành công! Hoan hô! 🎉');
      login(data.user, data.token);
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (err) {
      setMascotMood('sad');
      setMascotNotice('Đăng nhập chưa thành công, vui lòng kiểm tra lại!');
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

      setMascotMood('happy');
      setCelebrateCount(c => c + 1);
      setMascotNotice('Xác thực 2FA thành công! 🎉');
      login(data.user, data.token);
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (err) {
      setMascotMood('sad');
      setTwoFactorError(err.response?.data?.error || 'Mã xác thực 2FA không chính xác hoặc đã hết hạn.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!captchaVerified) {
      setRegError('Vui lòng gắp thú bông bên dưới để xác minh người thật trước khi tiếp tục!');
      setMascotMood('curious');
      setMascotNotice('Hãy hoàn thành trò chơi gắp thú bông trước nhé! 🧸');
      return;
    }

    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    try {
      const { data } = await axios.post(`${API}/api/auth/register`, {
        name: regName,
        email: regEmail,
        password: regPassword,
      }, { withCredentials: true });

      setMascotMood('happy');
      setCelebrateCount(c => c + 1);
      setMascotNotice('Chào mừng thành viên mới! Đăng ký thành công! 🎉');
      login(data.user, data.token);
      setRegSuccess('Đăng ký thành công! Đang chuyển hướng...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    } catch (err) {
      setMascotMood('sad');
      setMascotNotice('Đăng ký chưa thành công, hãy kiểm tra lại thông tin.');
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
    <div className="grid grid-cols-3 gap-2.5 mt-4">
      <a
        href={`${API}/api/auth/google${platformQuery}`}
        className="glass-button flex items-center justify-center gap-2 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
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
        href={`${API}/api/auth/github${platformQuery}`}
        className="glass-button flex items-center justify-center gap-2 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
        title="Tiếp tục với GitHub"
      >
        <svg className="w-4 h-4 fill-current flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        <span className="truncate">GitHub</span>
      </a>

      <button
        onClick={handleTelegramLogin}
        className="glass-button flex items-center justify-center gap-2 py-2.5 px-2 text-xs font-semibold hover:border-amber-400/50 hover:bg-white/10 transition-all group cursor-pointer"
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
    <GlassyWisteriaBackground className="w-full">
      <div className="w-full max-w-4xl mx-auto py-6 px-2 sm:px-4 relative z-10">
        {/* Mobile Fluid Mode Switcher */}
        <div className="md:hidden mb-6 relative p-1.5 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-xl flex shadow-lg">
          <div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl liquid-gold-button transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isRegister ? 'left-[calc(50%+3px)]' : 'left-1.5'
            }`}
          />
          <button
            onClick={() => toggleMode(false)}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              !isRegister ? 'text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn size={14} />
            <span>Đăng Nhập</span>
          </button>
          <button
            onClick={() => toggleMode(true)}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              isRegister ? 'text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus size={14} />
            <span>Đăng Ký</span>
          </button>
        </div>

        {/* Main Glass Container with Fluid Wave Cutout */}
        <div className="relative overflow-hidden rounded-3xl liquid-glass shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 min-h-[480px] flex">

          {/* ── 1. Left Section: Login Form ── */}
          <div
            className={`w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isRegister
                ? 'hidden md:flex opacity-20 scale-95 pointer-events-none md:pointer-events-auto'
                : 'flex opacity-100 scale-100'
            }`}
          >
            <div className="max-w-sm mx-auto w-full">
              {twoFactorChallenge ? (
                // 2FA Verification View
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white">Xác thực 2 Bước (2FA)</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Nhập mã 6 chữ số từ Authenticator của bạn</p>
                  </div>

                  {twoFactorError && (
                    <div className="p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2 text-red-400 text-xs">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                      <span>{twoFactorError}</span>
                    </div>
                  )}

                  <form onSubmit={handle2FASubmit} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        maxLength="6"
                        autoFocus
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        className="glass-input text-center text-xl tracking-[0.4em] font-mono py-2.5 focus:border-amber-400"
                        placeholder="000000"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={twoFactorLoading || totpCode.length < 6}
                      className="w-full liquid-gold-button py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {twoFactorLoading ? <><Loader2 size={16} className="animate-spin" /> Đang xác thực...</> : 'Xác Nhận & Đăng Nhập'}
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
                  {/* Feral-Blob Mascot Form Companion (Image 1 & 2) */}
                  <div className="flex flex-col items-center justify-center mb-2">
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 relative cursor-pointer group transition-transform hover:scale-105 active:scale-95"
                      onClick={handleMascotPoke}
                      title="Chạm vào để tương tác với companion!"
                    >
                      <JellyBlobMascot
                        mood={mascotMood}
                        gaze={mascotGaze}
                        nod={mascotNod}
                        celebrate={celebrateCount}
                        happyEyes="star"
                        className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(192,132,252,0.35)]"
                      />
                    </div>
                    {mascotNotice && (
                      <p className="text-[10px] font-medium text-purple-200 bg-purple-950/80 border border-purple-500/40 px-2.5 py-0.5 rounded-full animate-fadeIn mt-1 text-center shadow backdrop-blur-md max-w-xs">
                        {mascotNotice}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 mb-3 text-center">
                    <div className="luxury-badge mx-auto text-[10px] py-0.5 px-2">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>Chào mừng trở lại</span>
                    </div>
                    <h2 className="text-2xl font-extrabold gold-gradient-text flex items-center justify-center gap-2">
                      <LogIn size={22} className="text-amber-400" /> Đăng Nhập
                    </h2>
                    <p className="text-[11px] text-gray-400">Đăng nhập để quản lý file và tận hưởng công cụ Pro</p>
                  </div>

                  {(loginError || urlError) && (
                    <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{loginError || urlError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        onFocus={handleEmailFocus}
                        onBlur={handleInputBlur}
                        className="glass-input text-sm py-2.5"
                        placeholder="name@company.com"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-gray-300">Mật khẩu</label>
                        <Link to="/forgot-password" className="text-[11px] text-amber-400 hover:underline font-medium">
                          Quên mật khẩu?
                        </Link>
                      </div>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onFocus={handlePasswordFocus}
                        onBlur={handleInputBlur}
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
                    <span className="text-gray-400 text-[11px] uppercase font-semibold tracking-wider font-mono">Hoặc</span>
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

          {/* ── 2. Right Section: Register Form ── */}
          <div
            className={`w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              !isRegister
                ? 'hidden md:flex opacity-20 scale-95 pointer-events-none md:pointer-events-auto'
                : 'flex opacity-100 scale-100'
            }`}
          >
            <div className="max-w-sm mx-auto w-full">
              {/* Feral-Blob Mascot Form Companion (Image 1 & 2) */}
              <div className="flex flex-col items-center justify-center mb-2">
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 relative cursor-pointer group transition-transform hover:scale-105 active:scale-95"
                  onClick={handleMascotPoke}
                  title="Chạm vào để tương tác với companion!"
                >
                  <JellyBlobMascot
                    mood={mascotMood}
                    gaze={mascotGaze}
                    nod={mascotNod}
                    celebrate={celebrateCount}
                    happyEyes="star"
                    className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(192,132,252,0.35)]"
                  />
                </div>
                {mascotNotice && (
                  <p className="text-[10px] font-medium text-purple-200 bg-purple-950/80 border border-purple-500/40 px-2.5 py-0.5 rounded-full animate-fadeIn mt-1 text-center shadow backdrop-blur-md max-w-xs">
                    {mascotNotice}
                  </p>
                )}
              </div>

              <div className="space-y-1 mb-3 text-center">
                <div className="luxury-badge mx-auto text-[10px] py-0.5 px-2">
                  <Sparkles size={11} className="text-amber-400" />
                  <span>Khởi tạo tài khoản</span>
                </div>
                <h2 className="text-2xl font-extrabold gold-gradient-text flex items-center justify-center gap-2">
                  <UserPlus size={22} className="text-amber-400" /> Tạo Tài Khoản
                </h2>
                <p className="text-[11px] text-gray-400">Trải nghiệm không giới hạn mọi công cụ xử lý file</p>
              </div>

              {regError && (
                <div className="mb-3 p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="mb-3 p-2.5 bg-green-950/50 border border-green-800/60 rounded-xl flex items-start gap-2 text-green-400 text-xs">
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Họ và tên</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    onFocus={handleEmailFocus}
                    onBlur={handleInputBlur}
                    className="glass-input text-sm py-2"
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    onFocus={handleEmailFocus}
                    onBlur={handleInputBlur}
                    className="glass-input text-sm py-2"
                    placeholder="name@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    onFocus={handlePasswordFocus}
                    onBlur={handleInputBlur}
                    className="glass-input text-sm py-2"
                    placeholder="Mật khẩu bảo mật"
                    minLength={8}
                    required
                  />
                  {/* Password requirement badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${
                      hasMinLength ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>
                      {hasMinLength ? '✓' : '•'} ≥8 ký tự
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${
                      hasUpper ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>
                      {hasUpper ? '✓' : '•'} 1 Chữ hoa (A-Z)
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${
                      hasNumber ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>
                      {hasNumber ? '✓' : '•'} 1 Số (0-9)
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors ${
                      hasSpecial ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>
                      {hasSpecial ? '✓' : '•'} 1 Ký tự đặc biệt (!@#$)
                    </span>
                  </div>
                </div>

                {/* PlayCaptcha Claw Machine (Chỉ hiện sau khi người dùng đã nhập đúng và đủ yêu cầu) */}
                <div className="pt-1">
                  {!captchaVerified ? (
                    isFormReady ? (
                      <div className="rounded-2xl bg-black/60 border border-purple-500/30 p-2 overflow-hidden flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between w-full px-2 mb-1">
                          <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-purple-400" />
                            Bước cuối: Gắp thú bông để xác minh
                          </label>
                          <span className="text-[10px] text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
                            Xác minh người thật
                          </span>
                        </div>
                        <div className="scale-[0.8] sm:scale-[0.85] origin-top -mb-12 sm:-mb-8">
                          <ClawCaptcha
                            onVerify={() => {
                              setCaptchaVerified(true);
                              setMascotMood('happy');
                              setCelebrateCount(c => c + 1);
                              setMascotNotice('Gắp trúng rồi! Bạn đã hoàn thành xác minh! 🎉');
                              setRegError(null);
                            }}
                            title="Gắp thú bông để tiếp tục"
                            assetBase="/toys/"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center text-[11px] text-gray-400 flex items-center justify-center gap-2">
                        <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                        <span>Nhập đủ Họ tên, Email và Mật khẩu (≥8 ký tự, có chữ hoa, số & ký tự đặc biệt) để mở máy gắp thú</span>
                      </div>
                    )
                  ) : (
                    <div className="p-2 text-center text-xs text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-center gap-2 animate-in fade-in duration-200">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      <span>Đã xác minh người thật thành công ✓</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={regLoading || !captchaVerified}
                  className="w-full mt-1.5 liquid-gold-button py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {regLoading ? <><Loader2 size={16} className="animate-spin" /> Đang tạo tài khoản...</> : 'Tạo Tài Khoản'}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-400 text-[11px] uppercase font-semibold tracking-wider font-mono">Hoặc</span>
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

          {/* ── 3. Fluid Organic Curved Wave Sliding Overlay (Desktop >= md) ── */}
          <div
            className={`hidden md:flex absolute top-0 w-1/2 h-full z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] items-center justify-center text-center p-12 text-white shadow-2xl overflow-hidden ${
              isRegister ? 'translate-x-0 left-0' : 'translate-x-full left-0'
            }`}
          >
            {/* Rich Gradient Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-orange-700 to-rose-950 backdrop-blur-3xl" />

            {/* Organic Curved Wave Mask Border */}
            <div
              className={`absolute top-0 bottom-0 w-16 pointer-events-none transition-all duration-700 ${
                isRegister ? 'right-0 translate-x-full rotate-180' : 'left-0 -translate-x-full'
              }`}
            >
              <svg
                className="h-full w-16 fill-orange-700 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                viewBox="0 0 100 1000"
                preserveAspectRatio="none"
              >
                <path d="M0,0 Q80,250 20,500 T0,1000 L100,1000 L100,0 Z" />
              </svg>
            </div>

            {/* Dynamic Floating Glow Orbs inside Overlay */}
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-400/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-rose-500/30 rounded-full blur-3xl pointer-events-none" />

            {/* Content inside Overlay with Spring Fade */}
            <div className="relative z-10 space-y-6 max-w-xs transition-transform duration-500">
              {isRegister ? (
                <>
                  <div className="inline-flex p-3 rounded-2xl bg-white/10 border border-white/20 shadow-inner">
                    <LogIn size={28} className="text-amber-200" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">Đã Có Tài Khoản?</h3>
                  <p className="text-sm text-amber-100/90 leading-relaxed font-normal">
                    Đăng nhập để tiếp tục làm việc với các tài liệu và kho công cụ xử lý file tốc độ cao của bạn!
                  </p>
                  <button
                    onClick={() => toggleMode(false)}
                    className="px-8 py-3 rounded-2xl bg-white text-black font-extrabold hover:bg-amber-50 transition-all shadow-[0_10px_25px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                    <span>Đăng Nhập Ngay</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex p-3 rounded-2xl bg-white/10 border border-white/20 shadow-inner">
                    <UserPlus size={28} className="text-amber-200" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">Chào Bạn Mới!</h3>
                  <p className="text-sm text-amber-100/90 leading-relaxed font-normal">
                    Tạo tài khoản miễn phí để mở khóa xử lý hàng loạt, lưu trữ đám mây, chữ ký số và AI thông minh.
                  </p>
                  <button
                    onClick={() => toggleMode(true)}
                    className="px-8 py-3 rounded-2xl bg-white text-black font-extrabold hover:bg-amber-50 transition-all shadow-[0_10px_25px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    <span>Đăng Ký Ngay</span>
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </GlassyWisteriaBackground>
  );
}
