// StayOS API - Reservations
// API para Gerenciamento de Reservas (Módulo 12)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, ReservationStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { checkoutEngine } from '@stayos/payments';

// GET /api/reservations - Listar reservas
export async function GET(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      const { tenantId: queryTenantId } = Object.fromEntries(
        new URL(request.url).searchParams
      );
      tenantId = queryTenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      tenantId = session.user.tenantId!;
    }

    const { status, checkInFrom, checkInTo, guestId } = Object.fromEntries(
      new URL(request.url).searchParams
    );

    // Construir where clause
    const where: any = { tenantId };
    
    if (status) {
      where.status = status as ReservationStatus;
    }
    if (checkInFrom) {
      where.checkInDate = { gte: new Date(checkInFrom) };
    }
    if (checkInTo) {
      where.checkInDate = { ...where.checkInDate, lte: new Date(checkInTo) };
    }
    if (guestId) {
      where.guestId = guestId;
    }

    // Buscar reservas
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        room: {
          include: {
            roomGroup: true,
            photos: { take: 1 },
          },
        },
        guest: true,
        checkout: true,
      },
      orderBy: { checkInDate: 'asc' },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('GET /api/reservations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/reservations - Criar reserva
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const ReservationSchema = z.object({
      roomId: z.string(),
      guestId: z.string().optional(),
      checkInDate: z.string(),
      checkOutDate: z.string(),
      adults: z.number().int().positive().default(1),
      children: z.number().int().nonnegative().default(0),
      metadata: z.record(z.unknown()).optional().default({}),
    });

    const validatedData = ReservationSchema.parse(body);

    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      tenantId = body.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      tenantId = session.user.tenantId!;
    }

    // Buscar quarto
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
      include: {
        roomGroup: {
          include: { ratePlan: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verificar se quarto pertence ao tenant
    if (room.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Room does not belong to tenant' }, { status: 403 });
    }

    // Verificar disponibilidade
    const checkInDate = new Date(validatedData.checkInDate);
    const checkOutDate = new Date(validatedData.checkOutDate);

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    // Verificar se quarto está disponível no período
    const unavailableDates = await prisma.calendarAvailability.findMany({
      where: {
        roomId: validatedData.roomId,
        date: {
          gte: checkInDate,
          lte: checkOutDate,
        },
        status: { in: [RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE, RoomStatus.BLOCKED] },
      },
    });

    if (unavailableDates.length > 0) {
      return NextResponse.json(
        { error: 'Room not available for selected dates' },
        { status: 400 }
      );
    }

    // Buscar hóspede ou criar novo
    let guestId = validatedData.guestId;
    if (!guestId) {
      // Criar hóspede padrão
      const guest = await prisma.guest.create({
        data: {
          tenantId,
          firstName: 'Hóspede',
          lastName: `Reserva-${Date.now()}`,
          metadata: { createdFromReservation: true },
        },
      });
      guestId = guest.id;
    }

    // Calcular preço
    const ratePlan = room.roomGroup?.ratePlan;
    if (!ratePlan) {
      return NextResponse.json({ error: 'Rate plan not found for room' }, { status: 400 });
    }

    // Calcular número de noites
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));

    // Calcular preço base
    let basePrice = ratePlan.basePrice * nights;

    // Adicionar preço por adulto extra
    if (validatedData.adults > 1) {
      const extraAdults = validatedData.adults - 1;
      const adultPricing = ratePlan.occupancyPricing as Record<string, number>;
      const extraAdultPrice = adultPricing?.adult || 0;
      basePrice += extraAdultPrice * extraAdults * nights;
    }

    // Adicionar preço por criança
    if (validatedData.children > 0) {
      const childPricing = ratePlan.occupancyPricing as Record<string, number>;
      const childPrice = childPricing?.child || 0;
      basePrice += childPrice * validatedData.children * nights;
    }

    // Verificar sazonalidade
    const seasonalRules = await prisma.seasonalRule.findMany({
      where: { tenantId },
    });

    let seasonalAdjustment = 0;
    for (const rule of seasonalRules) {
      const startDate = new Date(rule.startDate);
      const endDate = new Date(rule.endDate);
      
      if (checkInDate >= startDate && checkOutDate <= endDate) {
        if (rule.priceAdjustmentType === 'percentage') {
          seasonalAdjustment = basePrice * (rule.priceAdjustmentValue / 100);
        } else {
          seasonalAdjustment = rule.priceAdjustmentValue * nights;
        }
        break;
      }
    }

    const totalPrice = basePrice + seasonalAdjustment;

    // Criar reserva
    const reservation = await prisma.reservation.create({
      data: {
        tenantId,
        guestId,
        roomId: validatedData.roomId,
        confirmationCode: `RES-${Date.now()}`,
        checkInDate,
        checkOutDate,
        adults: validatedData.adults,
        children: validatedData.children,
        subtotal: basePrice,
        taxAmount: 0,
        totalAmount: totalPrice,
        status: ReservationStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        metadata: validatedData.metadata,
      },
    });

    // Atualizar calendário de disponibilidade
    for (let date = new Date(checkInDate); date <= checkOutDate; date.setDate(date.getDate() + 1)) {
      await prisma.calendarAvailability.upsert({
        where: {
          roomId_date: {
            roomId: validatedData.roomId,
            date,
          },
        },
        update: {
          status: RoomStatus.OCCUPIED,
          blockedById: reservation.id,
        },
        create: {
          roomId: validatedData.roomId,
          date,
          status: RoomStatus.OCCUPIED,
          blockedById: reservation.id,
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmationCode,
          roomId: validatedData.roomId,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          totalAmount: reservation.totalAmount,
        },
      },
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/reservations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/reservations/:id - Obter reserva
export async function GET_BY_ID(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            roomGroup: true,
            photos: true,
          },
        },
        guest: true,
        checkout: true,
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== reservation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('GET /api/reservations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/reservations/:id - Atualizar reserva
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== reservation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Se estiver atualizando datas, verificar disponibilidade
    if (body.checkInDate || body.checkOutDate) {
      const checkInDate = new Date(body.checkInDate || reservation.checkInDate);
      const checkOutDate = new Date(body.checkOutDate || reservation.checkOutDate);

      if (checkInDate >= checkOutDate) {
        return NextResponse.json(
          { error: 'Check-out date must be after check-in date' },
          { status: 400 }
        );
      }

      // Verificar se quarto está disponível no novo período
      const unavailableDates = await prisma.calendarAvailability.findMany({
        where: {
          roomId: reservation.roomId,
          date: {
            gte: checkInDate,
            lte: checkOutDate,
          },
          status: { in: [RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE, RoomStatus.BLOCKED] },
          NOT: {
            blockedById: reservation.id,
          },
        },
      });

      if (unavailableDates.length > 0) {
        return NextResponse.json(
          { error: 'Room not available for selected dates' },
          { status: 400 }
        );
      }
    }

    // Atualizar reserva
    const updatedReservation = await prisma.reservation.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_UPDATED',
        userId: session.user.id,
        tenantId: reservation.tenantId,
        details: {
          reservationId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedReservation);
  } catch (error) {
    console.error('PUT /api/reservations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/reservations/:id - Cancelar reserva
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        checkout: true,
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== reservation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancelar checkout se existir
    if (reservation.checkoutId) {
      await checkoutEngine.cancelCheckout(reservation.checkoutId);
    }

    // Atualizar reserva
    const canceledReservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        paymentStatus: PaymentStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    // Liberar datas no calendário
    for (let date = new Date(reservation.checkInDate); 
         date <= new Date(reservation.checkOutDate); 
         date.setDate(date.getDate() + 1)) {
      
      await prisma.calendarAvailability.updateMany({
        where: {
          roomId: reservation.roomId,
          date,
          blockedById: reservation.id,
        },
        data: {
          status: RoomStatus.AVAILABLE,
          blockedById: null,
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_CANCELED',
        userId: session.user.id,
        tenantId: reservation.tenantId,
        details: {
          reservationId: id,
          confirmationCode: reservation.confirmationCode,
        },
      },
    });

    return NextResponse.json(canceledReservation);
  } catch (error) {
    console.error('DELETE /api/reservations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/reservations/:id/confirm - Confirmar reserva
export async function POST_CONFIRM(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        checkout: true,
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== reservation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verificar se já tem checkout
    if (!reservation.checkoutId) {
      return NextResponse.json(
        { error: 'Reservation has no checkout' },
        { status: 400 }
      );
    }

    // Confirmar checkout
    const checkout = await checkoutEngine.getCheckout(reservation.checkoutId);
    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout not found' },
        { status: 404 }
      );
    }

    // Confirmar pagamento (simulação)
    const confirmedCheckout = await checkoutEngine.confirmPayment(
      checkout.id,
      checkout.providerCheckoutId || '',
      checkout.provider as PaymentProvider
    );

    // Atualizar reserva
    const confirmedReservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        confirmedAt: new Date(),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'RESERVATION_CONFIRMED',
        userId: session.user.id,
        tenantId: reservation.tenantId,
        details: {
          reservationId: id,
          confirmationCode: reservation.confirmationCode,
        },
      },
    });

    return NextResponse.json(confirmedReservation);
  } catch (error) {
    console.error('POST /api/reservations/:id/confirm error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/reservations/:id/availability - Verificar disponibilidade
export async function GET_AVAILABILITY(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { checkIn, checkOut } = Object.fromEntries(
      new URL(request.url).searchParams
    );

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'checkIn and checkOut are required' },
        { status: 400 }
      );
    }

    // Buscar quarto
    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== room.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verificar disponibilidade
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    const unavailableDates = await prisma.calendarAvailability.findMany({
      where: {
        roomId: id,
        date: {
          gte: checkInDate,
          lte: checkOutDate,
        },
        status: { in: [RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE, RoomStatus.BLOCKED] },
      },
    });

    const available = unavailableDates.length === 0;

    return NextResponse.json({
      available,
      unavailableDates: unavailableDates.map(d => d.date),
    });
  } catch (error) {
    console.error('GET /api/reservations/:id/availability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
