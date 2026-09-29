// Audit Logger Service
// Writes immutable event records to audit_log.
// Rules: INSERT only — never UPDATE, never DELETE.
// Every significant state change (ride status, pool status, fare lock) is recorded.

import { prisma } from '../db';

export type EntityType = 'ride_request' | 'pool' | 'user' | 'vehicle';

export interface AuditEntry {
  entityType: EntityType;
  entityId: string;
  action: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  actorId: string;
}

// ---------------------------------------------------------------------------
// log — INSERT one immutable audit record
// ---------------------------------------------------------------------------
export async function log(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId:   entry.entityId,
      action:     entry.action,
      oldValue:   entry.oldValue ?? {},
      newValue:   entry.newValue ?? {},
      actorId:    entry.actorId,
    },
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers — strongly typed action strings
// ---------------------------------------------------------------------------

export const AuditAction = {
  RIDE_CREATED:          'ride.created',
  RIDE_MATCHED:          'ride.matched',
  RIDE_STATUS_CHANGED:   'ride.status_changed',
  RIDE_CANCELLED:        'ride.cancelled',
  RIDE_FARE_LOCKED:      'ride.fare_locked',

  POOL_CREATED:          'pool.created',
  POOL_STATUS_CHANGED:   'pool.status_changed',
  POOL_CANCELLED:        'pool.cancelled',

  USER_LOGIN:            'user.login',
  USER_REGISTERED:       'user.registered',
  DRIVER_STATUS_CHANGED: 'driver.status_changed',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
