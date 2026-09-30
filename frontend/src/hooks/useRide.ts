// hooks/useRide.ts
// SWR + SSE hybrid for a single ride request.
//
// Strategy:
//  - SWR fetches the ride on mount (initial data, cache, deduplication).
//  - useSSE subscribes to /sse/ride/:id for real-time server pushes.
//  - When SSE delivers new data, it overwrites the SWR cache → UI updates instantly.
//  - If SSE disconnects, SWR's own revalidation kicks in as fallback.

'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { swrFetcher } from '@/lib/api';
import { useSSE } from './useSSE';
import { API } from '@/lib/constants';
import type { RideRequest } from '@/lib/types';

interface RideResponse {
  ride: RideRequest;
}

interface UseRideResult {
  ride: RideRequest | null;
  isLoading: boolean;
  error: unknown;
  isSSEConnected: boolean;
  /** Force a manual refetch (e.g. after a PATCH action). */
  refresh: () => void;
}

export function useRide(rideId: string | null): UseRideResult {
  const swrKey = rideId ? `${API.rides}/${rideId}` : null;

  const { data, error, isLoading, mutate } = useSWR<RideRequest>(
    swrKey,
    async (url: string) => {
      const response = await swrFetcher<RideResponse>(url);
      return response.ride;
    },
    {
      revalidateOnFocus: false,
      // Slow poll as SSE safety net (SSE is the primary real-time channel)
      refreshInterval: 10_000,
    },
  );

  // Subscribe to SSE for live push updates
  const { data: sseData, isConnected: isSSEConnected } = useSSE<RideRequest>(
    rideId ? API.sseRide(rideId) : null,
    { enabled: !!rideId },
  );

  // When SSE delivers fresh data, update the SWR cache without a network call
  useEffect(() => {
    if (sseData) {
      mutate((current) => current ? {
        ...current,
        ...sseData,
        pool: current.pool && sseData.pool
          ? { ...current.pool, ...sseData.pool, route: current.pool.route }
          : current.pool,
      } : sseData, false);
    }
  }, [sseData, mutate]);

  return {
    ride: data ?? null,
    isLoading,
    error,
    isSSEConnected,
    refresh: () => mutate(),
  };
}
