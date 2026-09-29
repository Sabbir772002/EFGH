'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSE } from '@/hooks/useSSE';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { OnlineToggle } from '@/components/OnlineToggle';
import { PoolCapacityBar } from '@/components/PoolCapacityBar';
import { apiFetch, swrFetcher } from '@/lib/api';
import { DriverDashboardResponse, RideRequest } from '@/lib/types';
import { formatBDT } from '@/lib/constants';
import useSWR from 'swr';
import Link from 'next/link';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const { data: dashboard, mutate: mutateDashboard, isLoading: dashLoading } = useSWR<DriverDashboardResponse>(
    '/driver/dashboard',
    swrFetcher
  );

  const { data: pendingRequests, mutate: mutatePending } = useSWR<RideRequest[]>(
    '/pools/pending',
    swrFetcher
  );

  const [toggling, setToggling] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const isOnline = dashboard?.user?.is_online ?? false;

  // SSE real-time listener for new passenger requests on driver route
  const sseData = useSSE<RideRequest[]>('/sse/driver/requests', isOnline);

  useEffect(() => {
    if (sseData) {
      mutatePending(sseData, false);
    }
  }, [sseData, mutatePending]);

  const handleToggleOnline = async (nextState: boolean) => {
    setToggling(true);
    setActionError('');
    try {
      await apiFetch('/driver/status', {
        method: 'PATCH',
        body: JSON.stringify({ is_online: nextState }),
      });
      mutateDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update online status');
    } finally {
      setToggling(false);
    }
  };

  const handleAcceptRequest = async (rideRequestId: string) => {
    setAcceptingId(rideRequestId);
    setActionError('');
    try {
      await apiFetch(`/pools/${rideRequestId}/accept`, {
        method: 'POST',
      });
      mutateDashboard();
      mutatePending();
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept ride request');
    } finally {
      setAcceptingId(null);
    }
  };

  if (dashLoading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const activePool = dashboard?.active_pool;
  const vehicle = dashboard?.vehicle;

  return (
    <div style={{ padding: '1rem 0', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Driver Cockpit</h1>
          <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Vehicle: <strong>{vehicle ? `${vehicle.name} (${vehicle.plate})` : 'Unassigned'}</strong>
          </p>
        </div>

        <Link href="/driver/history">
          <Button variant="outline">Pool History</Button>
        </Link>
      </div>

      {actionError && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'rgba(248, 81, 73, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {actionError}
        </div>
      )}

      {/* Online Switch */}
      <div style={{ marginBottom: '1.5rem' }}>
        <OnlineToggle isOnline={isOnline} onToggle={handleToggleOnline} disabled={toggling} />
      </div>

      {/* Active Pool Card (if currently running a pool) */}
      {activePool && (
        <Card style={{ border: '2px solid var(--accent)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>ACTIVE POOL</span>
                <Badge variant="accent">{activePool.status.toUpperCase()}</Badge>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
                Route: <strong>{activePool.route?.name}</strong> ({activePool.origin_stop?.name} → {activePool.dest_stop?.name})
              </p>
            </div>

            <Link href={`/driver/pool/${activePool.id}`}>
              <Button variant="primary">Manage Pool & Passengers →</Button>
            </Link>
          </div>

          <PoolCapacityBar
            occupied={activePool.occupied_seats || 0}
            capacity={vehicle?.capacity || 3}
          />
        </Card>
      )}

      {/* Pending Request Alerts (SSE Powered) */}
      <Card
        title="Incoming Ride Requests"
        subtitle={isOnline ? '⚡ Live SSE updates — requests matching your vehicle route' : 'Go online to view live incoming passenger requests'}
      >
        {!isOnline ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
            Turn toggle ON above to start receiving ride requests.
          </div>
        ) : !pendingRequests || pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
            <Spinner style={{ marginBottom: '0.5rem' }} />
            <div>Listening for new passenger requests on your route...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>👤 {req.passenger?.name || 'Passenger'}</span>
                    <Badge variant="neutral">{req.seats} seat{req.seats > 1 ? 's' : ''}</Badge>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                    🟢 {req.pickup_stop?.name} → 🔴 {req.dropoff_stop?.name}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>
                      {req.fare_paisa ? formatBDT(req.fare_paisa) : 'Calc on accept'}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    loading={acceptingId === req.id}
                    onClick={() => handleAcceptRequest(req.id)}
                  >
                    Accept Ride
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
