'use client';

import React from 'react';
import { RideRequest } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatBDT } from '@/lib/constants';

interface PassengerCardProps {
  ride: RideRequest;
  onStatusChange?: (newStatus: string) => void;
  actionLoading?: boolean;
}

export function PassengerCard({ ride, onStatusChange, actionLoading }: PassengerCardProps) {
  const passengerName = ride.passenger?.name || 'Passenger';
  const passengerPhone = ride.passenger?.phone || 'N/A';
  const pickup = ride.pickup_stop?.name || 'Pickup Stop';
  const dropoff = ride.dropoff_stop?.name || 'Dropoff Stop';
  const fareDisplay = ride.fare_paisa ? formatBDT(ride.fare_paisa) : 'Pending match';

  return (
    <Card
      style={{
        marginBottom: '1rem',
        borderLeft: '4px solid var(--accent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
              👤 {passengerName}
            </span>
            <Badge variant="neutral">{ride.seats} seat{ride.seats > 1 ? 's' : ''}</Badge>
            <Badge variant={ride.status === 'completed' ? 'success' : ride.status === 'cancelled' ? 'danger' : 'accent'}>
              {ride.status}
            </Badge>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
            📞 {passengerPhone}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
            {fareDisplay}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Method: {ride.payment_method.toUpperCase()} ({ride.payment_status})
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--success)' }}>🟢 Pickup:</span>
          <span style={{ fontWeight: 600 }}>{pickup}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--danger)' }}>🔴 Drop-off:</span>
          <span style={{ fontWeight: 600 }}>{dropoff}</span>
        </div>
        {ride.pickup_note && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--accent2)', fontStyle: 'italic', marginTop: '0.25rem' }}>
            Note: "{ride.pickup_note}"
          </div>
        )}
      </div>
    </Card>
  );
}
