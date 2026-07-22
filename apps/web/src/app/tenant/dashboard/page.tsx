// StayOS Tenant Dashboard
// Dashboard do Tenant (Módulo 15)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, ReservationStatus } from '@prisma/client';
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

// Componente de Gráfico de Ocupação
async function OccupancyChart({ tenantId }: { tenantId: string }) {
  // Buscar reservas para os próximos 30 dias
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      tenantId,
      checkInDate: {
        gte: now,
        lte: in30Days,
      },
      status: {
        in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
      },
    },
    include: {
      room: true,
    },
  });

  // Agrupar por dia
  const occupancyByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    occupancyByDay[dateStr] = 0;
  }

  reservations.forEach((reservation) => {
    const checkIn = reservation.checkInDate.toISOString().split('T')[0];
    const checkOut = reservation.checkOutDate.toISOString().split('T')[0];
    
    for (let date = new Date(checkIn); date <= new Date(checkOut); date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      if (occupancyByDay[dateStr] !== undefined) {
        occupancyByDay[dateStr]++;
      }
    }
  });

  const maxOccupancy = Math.max(...Object.values(occupancyByDay));

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Ocupação (Próximos 30 dias)</h3>
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2">
        {Object.entries(occupancyByDay).map(([date, count]) => {
          const percentage = calculatePercentage(count, maxOccupancy || 1);
          return (
            <div key={date} className="space-y-2">
              <div className="h-16 w-full rounded-lg bg-muted relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-500"
                  style={{ height: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {new Date(date).toLocaleDateString('pt-BR', { day: 'numeric' })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Próximas Chegadas
async function UpcomingArrivals({ tenantId }: { tenantId: string }) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      tenantId,
      checkInDate: {
        gte: now,
        lte: in7Days,
      },
      status: ReservationStatus.CONFIRMED,
    },
    include: {
      guest: true,
      room: true,
    },
    orderBy: { checkInDate: 'asc' },
    take: 5,
  });

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Próximas Chegadas</h3>
        <Link href="/reservations" className="text-sm hover:text-primary">
          Ver todas
        </Link>
      </div>
      <div className="mt-6 space-y-4">
        {reservations.length > 0 ? (
          reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="flex items-center gap-4 p-3 hover:bg-accent rounded-lg"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-medium">
                  {reservation.guest?.firstName?.charAt(0) || 'G'}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {reservation.guest?.firstName} {reservation.guest?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {reservation.room?.name} - {reservation.adults} adultos
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {formatDate(reservation.checkInDate)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {reservation.nights} noites
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma reserva confirmada
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Hóspedes na Casa
async function CurrentGuests({ tenantId }: { tenantId: string }) {
  const now = new Date();

  const reservations = await prisma.reservation.findMany({
    where: {
      tenantId,
      checkInDate: {
        lte: now,
      },
      checkOutDate: {
        gte: now,
      },
      status: {
        in: [ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED],
      },
    },
    include: {
      guest: true,
      room: true,
    },
  });

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Hóspedes na Casa</h3>
      </div>
      <div className="mt-6">
        <p className="text-3xl font-bold">{reservations.length}</p>
        <p className="text-sm text-muted-foreground">
          {reservations.length > 0
            ? `${reservations.reduce((sum, r) => sum + r.adults + r.children, 0)} pessoas`
            : 'Nenhum hóspede'}
        </p>
        <div className="mt-6 space-y-3">
          {reservations.slice(0, 3).map((reservation) => (
            <div
              key={reservation.id}
              className="flex items-center gap-3"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">
                  {reservation.guest?.firstName?.charAt(0) || 'G'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {reservation.guest?.firstName} {reservation.guest?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reservation.room?.name} - Check-out: {formatDate(reservation.checkOutDate)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente de Saúde da IA
async function AIHealth({ tenantId }: { tenantId: string }) {
  // Buscar configuração de IA
  const aiConfig = await prisma.aIBehaviorConfig.findUnique({
    where: { tenantId },
  });

  // Buscar uso de tokens
  const tokenUsage = await prisma.aITokenUsage.aggregate({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    },
    _sum: {
      tokensUsed: true,
    },
  });

  // Buscar plano do tenant
  const subscription = await prisma.platformSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  const tokenQuota = subscription?.plan?.tokenQuota || 0;
  const tokensUsed = tokenUsage._sum.tokensUsed || 0;
  const percentage = calculatePercentage(tokensUsed, tokenQuota);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Saúde da IA</h3>
        <Link href="/settings/ai" className="text-sm hover:text-primary">
          Configurar
        </Link>
      </div>
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Tokens Usados</p>
          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold">{tokensUsed.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">
              / {tokenQuota.toLocaleString()}
            </p>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-2">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="text-sm font-medium">
            {aiConfig ? 'Configurado' : 'Não configurado'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente de Receita
async function RevenueChart({ tenantId }: { tenantId: string }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const transactions = await prisma.tenantFinancialTransaction.findMany({
    where: {
      tenantId,
      period: {
        gte: startOfMonth,
      },
      transactionType: 'revenue',
    },
    orderBy: { period: 'asc' },
  });

  // Agrupar por dia
  const revenueByDay: Record<string, number> = {};
  transactions.forEach((t) => {
    const dateStr = t.period.toISOString().split('T')[0];
    revenueByDay[dateStr] = (revenueByDay[dateStr] || 0) + t.amount;
  });

  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();

  const maxRevenue = Math.max(...Object.values(revenueByDay), 1);

  return (
    <div className="dashboard-widget">
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">Receita (Mês Atual)</h3>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1">
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth(), i + 1);
          const dateStr = date.toISOString().split('T')[0];
          const revenue = revenueByDay[dateStr] || 0;
          const percentage = calculatePercentage(revenue, maxRevenue);
          
          return (
            <div key={i} className="space-y-1">
              <div className="h-16 w-full rounded-lg bg-muted relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-500"
                  style={{ height: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {i + 1}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <p className="text-2xl font-bold">
          {formatCurrency(Object.values(revenueByDay).reduce((a, b) => a + b, 0))}
        </p>
        <p className="text-sm text-muted-foreground">Total do Mês</p>
      </div>
    </div>
  );
}

// Tenant Dashboard
export default async function TenantDashboardPage() {
  const session = await auth();

  // Verificar autenticação
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Verificar papel
  if (session.user.role === UserRole.MASTER_ADMIN) {
    redirect('/master/dashboard');
  }

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

  // Buscar métricas
  const [
    totalReservations,
    confirmedReservations,
    totalRevenue,
    totalGuests,
    occupancyRate,
  ] = await Promise.all([
    prisma.reservation.count({
      where: { tenantId: tenant.id },
    }),
    prisma.reservation.count({
      where: {
        tenantId: tenant.id,
        status: ReservationStatus.CONFIRMED,
      },
    }),
    prisma.tenantFinancialTransaction.aggregate({
      where: {
        tenantId: tenant.id,
        transactionType: 'revenue',
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.guest.count({
      where: { tenantId: tenant.id },
    }),
    // Calcular taxa de ocupação
    prisma.reservation.aggregate({
      where: {
        tenantId: tenant.id,
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const revenueValue = totalRevenue._sum.amount || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral da {tenant.name}
        </p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Reservas"
          value={totalReservations}
          change={'+12%'}
          icon={
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          href="/reservations"
        />
        <MetricCard
          title="Reservas Confirmadas"
          value={confirmedReservations}
          change={'+8%'}
          icon={
            <svg className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          href="/reservations"
        />
        <MetricCard
          title="Receita Total"
          value={formatCurrency(revenueValue)}
          change={'+15%'}
          icon={
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          href="/financial"
        />
        <MetricCard
          title="Hóspedes"
          value={totalGuests}
          change={'+5%'}
          icon={
            <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          href="/guests"
        />
      </div>

      {/* Gráficos */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OccupancyChart tenantId={tenant.id} />
        <RevenueChart tenantId={tenant.id} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingArrivals tenantId={tenant.id} />
        <CurrentGuests tenantId={tenant.id} />
      </div>

      {/* Saúde da IA */}
      <div className="mt-6">
        <AIHealth tenantId={tenant.id} />
      </div>
    </div>
  );
}
