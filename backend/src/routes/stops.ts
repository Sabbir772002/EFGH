import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/v1/stops — List all 26 Dhaka stops with coordinates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stops = await prisma.stop.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      count: stops.length,
      stops,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
