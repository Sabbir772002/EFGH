// hooks/useSSE.ts
// Generic Server-Sent Events hook — wraps EventSource with React state.
// The backend pushes updates every 2s; this hook exposes the latest data.
// Automatically reconnects (native EventSource behaviour).
// Cleans up on unmount or URL change.

'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE, LS_TOKEN } from '@/lib/constants';

interface UseSSEOptions {
  /** If false, do not open the connection (e.g. wait until rideId is known). */
  enabled?: boolean;
}

interface UseSSEResult<T> {
  data: T | null;
  error: string | null;
  isConnected: boolean;
}

/**
 * Subscribe to a backend SSE endpoint.
 *
 * @param path   Relative path, e.g. `/sse/ride/abc123`
 * @param opts   Optional: { enabled }
 *
 * The JWT token is appended as a query param (?token=...) because
 * EventSource does not support custom headers. The backend auth middleware
 * reads from Authorization header OR ?token= query param.
 */
export function useSSE<T = unknown>(
  path: string | null,
  { enabled = true }: UseSSEOptions = {},
): UseSSEResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Teardown helper
    const close = () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setIsConnected(false);
    };

    if (!path || !enabled) {
      close();
      return;
    }

    const token = localStorage.getItem(LS_TOKEN);
    const url = `${API_BASE}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        setData(JSON.parse(event.data) as T);
      } catch {
        // non-JSON event — ignore
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      setError('SSE connection lost — reconnecting…');
      // EventSource reconnects automatically; we just reflect the transient error.
    };

    return close; // cleanup on unmount or path change
  }, [path, enabled]);

  return { data, error, isConnected };
}
