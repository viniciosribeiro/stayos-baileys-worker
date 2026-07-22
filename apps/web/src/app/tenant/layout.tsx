// StayOS Tenant Layout
// Layout para o painel do Tenant

import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus } from '@prisma/client';
import { Sidebar } from '@/components/tenant/Sidebar';
import { Header } from '@/components/tenant/Header';

export const metadata: Metadata = {
  title: 'Painel - StayOS',
  description: 'Painel de controle da sua pousada/hotel',
};

// Componente de Layout do Tenant
async function TenantLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar autenticação
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Verificar se usuário tem tenant
  if (!session.user.tenantId) {
    redirect('/auth/select-tenant');
  }

  // Buscar tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    include: {
      platformSubscription: true,
      connectedAccount: true,
    },
  });

  if (!tenant) {
    redirect('/auth/error?code=tenant_not_found');
  }

  // Verificar status do tenant
  if ([TenantStatus.SUSPENDED, TenantStatus.CANCELLED].includes(tenant.status)) {
    redirect('/auth/error?code=tenant_suspended');
  }

  // Buscar configurações de UI do Tenant
  const settings = tenant.uiConfig || {};

  // Buscar notificações
  const notifications = await prisma.auditLog.findMany({
    where: {
      tenantId: session.user.tenantId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24h
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar tenant={tenant} settings={settings} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header 
          tenant={tenant}
          settings={settings}
          notifications={notifications}
        />

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default async function TenantLayout({
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
  if (session.user.role === UserRole.MASTER_ADMIN) {
    redirect('/master/dashboard');
  }

  return <TenantLayoutContent>{children}</TenantLayoutContent>;
}
