'use client';

import React from 'react';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: (nextState: boolean) => void;
  disabled?: boolean;
}

export function OnlineToggle({ isOnline, onToggle, disabled = false }: OnlineToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius)',
        background: isOnline ? 'rgba(63, 185, 80, 0.1)' : 'var(--surface)',
        border: `1px solid ${isOnline ? 'var(--success)' : 'var(--border)'}`,
        transition: 'all 0.2s ease',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
          {isOnline ? '🟢 Online & Ready for Requests' : '⚪ Offline'}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
          {isOnline
            ? 'You are visible to unmatched passengers on your route'
            : 'Toggle on to accept pool requests and start earning'}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!isOnline)}
        style={{
          position: 'relative',
          width: '56px',
          height: '30px',
          borderRadius: '15px',
          background: isOnline ? 'var(--success)' : 'var(--border)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'background 0.2s ease',
          padding: '2px',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: '#ffffff',
            transform: isOnline ? 'translateX(26px)' : 'translateX(0px)',
            transition: 'transform 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}
