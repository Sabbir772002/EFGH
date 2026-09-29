import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/v1/routes — List all 4 routes with stop counts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const routes = await prisma.route.findMany({
      include: {
        routeStops: {
          orderBy: { stopOrder: 'asc' },
          include: {
            stop: true,
          },
        },
      },
    });

    const result = routes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      stopCount: r.routeStops.length,
      origin: r.routeStops[0]?.stop.name ?? null,
      destination: r.routeStops[r.routeStops.length - 1]?.stop.name ?? null,
    }));

    res.json({ routes: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/routes/:id/stops — Get ordered stops for a specific route
router.get('/:id/stops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        routeStops: {
          orderBy: { stopOrder: 'asc' },
          include: {
            stop: true,
          },
        },
      },
    });

    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    const stops = route.routeStops.map((rs) => ({
      order: rs.stopOrder,
      stop: rs.stop,
    }));

    res.json({
      route: {
        id: route.id,
        name: route.name,
        description: route.description,
      },
      stops,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
