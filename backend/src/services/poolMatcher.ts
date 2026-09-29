// Pool Matcher Service
// Finds an existing OPEN pool that can accommodate a passenger's route segment.
// Uses Serializable transaction + raw SQL SELECT FOR UPDATE to prevent
// double-booking at the database level — this is the concurrency safety layer.
//
// Two outcomes:
//   MATCHED  — joined an existing open pool, fare calculated and locked
//   REQUESTED — no open pool found, ride_request waits for driver to accept (Phase 5)

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import {
  calcPassengerFarePaisa,
  buildSegmentLoads,
  StopCoord,
} from './fareCalculator';

export interface MatchResult {
  rideRequestId: string;
  status: 'matched' | 'requested';
  farePaisa: number | null;  // null when waiting for driver
  poolId: string | null;
}

// ---------------------------------------------------------------------------
// matchOrEnqueue
// Called when a passenger submits POST /rides.
//
// Algorithm:
//   1. Resolve pickup/dropoff stop orders on the given route
//   2. Find OPEN pools where:
//        pool.route_id = routeId
//        AND pool origin_stop_order <= passenger pickup_stop_order
//        AND pool dest_stop_order   >= passenger dropoff_stop_order
//   3. Inside a Serializable transaction:
//        a. SELECT FOR UPDATE the best candidate pool
//        b. Count active seats already taken
//        c. If remaining capacity >= seats: join pool, calc fare, return MATCHED
//   4. If no capacity: create unmatched ride_request (REQUESTED, poolId = null)
// ---------------------------------------------------------------------------
export async function matchOrEnqueue(params: {
  passengerId: string;
  routeId: string;
  pickupStopId: string;
  dropoffStopId: string;
  seats: number;
  paymentMethod: 'cash' | 'wallet';
  pickupNote?: string;
}): Promise<MatchResult> {
  const { passengerId, routeId, pickupStopId, dropoffStopId, seats, paymentMethod, pickupNote } = params;

  // Step 1 — resolve stop orders on this route
  const [pickupRS, dropoffRS] = await Promise.all([
    prisma.routeStop.findFirst({ where: { routeId, stopId: pickupStopId } }),
    prisma.routeStop.findFirst({ where: { routeId, stopId: dropoffStopId } }),
  ]);

  if (!pickupRS)  throw new Error('Pickup stop is not on the specified route');
  if (!dropoffRS) throw new Error('Dropoff stop is not on the specified route');
  if (pickupRS.stopOrder >= dropoffRS.stopOrder) {
    throw new Error('Pickup stop must come before dropoff stop on this route');
  }

  // Step 2 — find candidate OPEN pools (pre-filter, final check inside tx)
  // A pool can serve this passenger if:
  //   pool starts at or before passenger's pickup
  //   pool ends at or after passenger's dropoff
  const originRS = await prisma.routeStop.findFirst({
    where: { routeId, stopId: pickupStopId },
  });

  // Raw SQL gives us joins with route_stops in one shot
  // (Prisma relation filters can't directly compare stopOrder from related table)
  const candidatePools = await prisma.$queryRaw<Array<{
    id: string;
    vehicle_id: string;
    capacity: number;
    active_seats: number;
    origin_stop_order: number;
    dest_stop_order: number;
  }>>`
    SELECT
      p.id,
      p.vehicle_id,
      v.capacity,
      COALESCE(
        (SELECT SUM(rr.seats) FROM ride_requests rr
         WHERE rr.pool_id = p.id
           AND rr.status NOT IN ('cancelled')),
        0
      ) AS active_seats,
      rs_origin.stop_order  AS origin_stop_order,
      rs_dest.stop_order    AS dest_stop_order
    FROM pools p
    JOIN vehicles v ON v.id = p.vehicle_id
    JOIN route_stops rs_origin ON rs_origin.route_id = p.route_id
      AND rs_origin.stop_id = p.origin_stop_id
    JOIN route_stops rs_dest ON rs_dest.route_id = p.route_id
      AND rs_dest.stop_id = p.dest_stop_id
    WHERE p.route_id  = ${routeId}::uuid
      AND p.status    = 'open'
      AND rs_origin.stop_order <= ${pickupRS.stopOrder}
      AND rs_dest.stop_order   >= ${dropoffRS.stopOrder}
    ORDER BY p.created_at ASC
    LIMIT 5
  `;

  // Step 3 — try to join a pool inside a Serializable transaction
  for (const candidate of candidatePools) {
    const remaining = Number(candidate.capacity) - Number(candidate.active_seats);
    if (remaining < seats) continue; // quick pre-check before locking

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the pool row — prevents concurrent double-booking
        const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status FROM pools WHERE id = ${candidate.id}::uuid FOR UPDATE
        `;

        if (!locked[0] || locked[0].status !== 'open') return null; // pool changed

        // Re-count inside transaction after lock
        const takenAgg = await tx.rideRequest.aggregate({
          _sum: { seats: true },
          where: {
            poolId: candidate.id,
            status: { not: 'cancelled' },
          },
        });
        const taken = takenAgg._sum.seats ?? 0;
        if (Number(candidate.capacity) - taken < seats) return null; // no room

        // Check if pool is now full after adding this passenger
        const newTaken = taken + seats;
        const poolStatus = newTaken >= Number(candidate.capacity) ? 'full' : 'open';

        // Load route stops for fare calculation
        const routeStops = await tx.routeStop.findMany({
          where: { routeId },
          orderBy: { stopOrder: 'asc' },
          include: { stop: true },
        });

        const stopCoords: StopCoord[] = routeStops.map((rs) => ({
          id: rs.stop.id,
          lat: Number(rs.stop.lat),
          lng: Number(rs.stop.lng),
        }));

        // Existing active passengers in this pool
        const existingRides = await tx.rideRequest.findMany({
          where: { poolId: candidate.id, status: { not: 'cancelled' } },
          select: { pickupStopId: true, dropoffStopId: true, seats: true },
        });

        // Build segment loads including the new passenger
        const allPassengers = [
          ...existingRides.flatMap((r) =>
            Array(r.seats).fill({ pickupStopId: r.pickupStopId, dropoffStopId: r.dropoffStopId })
          ),
          ...Array(seats).fill({ pickupStopId, dropoffStopId }),
        ];
        const segmentLoads = buildSegmentLoads(stopCoords, allPassengers);

        const farePaisa = calcPassengerFarePaisa(
          stopCoords,
          pickupStopId,
          dropoffStopId,
          segmentLoads,
        );

        // Create the matched ride request
        const rideRequest = await tx.rideRequest.create({
          data: {
            passengerId,
            poolId: candidate.id,
            pickupStopId,
            dropoffStopId,
            seats,
            farePaisa,
            status: 'matched',
            paymentMethod,
            pickupNote,
          },
        });

        // Update pool status if now full
        if (poolStatus === 'full') {
          await tx.pool.update({
            where: { id: candidate.id },
            data: { status: 'full' },
          });
        }

        return { rideRequest, farePaisa };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      });

      if (result) {
        return {
          rideRequestId: result.rideRequest.id,
          status: 'matched',
          farePaisa: result.farePaisa,
          poolId: candidate.id,
        };
      }
    } catch (err: unknown) {
      // Serialization failure — another transaction won the race, try next pool
      const pgError = err as { code?: string };
      if (pgError.code === '40001' || pgError.code === '40P01') continue;
      throw err;
    }
  }

  // Step 4 — no open pool found; enqueue as REQUESTED (driver will accept in Phase 5)
  const rideRequest = await prisma.rideRequest.create({
    data: {
      passengerId,
      poolId: null,
      pickupStopId,
      dropoffStopId,
      seats,
      farePaisa: null,
      status: 'requested',
      paymentMethod,
      pickupNote,
    },
  });

  return {
    rideRequestId: rideRequest.id,
    status: 'requested',
    farePaisa: null,
    poolId: null,
  };
}
