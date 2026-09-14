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

  // Scroll Spy for Home Page
  useEffect(() => {
    if (!isHomePage) {
      if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/login') || location.pathname.startsWith('/register')) {
        setActiveTab('personal');
      } else {
        setActiveTab('tools');
      }
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      const heroEl = document.getElementById('hero');
      const toolsEl = document.getElementById('tools');
      const personalEl = document.getElementById('personal');

      const toolsTop = toolsEl ? toolsEl.offsetTop - 200 : 600;
      const personalTop = personalEl ? personalEl.offsetTop - 300 : 1800;

      if (scrollY >= personalTop) {
        setActiveTab('personal');
      } else if (scrollY >= toolsTop) {
        setActiveTab('tools');
      } else {
        setActiveTab('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
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
        navigate('/#tools');
      }
    } else if (tabId === 'personal') {
      if (user) {
        navigate('/dashboard');
      } else {
        if (isHomePage) {
          const personalEl = document.getElementById('personal');
          if (personalEl) {
            personalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            navigate('/login');
          }
        } else {
          navigate('/login');
        }
      }
    }
  };

  const tabs = [
    { id: 'home', label: 'Trang chủ', icon: Home },
    { id: 'tools', label: 'Công cụ', icon: LayoutGrid },
    { id: 'personal', label: user ? (user.name ? user.name.split(' ')[0] : 'Cá nhân') : 'Cá nhân', icon: User },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <nav
        aria-label="Thanh điều hướng nhanh iOS"
        className="relative flex items-center gap-1.5 p-1.5 rounded-full bg-[#0E0E14]/85 backdrop-blur-2xl border border-white/15 border-t-white/30 shadow-[0_16px_45px_rgba(0,0,0,0.85)]"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 select-none cursor-pointer ${
                isActive
                  ? 'text-amber-300 bg-gradient-to-r from-amber-500/25 via-amber-400/20 to-amber-500/25 border border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.03]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon
                size={16}
                className={`transition-transform duration-300 ${
                  isActive ? 'text-amber-300 scale-110 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'text-gray-400'
                }`}
              />
              <span className="tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
