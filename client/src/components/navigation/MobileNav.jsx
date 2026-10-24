import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, FileText, Wand2, LayoutDashboard, MoreHorizontal,
  X, Image, Layers, Sparkles, FileCode, ScanText, Archive,
  QrCode, ArrowRightLeft, Mic, Terminal
} from 'lucide-react';
import ThemeSelector from './ThemeSelector';

const MORE_TOOLS = [
  { to: '/image', label: 'Xử lý Ảnh & Vector', icon: Image },
  { to: '/office', label: 'Office Converter', icon: FileText },
  { to: '/convert', label: 'Convert Đa Năng', icon: ArrowRightLeft },
  { to: '/editor', label: 'Monaco Editor Code', icon: FileCode },
  { to: '/ai', label: 'AI Tóm tắt & Dịch', icon: Sparkles },
  { to: '/ocr', label: 'OCR Nhận Dạng Chữ', icon: ScanText },
  { to: '/speech', label: 'Speech to Text', icon: Mic },
  { to: '/archive', label: 'Nén & Giải nén ZIP', icon: Archive },
  { to: '/qr', label: 'Tạo mã QR & Barcode', icon: QrCode },
  { to: '/api-docs', label: 'REST API Docs', icon: Terminal },
];

export default function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  const primaryTabs = [
    { to: '/', label: 'Trang chủ', icon: Home, exact: true },
    { to: '/pdf', label: 'PDF Studio', icon: FileText },
    { to: '/creative', label: 'Sáng tạo', icon: Wand2 },
    { to: '/dashboard', label: 'Tệp cá nhân', icon: LayoutDashboard },
  ];

  return (
    <>
      {/* ── Fixed Mobile Bottom Nav Bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-xl transition-colors pb-[env(safe-area-inset-bottom)]"
        style={{
          backgroundColor: 'var(--bg-overlay)',
          borderColor: 'var(--border-subtle)',
        }}
        aria-label="Điều hướng di động"
      >
        <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2">
          {primaryTabs.map(({ to, label, icon: Icon, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center justify-center flex-1 h-full min-w-[56px] min-h-[44px] transition-colors relative"
                style={{
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                <Icon size={20} className={active ? 'scale-110 transition-transform' : ''} />
                <span className="text-[10px] font-medium mt-1 leading-none truncate max-w-[64px]">
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute top-1 w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  />
                )}
              </NavLink>
            );
          })}

          {/* More Sheet Trigger Button */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full min-w-[56px] min-h-[44px] transition-colors cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            aria-label="Xem thêm danh mục công cụ"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium mt-1 leading-none">Thêm</span>
          </button>
        </div>
      </nav>

      {/* ── Sliding Bottom Sheet Drawer ── */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet Body */}
          <div
            className="relative w-full max-h-[82vh] rounded-t-3xl border-t p-5 shadow-2xl flex flex-col overflow-hidden pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-gray-400/40 mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-inherit mb-3">
              <span className="font-bold text-sm tracking-tight">Tất Cả Công Cụ & Tùy Chọn</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 cursor-pointer"
                aria-label="Đóng bảng công cụ"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Theme Controls */}
            <div className="py-2 mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-400">Chủ đề giao diện:</span>
              <ThemeSelector compact={false} />
            </div>

            {/* Tool Items Grid */}
            <div className="overflow-y-auto flex-1 grid grid-cols-2 gap-2 pt-1 pb-4">
              {MORE_TOOLS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSheetOpen(false)}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-inherit hover:bg-black/5 dark:hover:bg-white/5 transition-all text-xs font-medium"
                >
                  <Icon size={18} style={{ color: 'var(--accent-primary)' }} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
