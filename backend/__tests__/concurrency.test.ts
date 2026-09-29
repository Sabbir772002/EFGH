// Concurrency test — Serializable isolation prevents double-booking the last seat
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/index';
import { prisma } from '../src/db';

const api = request(app);

async function seed() {
  await prisma.auditLog.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  const h = (pw: string) => bcrypt.hashSync(pw, 10);
  const [jashim, nusrat, rafiq, shirin] = await Promise.all([
    prisma.user.create({ data: { name: 'Jashim', phone: '01711000001', passwordHash: h('jashim123'), role: 'driver'    } }),
    prisma.user.create({ data: { name: 'Nusrat', phone: '01711000002', passwordHash: h('nusrat123'), role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Rafiq',  phone: '01711000003', passwordHash: h('rafiq123'),  role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Shirin', phone: '01711000004', passwordHash: h('shirin123'), role: 'passenger' } }),
  ]);

  await prisma.vehicle.create({ data: { name: 'Bullet', plate: 'T-001', capacity: 3, driverId: jashim.id } });

  const [banani, mohakhali] = await Promise.all([
    prisma.stop.create({ data: { name: 'Banani',    lat: 23.794588, lng: 90.400888 } }),
    prisma.stop.create({ data: { name: 'Mohakhali', lat: 23.778448, lng: 90.398448 } }),
  ]);
  const route = await prisma.route.create({ data: { name: 'Test Route', description: 'Banani→Mohakhali' } });
  await prisma.routeStop.createMany({
    data: [
      { routeId: route.id, stopId: banani.id,    stopOrder: 1 },
      { routeId: route.id, stopId: mohakhali.id, stopOrder: 2 },
    ],
  });

  return { jashim, nusrat, rafiq, shirin, route, banani, mohakhali };
}

async function login(phone: string, password: string) {
  const res = await api.post('/api/v1/auth/login').send({ phone, password });
  return res.body.token as string;
}

let data: Awaited<ReturnType<typeof seed>>;
let tokens: Record<string, string> = {};

beforeAll(async () => {
  data = await seed();
  tokens.nusrat = await login('01711000002', 'nusrat123');
  tokens.rafiq  = await login('01711000003', 'rafiq123');
  tokens.shirin = await login('01711000004', 'shirin123');
  tokens.jashim = await login('01711000001', 'jashim123');
});

afterAll(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('Concurrency — last seat race condition', () => {
  test('exactly one accept wins when two requests race for the same ride', async () => {
    // Book Nusrat + Rafiq BEFORE any pool (no auto-match)
    const [b1, b2] = await Promise.all([
      api.post('/api/v1/rides').set('Authorization', `Bearer ${tokens.nusrat}`)
        .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id }),
      api.post('/api/v1/rides').set('Authorization', `Bearer ${tokens.rafiq}`)
        .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id }),
    ]);
    expect(b1.status).toBe(201);
    expect(b2.status).toBe(201);

    const nusratRideId = b1.body.rideRequestId;
    const rafiqRideId  = b2.body.rideRequestId;

    // Accept Nusrat → creates pool (1/3)
    const a1 = await api
      .post(`/api/v1/pools/${nusratRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(a1.status).toBe(201);
    const poolId = a1.body.poolId;

    // Accept Rafiq → joins pool (2/3); pool still open (1 seat left)
    const a2 = await api
      .post(`/api/v1/pools/${rafiqRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(a2.status).toBe(201);

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    expect(pool?.status).toBe('open'); // 1 seat still available

    // Book Shirin (may auto-match to the open pool)
    const b3 = await api
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${tokens.shirin}`)
      .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id });
    expect(b3.status).toBe(201);
    const shirinRideId = b3.body.rideRequestId;

    const shirinBefore = await prisma.rideRequest.findUnique({ where: { id: shirinRideId } });

    // Race: driver double-taps accept on Shirin's ride
    const [r1, r2] = await Promise.all([
      api.post(`/api/v1/pools/${shirinRideId}/accept`).set('Authorization', `Bearer ${tokens.jashim}`).send({ routeId: data.route.id }),
      api.post(`/api/v1/pools/${shirinRideId}/accept`).set('Authorization', `Bearer ${tokens.jashim}`).send({ routeId: data.route.id }),
    ]);

    const statuses = [r1.status, r2.status];

    if (shirinBefore?.status === 'matched') {
      // Already auto-matched — both double-accepts should fail (400)
      expect(statuses.every(s => s === 400)).toBe(true);
    } else {
      // Still REQUESTED — exactly one wins, one fails
      const wins   = statuses.filter(s => s === 201).length;
      const losses = statuses.filter(s => s !== 201).length;
      expect(wins).toBe(1);
      expect(losses).toBe(1);
    }

    // Ride must be MATCHED (not double-matched)
    const rideAfter = await prisma.rideRequest.findUnique({ where: { id: shirinRideId } });
    expect(rideAfter?.status).toBe('matched');

    // Pool must be FULL
    const poolAfter = await prisma.pool.findUnique({ where: { id: poolId } });
    expect(poolAfter?.status).toBe('full');
  });
});
