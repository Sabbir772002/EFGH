import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma, RideStatus, PoolStatus } from '@prisma/client';
import { prisma } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  validatePoolTransition,
  validateRideTransition,
  POOL_TO_RIDE_STATUS,
  TransitionError,
} from '../services/rideStateMachine';
import {
  calcPassengerFarePaisa,
  buildSegmentLoads,
  StopCoord,
} from '../services/fareCalculator';
import { log, AuditAction } from '../services/auditLogger';

const router = Router();
router.use(authMiddleware);

function requireDriver(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role !== 'driver') {
    res.status(403).json({ error: 'Only drivers can access this endpoint' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/v1/pools/pending
// Returns REQUESTED (unmatched) ride_requests with no pool yet.
// Optionally filter by routeId: ?routeId=<uuid>
// Driver sees these and picks which ones to accept.
// ---------------------------------------------------------------------------
router.get('/pending', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!requireDriver(req, res)) return;

    const { routeId } = req.query as { routeId?: string };

    // If routeId filter provided: return requests where pickup & dropoff are both on that route
    let stopIds: string[] | undefined;
    if (routeId) {
      const routeStops = await prisma.routeStop.findMany({
        where: { routeId },
        select: { stopId: true },
      });
      stopIds = routeStops.map((rs) => rs.stopId);
    }

    const pending = await prisma.rideRequest.findMany({
      where: {
        status: 'requested',
        poolId: null,
        ...(stopIds
          ? { pickupStopId: { in: stopIds }, dropoffStopId: { in: stopIds } }
          : {}),
      },
      orderBy: { createdAt: 'asc' }, // oldest first
      include: {
        passenger:   { select: { id: true, name: true, phone: true } },
        pickupStop:  { select: { id: true, name: true, lat: true, lng: true } },
        dropoffStop: { select: { id: true, name: true, lat: true, lng: true } },
      },
    });

    res.json({ count: pending.length, pending });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/pools/:rideRequestId/accept
// Driver accepts an unmatched ride request.
// Body: { routeId: string }
//
// Logic:
//   1. Validate ride is REQUESTED + unmatched
//   2. Find driver's active OPEN pool (if any)
//      - If exists: check capacity, add passenger, recalc fare
//      - If none: create new pool, then add passenger
//   3. Lock fare, update ride status to MATCHED
//   4. All inside Serializable transaction
// ---------------------------------------------------------------------------
const acceptSchema = z.object({
  routeId: z.string().uuid('routeId must be a valid UUID'),
});

router.post('/:rideRequestId/accept', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!requireDriver(req, res)) return;

    const { routeId } = acceptSchema.parse(req.body);
    const { rideRequestId } = req.params;
    const driverId = req.user!.id;

    const rideRequest = await prisma.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { pickupStop: true, dropoffStop: true },
    });

    if (!rideRequest) {
      res.status(404).json({ error: 'Ride request not found' });
      return;
    }
    if (rideRequest.status !== 'requested' || rideRequest.poolId !== null) {
      res.status(400).json({ error: 'Ride is already matched or not in REQUESTED state' });
      return;
    }

    // Validate pickup + dropoff are both on the driver's chosen route (in order)
    const [pickupRS, dropoffRS] = await Promise.all([
      prisma.routeStop.findFirst({ where: { routeId, stopId: rideRequest.pickupStopId } }),
      prisma.routeStop.findFirst({ where: { routeId, stopId: rideRequest.dropoffStopId } }),
    ]);

    if (!pickupRS) {
      res.status(400).json({ error: 'Passenger pickup stop is not on the selected route' });
      return;
    }
    if (!dropoffRS) {
      res.status(400).json({ error: 'Passenger dropoff stop is not on the selected route' });
      return;
    }
    if (pickupRS.stopOrder >= dropoffRS.stopOrder) {
      res.status(400).json({ error: 'Pickup must come before dropoff on this route' });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
    if (!vehicle) {
      res.status(400).json({ error: 'Driver has no registered vehicle' });
      return;
    }

    // Load full ordered route stops for fare calculation
    const routeStopsFull = await prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { stopOrder: 'asc' },
      include: { stop: true },
    });

    const stopCoords: StopCoord[] = routeStopsFull.map((rs) => ({
      id: rs.stop.id,
      lat: Number(rs.stop.lat),
      lng: Number(rs.stop.lng),
    }));

    const result = await prisma.$transaction(async (tx) => {
      // Find or create pool for this driver
      let pool = await tx.pool.findFirst({
        where: {
          vehicleId: vehicle.id,
          routeId,
          status: 'open',
        },
      });

      if (!pool) {
        // Create new pool — origin = first stop of route, dest = last stop
        const originStop = routeStopsFull[0].stop;
        const destStop   = routeStopsFull[routeStopsFull.length - 1].stop;

        pool = await tx.pool.create({
          data: {
            vehicleId:    vehicle.id,
            routeId,
            originStopId: originStop.id,
            destStopId:   destStop.id,
            status:       'open',
          },
        });

        await log({
          entityType: 'pool',
          entityId:   pool.id,
          action:     AuditAction.POOL_CREATED,
          newValue:   { routeId, vehicleId: vehicle.id },
          actorId:    driverId,
        });
      } else {
        // Lock existing pool row
        await tx.$queryRaw`SELECT id FROM pools WHERE id = ${pool.id}::uuid FOR UPDATE`;
      }

      // Recount seats after lock
      const takenAgg = await tx.rideRequest.aggregate({
        _sum: { seats: true },
        where: { poolId: pool.id, status: { not: 'cancelled' } },
      });
      const taken = takenAgg._sum.seats ?? 0;

      if (Number(vehicle.capacity) - taken < rideRequest.seats) {
        throw new Error(`Not enough seats: ${vehicle.capacity - taken} free, need ${rideRequest.seats}`);
      }

      // Calc fare: existing passengers + this new one
      const existingRides = await tx.rideRequest.findMany({
        where: { poolId: pool.id, status: { not: 'cancelled' } },
        select: { pickupStopId: true, dropoffStopId: true, seats: true },
      });

      const allPassengers = [
        ...existingRides.flatMap((r) =>
          Array(r.seats).fill({ pickupStopId: r.pickupStopId, dropoffStopId: r.dropoffStopId })
        ),
        ...Array(rideRequest.seats).fill({
          pickupStopId: rideRequest.pickupStopId,
          dropoffStopId: rideRequest.dropoffStopId,
        }),
      ];

      const segmentLoads = buildSegmentLoads(stopCoords, allPassengers);
      const farePaisa = calcPassengerFarePaisa(
        stopCoords,
        rideRequest.pickupStopId,
        rideRequest.dropoffStopId,
        segmentLoads,
      );

      // Update the ride request — match it to pool
      const updatedRide = await tx.rideRequest.update({
        where: { id: rideRequestId },
        data: {
          poolId: pool.id,
          status: 'matched',
          farePaisa,
        },
      });

      // Check if pool is now full
      const newTaken = taken + rideRequest.seats;
      if (newTaken >= vehicle.capacity) {
        await tx.pool.update({ where: { id: pool.id }, data: { status: 'full' } });
      }

      return { pool, updatedRide, farePaisa };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10_000,
    });

    await log({
      entityType: 'ride_request',
      entityId:   rideRequestId,
      action:     AuditAction.RIDE_MATCHED,
      oldValue:   { status: 'requested', farePaisa: null },
      newValue:   { status: 'matched', farePaisa: result.farePaisa, poolId: result.pool.id },
      actorId:    driverId,
    });

    res.status(201).json({
      message: 'Ride accepted and matched',
      poolId:    result.pool.id,
      rideRequest: {
        id:        result.updatedRide.id,
        status:    result.updatedRide.status,
        farePaisa: result.farePaisa,
        fareTk:    (result.farePaisa / 100).toFixed(2),
      },
    });
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/pools/:poolId/status
// Driver advances pool lifecycle: driver_arrived → started → completed
// Cascades status to ALL active ride_requests in the pool.
// Body: { status: 'driver_arrived' | 'started' | 'completed' | 'cancelled' }
// ---------------------------------------------------------------------------
const statusSchema = z.object({
  status: z.enum(['driver_arrived', 'started', 'completed', 'cancelled']),
});

router.patch('/:poolId/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!requireDriver(req, res)) return;

    const { status: nextStatus } = statusSchema.parse(req.body);
    const { poolId } = req.params;
    const driverId = req.user!.id;

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { vehicle: true },
    });

    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    // Only the driver of this pool's vehicle can advance it
    if (pool.vehicle.driverId !== driverId) {
      res.status(403).json({ error: 'This is not your pool' });
      return;
    }

    // Validate FSM transition
    try {
      validatePoolTransition(pool.status as PoolStatus, nextStatus as PoolStatus);
    } catch (err) {
      if (err instanceof TransitionError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    // Cascade ride status to all active passengers
    const rideNextStatus = POOL_TO_RIDE_STATUS[nextStatus as PoolStatus];

    await prisma.$transaction(async (tx) => {
      // Advance pool
      await tx.pool.update({
        where: { id: poolId },
        data:  { status: nextStatus },
      });

      // Cascade to active ride_requests
      if (rideNextStatus) {
        const activeRides = await tx.rideRequest.findMany({
          where: { poolId, status: { notIn: ['cancelled', 'completed'] } },
        });

        for (const ride of activeRides) {
          try {
            validateRideTransition(ride.status as RideStatus, rideNextStatus, 'driver');
            await tx.rideRequest.update({
              where: { id: ride.id },
              data:  { status: rideNextStatus },
            });
          } catch {
            // Skip rides that can't follow (e.g., already cancelled)
          }
        }
      }
    });

    await log({
      entityType: 'pool',
      entityId:   poolId,
      action:     AuditAction.POOL_STATUS_CHANGED,
      oldValue:   { status: pool.status },
      newValue:   { status: nextStatus },
      actorId:    driverId,
    });

    res.json({
      message: `Pool status updated to '${nextStatus}'`,
      poolId,
      status: nextStatus,
      rideCascade: rideNextStatus ?? 'no cascade',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
