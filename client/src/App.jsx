import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home         from './pages/Home';
import PdfTools     from './pages/PdfTools';
import PdfMergeTool from './pages/PdfMergeTool';
import PdfSplitTool from './pages/PdfSplitTool';
import PdfSignTool  from './pages/PdfSignTool';
import PdfDeleteTool from './pages/PdfDeleteTool';
import PdfOrganizeTool from './pages/PdfOrganizeTool';
import ImageTools   from './pages/ImageTools';
import ConvertTools from './pages/ConvertTools';
import CreativeTools from './pages/CreativeTools';
import OfficeTools  from './pages/OfficeTools';
import AiTools      from './pages/AiTools';
import OcrTools     from './pages/OcrTools';
import ArchiveTools from './pages/ArchiveTools';
import QrTools      from './pages/QrTools';
import Pricing      from './pages/Pricing';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import SignaturePage from './pages/SignaturePage';
import BatchTools   from './pages/BatchTools';
import SpeechToText from './pages/SpeechToText';
import ApiDocs      from './pages/ApiDocs';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail  from './pages/VerifyEmail';
import NotFound     from './pages/NotFound';
import GlobalSearch from './components/GlobalSearch';
import UserMenu     from './components/UserMenu';
import FloatingTabBar from './components/FloatingTabBar';
import { useAuth }    from './context/AuthContext';
import {
  FileText, Image, Sparkles, Layers,
  ScanText, Archive, QrCode, ArrowRightLeft, Wand2, Menu, X
} from 'lucide-react';

const NAV = [
  { path: '/pdf',       label: 'PDF',       icon: FileText },
  { path: '/image',     label: 'Hình ảnh',  icon: Image },
  { path: '/convert',   label: 'Convert',   icon: ArrowRightLeft },
  { path: '/creative',  label: 'Creative',  icon: Wand2 },
  { path: '/office',    label: 'Office',    icon: Layers },
  { path: '/ai',        label: 'AI Tools',  icon: Sparkles },
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
      // Fetch user info for OAuth login
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => {
          if (d.user) login(d.user, token);
        })
        .catch(() => {});
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-[#08080C] text-[#F3F4F6] selection:bg-amber-500 selection:text-black relative">
      {/* ── 3 AMBIENT ORBS (Champagne Gold, Warm Coral, Bronze) ── */}
      <div className="ambient-orb-container" aria-hidden="true">
        <div className="ambient-orb-gold" />
        <div className="ambient-orb-coral" />
        <div className="ambient-orb-bronze" />
      </div>

      {/* ── STICKY SOLID LIQUID GLASS HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#08080C]/90 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <img
                src="/logo.png"
                alt="FileTools Pro"
                className="h-9 w-auto group-hover:scale-105 transition-transform duration-200"
                style={{ filter: 'brightness(1.05) drop-shadow(0 0 10px rgba(245,158,11,0.35))' }}
              />
              <span className="font-black text-lg tracking-tight text-gradient hidden sm:inline">
                FileTools<span className="text-amber-300 text-xs ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30">PRO</span>
              </span>
            </Link>
            <GlobalSearch />
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-amber-400' : 'text-gray-400'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <UserMenu />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl glass-button text-gray-300 hover:text-white"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-[#0C0C12]/95 backdrop-blur-2xl px-4 py-4 space-y-1 shadow-2xl">
            {NAV.map(({ path, label, icon: Icon }) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-amber-400' : 'text-gray-400'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-28">
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
