// hooks/useAuth.ts
// Auth state management — stores JWT + User in localStorage and a cookie.
// The cookie is read by middleware.ts (server-side) for route protection.
// The localStorage value is read by api.ts for Bearer token injection.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { COOKIE_TOKEN, LS_TOKEN, LS_USER, ROUTES, API } from '@/lib/constants';
import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthResponse,
  User,
} from '@/lib/types';

// ── Cookie helpers (client-side only) ─────────────────────────────────────

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// ── Hook ──────────────────────────────────────────────────────────────────

interface UseAuthReturn {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  /** Login with phone + password — stores token and redirects to dashboard. */
  login: (data: AuthLoginRequest) => Promise<void>;
  /** Register new account — logs in immediately after success. */
  register: (data: AuthRegisterRequest) => Promise<void>;
  /** Clear auth state and redirect to /login. */
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(LS_TOKEN);
    const storedUser = localStorage.getItem(LS_USER);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
      }
    }
    setIsLoading(false);
  }, []);

  // Persist auth to localStorage + cookie, update state
  const persist = useCallback((res: AuthResponse) => {
    localStorage.setItem(LS_TOKEN, res.token);
    localStorage.setItem(LS_USER, JSON.stringify(res.user));
    setCookie(COOKIE_TOKEN, res.token); // for Next.js middleware
    setToken(res.token);
    setUser(res.user);
  }, []);

  // Redirect to the correct dashboard based on role
  const redirectToDashboard = useCallback((role: string) => {
    if (role === 'driver') {
      router.push(ROUTES.driverDashboard);
    } else {
      router.push(ROUTES.passengerDashboard);
    }
  }, [router]);

  const login = useCallback(
    async (data: AuthLoginRequest) => {
      const res = await api.post<AuthResponse>(API.login, data, { auth: false });
      persist(res);
      redirectToDashboard(res.user.role);
    },
    [persist, redirectToDashboard],
  );

  const register = useCallback(
    async (data: AuthRegisterRequest) => {
      const res = await api.post<AuthResponse>(API.register, data, { auth: false });
      persist(res);
      redirectToDashboard(res.user.role);
    },
    [persist, redirectToDashboard],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    deleteCookie(COOKIE_TOKEN);
    setToken(null);
    setUser(null);
    router.push(ROUTES.login);
  }, [router]);

  return { user, token, isLoading, login, register, logout };
}
