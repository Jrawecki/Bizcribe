// frontend/src/auth/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchJson, setTokens, clearTokens, getAccessToken, getRefreshToken } from '../utils/apiClient.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const isAuthenticated = !!user;
  const role = user?.role ?? null;

  const loadMe = useCallback(async () => {
    try {
      const me = await fetchJson('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  // On mount: if we have a token, try to load profile
  useEffect(() => {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    if (access) {
      loadMe();
      return;
    }
    if (!refresh) {
      setInitializing(false);
      return;
    }

    (async () => {
      try {
        const data = await fetchJson('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        setTokens(data);
        setUser(data.user);
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    })();
  }, [loadMe]);

  const login = useCallback(async (email, password) => {
    const data = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setTokens(data);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ email, password, display_name, business }) => {
    const payload = { email, password, display_name, business };
    const data = await fetchJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setTokens(data);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, role, isAuthenticated, initializing, login, register, logout, reloadMe: loadMe }),
    [user, role, isAuthenticated, initializing, login, register, logout, loadMe]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
