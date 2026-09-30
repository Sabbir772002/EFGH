// lib/api.ts
// Typed fetch wrapper for all backend calls.
// - Injects JWT Authorization header automatically from localStorage.
// - Throws ApiError on non-2xx responses so callers can catch uniformly.
// - Fully typed via generics — callers get strong return types.

import { API_BASE, LS_TOKEN } from './constants';
import type { ApiError } from './types';

// ── Core fetch wrapper ─────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  status: number;
  body: ApiError;

  constructor(status: number, body: ApiError) {
    super(body.error ?? 'Request failed');
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

/** Read stored JWT token (client-side only). */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LS_TOKEN);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;   // default true — injects Bearer token
}

/**
 * Core typed fetch.
 * Usage:  const data = await apiFetch<RideRequest>('/rides', { method: 'POST', body: {...} });
 */
export async function apiFetch<T = unknown>(
  path: string,
  { body, auth = true, headers: extraHeaders, ...rest }: RequestOptions = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  // Parse body regardless of status for the error message
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { error: res.statusText };
  }

  if (!res.ok) {
    throw new ApiRequestError(res.status, data as ApiError);
  }

  return data as T;
}

// ── Convenience helpers (mirrors REST conventions) ─────────────────────────

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method'>) =>
    apiFetch<T>(path, { method: 'POST', body, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method'>) =>
    apiFetch<T>(path, { method: 'PATCH', body, ...opts }),

  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    apiFetch<T>(path, { method: 'DELETE', ...opts }),
};

// ── SWR fetcher (used by all useXxx hooks) ─────────────────────────────────
// SWR calls this with the URL key string.

export const swrFetcher = <T>(url: string): Promise<T> => api.get<T>(url);
