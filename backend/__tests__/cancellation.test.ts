// Cancellation tests — verifies cancellation rules at each ride/pool state
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
  const [jashim, nusrat, rafiq] = await Promise.all([
    prisma.user.create({ data: { name: 'Jashim', phone: '01711000001', passwordHash: h('jashim123'), role: 'driver'    } }),
    prisma.user.create({ data: { name: 'Nusrat', phone: '01711000002', passwordHash: h('nusrat123'), role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Rafiq',  phone: '01711000003', passwordHash: h('rafiq123'),  role: 'passenger' } }),
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

  return { jashim, nusrat, rafiq, route, banani, mohakhali };
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

function bookRide(token: string) {
  return api
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${token}`)
    .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id });
}

// ── From REQUESTED ────────────────────────────────────────────────────────────
describe('Cancellation — from REQUESTED state', () => {
  test('passenger can cancel their own REQUESTED ride', async () => {
    const book = await bookRide(tokens.nusrat);
    expect(book.status).toBe(201);

    const cancel = await api
      .patch(`/api/v1/rides/${book.body.rideRequestId}/cancel`)
      .set('Authorization', `Bearer ${tokens.nusrat}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.ride.status).toBe('cancelled');
  });

  test('another passenger cannot cancel someone else\'s ride', async () => {
    const book = await bookRide(tokens.nusrat);
    expect(book.status).toBe(201);

    const cancel = await api
      .patch(`/api/v1/rides/${book.body.rideRequestId}/cancel`)
      .set('Authorization', `Bearer ${tokens.rafiq}`);
    expect(cancel.status).toBe(403);
  });
});

// ── From MATCHED ──────────────────────────────────────────────────────────────
describe('Cancellation — from MATCHED state', () => {
  let matchedRideId: string;
  let poolId: string;

  beforeAll(async () => {
    const book = await bookRide(tokens.nusrat);
    matchedRideId = book.body.rideRequestId;

    await api.patch('/api/v1/driver/status').set('Authorization', `Bearer ${tokens.jashim}`).send({ online: true });

    const accept = await api
      .post(`/api/v1/pools/${matchedRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(accept.status).toBe(201);
    poolId = accept.body.poolId;
  });

  test('passenger CANNOT cancel from MATCHED state', async () => {
    const cancel = await api
      .patch(`/api/v1/rides/${matchedRideId}/cancel`)
      .set('Authorization', `Bearer ${tokens.nusrat}`);
    expect(cancel.status).toBe(400);
  });

  test('driver CAN cancel the pool — cascades to rides', async () => {
    const cancel = await api
      .patch(`/api/v1/pools/${poolId}/status`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);

    const ride = await prisma.rideRequest.findUnique({ where: { id: matchedRideId } });
    expect(ride?.status).toBe('cancelled');
  });
});

// ── From STARTED ──────────────────────────────────────────────────────────────
describe('Cancellation — from STARTED state', () => {
  let startedRideId: string;
  let startedPoolId: string;

  beforeAll(async () => {
    const book = await bookRide(tokens.rafiq);
    startedRideId = book.body.rideRequestId;

    const accept = await api
      .post(`/api/v1/pools/${startedRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    startedPoolId = accept.body.poolId;

    // open → driver_arrived → started
    await api.patch(`/api/v1/pools/${startedPoolId}/status`).set('Authorization', `Bearer ${tokens.jashim}`).send({ status: 'driver_arrived' });
    await api.patch(`/api/v1/pools/${startedPoolId}/status`).set('Authorization', `Bearer ${tokens.jashim}`).send({ status: 'started' });
  });

  test('passenger CANNOT cancel from STARTED state', async () => {
    const cancel = await api
      .patch(`/api/v1/rides/${startedRideId}/cancel`)
      .set('Authorization', `Bearer ${tokens.rafiq}`);
    expect(cancel.status).toBe(400);
  });

  test('driver CANNOT cancel the pool from STARTED state', async () => {
    const cancel = await api
      .patch(`/api/v1/pools/${startedPoolId}/status`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ status: 'cancelled' });
    expect(cancel.status).toBe(400);
  });
});
