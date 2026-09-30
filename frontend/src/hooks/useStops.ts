// hooks/useStops.ts
// SWR hooks for stops and routes.
// Stops and routes are static seed data — revalidate only once per session.

'use client';

import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';
import { API } from '@/lib/constants';
import type { Stop, Route, RouteWithStops } from '@/lib/types';

// ── All stops ─────────────────────────────────────────────────────────────

interface UseStopsResult {
  stops: Stop[];
  isLoading: boolean;
  error: unknown;
}

interface StopsResponse {
  count: number;
  stops: Stop[];
}

interface RoutesResponse {
  routes: Route[];
}

interface RouteStopsResponse {
  route: Route;
  stops: Array<{
    order: number;
    stop: Stop;
  }>;
}

export function useStops(): UseStopsResult {
  const { data, error, isLoading } = useSWR<StopsResponse>(API.stops, swrFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false, // stops are seeded once; never change at runtime
  });

  return {
    stops: data?.stops ?? [],
    isLoading,
    error,
  };
}

// ── All routes ────────────────────────────────────────────────────────────

interface UseRoutesResult {
  routes: Route[];
  isLoading: boolean;
  error: unknown;
}

export function useRoutes(): UseRoutesResult {
  const { data, error, isLoading } = useSWR<RoutesResponse>(API.routes, swrFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  return {
    routes: data?.routes ?? [],
    isLoading,
    error,
  };
}

// ── Stops for a specific route (ordered by stop_order) ───────────────────

interface UseRouteStopsResult {
  stops: Stop[];
  isLoading: boolean;
  error: unknown;
}

export function useRouteStops(routeId: string | null): UseRouteStopsResult {
  const swrKey = routeId ? API.routeStops(routeId) : null;

  const { data, error, isLoading } = useSWR<RouteStopsResponse>(swrKey, swrFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  return {
    stops: data?.stops.map(({ order, stop }) => ({ ...stop, sequenceOrder: order })) ?? [],
    isLoading,
    error,
  };
}
