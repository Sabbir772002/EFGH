// Auth & isolation tests — passengers cannot see other users' data; roles are enforced
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/index';
import { prisma } from '../src/db';

const api = request(app);

// ── Seed ──────────────────────────────────────────────────────────────────────
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
    prisma.user.create({ data: { name: 'Jashim',  phone: '01711000001', passwordHash: h('jashim123'), role: 'driver'    } }),
    prisma.user.create({ data: { name: 'Nusrat',  phone: '01711000002', passwordHash: h('nusrat123'), role: 'passenger' } }),
    prisma.user.create({ data: { name: 'Rafiq',   phone: '01711000003', passwordHash: h('rafiq123'),  role: 'passenger' } }),
  ]);

  await prisma.vehicle.create({ data: { name: 'Bullet', plate: 'T-001', capacity: 3, driverId: jashim.id } });

  const [banani, gulshan] = await Promise.all([
    prisma.stop.create({ data: { name: 'Banani',   lat: 23.794588, lng: 90.400888 } }),
    prisma.stop.create({ data: { name: 'Gulshan1', lat: 23.780295, lng: 90.416299 } }),
  ]);
  const route = await prisma.route.create({ data: { name: 'Test Route', description: 'Banani→Gulshan' } });
  await prisma.routeStop.createMany({
    data: [
      { routeId: route.id, stopId: banani.id,  stopOrder: 1 },
      { routeId: route.id, stopId: gulshan.id, stopOrder: 2 },
    ],
  });

  return { jashim, nusrat, rafiq, route, banani, gulshan };
}

async function login(phone: string, password: string): Promise<string> {
  const res = await api.post('/api/v1/auth/login').send({ phone, password });
  return res.body.token as string;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
let data: Awaited<ReturnType<typeof seed>>;
let tokens: Record<string, string> = {};

beforeAll(async () => {
  data   = await seed();
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

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth — login', () => {
  test('valid credentials return token + user', async () => {
    const res = await api.post('/api/v1/auth/login').send({ phone: '01711000002', password: 'nusrat123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('passenger');
  });

  test('wrong password returns 401', async () => {
    const res = await api.post('/api/v1/auth/login').send({ phone: '01711000002', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('unknown phone returns 401', async () => {
    const res = await api.post('/api/v1/auth/login').send({ phone: '01999999999', password: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('Auth — protected endpoints require token', () => {
  test('GET /rides without token returns 401', async () => {
    const res = await api.get('/api/v1/rides');
    expect(res.status).toBe(401);
  });

  test('GET /driver/dashboard without token returns 401', async () => {
    const res = await api.get('/api/v1/driver/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('Auth — ride isolation (Nusrat cannot see Rafiq\'s rides)', () => {
  let rafiqRideId: string;

  beforeAll(async () => {
    const res = await api
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${tokens.rafiq}`)
      .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.gulshan.id, seats: 1 });
    expect(res.status).toBe(201);
    rafiqRideId = res.body.rideRequestId;
  });

  test('GET /rides as Rafiq returns only Rafiq\'s rides', async () => {
    const res = await api.get('/api/v1/rides').set('Authorization', `Bearer ${tokens.rafiq}`);
    expect(res.status).toBe(200);
    const ids = res.body.rides.map((r: { id: string }) => r.id);
    expect(ids).toContain(rafiqRideId);
  });

  test('GET /rides as Nusrat does NOT return Rafiq\'s ride', async () => {
    const res = await api.get('/api/v1/rides').set('Authorization', `Bearer ${tokens.nusrat}`);
    expect(res.status).toBe(200);
    const ids = res.body.rides.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(rafiqRideId);
  });

  test('GET /rides/:id as Nusrat for Rafiq\'s ride returns 403', async () => {
    const res = await api.get(`/api/v1/rides/${rafiqRideId}`).set('Authorization', `Bearer ${tokens.nusrat}`);
    expect(res.status).toBe(403);
  });
});

describe('Auth — role guards', () => {
  test('passenger cannot access GET /pools/pending', async () => {
    const res = await api.get('/api/v1/pools/pending').set('Authorization', `Bearer ${tokens.nusrat}`);
    expect(res.status).toBe(403);
  });

  test('passenger cannot PATCH /driver/status', async () => {
    const res = await api.patch('/api/v1/driver/status').set('Authorization', `Bearer ${tokens.nusrat}`).send({ online: true });
    expect(res.status).toBe(403);
  });

  test('driver cannot book a ride', async () => {
    const res = await api
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${tokens.jashim}`)
      .send({ routeId: data.route.id, pickupStopId: data.banani.id, dropoffStopId: data.gulshan.id });
    expect(res.status).toBe(403);
  });
});
