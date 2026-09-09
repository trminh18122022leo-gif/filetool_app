import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home         from './pages/Home';
import PdfTools     from './pages/PdfTools';
import PdfMergeTool from './pages/PdfMergeTool';
import PdfSplitTool from './pages/PdfSplitTool';
import PdfSignTool  from './pages/PdfSignTool';
import PdfDeleteTool from './pages/PdfDeleteTool';
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
import ApiDocs      from './pages/ApiDocs';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail  from './pages/VerifyEmail';
import NotFound     from './pages/NotFound';
import GlobalSearch from './components/GlobalSearch';
import UserMenu     from './components/UserMenu';
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
    <div className="min-h-screen flex flex-col bg-[#0A0A0F] text-[#E2E8F0] selection:bg-pink-500 selection:text-white">
      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-2xl border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <img
                src="/logo.png"
                alt="FileTools Pro"
                className="h-9 w-auto group-hover:scale-105 transition-transform duration-200"
                style={{ filter: 'brightness(1.05) drop-shadow(0 0 8px rgba(59,195,170,0.3))' }}
              />
              <span className="font-extrabold text-lg tracking-tight text-gradient hidden sm:inline">
                FileTools<span className="text-white text-xs ml-1 px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10">PRO</span>
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
                      ? 'bg-white/10 text-white border border-white/10 shadow-inner'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-pink-400' : 'text-gray-400'} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <UserMenu />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl glass-button"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-black/90 backdrop-blur-2xl px-4 py-4 space-y-1">
            {NAV.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10"
              >
                <Icon size={16} className="text-pink-400" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pdf" element={<PdfTools />} />
          <Route path="/pdf/merge" element={<PdfMergeTool />} />
          <Route path="/pdf/split" element={<PdfSplitTool />} />
          <Route path="/pdf/sign"  element={<PdfSignTool />} />
          <Route path="/pdf/delete" element={<PdfDeleteTool />} />
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

      <footer className="border-t border-white/5 bg-black/40 backdrop-blur-xl py-6 text-center text-xs text-gray-500">
        <p>© 2026 FileTools Pro — Nền tảng xử lý file trực tuyến tốc độ cao & bảo mật.</p>
      </footer>
    </div>
  );
}
