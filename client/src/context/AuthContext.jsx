import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || '';
let refreshPromise = null;

export function AuthProvider({ children }) {
  // 1. Initialize user from localStorage if available
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  // 2. Initialize token from URL query params (OAuth redirect) or localStorage
  const [token, setToken] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('token', urlToken);
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('token');
          const cleanSearch = cleanUrl.searchParams.toString();
          window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanSearch ? `?${cleanSearch}` : '') + cleanUrl.hash);
        } catch (_) {}
        return urlToken;
      }
    } catch (_) {}
    return localStorage.getItem('token') || null;
  });

  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const newToken = data.accessToken || data.token;
          if (newToken) {
            localStorage.setItem('token', newToken);
            setToken(newToken);
            if (data.user) {
              setUser(data.user);
              localStorage.setItem('user', JSON.stringify(data.user));
            }
            return newToken;
          }
        }
      } catch (err) {
        console.warn('[auth] Không thể làm mới token:', err);
      } finally {
        refreshPromise = null;
      }
      return null;
    })();

    return refreshPromise;
  };

  // 3. Load / verify user info khi app khởi động hoặc khi token thay đổi
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const activeToken = urlToken || token;

    if (activeToken) {
      if (urlToken) {
        if (urlToken !== token) {
          setToken(urlToken);
          localStorage.setItem('token', urlToken);
        }
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('token');
          const cleanSearch = cleanUrl.searchParams.toString();
          window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanSearch ? `?${cleanSearch}` : '') + cleanUrl.hash);
        } catch (_) {}
      }

      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` },
        credentials: 'include',
      })
        .then(async (r) => {
          if (r.ok) {
            const d = await r.json();
            if (d.user) {
              setUser(d.user);
              localStorage.setItem('user', JSON.stringify(d.user));
            }
          } else if (r.status === 401) {
            // Thử tự động làm mới token qua refresh cookie
            const refreshedToken = await refreshSession();
            if (!refreshedToken) {
              logout();
            }
          }
        })
        .catch((err) => {
          console.warn('[auth] Không thể kết nối tới /api/auth/me:', err);
        })
        .finally(() => setLoading(false));
    } else {
      // Thử refresh session qua cookie nếu chưa có token trong storage
      refreshSession()
        .then((tok) => {
          if (!tok) setLoading(false);
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  const login = (userData, jwtToken) => {
    if (jwtToken) localStorage.setItem('token', jwtToken);
    if (userData) localStorage.setItem('user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const logoutAll = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    await fetch(`${API}/api/auth/logout-all`, { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const updateUser = fields => {
    setUser(u => {
      const updated = u ? { ...u, ...fields } : u;
      if (updated) localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, logoutAll, updateUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
