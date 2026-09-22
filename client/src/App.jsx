import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import GlobalSearch from './components/GlobalSearch';
import UserMenu from './components/UserMenu';
import PullCordSwitch from './components/PullCordSwitch';
import FloatingTabBar from './components/FloatingTabBar';
import NorthernLightsBackground from './components/backgrounds/NorthernLightsBackground';
import SolitudeSkyBackground from './components/backgrounds/SolitudeSkyBackground';
import { useAuth } from './context/AuthContext';
import {
  FileText, Image, Sparkles, Layers,
  ScanText, Archive, QrCode, ArrowRightLeft, Wand2, FileCode, Menu, X
} from 'lucide-react';

// Code Splitting & Lazy Loading for all 26 secondary pages
const PdfTools       = lazy(() => import('./pages/PdfTools'));
const PdfMergeTool   = lazy(() => import('./pages/PdfMergeTool'));
const PdfSplitTool   = lazy(() => import('./pages/PdfSplitTool'));
const PdfSignTool    = lazy(() => import('./pages/PdfSignTool'));
const PdfDeleteTool  = lazy(() => import('./pages/PdfDeleteTool'));
const PdfOrganizeTool = lazy(() => import('./pages/PdfOrganizeTool'));
const ImageTools     = lazy(() => import('./pages/ImageTools'));
const ConvertTools   = lazy(() => import('./pages/ConvertTools'));
const CreativeTools  = lazy(() => import('./pages/CreativeTools'));
const OfficeTools    = lazy(() => import('./pages/OfficeTools'));
const AiTools        = lazy(() => import('./pages/AiTools'));
const OcrTools       = lazy(() => import('./pages/OcrTools'));
const ArchiveTools   = lazy(() => import('./pages/ArchiveTools'));
const QrTools        = lazy(() => import('./pages/QrTools'));
const AdvancedEditor = lazy(() => import('./pages/AdvancedEditor'));
const Pricing        = lazy(() => import('./pages/Pricing'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const SignaturePage  = lazy(() => import('./pages/SignaturePage'));
const BatchTools     = lazy(() => import('./pages/BatchTools'));
const SpeechToText   = lazy(() => import('./pages/SpeechToText'));
const ApiDocs        = lazy(() => import('./pages/ApiDocs'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail'));
const NotFound       = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
        <Sparkles size={22} className="animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <p className="text-xs text-gray-400 font-mono tracking-wider animate-pulse">Đang tải công cụ...</p>
    </div>
  );
}

const NAV = [
  { path: '/pdf',       label: 'PDF',       icon: FileText },
  { path: '/image',     label: 'Hình ảnh',  icon: Image },
  { path: '/convert',   label: 'Convert',   icon: ArrowRightLeft },
  { path: '/creative',  label: 'Creative',  icon: Wand2 },
  { path: '/office',    label: 'Office',    icon: Layers },
  { path: '/ai',        label: 'AI Tools',  icon: Sparkles },
  { path: '/editor',    label: 'Editor',    icon: FileCode },
  { path: '/ocr',       label: 'OCR',       icon: ScanText },
  { path: '/archive',   label: 'Nén file',  icon: Archive },
  { path: '/qr',        label: 'QR Code',   icon: QrCode },
];

export default function App() {
  const { user, login } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => {
          if (d.user) login(d.user, token);
        })
        .catch(() => {});
    }
    // Capacitor Deep Link listener
    if (window.Capacitor?.isNativePlatform?.()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', data => {
          const url = new URL(data.url);
          const deepToken = url.searchParams.get('token');
          if (deepToken) {
            localStorage.setItem('token', deepToken);
            window.location.href = `/?token=${deepToken}`;
          }
        });
      });
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#08080C] text-[#111827] dark:text-[#F3F4F6] selection:bg-amber-500 selection:text-black relative transition-colors duration-200">
      {/* ── CEILING PULL CORD (Pullcord Switcher) ── */}
      <PullCordSwitch />

      {/* ── DUAL DYNAMIC THEME BACKGROUNDS ── */}
      {/* Khi tắt đèn: Bầu trời cực quang đêm (Northern Lights) */}
      <NorthernLightsBackground />
      {/* Khi bật đèn: Bầu trời mây biến hình Solitude Azure (10s seamless loop) */}
      <SolitudeSkyBackground />

      {/* ── 3 AMBIENT ORBS (High-Performance GPU composition) ── */}
      <div className="ambient-orb-container" aria-hidden="true">
        <div className="ambient-orb-gold" />
        <div className="ambient-orb-coral" />
        <div className="ambient-orb-bronze" />
      </div>

      {/* ── STICKY SOLID LIQUID GLASS HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#F8F9FA]/90 dark:bg-[#08080C]/90 backdrop-blur-xl border-b border-black/10 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-colors duration-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-6">
          <div className="flex items-center shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <img
                src="/logo.png"
                alt="FileTools Pro"
                className="h-9 w-auto group-hover:scale-105 transition-transform duration-200"
                style={{ filter: 'brightness(1.05) drop-shadow(0 0 10px rgba(245,158,11,0.35))' }}
              />
              <span className="font-black text-lg tracking-tight text-gradient hidden sm:inline">
                FileTools<span className="text-amber-700 dark:text-amber-300 text-xs ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-600/30 dark:border-amber-400/30 font-bold">PRO</span>
              </span>
            </Link>
          </div>

          <nav className="hidden xl:flex items-center gap-1.5 shrink-0">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  data-active={active}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-amber-500/20 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-600/40 dark:border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.15)] dark:shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <GlobalSearch />
            <UserMenu />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl glass-button text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-black/10 dark:border-white/10 bg-[#F8F9FA]/95 dark:bg-[#0C0C12]/95 backdrop-blur-2xl px-4 py-4 space-y-1 shadow-2xl">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  data-active={active}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-500/20 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-600/40 dark:border-amber-400/30'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT (Lazy Loaded with Suspense) ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-28">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pdf" element={<PdfTools />} />
            <Route path="/pdf/merge" element={<PdfMergeTool />} />
            <Route path="/pdf/split" element={<PdfSplitTool />} />
            <Route path="/pdf/sign"  element={<PdfSignTool />} />
            <Route path="/pdf/delete" element={<PdfDeleteTool />} />
            <Route path="/pdf/organize" element={<PdfOrganizeTool />} />
            <Route path="/image" element={<ImageTools />} />
            <Route path="/convert" element={<ConvertTools />} />
            <Route path="/creative" element={<CreativeTools />} />
            <Route path="/office" element={<OfficeTools />} />
            <Route path="/ai" element={<AiTools />} />
            <Route path="/editor" element={<AdvancedEditor />} />
            <Route path="/ocr" element={<OcrTools />} />
            <Route path="/archive" element={<ArchiveTools />} />
            <Route path="/qr" element={<QrTools />} />
            <Route path="/signature" element={<SignaturePage />} />
            <Route path="/batch" element={<BatchTools />} />
            <Route path="/speech" element={<SpeechToText />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {/* ── FLOATING BOTTOM TAB BAR (iOS Style) ── */}
      <FloatingTabBar />

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#08080C]/70 backdrop-blur-xl py-6 text-center text-xs text-gray-500 relative z-10">
        <p>© 2026 FileTools Pro — Nền tảng xử lý file trực tuyến tốc độ cao & bảo mật.</p>
      </footer>
    </div>
  );
}
