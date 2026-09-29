'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStops, useRoutes, useRouteStops } from '@/hooks/useStops';
import RouteMap from '@/components/RouteMap';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatBDT } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import { Stop, FareEstimateResponse } from '@/lib/types';

export default function BookRidePage() {
  const router = useRouter();
  const { routes, loading: loadingRoutes } = useRoutes();
  const { stops, loading: loadingStops } = useStops();

  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const { stops: routeStops } = useRouteStops(selectedRouteId || undefined);

  const [pickupStopId, setPickupStopId] = useState<string>('');
  const [dropoffStopId, setDropoffStopId] = useState<string>('');
  const [seatsRequested, setSeatsRequested] = useState<number>(1);

  const [estimate, setEstimate] = useState<FareEstimateResponse | null>(null);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [booking, setBooking] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Auto-select first route when loaded
  useEffect(() => {
    if (routes && routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  // Reset stop selections if route changes
  useEffect(() => {
    setPickupStopId('');
    setDropoffStopId('');
    setEstimate(null);
  }, [selectedRouteId]);

  // Fetch fare estimate when pickup and dropoff are both selected
  useEffect(() => {
    if (!pickupStopId || !dropoffStopId || pickupStopId === dropoffStopId) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setEstimating(true);
      setError('');
      try {
        const res = await apiFetch<FareEstimateResponse>('/fare/estimate', {
          method: 'POST',
          body: JSON.stringify({
            pickupStopId,
            dropoffStopId,
            seatsRequested,
          }),
        });
        setEstimate(res);
      } catch (err: any) {
        setError(err.message || 'Failed to estimate fare');
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    };

    fetchEstimate();
  }, [pickupStopId, dropoffStopId, seatsRequested]);

  // Handle Stop Click from SVG Map
  const handleStopSelectFromMap = (stop: Stop) => {
    // If route isn't matching selected route, switch route
    if (stop.routeId && stop.routeId !== selectedRouteId) {
      setSelectedRouteId(stop.routeId);
    }

    if (!pickupStopId) {
      setPickupStopId(stop.id);
    } else if (!dropoffStopId && stop.id !== pickupStopId) {
      setDropoffStopId(stop.id);
    } else {
      // Toggle or restart selection
      setPickupStopId(stop.id);
      setDropoffStopId('');
    }
  };

  // Submit Booking
  const handleBookRide = async () => {
    if (!pickupStopId || !dropoffStopId || !selectedRouteId) return;
    setBooking(true);
    setError('');

    try {
      const res = await apiFetch<{ id: string; status: string }>('/rides', {
        method: 'POST',
        body: JSON.stringify({
          pickupStopId,
          dropoffStopId,
          routeId: selectedRouteId,
          seatsRequested,
        }),
      });

      router.push(`/ride/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to book ride. Please try again.');
      setBooking(false);
    }
  };

  const availableStops = routeStops.length > 0 ? routeStops : stops;

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Book a Pool Ride</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Select your route and stops on the map or dropdown below.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Map */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {routes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRouteId(r.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  border: `1px solid ${selectedRouteId === r.id ? r.color : 'var(--border-color)'}`,
                  background: selectedRouteId === r.id ? `${r.color}22` : 'var(--bg-secondary)',
                  color: selectedRouteId === r.id ? r.color : 'var(--text-secondary)',
                  fontWeight: selectedRouteId === r.id ? 600 : 400,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                ● {r.name} ({r.code})
              </button>
            ))}
          </div>

          <RouteMap
            routes={routes}
            stops={stops}
            selectedRouteId={selectedRouteId}
            pickupStopId={pickupStopId}
            dropoffStopId={dropoffStopId}
            onSelectStop={handleStopSelectFromMap}
          />
        </div>

        {/* Right: Booking Form */}
        <Card title="Trip Details">
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Route Selector */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Selected Route
              </label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Pickup Stop */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--accent-green)' }}>
                🟢 Pickup Stop
              </label>
              <select
                value={pickupStopId}
                onChange={(e) => setPickupStopId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value="">Select pickup stop...</option>
                {availableStops.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === dropoffStopId}>
                    {s.sequenceOrder ? `${s.sequenceOrder}. ` : ''}{s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Dropoff Stop */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--accent-red)' }}>
                🔴 Drop-off Stop
              </label>
              <select
                value={dropoffStopId}
                onChange={(e) => setDropoffStopId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value="">Select drop-off stop...</option>
                {availableStops.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === pickupStopId}>
                    {s.sequenceOrder ? `${s.sequenceOrder}. ` : ''}{s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Seats requested */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Seats
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeatsRequested(num)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${seatsRequested === num ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                      background: seatsRequested === num ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
                      color: seatsRequested === num ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {num} {num === 1 ? 'Seat' : 'Seats'}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimate breakdown card */}
            {estimating && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Calculating Tesla Pool fare...
              </div>
            )}

            {estimate && !estimating && (
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Distance:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{estimate.distanceKm.toFixed(2)} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Est. Duration:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>~{estimate.estimatedDurationMin} mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Demand Multiplier:</span>
                  <Badge variant={estimate.surgeMultiplier > 1 ? 'warning' : 'neutral'}>
                    {estimate.surgeMultiplier}x Surge
                  </Badge>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--border-color)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Fare:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                    {formatBDT(estimate.farePaisa)}
                  </span>
                </div>
              </div>
            )}

            {/* Book Button */}
            <Button
              variant="primary"
              fullWidth
              disabled={!pickupStopId || !dropoffStopId || !estimate || booking}
              loading={booking}
              onClick={handleBookRide}
            >
              {booking ? 'Requesting Ride...' : 'Request Ride Now'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
