// Server-Sent Events (SSE) — real-time server→client push
//
// Why SSE and not WebSocket:
//   - One-directional (server → client) which is all we need
//   - Native browser EventSource API — no extra library
//   - Works through any HTTP proxy / Docker / nginx
//   - Automatically reconnects on drop
//   - Zero extra infrastructure (just a long-lived HTTP response)
//
// Pattern:
//   1. Set text/event-stream headers + flushHeaders()
//   2. Push data immediately on connect
//   3. setInterval 2s → push again
//   4. req.on('close') → clearInterval (critical: prevents memory leak)

import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// Helper — set SSE headers and flush so the browser starts streaming
// ---------------------------------------------------------------------------
function startSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();
}

// ---------------------------------------------------------------------------
// Helper — write one SSE event frame
// ---------------------------------------------------------------------------
function sendEvent(res: Response, data: unknown, event?: string): void {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ---------------------------------------------------------------------------
// GET /api/v1/sse/ride/:rideId
// Passenger subscribes to live updates for their own ride.
// Pushes: { id, status, farePaisa, pool.status, updatedAt }
// ---------------------------------------------------------------------------
router.get('/ride/:rideId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const { rideId } = req.params;

    // Quick auth check before opening stream
    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) { res.status(404).end(); return; }

    // Passenger can only stream their own ride; driver can stream any
    if (req.user.role === 'passenger' && ride.passengerId !== req.user.id) {
      res.status(403).end();
      return;
    }

    startSSE(res);

    const push = async () => {
      try {
        const updated = await prisma.rideRequest.findUnique({
          where: { id: rideId },
          select: {
            id: true,
            status: true,
            farePaisa: true,
            paymentStatus: true,
            updatedAt: true,
            pool: {
              select: {
                id: true,
                status: true,
                vehicle: { select: { name: true, plate: true } },
              },
            },
            pickupStop: { select: { name: true } },
            dropoffStop: { select: { name: true } },
          },
        });

        if (!updated) {
          sendEvent(res, { error: 'Ride not found' }, 'error');
          return;
        }

        sendEvent(res, {
          ...updated,
          fareTk: updated.farePaisa !== null
            ? (updated.farePaisa / 100).toFixed(2)
            : null,
        }, 'ride_update');

        // If terminal state reached, close the stream
        if (['completed', 'cancelled'].includes(updated.status)) {
          sendEvent(res, { message: 'Ride ended' }, 'done');
          res.end();
        }
      } catch {
        // DB error during push — don't crash the stream, just skip
      }
    };

    await push(); // immediate push on connect
    const interval = setInterval(push, 2000);

    req.on('close', () => {
      clearInterval(interval); // CRITICAL: clean up on client disconnect
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/sse/driver/requests
// Driver subscribes to live feed of unmatched REQUESTED ride requests.
// Pushes every 2s: list of pending rides with pickup/dropoff info.
// Driver dashboard stays live without any manual refresh.
// ---------------------------------------------------------------------------
router.get('/driver/requests', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'driver') {
      res.status(403).json({ error: 'Only drivers can subscribe to this stream' });
      return;
    }

    startSSE(res);

    const push = async () => {
      try {
        const pending = await prisma.rideRequest.findMany({
          where: {
            status: 'requested',
            poolId: null,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            seats: true,
            createdAt: true,
            passenger: { select: { id: true, name: true } },
            pickupStop: { select: { id: true, name: true, lat: true, lng: true } },
            dropoffStop: { select: { id: true, name: true, lat: true, lng: true } },
          },
        });

        sendEvent(res, { count: pending.length, pending }, 'pending_requests');
      } catch {
        // Skip on DB error
      }
    };

    await push();
    const interval = setInterval(push, 2000);

    req.on('close', () => {
      clearInterval(interval); // CRITICAL: clean up on client disconnect
    });
  } catch (err) {
    next(err);
  }
});

export default router;
