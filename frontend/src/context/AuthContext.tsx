'use client';

// context/AuthContext.tsx
// Single shared auth state for the entire app.
// Previously useAuth() was a plain hook → every component got its OWN isolated
// state, so the layout's isLoading never settled in sync with the login page.
// Now all components read from ONE context instance.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { COOKIE_TOKEN, LS_TOKEN, LS_USER, ROUTES, API } from '@/lib/constants';
import type { AuthLoginRequest, AuthRegisterRequest, AuthResponse, User } from '@/lib/types';

// ── Cookie helpers ─────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// ── Context shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: AuthLoginRequest) => Promise<void>;
  register: (data: AuthRegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth from localStorage exactly once on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(LS_TOKEN);
    const storedUser = localStorage.getItem(LS_USER);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
      }
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((res: AuthResponse) => {
    localStorage.setItem(LS_TOKEN, res.token);
    localStorage.setItem(LS_USER, JSON.stringify(res.user));
    setCookie(COOKIE_TOKEN, res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const redirectToDashboard = useCallback((role: string) => {
    if (role === 'driver') {
      router.push(ROUTES.driverDashboard);
    } else {
      router.push(ROUTES.passengerDashboard);
    }
  }, [router]);

  const login = useCallback(async (data: AuthLoginRequest) => {
    const res = await api.post<AuthResponse>(API.login, data, { auth: false });
    persist(res);
    redirectToDashboard(res.user.role);
  }, [persist, redirectToDashboard]);

  const register = useCallback(async (data: AuthRegisterRequest) => {
    const res = await api.post<AuthResponse>(API.register, data, { auth: false });
    persist(res);
    redirectToDashboard(res.user.role);
  }, [persist, redirectToDashboard]);

  const logout = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    deleteCookie(COOKIE_TOKEN);
    setToken(null);
    setUser(null);
    router.push(ROUTES.login);
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Check your root layout.');
  }
  return ctx;
}
