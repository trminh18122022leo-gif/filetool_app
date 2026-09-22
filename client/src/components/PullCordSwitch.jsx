import { useState, useEffect } from 'react';
import { PullCord } from 'pullcord';
import 'pullcord/pullcord.css';

export default function PullCordSwitch() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('filetools_theme');
      if (saved) return saved === 'dark';
      return !document.documentElement.classList.contains('light');
    }
    return true;
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const currentDark = !document.documentElement.classList.contains('light');
      setIsDark(currentDark);
    };

    window.addEventListener('theme-change', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('theme-change', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  const handlePull = () => {
    setIsDark(prev => {
      const nextDark = !prev;
      if (nextDark) {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('filetools_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('filetools_theme', 'light');
      }
      window.dispatchEvent(new Event('theme-change'));
      return nextDark;
    });
  };

  return (
    <aside
      aria-label="Công tắc đèn trần"
      className="fixed top-0 right-12 sm:right-24 md:right-32 pointer-events-auto"
      style={{
        zIndex: 9999,
        '--pullcord-top': '0px',
        '--pullcord-z': 9999,
        '--pullcord-ink': isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
      }}
    >
      <PullCord
        onPull={handlePull}
        pulled={!isDark}
        ariaLabel="Bật tắt chế độ sáng tối"
        config={{
          gravity: 1600,
          damping: 0.968,
          iterations: 24,
          stretchMax: 85,
          stretchToggle: 38,
          maxVelocity: 55,
          sleepVelocity: 0.08,
        }}
      />
    </aside>
  );
}
