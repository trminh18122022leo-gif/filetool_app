import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FileText, Image, Wand2, Film, Layers, Sparkles, FileCode,
  ScanText, Archive, QrCode, ArrowRightLeft, Mic, FolderArchive,
  ChevronLeft, ChevronRight, Home, LayoutDashboard, Terminal,
  ShieldAlert, Scissors, PenTool, CreditCard, BookOpen, Grid
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Không Gian Chính',
    items: [
      { to: '/', label: 'Trang chủ', icon: Home },
      { to: '/tools', label: 'Tất cả công cụ', icon: Grid },
      { to: '/pricing', label: 'Bảng Giá & Gói', icon: CreditCard },
      { to: '/dashboard', label: 'Tệp cá nhân & Job', icon: LayoutDashboard },
      { to: '/workflows', label: 'Workflow Studio', icon: Wand2 },
    ],
  },
  {
    title: 'Tài Liệu & PDF',
    items: [
      { to: '/pdf', label: 'PDF Hub', icon: FileText },
      { to: '/pdf/merge', label: 'Gộp PDF', icon: Layers },
      { to: '/pdf/split', label: 'Tách PDF', icon: Scissors },
      { to: '/pdf/sign', label: 'Ký số', icon: PenTool },
      { to: '/pdf/redact', label: 'Che PII Redact', icon: ShieldAlert },
    ],
  },
  {
    title: 'Ảnh & Media AI',
    items: [
      { to: '/image', label: 'Ảnh & Vector', icon: Image },
      { to: '/creative', label: 'Creative Shorts', icon: Wand2 },
      { to: '/video', label: 'Video Studio', icon: Film },
    ],
  },
  {
    title: 'Dữ Liệu & Office',
    items: [
      { to: '/office', label: 'Office Converter', icon: FileText },
      { to: '/convert', label: 'Convert Đa Năng', icon: ArrowRightLeft },
      { to: '/editor', label: 'Monaco Editor', icon: FileCode },
    ],
  },
  {
    title: 'Tiện Ích & AI',
    items: [
      { to: '/ai', label: 'AI Trợ Lý', icon: Sparkles },
      { to: '/ocr', label: 'OCR Nhận Dạng', icon: ScanText },
      { to: '/speech', label: 'Speech-to-Text', icon: Mic },
      { to: '/archive', label: 'Nén ZIP', icon: Archive },
      { to: '/qr', label: 'QR Studio', icon: QrCode },
      { to: '/batch', label: 'Xử lý Hàng Loạt', icon: FolderArchive },
    ],
  },
  {
    title: 'Hỗ Trợ & API',
    items: [
      { to: '/guides', label: 'Hướng dẫn sử dụng', icon: BookOpen },
      { to: '/api-docs', label: 'REST API Docs', icon: Terminal },
    ],
  },
];

export default function AppSidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 border-r transition-all duration-200 z-30 select-none ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Thanh điều hướng chính"
    >
      {/* Sidebar Header / Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-inherit">
        <NavLink to="/" className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/logo.png"
            alt="FileTools Pro"
            className="h-8 w-8 shrink-0 object-contain"
            style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.35))' }}
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight leading-none text-gradient">
                FileTools<span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-400">PRO</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono tracking-wider mt-0.5">Desktop 2026</span>
            </div>
          )}
        </NavLink>

        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          title={collapsed ? 'Mở rộng sidebar (Ctrl+\\)' : 'Thu gọn sidebar (Ctrl+\\)'}
          aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav Link Groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {SECTIONS.map((sec, idx) => (
          <div key={idx}>
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {sec.title}
              </div>
            )}
            <div className="space-y-0.5">
              {sec.items.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <NavLink
                    key={to}
                    to={to}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? 'font-semibold shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--accent-subtle)',
                            color: 'var(--text-primary)',
                            borderColor: 'var(--border-subtle)',
                            boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                          }
                        : {}
                    }
                  >
                    <Icon
                      size={18}
                      className="shrink-0"
                      style={active ? { color: 'var(--accent-primary)' } : {}}
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-inherit text-center">
        {!collapsed ? (
          <div className="text-[11px] text-gray-400">
            <div>Engine: <span className="text-emerald-500 font-mono font-semibold">Ready</span></div>
            <div className="text-[10px] opacity-75 mt-0.5">BullMQ &bull; Render Worker</div>
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto" title="Worker Online" />
        )}
      </div>
    </aside>
  );
}
