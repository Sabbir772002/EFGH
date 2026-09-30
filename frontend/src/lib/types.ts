// lib/types.ts
// TypeScript interfaces that mirror the backend Prisma schema and API responses.
// Single source of truth for all frontend types — import from here, never redefine.

// ── Enums ──────────────────────────────────────────────────────────────────

// Backend always returns lowercase role values
export type UserRole = 'passenger' | 'driver';

export type RideStatus =
  | 'REQUESTED'
  | 'MATCHED'
  | 'DRIVER_ASSIGNED'
  | 'EN_ROUTE_PICKUP'
  | 'PICKED_UP'
  | 'EN_ROUTE_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED'
  // lowercase aliases (legacy)
  | 'requested'
  | 'matched'
  | 'driver_arrived'
  | 'started'
  | 'completed'
  | 'cancelled';

export type PoolStatus =
  | 'OPEN' | 'FULL' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED'
  | 'open' | 'full' | 'driver_arrived' | 'started' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash' | 'wallet';
export type PaymentStatus = 'pending' | 'paid';

// ── Domain Models ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  // Backend returns lowercase role: 'passenger' | 'driver'
  role: 'passenger' | 'driver';
  // Backend returns camelCase fields
  walletPaisa: number;
  isOnline: boolean;
  createdAt: string; // ISO string
  // Snake_case aliases for backwards compat
  wallet_paisa?: number;
  is_online?: boolean;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  capacity: number;
  driver_id: string;
  created_at: string;
  // Extended fields from ride page
  model?: string;
  color?: string;
  licensePlate?: string;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  code?: string;
  sequenceOrder?: number;
  routeId?: string;
}

export interface Route {
  id: string;
  name: string;
  code?: string;
  color?: string;
  description?: string;
}

export interface RouteWithStops extends Route {
  stops: Stop[];           // ordered by stop_order
}

export interface Pool {
  id: string;
  vehicle_id: string;
  route_id: string;
  origin_stop_id: string;
  dest_stop_id: string;
  status: PoolStatus;
  created_at: string;
  updated_at: string;
  // Joined fields (populated by dashboard/detail endpoints)
  vehicle?: Vehicle;
  route?: Route;
  origin_stop?: Stop;
  dest_stop?: Stop;
  ride_requests?: RideRequest[];
  occupied_seats?: number;
}

export interface Ride {
  id: string;
  passenger_id: string;
  pool_id: string | null;
  pickup_stop_id: string;
  dropoff_stop_id: string;
  seats: number;
  fare_paisa: number | null;
  farePaisa?: number | null;       // camelCase alias
  status: RideStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  pickup_note?: string;
  created_at: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  // Joined fields
  passenger?: User;
  driver?: User;
  vehicle?: Vehicle;
  pool?: Pool;
  route?: Route;
  pickup_stop?: Stop;
  dropoff_stop?: Stop;
  pickupStop?: Stop;        // camelCase aliases
  dropoffStop?: Stop;
  pickupCode?: string;      // OTP verification code
  surgeMultiplier?: number;
  seatsRequested?: number;
}

// Alias for backwards compat — RideRequest was the original name
export interface RideRequest {
  id: string;
  passenger_id: string;
  pool_id: string | null;
  pickup_stop_id: string;
  dropoff_stop_id: string;
  seats: number;
  fare_paisa: number | null;
  farePaisa?: number | null;
  status: RideStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  pickup_note?: string;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
  // Joined fields
  passenger?: User;
  driver?: User;
  vehicle?: Vehicle;
  pool?: Pool;
  route?: Route;
  pickup_stop?: Stop;
  dropoff_stop?: Stop;
  pickupStop?: Stop;
  dropoffStop?: Stop;
  pickupCode?: string;
  surgeMultiplier?: number;
  seatsRequested?: number;
}

// ── API Request / Response shapes ──────────────────────────────────────────

export interface AuthLoginRequest {
  phone: string;
  password: string;
}

export interface AuthRegisterRequest {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface BookRideRequest {
  pickup_stop_id: string;
  dropoff_stop_id: string;
  route_id: string;
  seats?: number;
  payment_method?: PaymentMethod;
  pickup_note?: string;
}

export interface BookRideResponse {
  ride: RideRequest;
  matched: boolean;
  pool?: Pool;
}

export interface FareEstimateResponse {
  fare_paisa: number;
  fare_bdt: number;
  route_dist_km: number;
  route_fare_bdt: number;
  // camelCase / computed aliases
  farePaisa?: number;
  distanceKm?: number;
  estimatedDurationMin?: number;
  surgeMultiplier?: number;
}

export interface DriverDashboardResponse {
  user: User;
  vehicle: Vehicle | null;
  active_pool: Pool | null;
  available_seats: number;
}

// ── Generic API wrapper ────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: unknown;
}
