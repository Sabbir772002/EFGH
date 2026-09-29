// Button — reusable button primitive
// Variants: primary (yellow), secondary (surface), danger (red), ghost (transparent)
// Sizes: sm | md (default) | lg
// Props: loading (shows spinner), fullWidth, disabled

import React from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

// Style map — avoids ad-hoc inline styles scattered across pages.
const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#0d1117',
    border: '1px solid transparent',
    fontWeight: 700,
  },
  secondary: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    fontWeight: 600,
  },
  danger: {
    background: 'rgba(248, 81, 73, 0.12)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    fontWeight: 600,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid transparent',
    fontWeight: 500,
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' },
  md: { padding: '0.65rem 1.4rem', fontSize: '0.95rem', borderRadius: 'var(--radius)' },
  lg: { padding: '0.85rem 2rem', fontSize: '1.05rem', borderRadius: 'var(--radius)' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition:
          'opacity 180ms ease, transform 120ms ease, box-shadow 180ms ease',
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font)',
        letterSpacing: '0.01em',
        userSelect: 'none',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled)
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
      }}
      onMouseLeave={(e) => {
        if (!isDisabled)
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}
