import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

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
    // Check if token in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const activeToken = urlToken || token;

    if (activeToken) {
      if (urlToken && urlToken !== token) {
        setToken(urlToken);
        localStorage.setItem('token', urlToken);
      }

      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      })
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(d => {
          if (d.user) {
            setUser(d.user);
            localStorage.setItem('user', JSON.stringify(d.user));
          }
        })
        .catch(() => {
          // Only logout if token is truly invalid and no user
          logout();
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
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
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
