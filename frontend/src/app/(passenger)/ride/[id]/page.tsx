'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRide } from '@/hooks/useRide';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import RideStatusTracker from '@/components/RideStatusTracker';
import FareDisplay from '@/components/FareDisplay';
import { apiFetch } from '@/lib/api';

export default function PassengerLiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const rideId = params?.id as string;

  const { ride, loading, error, isLive } = useRide(rideId);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const handleCancelRide = async () => {
    if (!confirm('Are you sure you want to cancel this ride?')) return;
    setCancelling(true);
    setCancelError('');

    try {
      await apiFetch(`/rides/${rideId}/cancel`, { method: 'POST' });
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel ride');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div style={{ padding: '2rem 0', maxWidth: '500px', margin: '0 auto' }}>
        <Card title="Ride Not Found">
          <p style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>
            {error ? error.message : 'Unable to load ride details.'}
          </p>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const canCancel = ['REQUESTED', 'MATCHED', 'DRIVER_ASSIGNED'].includes(ride.status);

  return (
    <div style={{ padding: '1rem 0', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Live Ride Tracker</h1>
            <Badge variant={isLive ? 'success' : 'neutral'}>
              {isLive ? '⚡ SSE Connected' : '🔄 Polling'}
            </Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Ride ID: <span style={{ fontFamily: 'monospace' }}>{ride.id}</span>
          </p>
        </div>

        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Dashboard
        </Button>
      </div>

      {cancelError && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {cancelError}
        </div>
      )}

      {/* Main Status Tracker Card */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <RideStatusTracker status={ride.status} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Trip & Driver Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Pickup & Dropoff Stops */}
          <Card title="Trip Route">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🟢</span>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', uppercase: 'true' }}>PICKUP STOP</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ride.pickupStop?.name || 'Pickup Stop'}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Route: {ride.route?.name} ({ride.route?.code})</div>
                </div>
              </div>

              <div style={{ paddingLeft: '0.6rem', borderLeft: '2px dashed var(--border-color)', margin: '-0.5rem 0 -0.5rem 0.6rem', height: '20px' }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🔴</span>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', uppercase: 'true' }}>DROP-OFF STOP</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ride.dropoffStop?.name || 'Dropoff Stop'}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Verification Code (OTP) */}
          {ride.pickupCode && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && (
            <Card style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid var(--accent-cyan)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  PICKUP VERIFICATION OTP
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.25em', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                  {ride.pickupCode}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                  Share this 4-digit code with your Tesla driver upon boarding.
                </p>
              </div>
            </Card>
          )}

          {/* Driver & Vehicle Details */}
          {ride.driver && (
            <Card title="Your Vehicle & Driver">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Driver:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ride.driver.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Phone:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ride.driver.phone || 'N/A'}</span>
                </div>
                {ride.vehicle && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tesla Model:</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                        {ride.vehicle.model} ({ride.vehicle.color})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>License Plate:</span>
                      <Badge variant="neutral">{ride.vehicle.licensePlate}</Badge>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Fare & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <FareDisplay
            farePaisa={ride.farePaisa}
            surgeMultiplier={ride.surgeMultiplier}
            seatsRequested={ride.seatsRequested}
          />

          {/* Actions */}
          <Card title="Manage Ride">
            {canCancel && (
              <Button
                variant="danger"
                fullWidth
                loading={cancelling}
                onClick={handleCancelRide}
              >
                Cancel Ride
              </Button>
            )}

            {ride.status === 'COMPLETED' && (
              <div style={{ textAlign: 'center', color: 'var(--accent-green)', fontWeight: 600 }}>
                🎉 You have arrived at your destination!
              </div>
            )}

            {!canCancel && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Your trip is currently in progress. Sit back and enjoy your Tesla pool!
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
