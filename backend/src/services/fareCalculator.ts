// Fare Calculator Service
// All money in INTEGER PAISA (1 BDT = 100 paisa) — no floats stored.
//
// Parameters (locked in master plan Part D):
const FARE_PER_KM_TK = 10;          // 10 tk per km
const MIN_ROUTE_FARE_TK = 30;       // whole route floor
const PER_PERSON_MIN_TK = 5;        // individual passenger floor

// ---------------------------------------------------------------------------
// Haversine — great-circle distance in kilometres between two lat/lng points
// ---------------------------------------------------------------------------
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // km
}

// ---------------------------------------------------------------------------
// Stop shape — minimal data needed for fare calculation
// ---------------------------------------------------------------------------
export interface StopCoord {
  id: string;
  lat: number;   // decimal degrees
  lng: number;   // decimal degrees
}

// ---------------------------------------------------------------------------
// calcRouteFare
// Input:  ordered array of stops on the route (origin → destination)
// Output: { routeDist (km), routeFare (tk), effectiveRate (tk/km) }
//
// Formula:
//   routeDist   = Σ haversine(stop_i, stop_i+1)
//   rawFare     = routeDist × FARE_PER_KM_TK
//   routeFare   = max(MIN_ROUTE_FARE, floor(rawFare / 10) × 10)   ← floor to 10 tk
//   effectiveRate = routeFare / routeDist
// ---------------------------------------------------------------------------
export interface RouteFareResult {
  routeDist: number;       // km
  routeFare: number;       // tk (integer, rounded to nearest 10)
  effectiveRate: number;   // tk/km
}

export function calcRouteFare(stops: StopCoord[]): RouteFareResult {
  if (stops.length < 2) {
    throw new Error('At least 2 stops are required to calculate fare');
  }

  let routeDist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    routeDist += haversine(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  }

  const rawFare = routeDist * FARE_PER_KM_TK;
  const routeFare = Math.max(MIN_ROUTE_FARE_TK, Math.floor(rawFare / 10) * 10);
  const effectiveRate = routeFare / routeDist;

  return { routeDist, routeFare, effectiveRate };
}

// ---------------------------------------------------------------------------
// Segment — one stop-to-stop leg of a route
// ---------------------------------------------------------------------------
export interface Segment {
  fromStop: StopCoord;
  toStop: StopCoord;
  passengersOnSeg: number;  // how many passengers share this segment in the pool
}

// ---------------------------------------------------------------------------
// calcPassengerFarePaisa
// Input:
//   routeStops      — all ordered stops on the route
//   pickupStopId    — passenger boards here
//   dropoffStopId   — passenger alights here
//   segmentLoads    — Map<"fromId→toId", number> of total passengers per segment
//                     (built by poolMatcher and passed here)
//
// Output: fare in PAISA (integer)
//
// Formula (Part D Step 4-6):
//   For each segment the passenger rides:
//     segCost   = haversine(from, to) × effectiveRate
//     passengerShare += segCost / passengersOnSeg
//   passengerFare = max(PER_PERSON_MIN, passengerShare)
//   fareInPaisa  = Math.round(passengerFare × 100)
// ---------------------------------------------------------------------------
export function calcPassengerFarePaisa(
  routeStops: StopCoord[],
  pickupStopId: string,
  dropoffStopId: string,
  segmentLoads: Map<string, number>,   // key = `${fromId}→${toId}`, value = passenger count on that segment
): number {
  const pickupIdx = routeStops.findIndex((s) => s.id === pickupStopId);
  const dropoffIdx = routeStops.findIndex((s) => s.id === dropoffStopId);

  if (pickupIdx === -1) throw new Error(`Pickup stop ${pickupStopId} not found on route`);
  if (dropoffIdx === -1) throw new Error(`Dropoff stop ${dropoffStopId} not found on route`);
  if (pickupIdx >= dropoffIdx) throw new Error('Pickup stop must come before dropoff stop on route');

  const { effectiveRate } = calcRouteFare(routeStops);

  let passengerRaw = 0;

  for (let i = pickupIdx; i < dropoffIdx; i++) {
    const from = routeStops[i];
    const to = routeStops[i + 1];

    const segKey = `${from.id}→${to.id}`;
    const passengers = segmentLoads.get(segKey) ?? 1;  // default 1 (solo)
    const segDist = haversine(from.lat, from.lng, to.lat, to.lng);
    const segCost = segDist * effectiveRate;

    passengerRaw += segCost / passengers;
  }

  const finalTk = Math.max(PER_PERSON_MIN_TK, passengerRaw);
  return Math.round(finalTk * 100);  // convert to paisa
}

// ---------------------------------------------------------------------------
// buildSegmentLoads
// Convenience helper used by poolMatcher:
// Given a list of (pickupIdx, dropoffIdx) pairs and the route stops array,
// returns a Map of segment → passenger count.
//
// Usage: call this after collecting all ride_requests in a pool,
//        then pass result into calcPassengerFarePaisa for each passenger.
// ---------------------------------------------------------------------------
export interface PassengerSpan {
  pickupStopId: string;
  dropoffStopId: string;
}

export function buildSegmentLoads(
  routeStops: StopCoord[],
  passengers: PassengerSpan[],
): Map<string, number> {
  const loads = new Map<string, number>();

  for (const p of passengers) {
    const pickupIdx = routeStops.findIndex((s) => s.id === p.pickupStopId);
    const dropoffIdx = routeStops.findIndex((s) => s.id === p.dropoffStopId);

    for (let i = pickupIdx; i < dropoffIdx; i++) {
      const key = `${routeStops[i].id}→${routeStops[i + 1].id}`;
      loads.set(key, (loads.get(key) ?? 0) + 1);
    }
  }

  return loads;
}
