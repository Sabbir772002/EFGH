// Card — surface container with optional hover lift and accent border.
// Used everywhere: ride cards, stop selector, dashboard tiles, etc.

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  hover?: boolean;      // adds lift effect on hover
  accent?: boolean;     // left yellow accent border
  padding?: string;     // override default padding (1.5rem)
}

export function Card({
  title,
  subtitle,
  hover = false,
  accent = false,
  padding = '1.5rem',
  children,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: accent ? '3px solid var(--accent)' : undefined,
        borderRadius: 'var(--radius)',
        padding,
        transition: hover
          ? 'transform 180ms var(--ease), box-shadow 180ms var(--ease)'
          : undefined,
        cursor: hover ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hover) {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            '0 8px 32px rgba(0,0,0,0.45)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }
      }}
      {...rest}
    >
      {title && (
        <div style={{ marginBottom: children ? '1rem' : 0 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{title}</h2>
          {subtitle && (
            <p style={{ color: 'var(--text-secondary, rgba(255,255,255,0.6))', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;
