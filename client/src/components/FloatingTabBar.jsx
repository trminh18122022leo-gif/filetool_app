import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FloatingTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  const isHomePage = location.pathname === '/';

  // High-performance IntersectionObserver (Zero CPU / Zero Layout Thrashing)
  useEffect(() => {
    if (!isHomePage) {
      if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/login') || location.pathname.startsWith('/register')) {
        setActiveTab('personal');
      } else {
        setActiveTab('tools');
      }
      return;
    }

    const toolsEl = document.getElementById('tools');
    if (!toolsEl) {
      setActiveTab('home');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveTab('tools');
        } else {
          if (window.scrollY < (toolsEl.offsetTop - 300)) {
            setActiveTab('home');
          }
        }
      },
      { rootMargin: '-20% 0px -40% 0px', threshold: 0 }
    );

    observer.observe(toolsEl);

    // Light scroll handler for top of page detection (throttled via requestAnimationFrame)
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        if (window.scrollY < 200) {
          setActiveTab('home');
        }
        rafId = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isHomePage, location.pathname]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);

    if (tabId === 'home') {
      if (isHomePage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    } else if (tabId === 'tools') {
      if (isHomePage) {
        const toolsEl = document.getElementById('tools');
        if (toolsEl) {
          toolsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        navigate('/');
        setTimeout(() => {
          const toolsEl = document.getElementById('tools');
          if (toolsEl) {
            toolsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
    } else if (tabId === 'personal') {
      navigate('/dashboard');
    }
  };

  const tabs = [
    { id: 'home', label: 'Trang chủ', icon: Home },
    { id: 'tools', label: 'Công cụ', icon: LayoutGrid },
    { id: 'personal', label: user ? (user.name ? user.name.split(' ')[0] : 'Cá nhân') : 'Cá nhân', icon: User },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        left: '50%',
        transform: 'translateX(-50%) translateZ(0)',
        zIndex: 9999,
        pointerEvents: 'auto',
        touchAction: 'manipulation',
        WebkitTransform: 'translateX(-50%) translateZ(0)',
      }}
      className="select-none"
    >
      <nav
        aria-label="Thanh điều hướng nhanh iOS"
        className="relative flex items-center gap-1.5 p-1.5 rounded-full bg-[#0E0E14]/90 backdrop-blur-xl border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.9)] transition-all duration-300"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 select-none cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-amber-300 bg-gradient-to-r from-amber-500/30 via-amber-400/25 to-amber-500/30 border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]'
                  : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent active:scale-95'
              }`}
            >
              <Icon
                size={16}
                className={`transition-transform duration-200 shrink-0 ${
                  isActive ? 'text-amber-300 scale-110 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]' : 'text-gray-400'
                }`}
              />
              <span className="tracking-wide font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
