// State Machine test — FSM transition validation
// Verifies only valid transitions are accepted, invalid ones return errors
import {
  validateRideTransition,
  validatePoolTransition,
  TransitionError,
} from '../src/services/rideStateMachine';
import { RideStatus, PoolStatus } from '@prisma/client';

describe('Ride State Machine — valid transitions', () => {
  test('requested → matched (driver)', () => {
    expect(() => validateRideTransition('requested', 'matched', 'driver')).not.toThrow();
  });

  test('requested → cancelled (passenger)', () => {
    expect(() => validateRideTransition('requested', 'cancelled', 'passenger')).not.toThrow();
  });

  test('matched → driver_arrived (driver)', () => {
    expect(() => validateRideTransition('matched', 'driver_arrived', 'driver')).not.toThrow();
  });

  test('driver_arrived → started (driver)', () => {
    expect(() => validateRideTransition('driver_arrived', 'started', 'driver')).not.toThrow();
  });

  test('started → completed (driver)', () => {
    expect(() => validateRideTransition('started', 'completed', 'driver')).not.toThrow();
  });
});

describe('Ride State Machine — invalid transitions', () => {
  test('requested → completed ❌', () => {
    expect(() => validateRideTransition('requested', 'completed', 'driver'))
      .toThrow(TransitionError);
  });

  test('started → cancelled ❌', () => {
    expect(() => validateRideTransition('started', 'cancelled', 'driver'))
      .toThrow(TransitionError);
  });

  test('completed → anything ❌', () => {
    expect(() => validateRideTransition('completed', 'cancelled', 'driver'))
      .toThrow(TransitionError);
  });

  test('cancelled → anything ❌', () => {
    expect(() => validateRideTransition('cancelled', 'requested', 'passenger'))
      .toThrow(TransitionError);
  });

  test('requested → matched by passenger ❌ (driver-only)', () => {
    expect(() => validateRideTransition('requested', 'matched', 'passenger'))
      .toThrow(TransitionError);
  });

  test('requested → cancelled by driver ❌ (passenger-only from requested)', () => {
    // Driver can cancel from matched, not requested
    expect(() => validateRideTransition('requested', 'cancelled', 'driver'))
      .toThrow(TransitionError);
  });

  test('matched → cancelled by passenger ❌ (driver-only from matched)', () => {
    expect(() => validateRideTransition('matched', 'cancelled', 'passenger'))
      .toThrow(TransitionError);
  });
});

describe('Pool State Machine — valid transitions', () => {
  test('open → full', () => {
    expect(() => validatePoolTransition('open', 'full')).not.toThrow();
  });

  test('full → driver_arrived', () => {
    expect(() => validatePoolTransition('full', 'driver_arrived')).not.toThrow();
  });

  test('driver_arrived → started', () => {
    expect(() => validatePoolTransition('driver_arrived', 'started')).not.toThrow();
  });

  test('started → completed', () => {
    expect(() => validatePoolTransition('started', 'completed')).not.toThrow();
  });

  test('open → cancelled', () => {
    expect(() => validatePoolTransition('open', 'cancelled')).not.toThrow();
  });
});

describe('Pool State Machine — invalid transitions', () => {
  test('open → started ❌ (must go through full → driver_arrived)', () => {
    expect(() => validatePoolTransition('open', 'started')).toThrow(TransitionError);
  });

  test('started → cancelled ❌ (cannot cancel an in-progress trip)', () => {
    expect(() => validatePoolTransition('started', 'cancelled')).toThrow(TransitionError);
  });

  test('completed → cancelled ❌', () => {
    expect(() => validatePoolTransition('completed', 'cancelled')).toThrow(TransitionError);
  });

  test('cancelled → open ❌', () => {
    expect(() => validatePoolTransition('cancelled', 'open')).toThrow(TransitionError);
  });
});
