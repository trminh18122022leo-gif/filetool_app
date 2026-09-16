import { useState, useEffect } from 'react';

/**
 * Animated Physics Theme Toggle (Sun ↔ Moon Morph with Spring Physics & Particles)
 * Tự động đồng bộ với localStorage và document.documentElement
 */
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('filetools_theme');
      if (saved) return saved === 'dark';
      return !document.documentElement.classList.contains('light');
    }
    return true;
  });

  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('filetools_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('filetools_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setAnimating(true);
    setIsDark(prev => !prev);
    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl transition-all duration-300 select-none cursor-pointer group ${
        isDark
          ? 'bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 hover:border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
          : 'bg-black/5 hover:bg-black/10 text-amber-600 border border-black/10 hover:border-amber-500/40 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
      } ${animating ? 'scale-90 active:scale-95' : 'hover:scale-105'} ${className}`}
      title={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
      aria-label="Toggle Dark/Light Mode"
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        {/* ── Sun & Rays (Active in Light Mode) ── */}
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark
              ? 'opacity-0 rotate-90 scale-0 pointer-events-none'
              : 'opacity-100 rotate-0 scale-100 text-amber-500'
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Central Sun Disc */}
          <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.2" />
          {/* Spring Sun Rays */}
          <line x1="12" y1="1" x2="12" y2="3" className="transition-transform duration-300" />
          <line x1="12" y1="21" x2="12" y2="23" className="transition-transform duration-300" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>

        {/* ── Moon & Stars (Active in Dark Mode) ── */}
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-300'
              : 'opacity-0 -rotate-90 scale-0 pointer-events-none'
          }`}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fillOpacity="0.25" />
          {/* Twinkle Stars */}
          <circle cx="17" cy="6" r="1" className="animate-pulse" fill="#FDE68A" />
          <circle cx="20" cy="10" r="0.75" className="animate-ping" style={{ animationDuration: '3s' }} fill="#FBBF24" />
        </svg>
      </div>

      {/* Physics Click Ripple Sheen */}
      <span
        className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-500 ${
          animating
            ? isDark
              ? 'bg-amber-400/20 opacity-100 scale-125'
              : 'bg-amber-600/20 opacity-100 scale-125'
            : 'opacity-0 scale-100'
        }`}
      />
    </button>
  );
}
