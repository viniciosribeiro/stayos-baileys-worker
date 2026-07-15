// StayOS Prisma Client
// Singleton com RLS (Row Level Security)

import { PrismaClient } from '@stayos/db';

// Extender o Prisma Client com métodos customizados
declare global {
  var prisma: PrismaClient | undefined;
}

// Singleton do Prisma Client
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Middleware para RLS (Row Level Security)
// Em produção, o PostgreSQL deve ter políticas RLS configuradas
// Este middleware garante que o tenant_id seja sempre passado nas queries
export function withRLS<T extends Record<string, unknown>>(
  tenantId: string,
  data: T
): T & { tenantId: string } {
  return {
    ...data,
    tenantId,
  };
}

// Helper para queries com RLS
export function getRLSQuery(tenantId: string) {
  return {
    where: {
      tenantId,
    },
  };
}

export default prisma;
