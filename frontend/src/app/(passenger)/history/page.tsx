'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { swrFetcher } from '@/lib/api';
import { Ride, RideStatus } from '@/lib/types';
import { formatBDT } from '@/lib/constants';

export default function PassengerHistoryPage() {
  const { data: rides, isLoading } = useSWR<Ride[]>('/rides', swrFetcher);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredRides = (rides || []).filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Ride History</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            All past and active trip records
          </p>
        </div>

        <Link href="/dashboard">
          <Button variant="outline">← Dashboard</Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['ALL', 'COMPLETED', 'CANCELLED', 'REQUESTED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: `1px solid ${filterStatus === status ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
              background: filterStatus === status ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
              color: filterStatus === status ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner size="lg" /></div>
        ) : filteredRides.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No rides found matching selected filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredRides.map((ride) => (
              <div
                key={ride.id}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{ride.pickupStop?.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{ride.dropoffStop?.name}</span>
                  </div>

                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Route: <strong style={{ color: 'var(--text-primary)' }}>{ride.route?.name} ({ride.route?.code})</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Date: {new Date(ride.createdAt).toLocaleString()} • Seats: {ride.seatsRequested}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                      {formatBDT(ride.farePaisa)}
                    </div>
                    <Badge variant={ride.status === 'COMPLETED' ? 'success' : ride.status === 'CANCELLED' ? 'danger' : 'cyan'}>
                      {ride.status}
                    </Badge>
                  </div>

                  <Link href={`/ride/${ride.id}`}>
                    <Button variant="outline" size="sm">
                      Details →
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
