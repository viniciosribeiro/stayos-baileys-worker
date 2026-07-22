// StayOS Database Client
// Exporta o Prisma Client configurado com RLS

import { PrismaClient } from '@prisma/client';

// Singleton do Prisma Client
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export * from '@prisma/client';
export default prisma;
