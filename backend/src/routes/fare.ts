import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import {
  calcRouteFare,
  calcPassengerFarePaisa,
  buildSegmentLoads,
  StopCoord,
} from '../services/fareCalculator';

const router = Router();

const estimateQuerySchema = z.object({
  pickupStopId:  z.string().uuid('pickupStopId must be a valid UUID'),
  dropoffStopId: z.string().uuid('dropoffStopId must be a valid UUID'),
  routeId:       z.string().uuid('routeId must be a valid UUID'),
});

// GET /api/v1/fare/estimate?pickupStopId=X&dropoffStopId=Y&routeId=Z
//
// Returns the solo fare estimate (1 passenger, no pool sharing).
// The actual locked fare is calculated on match inside poolMatcher.
router.get('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = estimateQuerySchema.parse(req.query);
    const { pickupStopId, dropoffStopId, routeId } = query;

    // Load route with ordered stops from DB
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        routeStops: {
          orderBy: { stopOrder: 'asc' },
          include: { stop: true },
        },
      },
    });

    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    const routeStops: StopCoord[] = route.routeStops.map((rs) => ({
      id:  rs.stop.id,
      lat: Number(rs.stop.lat),
      lng: Number(rs.stop.lng),
    }));

    // Validate pickup and dropoff are on this route
    const pickupIdx  = routeStops.findIndex((s) => s.id === pickupStopId);
    const dropoffIdx = routeStops.findIndex((s) => s.id === dropoffStopId);

    if (pickupIdx === -1) {
      res.status(400).json({ error: 'pickupStopId is not on this route' });
      return;
    }
    if (dropoffIdx === -1) {
      res.status(400).json({ error: 'dropoffStopId is not on this route' });
      return;
    }
    if (pickupIdx >= dropoffIdx) {
      res.status(400).json({ error: 'pickupStopId must come before dropoffStopId on this route' });
      return;
    }

    // Solo estimate: 1 passenger (no sharing), segment loads default to 1
    const segmentLoads = buildSegmentLoads(routeStops, [{ pickupStopId, dropoffStopId }]);

    const soloFarePaisa = calcPassengerFarePaisa(
      routeStops,
      pickupStopId,
      dropoffStopId,
      segmentLoads,
    );

    const { routeDist, routeFare, effectiveRate } = calcRouteFare(routeStops);

    res.json({
      estimate: {
        soloFarePaisa,                               // what 1 passenger pays alone
        soloFareTk: (soloFarePaisa / 100).toFixed(2), // human-readable
        note: 'Actual fare may be lower when pool is shared',
      },
      debug: {
        routeName:        route.name,
        routeDistKm:      routeDist.toFixed(3),
        fullRouteFareTk:  routeFare,
        effectiveRateTkPerKm: effectiveRate.toFixed(3),
        pickupStop:  route.routeStops[pickupIdx]?.stop.name,
        dropoffStop: route.routeStops[dropoffIdx]?.stop.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
