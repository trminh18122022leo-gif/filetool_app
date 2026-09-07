import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || '';

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
        return urlToken;
      }
    } catch (_) {}
    return localStorage.getItem('token') || null;
  });

  const [loading, setLoading] = useState(true);

  // 3. Load / verify user info khi app khởi động hoặc khi token thay đổi
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const activeToken = urlToken || token;

    if (activeToken) {
      if (urlToken && urlToken !== token) {
        setToken(urlToken);
        localStorage.setItem('token', urlToken);
      }

      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      })
        .then(async (r) => {
          if (r.ok) {
            const d = await r.json();
            if (d.user) {
              setUser(d.user);
              localStorage.setItem('user', JSON.stringify(d.user));
            }
          } else if (r.status === 401) {
            // Only logout when token is strictly rejected as unauthorized
            logout();
          }
        })
        .catch((err) => {
          console.warn('[auth] Cannot reach /api/auth/me:', err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (userData, jwtToken) => {
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    fetch(`${API}/api/auth/logout`, { method: 'POST' }).catch(() => {});
  };

  const updateUser = fields => {
    setUser(u => {
      const updated = u ? { ...u, ...fields } : u;
      if (updated) localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
