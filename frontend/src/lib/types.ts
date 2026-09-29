// lib/types.ts
// TypeScript interfaces that mirror the backend Prisma schema and API responses.
// Single source of truth for all frontend types — import from here, never redefine.

// ── Enums ──────────────────────────────────────────────────────────────────

export type UserRole = 'passenger' | 'driver';

export type RideStatus =
  | 'requested'
  | 'matched'
  | 'driver_arrived'
  | 'started'
  | 'completed'
  | 'cancelled';

export type PoolStatus =
  | 'open'
  | 'full'
  | 'driver_arrived'
  | 'started'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'wallet';
export type PaymentStatus = 'pending' | 'paid';

// ── Domain Models ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  wallet_paisa: number;
  is_online: boolean;
  created_at: string; // ISO string
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  capacity: number;
  driver_id: string;
  created_at: string;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
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

export interface RideRequest {
  id: string;
  passenger_id: string;
  pool_id: string | null;
  pickup_stop_id: string;
  dropoff_stop_id: string;
  seats: number;
  fare_paisa: number | null;   // null until matched
  status: RideStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  pickup_note?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  passenger?: User;
  pool?: Pool;
  pickup_stop?: Stop;
  dropoff_stop?: Stop;
}

// ── API Request / Response shapes ──────────────────────────────────────────

export interface AuthLoginRequest {
  phone: string;
  password: string;
}

export interface AuthRegisterRequest {
  name: string;
  phone: string;
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
  matched: boolean;           // true = joined an open pool immediately
  pool?: Pool;
}

export interface FareEstimateResponse {
  fare_paisa: number;
  fare_bdt: number;
  route_dist_km: number;
  route_fare_bdt: number;
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
