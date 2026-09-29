import { PrismaClient } from '@prisma/client';

// Singleton pattern — reuse the same Prisma instance across the app
// In development, ts-node-dev restarts the process, so we use a global to avoid
// creating a new connection on every hot reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
