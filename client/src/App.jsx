import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AppSidebar from './components/navigation/AppSidebar';
import TopBar from './components/navigation/TopBar';
import MobileNav from './components/navigation/MobileNav';
import NorthernLightsBackground from './components/backgrounds/NorthernLightsBackground';
import SolitudeSkyBackground from './components/backgrounds/SolitudeSkyBackground';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { Sparkles } from 'lucide-react';

// Code Splitting & Lazy Loading for all secondary pages
const PdfTools       = lazy(() => import('./pages/PdfTools'));
const PdfMergeTool   = lazy(() => import('./pages/PdfMergeTool'));
const PdfSplitTool   = lazy(() => import('./pages/PdfSplitTool'));
const PdfSignTool    = lazy(() => import('./pages/PdfSignTool'));
const PdfDeleteTool  = lazy(() => import('./pages/PdfDeleteTool'));
const PdfOrganizeTool = lazy(() => import('./pages/PdfOrganizeTool'));
const PdfRedactTool   = lazy(() => import('./pages/PdfRedactTool'));
const ImageTools     = lazy(() => import('./pages/ImageTools'));
const ConvertTools   = lazy(() => import('./pages/ConvertTools'));
const CreativeTools  = lazy(() => import('./pages/CreativeTools'));
const OfficeTools    = lazy(() => import('./pages/OfficeTools'));
const AiTools        = lazy(() => import('./pages/AiTools'));
const OcrTools       = lazy(() => import('./pages/OcrTools'));
const ArchiveTools   = lazy(() => import('./pages/ArchiveTools'));
const QrTools        = lazy(() => import('./pages/QrTools'));
const AdvancedEditor = lazy(() => import('./pages/AdvancedEditor'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const SignaturePage  = lazy(() => import('./pages/SignaturePage'));
const BatchTools     = lazy(() => import('./pages/BatchTools'));
const SpeechToText   = lazy(() => import('./pages/SpeechToText'));
const VideoTranslate = lazy(() => import('./pages/VideoTranslate'));
const VideoTools     = lazy(() => import('./pages/VideoTools'));
const PricingPage    = lazy(() => import('./pages/PricingPage'));
const ApiDocs        = lazy(() => import('./pages/ApiDocs'));
const WorkflowStudioPage = lazy(() => import('./pages/WorkflowStudioPage'));
const ToolsDirectoryPage = lazy(() => import('./pages/ToolsDirectoryPage'));
const PdfCompressTool    = lazy(() => import('./pages/PdfCompressTool'));
const PdfOcrTool         = lazy(() => import('./pages/PdfOcrTool'));
const WordToPdfTool      = lazy(() => import('./pages/WordToPdfTool'));
const ImageCompressTool  = lazy(() => import('./pages/ImageCompressTool'));
const SecurityPage       = lazy(() => import('./pages/SecurityPage'));
const PrivacyPolicyPage  = lazy(() => import('./pages/PrivacyPolicyPage'));
const GuidesPage         = lazy(() => import('./pages/GuidesPage'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail'));
const NotFound       = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
        <Sparkles size={22} className="animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <p className="text-xs text-gray-400 font-mono tracking-wider animate-pulse">Đang tải công cụ...</p>
    </div>
  );
}

export default function App() {
  const { user, login } = useAuth();
  const { ambientMode } = useTheme();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('filetools_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('filetools_sidebar_collapsed', next ? 'true' : 'false');
      return next;
    });
  };

  // Keyboard shortcut Ctrl+\ / Cmd+\ to toggle sidebar
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Handle Token / OAuth redirect & Capacitor deep links
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
    <div
      className="min-h-screen flex selection:bg-cyan-500 selection:text-black relative transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Skip to Content for Keyboard / Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-400 focus:text-slate-900 focus:font-bold focus:rounded-xl focus:shadow-2xl"
      >
        Chuyển tới nội dung chính
      </a>

      {/* ── CONDITIONAL AMBIENT BACKGROUNDS (Off by default for static-first performance) ── */}
      {ambientMode && (
        <>
          <NorthernLightsBackground />
          <SolitudeSkyBackground />
        </>
      )}

      {/* ── STATIC HARDWARE-ACCELERATED AMBIENT MESH (Zero continuous CPU draw) ── */}
      <div className="ambient-orb-container" aria-hidden="true">
        <div className="ambient-orb-gold" />
        <div className="ambient-orb-coral" />
        <div className="ambient-orb-bronze" />
      </div>

      {/* ── DESKTOP 3-PANE: LEFT COLLAPSIBLE APP SIDEBAR ── */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* ── PRIMARY WORKBENCH CONTAINER ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Desktop/Mobile Top Bar */}
        <TopBar
          onOpenMobileMenu={() => {}}
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={sidebarCollapsed}
        />

        {/* Dynamic Tool Workbench Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-28 lg:pb-12 relative z-10 focus:outline-none"
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tools" element={<ToolsDirectoryPage />} />
              <Route path="/pdf" element={<PdfTools />} />
              <Route path="/pdf/merge" element={<PdfMergeTool />} />
              <Route path="/pdf/split" element={<PdfSplitTool />} />
              <Route path="/pdf/compress" element={<PdfCompressTool />} />
              <Route path="/pdf/ocr" element={<PdfOcrTool />} />
              <Route path="/pdf/sign"  element={<PdfSignTool />} />
              <Route path="/pdf/delete" element={<PdfDeleteTool />} />
              <Route path="/pdf/organize" element={<PdfOrganizeTool />} />
              <Route path="/pdf/redact" element={<PdfRedactTool />} />
              <Route path="/image" element={<ImageTools />} />
              <Route path="/image/compress" element={<ImageCompressTool />} />
              <Route path="/convert" element={<ConvertTools />} />
              <Route path="/convert/word-to-pdf" element={<WordToPdfTool />} />
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
              <Route path="/video-translate" element={<VideoTranslate />} />
              <Route path="/video" element={<VideoTools />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/features/workflow-studio" element={<Navigate to="/workflows" replace />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/guides" element={<GuidesPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workflows" element={<WorkflowStudioPage />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        {/* System Footer */}
        <footer
          className="border-t py-6 text-center text-xs text-gray-500 relative z-10 transition-colors"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <p>© 2026 FileTools Pro — Nền tảng xử lý file tốc độ cao, bảo mật & chuẩn Apple HIG.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-gray-400">
              <Link to="/tools" className="hover:underline">Công cụ</Link>
              <span>•</span>
              <Link to="/pricing" className="hover:underline">Bảng giá</Link>
              <span>•</span>
              <Link to="/security" className="hover:underline">Bảo mật</Link>
              <span>•</span>
              <Link to="/privacy" className="hover:underline">Quyền riêng tư</Link>
              <span>•</span>
              <Link to="/guides" className="hover:underline">Hướng dẫn</Link>
              <span>•</span>
              <Link to="/api-docs" className="hover:underline">REST API</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION & OVERFLOW SHEET ── */}
      <MobileNav />
    </div>
  );
}
