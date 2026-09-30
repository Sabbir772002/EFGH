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
  const { routes, isLoading: loadingRoutes } = useRoutes();
  const { stops, isLoading: loadingStops } = useStops();

  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const { stops: routeStops } = useRouteStops(selectedRouteId || null);

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
    if (!selectedRouteId || !pickupStopId || !dropoffStopId || pickupStopId === dropoffStopId) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setEstimating(true);
      setError('');
      try {
        const query = new URLSearchParams({
          pickupStopId,
          dropoffStopId,
          routeId: selectedRouteId,
        });
        const res = await apiFetch<{
          estimate: { soloFarePaisa: number };
          debug: { routeDistKm: string; fullRouteFareTk: number };
        }>(`/fare/estimate?${query.toString()}`, { method: 'GET' });

        setEstimate({
          fare_paisa: res.estimate.soloFarePaisa,
          fare_bdt: res.estimate.soloFarePaisa / 100,
          route_dist_km: Number(res.debug.routeDistKm),
          route_fare_bdt: res.debug.fullRouteFareTk,
          farePaisa: res.estimate.soloFarePaisa,
          distanceKm: Number(res.debug.routeDistKm),
          estimatedDurationMin: 15,
          surgeMultiplier: 1,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to estimate fare');
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    };

    fetchEstimate();
  }, [selectedRouteId, pickupStopId, dropoffStopId]);

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
      const res = await apiFetch<{ rideRequestId: string; status: string }>('/rides', {
        method: 'POST',
        body: {
          pickupStopId,
          dropoffStopId,
          routeId: selectedRouteId,
          seats: seatsRequested,
        },
      });

      router.push(`/passenger/ride/${res.rideRequestId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to book ride. Please try again.');
      setBooking(false);
    }
  };

  const availableStops = routeStops.length > 0 ? routeStops : stops;

  return (
    <div style={{ padding: '0.5rem 0', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Book a Pool Ride</h1>
        <p style={{ color: 'var(--muted)', marginTop: '0.2rem', fontSize: '0.85rem' }}>
          Select your route and stops on the map or dropdown below.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Left: Map */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '0.875rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {routes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRouteId(r.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${selectedRouteId === r.id ? r.color : 'var(--border)'}`,
                  background: selectedRouteId === r.id ? `${r.color}22` : 'var(--surface2)',
                  color: selectedRouteId === r.id ? r.color : 'var(--muted)',
                  fontWeight: selectedRouteId === r.id ? 600 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                ● {r.name}
              </button>
            ))}
          </div>

          <RouteMap
            stops={stops}
            pickup={stops.find((s) => s.id === pickupStopId) || null}
            dropoff={stops.find((s) => s.id === dropoffStopId) || null}
            onStopClick={handleStopSelectFromMap}
            activeRouteKey={routes.find((r) => r.id === selectedRouteId)?.code?.toLowerCase()}
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
                {[1, 2, 3].map((num) => (
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
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(estimate.distanceKm ?? estimate.route_dist_km ?? 0).toFixed(2)} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Est. Duration:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>~{estimate.estimatedDurationMin ?? 15} mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Demand Multiplier:</span>
                  <Badge variant={(estimate.surgeMultiplier ?? 1) > 1 ? 'warning' : 'neutral'}>
                    {estimate.surgeMultiplier ?? 1.0}x Surge
                  </Badge>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--border-color)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Fare:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                    {formatBDT(estimate.farePaisa ?? estimate.fare_paisa ?? 0)}
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
