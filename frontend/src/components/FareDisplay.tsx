'use client';

import React from 'react';
import { formatBDT } from '@/lib/constants';
import { Badge } from '@/components/ui/Badge';

interface FareDisplayProps {
  farePaisa: number;
  surgeMultiplier?: number;
  seatsRequested?: number;
  compact?: boolean;
}

export default function FareDisplay({
  farePaisa,
  surgeMultiplier = 1.0,
  seatsRequested = 1,
  compact = false,
}: FareDisplayProps) {
  if (compact) {
    return (
      <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
        {formatBDT(farePaisa)}
      </span>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        padding: '1rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fare Breakdown</span>
        {surgeMultiplier > 1.0 && (
          <Badge variant="warning">{surgeMultiplier}x Demand Surge</Badge>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        <span>Seats Reserved:</span>
        <span style={{ color: 'var(--text-primary)' }}>{seatsRequested} seat(s)</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed var(--border-color)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Charge:</span>
        <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-green)' }}>
          {formatBDT(farePaisa)}
        </span>
      </div>
    </div>
  );
}
