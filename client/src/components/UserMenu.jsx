import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, CreditCard, LogOut, ChevronDown, User, Sparkles, Key } from 'lucide-react';

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
          className="text-xs font-medium text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-blue-900/30"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  const planBadges = {
    free:     'bg-gray-800 text-gray-400 border-gray-700',
    pro:      'bg-blue-950 text-blue-300 border-blue-800',
    business: 'bg-purple-950 text-purple-300 border-purple-800',
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow">
          {user.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-medium text-gray-200 leading-tight truncate max-w-[100px]">
            {user.name || user.email.split('@')[0]}
          </p>
          <span className={`inline-block text-[9px] uppercase font-bold px-1.5 rounded border ${planBadges[user.plan] || planBadges.free}`}>
            {user.plan || 'free'}
          </span>
        </div>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-gray-800/80 mb-1">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
          </div>

          <div className="space-y-0.5">
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <LayoutDashboard size={15} className="text-blue-400" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/pricing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <Sparkles size={15} className="text-purple-400" />
              <span>Nâng cấp gói</span>
            </Link>

            <Link
              to="/api-docs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <Key size={15} className="text-yellow-400" />
              <span>API Documentation</span>
            </Link>
          </div>

          <div className="border-t border-gray-800/80 my-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/');
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
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
