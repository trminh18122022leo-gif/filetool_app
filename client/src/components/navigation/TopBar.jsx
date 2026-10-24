import { Link } from 'react-router-dom';
import GlobalSearch from '../GlobalSearch';
import UserMenu from '../UserMenu';
import ThemeSelector from './ThemeSelector';
import { Menu, Search, Command } from 'lucide-react';

export default function TopBar({ onOpenMobileMenu, onToggleSidebar, isSidebarCollapsed }) {
  return (
    <header
      className="sticky top-0 z-40 h-16 border-b transition-colors select-none backdrop-blur-xl"
      style={{
        backgroundColor: 'var(--bg-overlay)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Mobile Menu Trigger + Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            aria-label="Toggle Sidebar"
            title="Đóng / mở thanh bên"
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            aria-label="Mở menu trên điện thoại"
          >
            <Menu size={18} />
          </button>

          <Link to="/" className="flex items-center gap-2 group lg:hidden">
            <img
              src="/logo.png"
              alt="FileTools Pro"
              className="h-8 w-8 object-contain"
            />
            <span className="font-black text-sm tracking-tight text-gradient">
              FileTools<span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 font-bold">PRO</span>
            </span>
          </Link>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-xl mx-2 hidden sm:block">
          <GlobalSearch />
        </div>

        {/* Right: Quick Search Button on Mobile + Theme Selector + User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="sm:hidden">
            <GlobalSearch />
          </div>

          {/* 6 Semantic Themes Picker & Ambient Mode */}
          <ThemeSelector />

          {/* User Account / Login Avatar */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
