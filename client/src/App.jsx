import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  FileText, Image, Archive, Sparkles,
  FileOutput, ScanText, PenLine, Layers,
  QrCode, Code, ShieldCheck, Heart
} from 'lucide-react';

import AuthGuard      from './components/AuthGuard';
import UserMenu       from './components/UserMenu';

import Home           from './pages/Home';
import PdfTools       from './pages/PdfTools';
import ImageTools     from './pages/ImageTools';
import OfficeTools    from './pages/OfficeTools';
import ArchiveTools   from './pages/ArchiveTools';
import OcrTools       from './pages/OcrTools';
import AiTools        from './pages/AiTools';
import BatchTools     from './pages/BatchTools';
import QrTools        from './pages/QrTools';
import SignaturePage  from './pages/SignaturePage';

import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import Pricing        from './pages/Pricing';
import ApiDocs        from './pages/ApiDocs';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import VerifyEmail    from './pages/VerifyEmail';
import NotFound       from './pages/NotFound';

const NAV_LINKS = [
  { to: '/pdf',       label: 'PDF',       icon: FileText },
  { to: '/image',     label: 'Ảnh',       icon: Image },
  { to: '/office',    label: 'Office',    icon: FileOutput },
  { to: '/ocr',       label: 'OCR',       icon: ScanText },
  { to: '/archive',   label: 'Archive',   icon: Archive },
  { to: '/ai',        label: 'AI Tools',  icon: Sparkles },
  { to: '/batch',     label: 'Batch',     icon: Layers },
  { to: '/qr',        label: 'QR Code',   icon: QrCode },
  { to: '/signature', label: 'E-Sign',    icon: PenLine },
];

function Navbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/80">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/30 group-hover:scale-105 transition-transform">
            <Layers size={20} />
          </div>
          <div>
            <span className="font-extrabold text-white text-base tracking-tight group-hover:text-blue-400 transition-colors">
              FileTools<span className="text-blue-500">Pro</span>
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-850'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/api-docs"
            className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Code size={13} />
            <span>API</span>
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-900 bg-gray-950/50 py-10 mt-20 text-center text-xs text-gray-500">
      <div className="max-w-7xl mx-auto px-4 space-y-3">
        <div className="flex flex-wrap justify-center gap-6 text-gray-400">
          <Link to="/pdf" className="hover:text-white transition-colors">PDF Tools</Link>
          <Link to="/image" className="hover:text-white transition-colors">Image Tools</Link>
          <Link to="/office" className="hover:text-white transition-colors">Office</Link>
          <Link to="/ocr" className="hover:text-white transition-colors">OCR</Link>
          <Link to="/ai" className="hover:text-white transition-colors">AI Tools</Link>
          <Link to="/pricing" className="hover:text-white transition-colors">Bảng giá</Link>
          <Link to="/api-docs" className="hover:text-white transition-colors">API Docs</Link>
        </div>
        <p className="flex items-center justify-center gap-1 text-gray-500">
          <span>&copy; {new Date().getFullYear()} FileTools Pro. Hoạt động trên Local Machine & Cloud.</span>
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pdf" element={<PdfTools />} />
            <Route path="/image" element={<ImageTools />} />
            <Route path="/office" element={<OfficeTools />} />
            <Route path="/archive" element={<ArchiveTools />} />
            <Route path="/ocr" element={<OcrTools />} />
            <Route path="/ai" element={<AiTools />} />
            <Route path="/batch" element={<BatchTools />} />
            <Route path="/qr" element={<QrTools />} />
            <Route path="/signature" element={<SignaturePage />} />

            {/* Auth & User */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/api-docs" element={<ApiDocs />} />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
