// StayOS Tenant Rooms
// Quartos & Reservas - Booking Engine (Módulo 12)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, RoomStatus } from '@prisma/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Componente de Card de Quarto
function RoomCard({ room }: any) {
  const statusColor = {
    [RoomStatus.AVAILABLE]: 'bg-success/10 text-success-foreground border-success',
    [RoomStatus.OCCUPIED]: 'bg-error/10 text-error-foreground border-error',
    [RoomStatus.MAINTENANCE]: 'bg-warning/10 text-warning-foreground border-warning',
    [RoomStatus.BLOCKED]: 'bg-muted text-muted-foreground border-muted',
  }[room.status];

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="card-title">{room.name}</h3>
            <p className="card-description">{room.roomGroup?.name}</p>
          </div>
          <span className={`badge ${statusColor}`}>
            {room.status}
          </span>
        </div>
      </div>
      <div className="card-content">
        <div className="flex gap-4">
          <div className="w-32 h-32 rounded-lg overflow-hidden">
            {room.photos[0] ? (
              <img
                src={room.photos[0].fileUrl}
                alt={room.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <svg className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground mb-2">{room.description}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Capacidade</p>
                <p className="font-medium">{room.maxAdults} adultos, {room.maxChildren} crianças</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ocupação Máxima</p>
                <p className="font-medium">{room.maxOccupancy} pessoas</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Comodidades</p>
              <div className="flex flex-wrap gap-2">
                {room.amenities.map((amenity: string) => (
                  <span key={amenity} className="badge badge-secondary">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="card-footer">
        <div className="flex gap-2">
          <Link href={`/tenant/rooms/${room.id}`} className="btn btn-primary btn-sm">
            Ver Detalhes
          </Link>
          <Link href={`/tenant/rooms/${room.id}/edit`} className="btn btn-outline btn-sm">
            Editar
          </Link>
          {room.status === RoomStatus.AVAILABLE && (
            <Link href={`/tenant/reservations/new?roomId=${room.id}`} className="btn btn-outline btn-sm">
              Nova Reserva
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente de Calendário de Disponibilidade
async function AvailabilityCalendar({ tenantId }: { tenantId: string }) {
  const rooms = await prisma.room.findMany({
    where: { tenantId },
    include: {
      calendarAvailability: {
        where: {
          date: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          },
        },
      },
    },
  });

  // Agrupar por data
  const availabilityByDate: Record<string, { roomId: string; roomName: string; status: RoomStatus }[]> = {};
  
  for (const room of rooms) {
    for (const availability of room.calendarAvailability) {
      const dateStr = availability.date.toISOString().split('T')[0];
      if (!availabilityByDate[dateStr]) {
        availabilityByDate[dateStr] = [];
      }
      availabilityByDate[dateStr].push({
        roomId: room.id,
        roomName: room.name,
        status: availability.status,
      });
    }
  }

  // Gerar datas para os próximos 30 dias
  const dates: Date[] = [];
  for (let i = 0; i < 30; i++) {
    dates.push(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Calendário de Disponibilidade (Próximos 30 dias)</h3>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
          {dates.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const roomsAvailable = availabilityByDate[dateStr] || [];
            const availableCount = roomsAvailable.filter(r => r.status === RoomStatus.AVAILABLE).length;
            const totalRooms = rooms.length;
            const percentage = (availableCount / totalRooms) * 100;

            return (
              <div key={dateStr} className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-muted relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-500"
                    style={{ height: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-center">
                  {availableCount}/{totalRooms} disponíveis
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Componente de Tabela de Quartos
async function RoomsTable({ tenantId }: { tenantId: string }) {
  const rooms = await prisma.room.findMany({
    where: { tenantId },
    include: {
      roomGroup: true,
      photos: { take: 1 },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Lista de Quartos</h3>
        <Link href="/tenant/rooms/new" className="btn btn-primary btn-sm">
          Novo Quarto
        </Link>
      </div>
      <div className="card-content">
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nome</th>
                <th>Grupo</th>
                <th>Capacidade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                const statusColor = {
                  [RoomStatus.AVAILABLE]: 'text-success',
                  [RoomStatus.OCCUPIED]: 'text-error',
                  [RoomStatus.MAINTENANCE]: 'text-warning',
                  [RoomStatus.BLOCKED]: 'text-muted-foreground',
                }[room.status];

                return (
                  <tr key={room.id} className="border-b">
                    <td className="py-4">
                      {room.photos[0] ? (
                        <img
                          src={room.photos[0].fileUrl}
                          alt={room.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="py-4">
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-muted-foreground">{room.description}</p>
                    </td>
                    <td className="py-4 text-sm">
                      {room.roomGroup?.name || 'N/A'}
                    </td>
                    <td className="py-4 text-sm">
                      {room.maxAdults} adultos, {room.maxChildren} crianças
                    </td>
                    <td className={`py-4 ${statusColor}`}>
                      {room.status}
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/tenant/rooms/${room.id}`}
                          className="text-sm hover:text-primary"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/tenant/rooms/${room.id}/edit`}
                          className="text-sm hover:text-primary"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/tenant/rooms/${room.id}/availability`}
                          className="text-sm hover:text-primary"
                        >
                          Disponibilidade
                        </Link>
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

// Componente de Estatísticas de Quartos
async function RoomsStats({ tenantId }: { tenantId: string }) {
  const [
    totalRooms,
    availableRooms,
    occupiedRooms,
    maintenanceRooms,
    blockedRooms,
  ] = await Promise.all([
    prisma.room.count({ where: { tenantId } }),
    prisma.room.count({ where: { tenantId, status: RoomStatus.AVAILABLE } }),
    prisma.room.count({ where: { tenantId, status: RoomStatus.OCCUPIED } }),
    prisma.room.count({ where: { tenantId, status: RoomStatus.MAINTENANCE } }),
    prisma.room.count({ where: { tenantId, status: RoomStatus.BLOCKED } }),
  ]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">Total de Quartos</p>
        <p className="text-2xl font-bold">{totalRooms}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">Disponíveis</p>
        <p className="text-2xl font-bold text-success">{availableRooms}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">Ocupados</p>
        <p className="text-2xl font-bold text-error">{occupiedRooms}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">Manutenção</p>
        <p className="text-2xl font-bold text-warning">{maintenanceRooms}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">Bloqueados</p>
        <p className="text-2xl font-bold text-muted-foreground">{blockedRooms}</p>
      </div>
    </div>
  );
}

// Tenant Rooms Page
export default async function TenantRoomsPage() {
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

  const tenantId = session.user.tenantId;

  // Buscar tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    redirect('/auth/error?code=tenant_not_found');
  }

  // Buscar quartos
  const rooms = await prisma.room.findMany({
    where: { tenantId },
    include: {
      roomGroup: true,
      photos: { take: 1 },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quartos</h1>
        <p className="text-muted-foreground">
          Gerencie os quartos da sua pousada/hotel
        </p>
      </div>

      {/* Estatísticas */}
      <RoomsStats tenantId={tenantId} />

      {/* Calendário de Disponibilidade */}
      <div className="mb-6">
        <AvailabilityCalendar tenantId={tenantId} />
      </div>

      {/* Tabela de Quartos */}
      <div className="mb-6">
        <RoomsTable tenantId={tenantId} />
      </div>

      {/* Cards de Quartos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
