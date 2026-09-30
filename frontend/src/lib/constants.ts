// lib/constants.ts
// App-wide constants — API base URL, local storage keys, route paths, seed data labels.
// All magic strings centralised here so a URL change is a one-line fix.

// ── API ────────────────────────────────────────────────────────────────────

const rawApiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const API_BASE = rawApiBase.endsWith('/api/v1')
  ? rawApiBase
  : `${rawApiBase.replace(/\/+$/, '')}/api/v1`;

// ── Local storage keys ─────────────────────────────────────────────────────

export const LS_TOKEN = 'tesla_pool_token';   // JWT string
export const LS_USER  = 'tesla_pool_user';    // serialised User JSON

// Cookie name used by Next.js middleware for server-side route protection.
export const COOKIE_TOKEN = 'tesla_token';

// ── Routes (Next.js paths) ─────────────────────────────────────────────────

export const ROUTES = {
  home:               '/',
  login:              '/login',
  register:           '/register',

  // Passenger
  passengerDashboard: '/passenger/dashboard',
  book:               '/passenger/book',
  ride:               (id: string) => `/passenger/ride/${id}`,
  passengerHistory:   '/passenger/history',

  // Driver
  driverDashboard:    '/driver/dashboard',
  pool:               (id: string) => `/driver/pool/${id}`,
  driverHistory:      '/driver/history',
} as const;

// ── API endpoint paths (relative to API_BASE) ─────────────────────────────

export const API = {
  login:            '/auth/login',
  register:         '/auth/register',
  stops:            '/stops',
  routes:           '/routes',
  routeStops:       (routeId: string) => `/routes/${routeId}/stops`,
  fareEstimate:     '/fare/estimate',
  rides:            '/rides',
  cancelRide:       (id: string) => `/rides/${id}/cancel`,
  poolsPending:     '/pools/pending',
  acceptPool:       (rideReqId: string) => `/pools/${rideReqId}/accept`,
  poolStatus:       (poolId: string) => `/pools/${poolId}/status`,
  driverStatus:     '/driver/status',
  driverDashboard:  '/driver/dashboard',
  vehiclesMine:     '/vehicles/mine',
  sseRide:          (id: string) => `/sse/ride/${id}`,
  sseDriverReqs:    '/sse/driver/requests',
} as const;

// ── Fare helpers ────────────────────────────────────────────────────────────

/** Convert integer paisa → display string: 500 → "৳5.00" */
export function formatBDT(paisa: number | null | undefined): string {
  if (paisa == null) return '—';
  return `৳${(paisa / 100).toFixed(2)}`;
}

/** Convert integer paisa → plain taka number: 500 → 5 */
export function paisaToTaka(paisa: number): number {
  return paisa / 100;
}

// ── Ride status labels (human-readable) ───────────────────────────────────

export const RIDE_STATUS_LABEL: Record<string, string> = {
  requested:      'Waiting for driver',
  matched:        'Driver matched',
  driver_arrived: 'Driver arrived',
  started:        'Ride in progress',
  completed:      'Completed',
  cancelled:      'Cancelled',
};

export const POOL_STATUS_LABEL: Record<string, string> = {
  open:           'Accepting passengers',
  full:           'Full',
  driver_arrived: 'Driver arrived',
  started:        'Ride in progress',
  completed:      'Completed',
  cancelled:      'Cancelled',
};
