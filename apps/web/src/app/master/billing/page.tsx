// StayOS Master Billing Dashboard
// SaaS Billing Engine & Revenue Operations (Módulo 1.B)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { formatCurrency, formatDate, calculatePercentage } from '@/lib/utils';
import Link from 'next/link';
import { BillingEngine } from '@stayos/payments';

// Componente de Métrica Financeira
function FinancialMetricCard({
  title,
  value,
  change,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  change?: string | number;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="dashboard-widget">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary/10 p-3">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {change && (
            <p className="text-sm text-muted-foreground">
              {typeof change === 'number' ? `${change > 0 ? '+' : ''}${change}%` : change}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Componente de Gráfico de Receita por Plano
async function RevenueByPlanChart() {
  const plans = await prisma.platformPlan.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const subscriptions = await prisma.platformSubscription.findMany({
    where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
  });

  // Calcular receita por plano
  const revenueByPlan = plans.map(plan => {
    const planSubscriptions = subscriptions.filter(sub => sub.planId === plan.id);
    const revenue = planSubscriptions.length * plan.basePrice;
    return { plan, revenue, count: planSubscriptions.length };
  });

  const maxRevenue = Math.max(...revenueByPlan.map(r => r.revenue), 1);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Receita por Plano</h3>
      </div>
      <div className="mt-6 space-y-4">
        {revenueByPlan.map(({ plan, revenue, count }) => {
          const percentage = calculatePercentage(revenue, maxRevenue);
          return (
            <div key={plan.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{plan.name}</span>
                <span>{formatCurrency(revenue)}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {count} assinaturas
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Tabela de Assinaturas
async function SubscriptionsTable() {
  const subscriptions = await prisma.platformSubscription.findMany({
    include: {
      tenant: true,
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Assinaturas</h3>
        <Link href="/master/billing/subscriptions" className="text-sm hover:text-primary">
          Ver todas
        </Link>
      </div>
      <div className="mt-6">
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
                        <button className="text-sm hover:text-primary">
                          Editar
                        </button>
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
  );
}

// Componente de Tabela de Comissões
async function CommissionsTable() {
  const commissions = await prisma.commissionLedger.findMany({
    include: {
      // reservation: true, // Descomentar quando Reservation estiver implementado
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const totalGross = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
  const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalNet = commissions.reduce((sum, c) => sum + c.netAmount, 0);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Comissões</h3>
        <Link href="/master/billing/commissions" className="text-sm hover:text-primary">
          Ver todas
        </Link>
      </div>
      <div className="mt-6">
        <div className="flex gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Bruto Total</p>
            <p className="text-xl font-bold">{formatCurrency(totalGross)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Comissão Total</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalCommission)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Líquido Total</p>
            <p className="text-xl font-bold">{formatCurrency(totalNet)}</p>
          </div>
        </div>
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Tenant</th>
                <th>Bruto</th>
                <th>Comissão</th>
                <th>Líquido</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission) => {
                const statusColor = {
                  pending: 'text-muted-foreground',
                  rolling_reserve: 'text-warning',
                  liquidated: 'text-success',
                  refunded: 'text-error',
                }[commission.status];

                return (
                  <tr key={commission.id} className="border-b">
                    <td className="py-4 text-sm">
                      {commission.reservationId}
                    </td>
                    <td className="py-4 text-sm">
                      {commission.tenantId}
                    </td>
                    <td className="py-4">
                      {formatCurrency(commission.grossAmount)}
                    </td>
                    <td className="py-4">
                      {formatCurrency(commission.commissionAmount)}
                    </td>
                    <td className="py-4">
                      {formatCurrency(commission.netAmount)}
                    </td>
                    <td className={`py-4 ${statusColor}`}>
                      {commission.status}
                    </td>
                    <td className="py-4">
                      {commission.status === 'pending' && (
                        <button className="text-sm hover:text-primary">
                          Liquidar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Componente de Tabela de Eventos de Billing
async function BillingEventsTable() {
  const events = await prisma.platformBillingEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Eventos de Billing</h3>
        <Link href="/master/billing/events" className="text-sm hover:text-primary">
          Ver todos
        </Link>
      </div>
      <div className="mt-6">
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Provider</th>
                <th>Tenant</th>
                <th>Processado</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b">
                  <td className="py-4 text-sm">
                    {event.eventType}
                  </td>
                  <td className="py-4 text-sm">
                    {event.provider}
                  </td>
                  <td className="py-4 text-sm">
                    {event.tenantId || 'N/A'}
                  </td>
                  <td className="py-4">
                    <span className={`badge ${event.processed ? 'badge-success' : 'badge-warning'}`}>
                      {event.processed ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </td>
                  <td className="py-4">
                    {!event.processed && (
                      <button className="text-sm hover:text-primary">
                        Processar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Componente de Status das Contas Conectadas
async function ConnectedAccountsStatus() {
  const accounts = await prisma.connectedAccount.findMany({
    include: { tenant: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const verifiedCount = accounts.filter(a => a.kycStatus === 'verified').length;
  const pendingCount = accounts.filter(a => a.kycStatus === 'pending').length;
  const rejectedCount = accounts.filter(a => a.kycStatus === 'rejected').length;

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Contas Conectadas (KYC)</h3>
        <Link href="/master/billing/connected-accounts" className="text-sm hover:text-primary">
          Ver todas
        </Link>
      </div>
      <div className="mt-6">
        <div className="flex gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Verificadas</p>
            <p className="text-xl font-bold text-success">{verifiedCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
            <p className="text-xl font-bold text-warning">{pendingCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rejeitadas</p>
            <p className="text-xl font-bold text-error">{rejectedCount}</p>
          </div>
        </div>
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Provider</th>
                <th>Status KYC</th>
                <th>Ativa</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const statusColor = {
                  verified: 'text-success',
                  pending: 'text-warning',
                  rejected: 'text-error',
                }[account.kycStatus];

                return (
                  <tr key={account.id} className="border-b">
                    <td className="py-4">
                      <div>
                        <p className="font-medium">{account.tenant?.name}</p>
                        <p className="text-sm text-muted-foreground">{account.tenant?.slug}</p>
                      </div>
                    </td>
                    <td className="py-4 text-sm">
                      {account.provider}
                    </td>
                    <td className={`py-4 ${statusColor}`}>
                      {account.kycStatus}
                    </td>
                    <td className="py-4">
                      <span className={`badge ${account.isActive ? 'badge-success' : 'badge-muted'}`}>
                        {account.isActive ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {formatDate(account.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Master Billing Dashboard
export default async function MasterBillingPage() {
  const session = await auth();

  // Verificar papel
  if (session?.user?.role !== UserRole.MASTER_ADMIN) {
    redirect('/auth/error?code=unauthorized');
  }

  // Buscar métricas financeiras
  const billingEngine = BillingEngine.getInstance();
  
  const [mrr, arr, churnRate, ltv, activationRate, netMargin] = await Promise.all([
    billingEngine.getMRR(),
    billingEngine.getARR(),
    billingEngine.getChurnRate(),
    billingEngine.getLTV(),
    billingEngine.getActivationRate(),
    billingEngine.getNetMargin(),
  ]);

  // Buscar dados adicionais
  const [totalTenants, activeTenants, trialTenants, pastDueTenants, suspendedTenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
    prisma.tenant.count({ where: { status: TenantStatus.TRIAL } }),
    prisma.tenant.count({ where: { status: TenantStatus.PAST_DUE } }),
    prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SaaS Billing Engine</h1>
        <p className="text-muted-foreground">
          Motor financeiro da plataforma - Gerencie assinaturas, comissões e reconciliação
        </p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinancialMetricCard
          title="MRR"
          value={formatCurrency(mrr)}
          change={'+12%'}
          icon={
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="ARR"
          value={formatCurrency(arr)}
          change={'+24%'}
          icon={
            <svg className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="Churn Rate"
          value={`${churnRate.toFixed(2)}%`}
          change={'-2%'}
          icon={
            <svg className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="Margem Líquida"
          value={`${netMargin.toFixed(2)}%`}
          change={'+5%'}
          icon={
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Segunda Linha de Métricas */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinancialMetricCard
          title="LTV Médio"
          value={formatCurrency(ltv)}
          icon={
            <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="Taxa de Ativação"
          value={`${activationRate.toFixed(2)}%`}
          icon={
            <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
              />
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="Tenants Ativos"
          value={activeTenants}
          icon={
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />
        <FinancialMetricCard
          title="Tenants em Trial"
          value={trialTenants}
          icon={
            <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Gráficos e Tabelas */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByPlanChart />
        <ConnectedAccountsStatus />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriptionsTable />
        <CommissionsTable />
      </div>

      {/* Eventos de Billing */}
      <div className="mt-6">
        <BillingEventsTable />
      </div>
    </div>
  );
}

// Import redirect
import { redirect } from 'next/navigation';
