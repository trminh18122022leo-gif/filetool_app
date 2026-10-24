import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Palette, Check, Sparkles, Moon, Sun } from 'lucide-react';

export default function ThemeSelector({ compact = false }) {
  const { theme, themes, setTheme, ambientMode, toggleAmbientMode, isDark, toggleLightDark } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  const activeTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div className="flex items-center gap-1.5">
        {/* Quick Dark/Light Toggle */}
        <button
          type="button"
          onClick={toggleLightDark}
          className="p-2 rounded-xl transition-all duration-150 cursor-pointer border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          aria-label="Chuyển chế độ Sáng / Tối"
        >
          {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
        </button>

        {/* Theme Picker Trigger */}
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-xs font-semibold cursor-pointer text-gray-800 dark:text-gray-200"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Chọn chủ đề giao diện (6 themes)"
        >
          <div className="flex items-center -space-x-1">
            {activeTheme.palette.slice(0, 3).map((hex, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full ring-1 ring-black/20 dark:ring-white/20"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          {!compact && <span className="hidden sm:inline">{activeTheme.name}</span>}
          <Palette size={14} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Danh sách 6 chủ đề giao diện"
          className="absolute right-0 mt-2 w-72 rounded-2xl p-2.5 shadow-2xl z-50 border border-black/10 dark:border-white/10 backdrop-blur-2xl transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="px-2.5 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            6 Giao Diện Chuẩn Apple & WCAG AA
          </div>

          <div className="space-y-1">
            {themes.map(t => {
              const selected = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                    selected
                      ? 'bg-black/10 dark:bg-white/10 font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center -space-x-1 shrink-0">
                      {t.palette.map((color, i) => (
                        <span
                          key={i}
                          className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="font-medium text-xs leading-none mb-0.5">{t.name}</div>
                      <div className="text-[10px] text-gray-400">{t.description}</div>
                    </div>
                  </div>
                  {selected && <Check size={14} className="text-cyan-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Ambient Mode Toggle */}
          <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 px-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className={ambientMode ? 'text-amber-400 animate-pulse' : 'text-gray-400'} />
              <div>
                <div className="text-xs font-semibold">Chế độ Ambient</div>
                <div className="text-[10px] text-gray-400">Video & Canvas (tắt để tiết kiệm pin)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleAmbientMode}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                ambientMode ? 'bg-amber-500' : 'bg-gray-400/40'
              }`}
              aria-label="Bật tắt chế độ Ambient nền"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  ambientMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
