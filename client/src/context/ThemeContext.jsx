import { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'arctic-precision',
    name: 'Arctic Precision',
    description: 'Nordic cyan & obsidian slate',
    type: 'light',
    palette: ['#A8DCE7', '#101422', '#FFFFFF', '#272B3B'],
    isDefaultLight: true,
  },
  {
    id: 'ember-studio',
    name: 'Ember Studio',
    description: 'Cadmium ember & warm parchment',
    type: 'light',
    palette: ['#EB5B38', '#272A2D', '#E6E4DC', '#347CCB'],
  },
  {
    id: 'apple-modern',
    name: 'Apple Modern',
    description: 'Cupertino glass & system blue',
    type: 'light',
    palette: ['#F5F5F7', '#1D1D1F', '#AAAAAA', '#007AFF'],
  },
  {
    id: 'vibrant-sunset',
    name: 'Vibrant Sunset',
    description: 'Aubergine plum & magenta sunset',
    type: 'light',
    palette: ['#4D3A4D', '#BE5CA9', '#D59CC5', '#EADADA'],
  },
  {
    id: 'earthy-minimal',
    name: 'Earthy Minimal',
    description: 'Pine green, terracotta & calico',
    type: 'light',
    palette: ['#2E3A2F', '#6B7F5B', '#D9C9B2', '#C96F4F'],
  },
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    description: 'Midnight slate, neon cyan & violet',
    type: 'dark',
    palette: ['#0F172A', '#7C3AED', '#22D3EE', '#A788BF'],
    isDefaultDark: true,
  },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'midnight-neon';
    const saved = localStorage.getItem('filetools_theme_id');
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
    // Backward compatibility with 'light' / 'dark'
    const legacy = localStorage.getItem('filetools_theme');
    if (legacy === 'light') return 'arctic-precision';
    if (legacy === 'dark') return 'midnight-neon';

    // System preference fallback
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'arctic-precision';
    }
    return 'midnight-neon';
  });

  // Ambient Mode (Disabled by default for static-first performance & battery life)
  const [ambientMode, setAmbientModeState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('filetools_ambient_mode') === 'true';
  });

  const activeThemeMeta = THEMES.find(t => t.id === theme) || THEMES[5];
  const isDark = activeThemeMeta.type === 'dark';

  const applyThemeToDOM = (themeId, isDarkTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    if (isDarkTheme) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('filetools_theme', 'dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      localStorage.setItem('filetools_theme', 'light');
    }
    localStorage.setItem('filetools_theme_id', themeId);
    window.dispatchEvent(new Event('theme-change'));
  };

  useEffect(() => {
    applyThemeToDOM(theme, isDark);
  }, [theme, isDark]);

  const setTheme = (themeId) => {
    if (!THEMES.some(t => t.id === themeId)) return;
    setThemeState(themeId);
  };

  const toggleAmbientMode = () => {
    setAmbientModeState(prev => {
      const next = !prev;
      localStorage.setItem('filetools_ambient_mode', next ? 'true' : 'false');
      return next;
    });
  };

  const toggleLightDark = () => {
    // Quick toggle between default light and default dark
    if (isDark) {
      setTheme('arctic-precision');
    } else {
      setTheme('midnight-neon');
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        activeThemeMeta,
        isDark,
        themes: THEMES,
        setTheme,
        ambientMode,
        toggleAmbientMode,
        toggleLightDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
