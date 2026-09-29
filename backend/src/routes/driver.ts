import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { log, AuditAction } from '../services/auditLogger';

const router = Router();

router.use(authMiddleware);

// Guard — all routes in this file are driver-only
function requireDriver(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role !== 'driver') {
    res.status(403).json({ error: 'Only drivers can access this endpoint' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/driver/status
// Body: { online: boolean }
// Toggles is_online flag on the driver's user record.
// ---------------------------------------------------------------------------
router.patch('/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!requireDriver(req, res)) return;

    const { online } = req.body as { online: boolean };
    if (typeof online !== 'boolean') {
      res.status(400).json({ error: '`online` must be a boolean' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data:  { isOnline: online },
      select: { id: true, name: true, isOnline: true },
    });

    await log({
      entityType: 'user',
      entityId:   req.user!.id,
      action:     AuditAction.DRIVER_STATUS_CHANGED,
      oldValue:   { isOnline: !online },
      newValue:   { isOnline: online },
      actorId:    req.user!.id,
    });

    res.json({
      message: online ? 'You are now online' : 'You are now offline',
      driver: user,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/driver/dashboard
// Returns:
//   - driver profile + vehicle (Bullet)
//   - active pool (if any) with all passengers
//   - seat counts: total capacity, seats taken, seats free
// ---------------------------------------------------------------------------
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!requireDriver(req, res)) return;

    const driverId = req.user!.id;

    // Driver's vehicle (Bullet)
    const vehicle = await prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'No vehicle registered for this driver' });
      return;
    }

    // Active pool — any pool that is not completed or cancelled
    const activePool = await prisma.pool.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        route:       { select: { id: true, name: true } },
        originStop:  { select: { id: true, name: true } },
        destStop:    { select: { id: true, name: true } },
        rideRequests: {
          where: { status: { not: 'cancelled' } },
          include: {
            passenger:   { select: { id: true, name: true, phone: true } },
            pickupStop:  { select: { id: true, name: true } },
            dropoffStop: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Seat accounting
    const seatsTaken = activePool
      ? activePool.rideRequests.reduce((sum, r) => sum + r.seats, 0)
      : 0;

    res.json({
      driver: {
        id:       req.user!.id,
        name:     req.user!.name,
        isOnline: req.user!.isOnline,
      },
      vehicle: {
        id:       vehicle.id,
        name:     vehicle.name,
        plate:    vehicle.plate,
        capacity: vehicle.capacity,
      },
      activePool: activePool
        ? {
            id:         activePool.id,
            status:     activePool.status,
            route:      activePool.route,
            originStop: activePool.originStop,
            destStop:   activePool.destStop,
            seatsTaken,
            seatsFree:  vehicle.capacity - seatsTaken,
            passengers: activePool.rideRequests.map((r) => ({
              rideId:      r.id,
              status:      r.status,
              farePaisa:   r.farePaisa,
              fareTk:      r.farePaisa !== null ? (r.farePaisa / 100).toFixed(2) : null,
              seats:       r.seats,
              passenger:   r.passenger,
              pickupStop:  r.pickupStop,
              dropoffStop: r.dropoffStop,
              pickupNote:  r.pickupNote,
            })),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
