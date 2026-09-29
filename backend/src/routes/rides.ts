import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { matchOrEnqueue } from '../services/poolMatcher';
import { validateRideTransition, TransitionError } from '../services/rideStateMachine';
import { log, AuditAction } from '../services/auditLogger';
import { RideStatus } from '@prisma/client';

const router = Router();

// All ride routes require authentication
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// POST /api/v1/rides — Passenger books a ride
// ---------------------------------------------------------------------------
const bookRideSchema = z.object({
  routeId:       z.string().uuid('routeId must be a valid UUID'),
  pickupStopId:  z.string().uuid('pickupStopId must be a valid UUID'),
  dropoffStopId: z.string().uuid('dropoffStopId must be a valid UUID'),
  seats:         z.number().int().min(1).max(3).default(1),
  paymentMethod: z.enum(['cash', 'wallet']).default('cash'),
  pickupNote:    z.string().max(200).optional(),
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'passenger') {
      res.status(403).json({ error: 'Only passengers can book rides' });
      return;
    }

    const data = bookRideSchema.parse(req.body);

    const matchResult = await matchOrEnqueue({
      passengerId:   req.user.id,
      routeId:       data.routeId,
      pickupStopId:  data.pickupStopId,
      dropoffStopId: data.dropoffStopId,
      seats:         data.seats,
      paymentMethod: data.paymentMethod,
      pickupNote:    data.pickupNote,
    });

    // Audit log the ride creation
    await log({
      entityType: 'ride_request',
      entityId:   matchResult.rideRequestId,
      action:     matchResult.status === 'matched' ? AuditAction.RIDE_MATCHED : AuditAction.RIDE_CREATED,
      newValue:   { status: matchResult.status, farePaisa: matchResult.farePaisa },
      actorId:    req.user.id,
    });

    res.status(201).json({
      message: matchResult.status === 'matched'
        ? 'Matched to an existing pool!'
        : 'Ride requested — waiting for a driver to accept',
      rideRequestId: matchResult.rideRequestId,
      status:        matchResult.status,
      farePaisa:     matchResult.farePaisa,
      fareTk:        matchResult.farePaisa !== null
        ? (matchResult.farePaisa / 100).toFixed(2)
        : null,
      poolId:        matchResult.poolId,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/rides — List the authenticated passenger's own rides ONLY
// ---------------------------------------------------------------------------
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const rides = await prisma.rideRequest.findMany({
      where: { passengerId: req.user.id }, // ← strict: own rides only
      orderBy: { createdAt: 'desc' },
      include: {
        pickupStop:  { select: { id: true, name: true, lat: true, lng: true } },
        dropoffStop: { select: { id: true, name: true, lat: true, lng: true } },
        pool: {
          select: {
            id: true,
            status: true,
            route: { select: { id: true, name: true } },
            vehicle: { select: { id: true, name: true, plate: true } },
          },
        },
      },
    });

    res.json({
      count: rides.length,
      rides: rides.map((r) => ({
        ...r,
        fareTk: r.farePaisa !== null ? (r.farePaisa / 100).toFixed(2) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/rides/:id — Get single ride (must belong to the requester)
// ---------------------------------------------------------------------------
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const ride = await prisma.rideRequest.findUnique({
      where: { id: req.params.id },
      include: {
        pickupStop:  true,
        dropoffStop: true,
        pool: {
          include: {
            route:   { select: { id: true, name: true } },
            vehicle: { select: { id: true, name: true, plate: true } },
          },
        },
      },
    });

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    // Passengers can only see their own rides
    if (req.user.role === 'passenger' && ride.passengerId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      ride: {
        ...ride,
        fareTk: ride.farePaisa !== null ? (ride.farePaisa / 100).toFixed(2) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/rides/:id/cancel — Passenger cancels their own ride
// Only allowed from status: 'requested' (not matched, not started)
// ---------------------------------------------------------------------------
router.patch('/:id/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const ride = await prisma.rideRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    // Passengers can only cancel their own rides
    if (req.user.role === 'passenger' && ride.passengerId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Validate FSM transition — throws TransitionError (→ 400) if invalid
    validateRideTransition(
      ride.status as RideStatus,
      'cancelled',
      req.user.role as 'passenger' | 'driver',
    );

    const updated = await prisma.rideRequest.update({
      where: { id: ride.id },
      data:  { status: 'cancelled' },
    });

    await log({
      entityType: 'ride_request',
      entityId:   ride.id,
      action:     AuditAction.RIDE_CANCELLED,
      oldValue:   { status: ride.status },
      newValue:   { status: 'cancelled' },
      actorId:    req.user.id,
    });

    res.json({ message: 'Ride cancelled', ride: updated });
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
