'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { PassengerCard } from '@/components/PassengerCard';
import { PoolCapacityBar } from '@/components/PoolCapacityBar';
import { apiFetch, swrFetcher } from '@/lib/api';
import { Pool, PoolStatus } from '@/lib/types';
import { formatBDT } from '@/lib/constants';
import Link from 'next/link';

export default function DriverPoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params?.id as string;

  const { data: pool, mutate, isLoading, error } = useSWR<Pool>(
    poolId ? `/pools/${poolId}` : null,
    swrFetcher,
    { refreshInterval: 3000 }
  );

  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState('');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div style={{ padding: '2rem 0', maxWidth: '500px', margin: '0 auto' }}>
        <Card title="Pool Not Found">
          <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
            {error ? error.message : 'Unable to load pool details.'}
          </p>
          <Link href="/driver/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const handleAdvanceStatus = async (nextStatus: PoolStatus) => {
    setUpdating(true);
    setActionError('');

    try {
      await apiFetch(`/pools/${poolId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      mutate();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update pool status');
    } finally {
      setUpdating(false);
    }
  };

  const rides = pool.ride_requests || [];
  const totalEarningsPaisa = rides.reduce((sum, r) => sum + (r.fare_paisa || 0), 0);
  const capacity = pool.vehicle?.capacity || 3;
  const occupied = pool.occupied_seats || rides.reduce((sum, r) => sum + r.seats, 0);

  return (
    <div style={{ padding: '1rem 0', maxWidth: '900px', margin: '0 auto' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Active Pool Management</h1>
            <Badge variant={pool.status === 'completed' ? 'success' : pool.status === 'cancelled' ? 'danger' : 'accent'}>
              {pool.status.toUpperCase()}
            </Badge>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Pool ID: <span style={{ fontFamily: 'monospace' }}>{pool.id}</span>
          </p>
        </div>

        <Link href="/driver/dashboard">
          <Button variant="outline">← Cockpit</Button>
        </Link>
      </div>

      {actionError && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'rgba(248, 81, 73, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {actionError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Passengers List */}
        <div>
          <Card
            title={`Manifest (${rides.length} Passenger${rides.length > 1 ? 's' : ''})`}
            subtitle="Current pool passengers onboard & pending pickup"
            style={{ marginBottom: '1.5rem' }}
          >
            {rides.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>No passengers assigned to this pool yet.</p>
            ) : (
              rides.map((ride) => (
                <PassengerCard key={ride.id} ride={ride} />
              ))
            )}
          </Card>
        </div>

        {/* Right Column: Pool Controls & Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Lifecycle Controls */}
          <Card title="Trip Lifecycle Controls">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(pool.status === 'open' || pool.status === 'full') && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={updating}
                  onClick={() => handleAdvanceStatus('driver_arrived')}
                >
                  📍 Mark Driver Arrived
                </Button>
              )}

              {pool.status === 'driver_arrived' && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={updating}
                  onClick={() => handleAdvanceStatus('started')}
                >
                  🚀 Start Pool Trip
                </Button>
              )}

              {pool.status === 'started' && (
                <Button
                  variant="success"
                  fullWidth
                  loading={updating}
                  onClick={() => handleAdvanceStatus('completed')}
                >
                  🏁 Complete Trip
                </Button>
              )}

              {pool.status === 'completed' && (
                <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600, padding: '0.5rem 0' }}>
                  🎉 Trip Completed Successfully
                </div>
              )}

              {pool.status !== 'completed' && pool.status !== 'cancelled' && (
                <Button
                  variant="danger"
                  fullWidth
                  loading={updating}
                  onClick={() => handleAdvanceStatus('cancelled')}
                  style={{ marginTop: '0.5rem' }}
                >
                  Cancel Pool
                </Button>
              )}
            </div>
          </Card>

          {/* Stats Card */}
          <Card title="Pool Overview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <PoolCapacityBar occupied={occupied} capacity={capacity} />

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--muted)' }}>Route:</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{pool.route?.name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--muted)' }}>Total Earnings:</span>
                <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>
                  {formatBDT(totalEarningsPaisa)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
