'use client';

import React from 'react';
import { RideStatus } from '@/lib/types';

interface RideStatusTrackerProps {
  status: RideStatus;
}

const STAGES: { key: RideStatus[]; label: string; icon: string }[] = [
  { key: ['REQUESTED'], label: 'Requested', icon: '🔍' },
  { key: ['MATCHED', 'DRIVER_ASSIGNED'], label: 'Driver Assigned', icon: '🚗' },
  { key: ['EN_ROUTE_PICKUP'], label: 'En Route to Pickup', icon: '📍' },
  { key: ['PICKED_UP', 'EN_ROUTE_DROPOFF'], label: 'On Board', icon: '⚡' },
  { key: ['COMPLETED'], label: 'Completed', icon: '✅' },
];

export default function RideStatusTracker({ status }: RideStatusTrackerProps) {
  if (status === 'CANCELLED') {
    return (
      <div
        style={{
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--accent-red)',
          border: '1px solid var(--accent-red)',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        ❌ Ride Cancelled
      </div>
    );
  }

  // Determine current active step index
  const getCurrentStepIndex = () => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (STAGES[i].key.includes(status)) {
        return i;
      }
    }
    return 0;
  };

  const currentIdx = getCurrentStepIndex();

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Progress Line */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '30px',
            right: '30px',
            height: '3px',
            background: 'var(--border-color)',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '30px',
            width: `calc(${(currentIdx / (STAGES.length - 1)) * 100}% - 30px)`,
            height: '3px',
            background: 'var(--accent-cyan)',
            transition: 'width 0.4s ease',
            zIndex: 0,
          }}
        />

        {/* Stage Nodes */}
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div
              key={stage.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isCurrent
                    ? 'var(--accent-cyan)'
                    : isCompleted
                    ? 'rgba(6, 182, 212, 0.2)'
                    : 'var(--bg-secondary)',
                  border: `2px solid ${isCurrent || isCompleted ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                  color: isCurrent ? '#000' : isCompleted ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  boxShadow: isCurrent ? 'var(--shadow-neon)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {stage.icon}
              </div>
              <span
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--accent-cyan)' : isCompleted ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
