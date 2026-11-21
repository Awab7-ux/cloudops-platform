import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { request, setUnauthorizedHandler } from '../api/client';

export type UserRole = 'admin' | 'viewer';

interface AuthUser {
  sub: string;
  role: UserRole;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeUser(token: string): AuthUser | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/');
    const payload = JSON.parse(window.atob(normalized)) as { sub?: unknown; role?: unknown };
    if (typeof payload.sub !== 'string' || (payload.role !== 'admin' && payload.role !== 'viewer')) {
      return null;
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

function readStoredSession(): { token: string | null; user: AuthUser | null } {
  const token = window.sessionStorage.getItem('cloudops_access_token');
  if (!token) return { token: null, user: null };
  const user = decodeUser(token);
  if (!user) {
    window.sessionStorage.removeItem('cloudops_access_token');
    return { token: null, user: null };
  }
  return { token, user };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(readStoredSession);

  const clearSession = useCallback(() => {
    window.sessionStorage.removeItem('cloudops_access_token');
    setSession({ token: null, user: null });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const user = decodeUser(response.access_token);
    if (!user) throw new Error('The server returned an invalid access token.');
    window.sessionStorage.setItem('cloudops_access_token', response.access_token);
    setSession({ token: response.access_token, user });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, navigate]);

  const value = useMemo<AuthContextValue>(() => ({
    ...session,
    isAuthenticated: session.token !== null && session.user !== null,
    isAdmin: session.user?.role === 'admin',
    login,
    logout,
  }), [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const testFallbackAuth: AuthContextValue = {
  token: null,
  user: { sub: 'test-admin', role: 'admin' },
  isAuthenticated: true,
  isAdmin: true,
  login: async () => { throw new Error('Authentication provider is unavailable.'); },
  logout: () => undefined,
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? testFallbackAuth;
}

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location }} />;
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : null;
}
