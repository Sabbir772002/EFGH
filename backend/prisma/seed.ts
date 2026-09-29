import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Clean existing data (reverse FK order) ─────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // ── Users ──────────────────────────────────────────────────────────────────
  const SALT = 10;

  const jashim = await prisma.user.create({
    data: {
      name: 'Jashim Uddin',
      phone: '01711000001',
      passwordHash: await bcrypt.hash('jashim123', SALT),
      role: Role.driver,
    },
  });

  const nusrat = await prisma.user.create({
    data: {
      name: 'Nusrat Jahan',
      phone: '01711000002',
      passwordHash: await bcrypt.hash('nusrat123', SALT),
      role: Role.passenger,
    },
  });

  // nusrat is used in route_stops reference so we keep it
  void nusrat;

  const rafiq = await prisma.user.create({
    data: {
      name: 'Rafiq Hossain',
      phone: '01711000003',
      passwordHash: await bcrypt.hash('rafiq123', SALT),
      role: Role.passenger,
    },
  });
  void rafiq;

  const shirin = await prisma.user.create({
    data: {
      name: 'Shirin Akter',
      phone: '01711000004',
      passwordHash: await bcrypt.hash('shirin123', SALT),
      role: Role.passenger,
    },
  });
  void shirin;

  console.log('👤 Users created: Jashim, Nusrat, Rafiq, Shirin');

  // ── Vehicle ────────────────────────────────────────────────────────────────
  await prisma.vehicle.create({
    data: {
      name: 'Bullet',
      plate: 'DHAKA-T-4201',
      capacity: 3,
      driverId: jashim.id,
    },
  });

  console.log('🚗 Vehicle created: Bullet (capacity 3) owned by Jashim');

  // ── Stops ──────────────────────────────────────────────────────────────────
  // All 26 stops — coordinates verified from final_safe.json
  // Decimal values passed as strings to avoid float precision issues
  const stopsData = [
    // Route 1 — Bijoy Sarani → Kuril Flyover
    { name: 'Bijoy Sarani',       lat: '23.7647116', lng: '90.3891671' },
    { name: 'Old Airport',        lat: '23.7712902', lng: '90.3896284' },
    { name: 'Jahangir Gate',      lat: '23.7752606', lng: '90.3897653' },
    { name: 'Mohakhali',          lat: '23.7784480', lng: '90.3984480' },
    { name: 'Chairman Bari',      lat: '23.7886545', lng: '90.4003626' },
    { name: 'Sainik Club',        lat: '23.7907445', lng: '90.4000998' },
    { name: 'Banani',             lat: '23.7945876', lng: '90.4008883' },
    { name: 'Staff Road',         lat: '23.8116965', lng: '90.4036888' },
    { name: 'MES',                lat: '23.8161546', lng: '90.4049489' },
    { name: 'Shewra',             lat: '23.8190920', lng: '90.4149969' },
    { name: 'Kuril Flyover',      lat: '23.8199670', lng: '90.4205600' },
    // Route 2 — new stops (Mohakhali shared with Route 1)
    { name: 'Amtoli (Mohakhali)', lat: '23.7809220', lng: '90.3988690' },
    { name: 'Wireless',           lat: '23.7805910', lng: '90.4054560' },
    { name: 'Gulshan Bridge',     lat: '23.7803844', lng: '90.4129207' },
    { name: 'Gulshan 1',          lat: '23.7802946', lng: '90.4162986' },
    { name: 'Badda Link Road',    lat: '23.7807157', lng: '90.4255432' },
    // Route 3 — new stops (Badda Link Road shared with Route 2, Kuril Flyover shared with Route 1)
    { name: 'Badda',              lat: '23.7842854', lng: '90.4256451' },
    { name: 'Uttar Badda',        lat: '23.7857042', lng: '90.4256113' },
    { name: 'Shahjadpur',         lat: '23.7920210', lng: '90.4244430' },
    { name: 'Bashtola',           lat: '23.7943670', lng: '90.4239610' },
    { name: 'Notun Bazar',        lat: '23.7975671', lng: '90.4236549' },
    { name: 'Coca Cola Bus Stop', lat: '23.8048949', lng: '90.4218334' },
    { name: 'Nadda',              lat: '23.8093965', lng: '90.4212780' },
    { name: 'Bashundhara',        lat: '23.8118974', lng: '90.4211787' },
    { name: 'Jamuna Future Park', lat: '23.8125560', lng: '90.4212870' },
    // Route 4 — new stop (Banani and Notun Bazar shared with Routes 1 and 3)
    { name: 'Gulshan 2',          lat: '23.7948166', lng: '90.4142645' },
  ];

  // Create stops and build a name→id map
  const S: Record<string, string> = {};
  for (const s of stopsData) {
    const stop = await prisma.stop.create({ data: s });
    S[s.name] = stop.id;
  }

  console.log(`📍 Created ${stopsData.length} stops`);

  // ── Routes ─────────────────────────────────────────────────────────────────
  const r1 = await prisma.route.create({
    data: {
      name: 'Route 1 — Bijoy Sarani → Kuril Flyover',
      description: 'Military corridor through cantonment zone. 11 stops.',
    },
  });
  const r2 = await prisma.route.create({
    data: {
      name: 'Route 2 — Mohakhali → Badda Link Road',
      description: 'Gulshan corridor. 6 stops.',
    },
  });
  const r3 = await prisma.route.create({
    data: {
      name: 'Route 3 — Badda Link Road → Kuril Flyover',
      description: 'Badda–Bashundhara corridor. 11 stops.',
    },
  });
  const r4 = await prisma.route.create({
    data: {
      name: 'Route 4 — Banani → Notun Bazar',
      description: 'Short Gulshan loop. 3 stops.',
    },
  });

  console.log('🗺️  Created 4 routes');

  // ── Route Stops (ordered) ──────────────────────────────────────────────────
  await prisma.routeStop.createMany({
    data: [
      // Route 1 — 11 stops
      { routeId: r1.id, stopId: S['Bijoy Sarani'],       stopOrder: 1  },
      { routeId: r1.id, stopId: S['Old Airport'],        stopOrder: 2  },
      { routeId: r1.id, stopId: S['Jahangir Gate'],      stopOrder: 3  },
      { routeId: r1.id, stopId: S['Mohakhali'],          stopOrder: 4  },
      { routeId: r1.id, stopId: S['Chairman Bari'],      stopOrder: 5  },
      { routeId: r1.id, stopId: S['Sainik Club'],        stopOrder: 6  },
      { routeId: r1.id, stopId: S['Banani'],             stopOrder: 7  },
      { routeId: r1.id, stopId: S['Staff Road'],         stopOrder: 8  },
      { routeId: r1.id, stopId: S['MES'],                stopOrder: 9  },
      { routeId: r1.id, stopId: S['Shewra'],             stopOrder: 10 },
      { routeId: r1.id, stopId: S['Kuril Flyover'],      stopOrder: 11 },

      // Route 2 — 6 stops
      { routeId: r2.id, stopId: S['Mohakhali'],          stopOrder: 1  },
      { routeId: r2.id, stopId: S['Amtoli (Mohakhali)'], stopOrder: 2  },
      { routeId: r2.id, stopId: S['Wireless'],           stopOrder: 3  },
      { routeId: r2.id, stopId: S['Gulshan Bridge'],     stopOrder: 4  },
      { routeId: r2.id, stopId: S['Gulshan 1'],          stopOrder: 5  },
      { routeId: r2.id, stopId: S['Badda Link Road'],    stopOrder: 6  },

      // Route 3 — 11 stops
      { routeId: r3.id, stopId: S['Badda Link Road'],    stopOrder: 1  },
      { routeId: r3.id, stopId: S['Badda'],              stopOrder: 2  },
      { routeId: r3.id, stopId: S['Uttar Badda'],        stopOrder: 3  },
      { routeId: r3.id, stopId: S['Shahjadpur'],         stopOrder: 4  },
      { routeId: r3.id, stopId: S['Bashtola'],           stopOrder: 5  },
      { routeId: r3.id, stopId: S['Notun Bazar'],        stopOrder: 6  },
      { routeId: r3.id, stopId: S['Coca Cola Bus Stop'], stopOrder: 7  },
      { routeId: r3.id, stopId: S['Nadda'],              stopOrder: 8  },
      { routeId: r3.id, stopId: S['Bashundhara'],        stopOrder: 9  },
      { routeId: r3.id, stopId: S['Jamuna Future Park'], stopOrder: 10 },
      { routeId: r3.id, stopId: S['Kuril Flyover'],      stopOrder: 11 },

      // Route 4 — 3 stops
      { routeId: r4.id, stopId: S['Banani'],             stopOrder: 1  },
      { routeId: r4.id, stopId: S['Gulshan 2'],          stopOrder: 2  },
      { routeId: r4.id, stopId: S['Notun Bazar'],        stopOrder: 3  },
    ],
  });

  console.log('🔗 Created 31 route-stop links (11 + 6 + 11 + 3)');

  console.log('\n✅ Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Driver    → Jashim Uddin   | 01711000001 | jashim123');
  console.log('  Passenger → Nusrat Jahan   | 01711000002 | nusrat123');
  console.log('  Passenger → Rafiq Hossain  | 01711000003 | rafiq123');
  console.log('  Passenger → Shirin Akter   | 01711000004 | shirin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
