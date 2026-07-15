// StayOS Master Billing - Subscriptions
// Gerenciamento de Assinaturas (Módulo 1.B)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Componente de Filtro
function SubscriptionFilter({
  status,
  planId,
  tenantId,
  onStatusChange,
  onPlanChange,
  onTenantChange,
}: {
  status: string;
  planId: string;
  tenantId: string;
  onStatusChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onTenantChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex items-center gap-2">
        <label htmlFor="status" className="text-sm font-medium">Status:</label>
        <select
          id="status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="input w-48"
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Ativo</option>
          <option value="TRIALING">Trial</option>
          <option value="PAST_DUE">Atrasado</option>
          <option value="CANCELED">Cancelado</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="plan" className="text-sm font-medium">Plano:</label>
        <select
          id="plan"
          value={planId}
          onChange={(e) => onPlanChange(e.target.value)}
          className="input w-48"
        >
          <option value="">Todos</option>
          {/* Planos serão carregados dinamicamente */}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="tenant" className="text-sm font-medium">Tenant:</label>
        <input
          id="tenant"
          type="text"
          value={tenantId}
          onChange={(e) => onTenantChange(e.target.value)}
          placeholder="Buscar tenant..."
          className="input w-48"
        />
      </div>
    </div>
  );
}

// Componente de Card de Assinatura
function SubscriptionCard({ subscription }: any) {
  const statusColor = {
    [SubscriptionStatus.ACTIVE]: 'bg-success/10 text-success-foreground border-success',
    [SubscriptionStatus.TRIALING]: 'bg-warning/10 text-warning-foreground border-warning',
    [SubscriptionStatus.PAST_DUE]: 'bg-error/10 text-error-foreground border-error',
    [SubscriptionStatus.CANCELED]: 'bg-muted text-muted-foreground border-muted',
    [SubscriptionStatus.INACTIVE]: 'bg-muted text-muted-foreground border-muted',
    [SubscriptionStatus.UNAID]: 'bg-muted text-muted-foreground border-muted',
  }[subscription.status];

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="card-title">{subscription.tenant?.name}</h3>
            <p className="card-description">{subscription.tenant?.slug}</p>
          </div>
          <span className={`badge ${statusColor}`}>
            {subscription.status}
          </span>
        </div>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <p className="font-medium">{subscription.plan?.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="font-medium">{formatCurrency(subscription.plan?.basePrice || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Próximo Pagamento</p>
            <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cadastro</p>
            <p className="font-medium">{formatDate(subscription.createdAt)}</p>
          </div>
        </div>
      </div>
      <div className="card-footer">
        <div className="flex gap-2">
          <Link
            href={`/master/billing/subscriptions/${subscription.id}`}
            className="btn btn-primary btn-sm"
          >
            Ver Detalhes
          </Link>
          <Link
            href={`/master/tenants/${subscription.tenantId}`}
            className="btn btn-outline btn-sm"
          >
            Ver Tenant
          </Link>
        </div>
      </div>
    </div>
  );
}

// Master Billing Subscriptions Page
export default async function MasterBillingSubscriptionsPage({
  searchParams,
}: {
  searchParams: { status?: string; planId?: string; tenantId?: string; page?: string };
}) {
  const session = await auth();

  // Verificar papel
  if (session?.user?.role !== UserRole.MASTER_ADMIN) {
    redirect('/auth/error?code=unauthorized');
  }

  // Buscar planos
  const plans = await prisma.platformPlan.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  // Buscar tenants
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
  });

  // Construir where clause
  const where: any = {};
  
  if (searchParams.status) {
    where.status = searchParams.status as any;
  }
  if (searchParams.planId) {
    where.planId = searchParams.planId;
  }
  if (searchParams.tenantId) {
    where.tenant = { name: { contains: searchParams.tenantId, mode: 'insensitive' } };
  }

  // Buscar assinaturas
  const subscriptions = await prisma.platformSubscription.findMany({
    where,
    include: {
      tenant: true,
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calcular estatísticas
  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE).length,
    trial: subscriptions.filter(s => s.status === SubscriptionStatus.TRIALING).length,
    pastDue: subscriptions.filter(s => s.status === SubscriptionStatus.PAST_DUE).length,
    canceled: subscriptions.filter(s => s.status === SubscriptionStatus.CANCELED).length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assinaturas</h1>
            <p className="text-muted-foreground">
              Gerencie todas as assinaturas dos tenants
            </p>
          </div>
          <Link href="/master/billing/subscriptions/new" className="btn btn-primary">
            Nova Assinatura
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <SubscriptionFilter
        status={searchParams.status || ''}
        planId={searchParams.planId || ''}
        tenantId={searchParams.tenantId || ''}
        onStatusChange={(value) => {
          // Atualizar URL
        }}
        onPlanChange={(value) => {
          // Atualizar URL
        }}
        onTenantChange={(value) => {
          // Atualizar URL
        }}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-bold text-success">{stats.active}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Trial</p>
          <p className="text-2xl font-bold text-warning">{stats.trial}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Atrasadas</p>
          <p className="text-2xl font-bold text-error">{stats.pastDue}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Canceladas</p>
          <p className="text-2xl font-bold text-muted-foreground">{stats.canceled}</p>
        </div>
      </div>

      {/* Tabela de Assinaturas */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Lista de Assinaturas</h3>
        </div>
        <div className="card-content">
          <div className="data-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Próximo Pagamento</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => {
                  const statusColor = {
                    [SubscriptionStatus.ACTIVE]: 'text-success',
                    [SubscriptionStatus.TRIALING]: 'text-warning',
                    [SubscriptionStatus.PAST_DUE]: 'text-error',
                    [SubscriptionStatus.CANCELED]: 'text-muted-foreground',
                    [SubscriptionStatus.INACTIVE]: 'text-muted-foreground',
                    [SubscriptionStatus.UNAID]: 'text-muted-foreground',
                  }[subscription.status as any];

                  return (
                    <tr key={subscription.id} className="border-b">
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{subscription.tenant?.name}</p>
                          <p className="text-sm text-muted-foreground">{subscription.tenant?.slug}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        {subscription.plan?.name} ({formatCurrency(subscription.plan?.basePrice || 0)})
                      </td>
                      <td className={`py-4 ${statusColor}`}>
                        {subscription.status}
                      </td>
                      <td className="py-4 text-sm">
                        {formatDate(subscription.currentPeriodEnd)}
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {formatDate(subscription.createdAt)}
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/master/billing/subscriptions/${subscription.id}`}
                            className="text-sm hover:text-primary"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/master/billing/subscriptions/${subscription.id}/edit`}
                            className="text-sm hover:text-primary"
                          >
                            Editar
                          </Link>
                          {subscription.status === SubscriptionStatus.ACTIVE && (
                            <button className="text-sm hover:text-error">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
