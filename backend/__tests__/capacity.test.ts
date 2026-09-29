// Capacity test — Bullet (capacity=3) cannot accept a 4th passenger
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
  const [jashim, nusrat, rafiq, shirin, karim] = await Promise.all([
    prisma.user.create({ data: { name: 'Jashim', phone: '01711000001', passwordHash: h('jashim123'), role: 'driver'    } }),
    prisma.user.create({ data: { name: 'Nusrat', phone: '01711000002', passwordHash: h('nusrat123'), role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Rafiq',  phone: '01711000003', passwordHash: h('rafiq123'),  role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Shirin', phone: '01711000004', passwordHash: h('shirin123'), role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Karim',  phone: '01711000099', passwordHash: h('karim123'),  role: 'passenger' } }),
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

  return { jashim, nusrat, rafiq, shirin, karim, route, banani, mohakhali };
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
  tokens.karim  = await login('01711000099', 'karim123');
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

describe('Capacity — Bullet cannot exceed 3 seats', () => {
  let poolId: string;
  let nusratRideId: string;
  let rafiqRideId: string;
  let shirinRideId: string;

  // Book all 3 rides BEFORE pool exists so they arrive as REQUESTED
  beforeAll(async () => {
    const [b1, b2, b3] = await Promise.all([
      api.post('/api/v1/rides').set('Authorization', `Bearer ${tokens.nusrat}`)
        .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id }),
      api.post('/api/v1/rides').set('Authorization', `Bearer ${tokens.rafiq}`)
        .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id }),
      api.post('/api/v1/rides').set('Authorization', `Bearer ${tokens.shirin}`)
        .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id }),
    ]);
    nusratRideId = b1.body.rideRequestId;
    rafiqRideId  = b2.body.rideRequestId;
    shirinRideId = b3.body.rideRequestId;
  });

  test('all 3 rides are REQUESTED (no pool yet)', async () => {
    const rides = await Promise.all([
      prisma.rideRequest.findUnique({ where: { id: nusratRideId } }),
      prisma.rideRequest.findUnique({ where: { id: rafiqRideId } }),
      prisma.rideRequest.findUnique({ where: { id: shirinRideId } }),
    ]);
    rides.forEach(r => expect(r?.status).toBe('requested'));
  });

  test('driver accepts Nusrat (1 of 3) — creates pool', async () => {
    const res = await api
      .post(`/api/v1/pools/${nusratRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(res.status).toBe(201);
    poolId = res.body.poolId;
  });

  test('driver accepts Rafiq (2 of 3) — joins same pool', async () => {
    const res = await api
      .post(`/api/v1/pools/${rafiqRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(res.status).toBe(201);
    expect(res.body.poolId).toBe(poolId);
  });

  test('driver accepts Shirin (3 of 3) — pool becomes full', async () => {
    const res = await api
      .post(`/api/v1/pools/${shirinRideId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(res.status).toBe(201);

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    expect(pool?.status).toBe('full');
  });

  test('4th passenger (Karim) books — lands as REQUESTED (full pool)', async () => {
    const book = await api
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${tokens.karim}`)
      .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.mohakhali.id });
    expect(book.status).toBe(201);
    expect(book.body.status).toBe('requested');
    expect(book.body.farePaisa).toBeNull();

    // Driver tries force-accept → 400 (full pool, no new pool while active)
    const forceAccept = await api
      .post(`/api/v1/pools/${book.body.rideRequestId}/accept`)
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id });
    expect(forceAccept.status).toBe(400);
  });
});
