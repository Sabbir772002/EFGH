'use client';

import React from 'react';

interface PoolCapacityBarProps {
  occupied: number;
  capacity: number;
}

export function PoolCapacityBar({ occupied, capacity }: PoolCapacityBarProps) {
  const percentage = Math.min(100, Math.round((occupied / capacity) * 100));
  const isFull = occupied >= capacity;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Pool Seats</span>
        <span style={{ fontWeight: 700, color: isFull ? 'var(--accent)' : 'var(--text)' }}>
          {occupied} / {capacity} seats ({isFull ? 'FULL' : `${capacity - occupied} left`})
        </span>
      </div>

      <div
        style={{
          width: '100%',
          height: '10px',
          borderRadius: '5px',
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: isFull
              ? 'linear-gradient(90deg, var(--accent) 0%, #ff9800 100%)'
              : 'linear-gradient(90deg, var(--accent2) 0%, var(--accent) 100%)',
            transition: 'width 0.3s ease',
            borderRadius: '5px',
          }}
        />
      </div>
    </div>
  );
}
