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
// matchOrEnqueue — called when a passenger submits POST /rides
//
// Algorithm:
//   1. Fetch all route stops → build stopId→order map
//   2. Find OPEN pools on this route via Prisma ORM (no raw SQL for enum comparison)
//   3. Filter pools: origin ≤ pickup AND dest ≥ dropoff
//   4. For each candidate: SELECT FOR UPDATE inside Serializable tx, recount seats
//   5. If none fits: create REQUESTED ride (waiting for driver)
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

  // Step 1 — fetch all stop orders for this route once
  const allRouteStops = await prisma.routeStop.findMany({
    where: { routeId },
    orderBy: { stopOrder: 'asc' },
    include: { stop: true },
  });

  const stopOrderMap = new Map(allRouteStops.map((rs) => [rs.stopId, rs.stopOrder]));

  const pickupOrder = stopOrderMap.get(pickupStopId);
  const dropoffOrder = stopOrderMap.get(dropoffStopId);

  if (pickupOrder === undefined) throw new Error('Pickup stop is not on the specified route');
  if (dropoffOrder === undefined) throw new Error('Dropoff stop is not on the specified route');
  if (pickupOrder >= dropoffOrder) throw new Error('Pickup stop must come before dropoff stop on this route');

  const stopCoords: StopCoord[] = allRouteStops.map((rs) => ({
    id: rs.stop.id,
    lat: Number(rs.stop.lat),
    lng: Number(rs.stop.lng),
  }));

  // Step 2 — find open pools via Prisma ORM (avoids enum comparison in raw SQL)
  const openPools = await prisma.pool.findMany({
    where: { routeId, status: 'open' },
    orderBy: { createdAt: 'asc' },
    include: {
      vehicle: { select: { id: true, capacity: true } },
      rideRequests: {
        where: { status: { not: 'cancelled' } },
        select: { seats: true },
      },
    },
  });

  // Step 3 — filter by stop coverage
  const candidatePools = openPools.filter((pool) => {
    const originOrder = stopOrderMap.get(pool.originStopId);
    const destOrder = stopOrderMap.get(pool.destStopId);
    if (originOrder === undefined || destOrder === undefined) return false;
    return originOrder <= pickupOrder && destOrder >= dropoffOrder;
  });

  // Step 4 — try to join each candidate inside a Serializable transaction
  for (const candidate of candidatePools) {
    const taken = candidate.rideRequests.reduce((sum, r) => sum + r.seats, 0);
    const remaining = candidate.vehicle.capacity - taken;
    if (remaining < seats) continue;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check pool status — Serializable isolation prevents phantom reads
        // (no SELECT FOR UPDATE needed; conflicting tx will get serialization error 40001)
        const poolNow = await tx.pool.findUnique({
          where: { id: candidate.id },
          select: { id: true, status: true },
        });

        if (!poolNow || poolNow.status !== 'open') return null;

        // Re-count seats after lock (definitive check)
        const takenAgg = await tx.rideRequest.aggregate({
          _sum: { seats: true },
          where: { poolId: candidate.id, status: { not: 'cancelled' } },
        });
        const takenNow = takenAgg._sum.seats ?? 0;
        if (candidate.vehicle.capacity - takenNow < seats) return null;

        const newTaken = takenNow + seats;
        const poolStatus = newTaken >= candidate.vehicle.capacity ? 'full' : 'open';

        // Fare calculation: existing passengers + new one
        const existingRides = await tx.rideRequest.findMany({
          where: { poolId: candidate.id, status: { not: 'cancelled' } },
          select: { id: true, pickupStopId: true, dropoffStopId: true, seats: true },
        });

        const allPassengers = [
          ...existingRides.flatMap((r) =>
            Array(r.seats).fill({ pickupStopId: r.pickupStopId, dropoffStopId: r.dropoffStopId })
          ),
          ...Array(seats).fill({ pickupStopId, dropoffStopId }),
        ];
        const segmentLoads = buildSegmentLoads(stopCoords, allPassengers);
        const farePaisa = calcPassengerFarePaisa(stopCoords, pickupStopId, dropoffStopId, segmentLoads);

        for (const ride of existingRides) {
          const rideFarePaisa = calcPassengerFarePaisa(
            stopCoords,
            ride.pickupStopId,
            ride.dropoffStopId,
            segmentLoads,
          );
          await tx.rideRequest.update({
            where: { id: ride.id },
            data: { farePaisa: rideFarePaisa },
          });
        }

        const rideRequest = await tx.rideRequest.create({
          data: { passengerId, poolId: candidate.id, pickupStopId, dropoffStopId, seats, farePaisa, status: 'matched', paymentMethod, pickupNote },
        });

        if (poolStatus === 'full') {
          await tx.pool.update({ where: { id: candidate.id }, data: { status: 'full' } });
        }

        return { rideRequest, farePaisa };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });

      if (result) {
        return { rideRequestId: result.rideRequest.id, status: 'matched', farePaisa: result.farePaisa, poolId: candidate.id };
      }
    } catch (err: unknown) {
      const pgError = err as { code?: string };
      if (pgError.code === '40001' || pgError.code === '40P01') continue;
      throw err;
    }
  }

  // Step 5 — no pool found: create REQUESTED ride (driver will accept in Phase 5)
  const rideRequest = await prisma.rideRequest.create({
    data: { passengerId, poolId: null, pickupStopId, dropoffStopId, seats, farePaisa: null, status: 'requested', paymentMethod, pickupNote },
  });

  return { rideRequestId: rideRequest.id, status: 'requested', farePaisa: null, poolId: null };
}
