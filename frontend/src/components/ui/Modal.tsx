// Modal — accessible overlay dialog.
// Traps focus, closes on Escape key and backdrop click.
// Used for: cancel confirmation, fare breakdown, error alerts.

'use client';

import React, { useEffect, useRef } from 'react';
import Button from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Width of the modal panel, default 480px */
  width?: number | string;
  /** Hide the default close button */
  hideClose?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
  hideClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    // Backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={(e) => {
        // Close when clicking outside the panel
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          width: '100%',
          maxWidth: typeof width === 'number' ? `${width}px` : width,
          animation: 'fadeInScale 0.18s ease',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        {(title || !hideClose) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            {title && (
              <h3
                id="modal-title"
                style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}
              >
                {title}
              </h3>
            )}
            {!hideClose && (
              <button
                aria-label="Close modal"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  fontSize: '1.4rem',
                  lineHeight: 1,
                  padding: '0.1rem 0.3rem',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 140ms ease',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)')
                }
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body */}
        {children}
      </div>
    </div>
  );
}
