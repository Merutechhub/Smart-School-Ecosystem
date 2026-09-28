import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);
const API = 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('smartschool_token'));
  const [loading, setLoading] = useState(true);

  // On mount, validate existing token
  useEffect(() => {
    const validateToken = async () => {
      const stored = localStorage.getItem('smartschool_token');
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setToken(stored);
        } else {
          localStorage.removeItem('smartschool_token');
          setToken(null);
        }
      } catch {
        // Backend may be down — keep token but don't crash
        const stored = localStorage.getItem('smartschool_token');
        if (stored) {
          try {
            const payload = JSON.parse(atob(stored.split('.')[1]));
            setUser({ role: payload.role, name: payload.name, email: payload.email,
                      uid: payload.uid, reg_no: payload.reg_no, lecturer_id: payload.lecturer_id });
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    localStorage.setItem('smartschool_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('smartschool_token');
    setToken(null);
    setUser(null);
  };

  // Helper: fetch with auth token automatically attached
  const authFetch = (url, options = {}) => {
    const t = localStorage.getItem('smartschool_token');
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers || {})
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
