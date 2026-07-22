// StayOS Master Layout
// Layout para o painel do Admin Master (Módulo 0, 1, 1.B, etc.)

import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { Sidebar } from '@/components/master/Sidebar';
import { Header } from '@/components/master/Header';

export const metadata: Metadata = {
  title: 'Painel Master - StayOS',
  description: 'Painel de controle do Admin Master',
};

// Componente de Layout do Master
async function MasterLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar papel
  if (session?.user?.role !== UserRole.MASTER_ADMIN) {
    redirect('/auth/error?code=unauthorized');
  }

  // Buscar configurações de UI do Master (Módulo 0)
  const settings = await prisma.masterUISettings.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  // Buscar notificações
  const notifications = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24h
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (Módulo 0) */}
      <Sidebar settings={settings} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header 
          settings={settings} 
          notifications={notifications}
        />

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar autenticação
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Verificar papel
  if (session.user.role !== UserRole.MASTER_ADMIN) {
    redirect('/auth/error?code=unauthorized');
  }

  return <MasterLayoutContent>{children}</MasterLayoutContent>;
}
