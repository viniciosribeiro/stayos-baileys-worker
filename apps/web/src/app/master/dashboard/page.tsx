// StayOS Master Dashboard
// Command Center de Vendas (Módulo 1) + Dashboard do Master

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { formatCurrency, formatDate, calculatePercentage } from '@/lib/utils';
import Link from 'next/link';

// Componente de Métrica
function MetricCard({
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

// Componente de Gráfico de Funil
function FunnelChart() {
  // Dados simulados do funil de conversão (Módulo 1)
  const funnelData = [
    { stage: 'Visitante Único', value: 10000, percentage: 100 },
    { stage: 'Iniciou Test-Drive', value: 2500, percentage: 25 },
    { stage: 'Completou Test-Drive', value: 1500, percentage: 15 },
    { stage: 'Cadastrou Email', value: 800, percentage: 8 },
    { stage: 'Escolheu Plano', value: 500, percentage: 5 },
    { stage: 'Pagamento Confirmado', value: 300, percentage: 3 },
  ];

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Funil de Conversão</h3>
      </div>
      <div className="mt-6 space-y-4">
        {funnelData.map((item, index) => {
          const width = `${item.percentage}%`;
          return (
            <div key={index} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{item.stage}</span>
                <span>{item.value.toLocaleString()}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Mapa de Tenants
async function TenantsMap() {
  // Buscar tenants por estado/região
  const tenantsByState = await prisma.tenant.groupBy({
    by: ['metadata'],
    where: {
      status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
    },
    _count: {
      _all: true,
    },
  });

  // Dados simulados (em produção, usar dados reais)
  const states = [
    { name: 'SP', count: 45, color: 'bg-primary' },
    { name: 'RJ', count: 30, color: 'bg-secondary' },
    { name: 'MG', count: 25, color: 'bg-accent' },
    { name: 'RS', count: 20, color: 'bg-success' },
    { name: 'PR', count: 15, color: 'bg-warning' },
    { name: 'SC', count: 10, color: 'bg-error' },
  ];

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Tenants por Estado</h3>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {states.map((state) => (
          <div
            key={state.name}
            className="flex flex-col items-center gap-2"
          >
            <div
              className={`h-16 w-16 rounded-lg ${state.color} flex items-center justify-center`}
            >
              <span className="text-white font-bold">{state.count}</span>
            </div>
            <span className="text-sm">{state.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de Lista de Tenants
async function TenantsList() {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL, TenantStatus.PAST_DUE, TenantStatus.SUSPENDED] },
    },
    include: {
      platformSubscription: true,
      connectedAccount: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Últimos Tenants</h3>
        <Link href="/master/tenants" className="text-sm hover:text-primary">
          Ver todos
        </Link>
      </div>
      <div className="mt-6">
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const statusColor = {
                  [TenantStatus.ACTIVE]: 'text-success',
                  [TenantStatus.TRIAL]: 'text-warning',
                  [TenantStatus.PAST_DUE]: 'text-error',
                  [TenantStatus.SUSPENDED]: 'text-muted-foreground',
                }[tenant.status];

                return (
                  <tr key={tenant.id} className="border-b">
                    <td className="py-4">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="py-4">
                      {tenant.platformSubscription?.plan?.name || 'N/A'}
                    </td>
                    <td className={`py-4 ${statusColor}`}>
                      {tenant.status}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="py-4">
                      <Link
                        href={`/master/tenants/${tenant.id}`}
                        className="text-sm hover:text-primary"
                      >
                        Ver
                      </Link>
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

// Componente de Consumo de Tokens
async function TokenConsumption() {
  const tokenUsage = await prisma.aITokenUsage.groupBy({
    by: ['provider'],
    _sum: {
      tokensUsed: true,
    },
    orderBy: {
      _sum: {
        tokensUsed: 'desc',
      },
    },
  });

  const totalTokens = tokenUsage.reduce(
    (sum, item) => sum + (item._sum.tokensUsed || 0),
    0
  );

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Consumo de Tokens por Provedor</h3>
      </div>
      <div className="mt-6 space-y-4">
        {tokenUsage.map((item) => {
          const percentage = calculatePercentage(
            item._sum.tokensUsed || 0,
            totalTokens
          );
          return (
            <div key={item.provider} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{item.provider}</span>
                <span>{(item._sum.tokensUsed || 0).toLocaleString()} tokens</span>
              </div>
              <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Cobertura de Treinamento (Módulo 21)
async function TrainingCoverage() {
  const coverage = await prisma.tourCoverageRegistry.findMany({
    include: {
      _count: {
        select: { moduleId: true },
      },
    },
  });

  const totalModules = coverage.length;
  const completedModules = coverage.filter(
    (item) => item.status === 'complete'
  ).length;
  const coveragePercentage = calculatePercentage(completedModules, totalModules);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Cobertura de Treinamento</h3>
        <Link href="/master/training" className="text-sm hover:text-primary">
          Ver detalhes
        </Link>
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-center">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * coveragePercentage) / 100}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{coveragePercentage}%</span>
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Módulos Completos</span>
            <span>{completedModules}/{totalModules}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Meta</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Master Dashboard
export default async function MasterDashboardPage() {
  const session = await auth();

  // Verificar papel
  if (session?.user?.role !== UserRole.MASTER_ADMIN) {
    redirect('/auth/error?code=unauthorized');
  }

  // Buscar métricas financeiras (Módulo 1.B)
  const [
    mrr,
    arr,
    churnRate,
    ltV,
    activationRate,
    npsScore,
    totalTenants,
    activeTenants,
    trialTenants,
    pastDueTenants,
    suspendedTenants,
  ] = await Promise.all([
    // MRR (Monthly Recurring Revenue)
    prisma.masterFinancialLedger.aggregate({
      where: {
        entryType: 'revenue_subscription',
        period: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
      _sum: {
        amount: true,
      },
    }),
    // ARR (Annual Recurring Revenue)
    prisma.masterFinancialLedger.aggregate({
      where: {
        entryType: 'revenue_subscription',
        period: {
          gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        },
      },
      _sum: {
        amount: true,
      },
    }),
    // Churn Rate
    prisma.tenant.count({
      where: {
        status: TenantStatus.CANCELLED,
        updatedAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
    }),
    // LTV (Lifetime Value)
    prisma.platformInvoice.aggregate({
      _avg: {
        totalAmount: true,
      },
    }),
    // Taxa de Ativação
    prisma.tenant.count({
      where: {
        onboardingCompleted: true,
      },
    }),
    // NPS Score
    prisma.auditLog.count({
      where: {
        action: 'NPS_SUBMITTED',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
    }),
    // Total de Tenants
    prisma.tenant.count(),
    // Tenants Ativos
    prisma.tenant.count({
      where: { status: TenantStatus.ACTIVE },
    }),
    // Tenants em Trial
    prisma.tenant.count({
      where: { status: TenantStatus.TRIAL },
    }),
    // Tenants em Atraso
    prisma.tenant.count({
      where: { status: TenantStatus.PAST_DUE },
    }),
    // Tenants Suspensos
    prisma.tenant.count({
      where: { status: TenantStatus.SUSPENDED },
    }),
  ]);

  // Calcular métricas
  const mrrValue = mrr._sum.amount || 0;
  const arrValue = arr._sum.amount || 0;
  const churnCount = churnRate || 0;
  const ltvValue = ltV._avg.totalAmount || 0;
  const activationCount = activationRate || 0;
  const totalTenantsCount = totalTenants || 0;

  const churnRateValue = totalTenantsCount > 0
    ? calculatePercentage(churnCount, totalTenantsCount)
    : 0;
  const activationRateValue = totalTenantsCount > 0
    ? calculatePercentage(activationCount, totalTenantsCount)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral da plataforma
        </p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="MRR"
          value={formatCurrency(mrrValue)}
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
        <MetricCard
          title="ARR"
          value={formatCurrency(arrValue)}
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
        <MetricCard
          title="Churn Rate"
          value={`${churnRateValue}%`}
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
        <MetricCard
          title="Taxa de Ativação"
          value={`${activationRateValue}%`}
          change={'+5%'}
          icon={
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24">
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
      </div>

      {/* Segunda Linha de Métricas */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="LTV Médio"
          value={formatCurrency(ltvValue * 100)} // Converter para centavos
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
        <MetricCard
          title="NPS Score"
          value={npsScore || 0}
          change={'+3'}
          icon={
            <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.97l-1.9 3.8z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Tenants Ativos"
          value={activeTenants}
          icon={
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        />
        <MetricCard
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

      {/* Gráficos e Widgets */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelChart />
        <TenantsMap />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenConsumption />
        <TrainingCoverage />
      </div>

      {/* Lista de Tenants */}
      <div className="mt-6">
        <TenantsList />
      </div>
    </div>
  );
}
