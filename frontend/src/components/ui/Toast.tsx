// Toast — auto-dismissing notification.
// Slides in from the right, fades out after `duration` ms.
// Usage: import { useToast } from '@/hooks/useToast'  (added in Phase 8.3 hooks index)
// OR use the ToastContainer + useToast pattern defined here.
//
// For Phase 8 we export:
//   <Toast>      — single toast element (managed by ToastProvider)
//   <ToastContainer> — renders all active toasts (place in layout)
//   useToast()   — returns { show } function

'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// ----- Types -----
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// ----- Context -----
interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

// ----- Provider -----
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration = 3500) => {
      const id = ++counterRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        duration,
      );
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

// ----- Hook -----
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ----- Single Toast -----
const typeStyle: Record<ToastType, React.CSSProperties> = {
  success: { borderLeft: '4px solid var(--success)', color: 'var(--success)' },
  error:   { borderLeft: '4px solid var(--danger)',  color: 'var(--danger)'  },
  warning: { borderLeft: '4px solid var(--warning)', color: 'var(--warning)' },
  info:    { borderLeft: '4px solid var(--accent2)', color: 'var(--accent2)' },
};

const typeIcon: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function Toast({ item }: { item: ToastItem }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.8rem 1.2rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.2s ease',
        minWidth: '280px',
        maxWidth: '380px',
        ...typeStyle[item.type],
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
        {typeIcon[item.type]}
      </span>
      <span style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.4 }}>
        {item.message}
      </span>
    </div>
  );
}

// ----- Container (fixed bottom-right) -----
function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} item={t} />
      ))}
    </div>
  );
}

export default Toast;
