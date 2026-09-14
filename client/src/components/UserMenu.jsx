import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, ChevronDown, Sparkles, Key, LogIn, UserPlus } from 'lucide-react';

// Tạo màu gradient nhất quán theo tên
function getAvatarColors(nameOrEmail = '') {
  const str = nameOrEmail.toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palettes = [
    'from-amber-500 via-orange-500 to-rose-500',
    'from-amber-400 via-amber-600 to-yellow-600',
    'from-rose-500 via-rose-600 to-orange-500',
    'from-orange-500 via-amber-500 to-yellow-500',
    'from-amber-500 via-rose-500 to-red-500',
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

// Chữ cái đầu từ tên hoặc email
function getInitial(user) {
  if (user?.name && user.name.trim().length > 0) {
    return user.name.trim()[0].toUpperCase();
  }
  if (user?.email) {
    return user.email[0].toUpperCase();
  }
  return 'U';
}

// Avatar gradient component
function AvatarInitial({ user, size = 'sm' }) {
  const initial = getInitial(user);
  const colors = getAvatarColors(user?.name || user?.email || '');
  const sizeClass = size === 'lg'
    ? 'w-10 h-10 text-sm font-black'
    : 'w-8 h-8 text-xs font-black';

  return (
    <div
      className={`${sizeClass} rounded-xl bg-gradient-to-tr ${colors} flex items-center justify-center text-black font-extrabold shadow-[0_0_14px_rgba(245,158,11,0.35)] group-hover:scale-105 transition-transform select-none`}
      aria-label={`Avatar của ${user?.name || 'bạn'}`}
    >
      {initial}
    </div>
  );
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const menuRef          = useRef(null);
  const navigate         = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className="glass-button flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold hover:border-amber-400/50 hover:text-amber-300 transition-all"
        >
          <LogIn size={14} />
          <span>Đăng nhập</span>
        </Link>
        <Link
          to="/register"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold liquid-gold-button"
        >
          <UserPlus size={14} />
          <span>Đăng ký</span>
        </Link>
      </div>
    );
  }

  const planBadges = {
    free:     'bg-white/5 text-gray-300 border-white/10',
    pro:      'bg-amber-950/80 text-amber-300 border-amber-600/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    business: 'bg-rose-950/80 text-rose-300 border-rose-600/50 shadow-[0_0_8px_rgba(251,113,133,0.25)]',
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-all text-left group cursor-pointer"
        title="Tài khoản của bạn (nhấp để mở menu)"
      >
        <AvatarInitial user={user} size="sm" />

        <div className="hidden sm:block text-left">
          <p className="text-xs font-bold text-gray-100 leading-tight truncate max-w-[110px] group-hover:text-amber-300 transition-colors">
            {user.name || user.email?.split('@')[0]}
          </p>
          <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md border mt-0.5 ${planBadges[user.plan] || planBadges.free}`}>
            {user.plan || 'Free'}
          </span>
        </div>

        <ChevronDown size={14} className={`text-gray-400 group-hover:text-white transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 border border-white/15 rounded-2xl p-2.5 shadow-[0_15px_45px_rgba(0,0,0,0.8)] z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl bg-[#0E0E14]/95">
          <div className="px-3 py-3 border-b border-white/10 mb-1.5 flex items-center gap-3">
            <div className="group shrink-0">
              <AvatarInitial user={user} size="lg" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span>{user.name || 'Thành viên'}</span>
                <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${planBadges[user.plan] || planBadges.free}`}>
                  {user.plan || 'Free'}
                </span>
              </p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/dashboard');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-400/30 transition-all text-left cursor-pointer"
            >
              <LayoutDashboard size={16} className="text-amber-400" />
              <span>Dashboard của tôi</span>
            </button>

            <Link
              to="/pricing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-amber-300 hover:bg-white/5 transition-colors"
            >
              <Sparkles size={15} className="text-amber-400" />
              <span>Nâng cấp gói Pro</span>
            </Link>

            <Link
              to="/api-docs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-amber-300 hover:bg-white/5 transition-colors"
            >
              <Key size={15} className="text-yellow-400" />
              <span>Tài liệu API</span>
            </Link>
          </div>

          <div className="border-t border-white/10 my-1.5 pt-1.5">
            <button
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/');
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
