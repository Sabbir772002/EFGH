'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { swrFetcher } from '@/lib/api';
import { Ride } from '@/lib/types';
import { formatBDT } from '@/lib/constants';

export default function PassengerDashboardPage() {
  const { user } = useAuth();
  const { data: rides, isLoading } = useSWR<Ride[]>('/rides', swrFetcher);

  const activeRide = rides?.find((r) =>
    ['REQUESTED', 'MATCHED', 'DRIVER_ASSIGNED', 'EN_ROUTE_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF'].includes(r.status)
  );

  const recentRides = rides?.slice(0, 5) || [];

  return (
    <div style={{ padding: '1rem 0' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Welcome back, {user?.name || 'Passenger'}!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Book clean, autonomous Tesla pool rides across Dhaka's key corridors.
          </p>
        </div>

        <Link href="/book">
          <Button variant="primary">⚡ Book New Ride</Button>
        </Link>
      </div>

      {/* Active Ride Banner */}
      {activeRide && (
        <Card style={{ border: '2px solid var(--accent-cyan)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🚗</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>ACTIVE RIDE IN PROGRESS</span>
                <Badge variant="cyan">{activeRide.status}</Badge>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                From <strong>{activeRide.pickupStop?.name}</strong> to <strong>{activeRide.dropoffStop?.name}</strong>
              </p>
            </div>

            <Link href={`/ride/${activeRide.id}`}>
              <Button variant="primary">View Live Tracker →</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Recent Rides */}
        <Card title="Recent Trips" subtitle="Your latest pool history">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner /></div>
          ) : recentRides.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>
              No trips recorded yet. Ready for your first Tesla pool ride?
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {recentRides.map((ride) => (
                <div
                  key={ride.id}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '0.875rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {ride.pickupStop?.name} → {ride.dropoffStop?.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {new Date(ride.createdAt).toLocaleDateString()} • Route: {ride.route?.code}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '0.875rem' }}>
                      {formatBDT(ride.farePaisa)}
                    </div>
                    <Badge variant={ride.status === 'COMPLETED' ? 'success' : ride.status === 'CANCELLED' ? 'danger' : 'cyan'}>
                      {ride.status}
                    </Badge>
                  </div>
                </div>
              ))}

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link href="/history" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
                  View All Trip History →
                </Link>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Stats / Account summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card title="Account Overview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Name:</span>
                <span style={{ fontWeight: 600 }}>{user?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                <span style={{ color: 'var(--text-primary)' }}>{user?.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Role:</span>
                <Badge variant="cyan">{user?.role}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Rides:</span>
                <span style={{ fontWeight: 700 }}>{rides?.length || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
