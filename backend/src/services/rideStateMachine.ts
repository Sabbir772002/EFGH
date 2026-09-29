// Ride State Machine
// Validates FSM transitions for both RideRequest and Pool status.
// Rule: only allowed transitions pass — everything else throws 400.
//
// Ride Request FSM:
//   requested → matched → driver_arrived → started → completed
//   requested → cancelled
//   matched   → cancelled (driver only)
//
// Pool FSM:
//   open → full → driver_arrived → started → completed
//   open | full | driver_arrived | started → cancelled

import { RideStatus, PoolStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Ride Request transitions
// ---------------------------------------------------------------------------
const RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  requested: ['matched', 'cancelled'],
  matched: ['driver_arrived', 'cancelled'],
  driver_arrived: ['started'],
  started: ['completed'],
  completed: [],   // terminal state
  cancelled: [],   // terminal state
};

// Who is allowed to trigger each transition?
const RIDE_TRANSITION_ACTOR: Partial<Record<`${RideStatus}→${RideStatus}`, 'passenger' | 'driver' | 'any'>> = {
  'requested→matched': 'driver',
  'requested→cancelled': 'passenger',
  'matched→driver_arrived': 'driver',
  'matched→cancelled': 'driver',
  'driver_arrived→started': 'driver',
  'started→completed': 'driver',
};

export function validateRideTransition(
  current: RideStatus,
  next: RideStatus,
  actorRole: 'passenger' | 'driver',
): void {
  const allowed = RIDE_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new TransitionError(
      `Ride cannot move from '${current}' to '${next}'`,
    );
  }

  const key = `${current}→${next}` as `${RideStatus}→${RideStatus}`;
  const requiredRole = RIDE_TRANSITION_ACTOR[key];
  if (requiredRole && requiredRole !== 'any' && requiredRole !== actorRole) {
    throw new TransitionError(
      `Only a ${requiredRole} can move a ride from '${current}' to '${next}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// Pool transitions
// ---------------------------------------------------------------------------
const POOL_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  open: ['full', 'driver_arrived', 'cancelled'], // driver can depart without filling up
  full: ['driver_arrived', 'cancelled'],
  driver_arrived: ['started', 'cancelled'],
  started: ['completed'],           // cannot cancel once started
  completed: [],
  cancelled: [],
};

export function validatePoolTransition(
  current: PoolStatus,
  next: PoolStatus,
): void {
  const allowed = POOL_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new TransitionError(
      `Pool cannot move from '${current}' to '${next}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// Map pool status → corresponding ride status for cascade updates
// When driver advances pool lifecycle, all active rides in the pool follow.
// ---------------------------------------------------------------------------
export const POOL_TO_RIDE_STATUS: Partial<Record<PoolStatus, RideStatus>> = {
  driver_arrived: 'driver_arrived',
  started: 'started',
  completed: 'completed',
  cancelled: 'cancelled',
};

// ---------------------------------------------------------------------------
// TransitionError — caught by errorHandler → 400 Bad Request
// ---------------------------------------------------------------------------
export class TransitionError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}
