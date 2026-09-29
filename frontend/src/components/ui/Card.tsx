// Card — surface container with optional hover lift and accent border.
// Used everywhere: ride cards, stop selector, dashboard tiles, etc.

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;      // adds lift effect on hover
  accent?: boolean;     // left yellow accent border
  padding?: string;     // override default padding (1.5rem)
}

export default function Card({
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
      {children}
    </div>
  );
}
