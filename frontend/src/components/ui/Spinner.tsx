// Spinner — inline loading indicator (CSS border-based, no image deps)
// Used inside Button (loading), Spinner full-page, and any async state.

import React from 'react';

interface SpinnerProps {
  size?: number | 'sm' | 'md' | 'lg' | string;   // px number or size preset
  color?: string;  // default var(--accent)
  style?: React.CSSProperties;
}

export function Spinner({ size = 24, color = 'var(--accent)', style }: SpinnerProps) {
  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 16
      : size === 'md'
      ? 24
      : size === 'lg'
      ? 36
      : parseInt(size, 10) || 24;

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: numericSize,
        height: numericSize,
        border: `${Math.max(2, numericSize / 8)}px solid rgba(255,255,255,0.12)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export default Spinner;
