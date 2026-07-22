// StayOS API - Rooms
// API para Gerenciamento de Quartos (Módulo 12)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, RoomStatus } from '@prisma/client';
import { z } from 'zod';

// GET /api/rooms - Listar quartos
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

    // Buscar quartos
    const rooms = await prisma.room.findMany({
      where: { tenantId },
      include: {
        roomGroup: true,
        photos: true,
        calendarAvailability: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('GET /api/rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Criar quarto
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const RoomSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      roomGroupId: z.string().optional(),
      maxAdults: z.number().int().positive().default(2),
      maxChildren: z.number().int().nonnegative().default(0),
      maxOccupancy: z.number().int().positive().default(2),
      amenities: z.array(z.string()).optional().default([]),
      status: z.nativeEnum(RoomStatus).optional().default(RoomStatus.AVAILABLE),
      sortOrder: z.number().int().optional().default(0),
      metadata: z.record(z.unknown()).optional().default({}),
    });

    const validatedData = RoomSchema.parse(body);

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

    // Criar quarto
    const room = await prisma.room.create({
      data: {
        tenantId,
        ...validatedData,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'ROOM_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          roomId: room.id,
          name: room.name,
        },
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/rooms/:id - Obter quarto
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
    
    // Buscar quarto
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        roomGroup: true,
        photos: true,
        calendarAvailability: true,
        reservations: true,
        blocks: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== room.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('GET /api/rooms/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/rooms/:id - Atualizar quarto
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

    // Atualizar quarto
    const updatedRoom = await prisma.room.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'ROOM_UPDATED',
        userId: session.user.id,
        tenantId: room.tenantId,
        details: {
          roomId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error('PUT /api/rooms/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/:id - Deletar quarto
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

    // Deletar quarto e dados relacionados
    await prisma.roomPhoto.deleteMany({
      where: { roomId: id },
    });

    await prisma.calendarAvailability.deleteMany({
      where: { roomId: id },
    });

    await prisma.roomBlock.deleteMany({
      where: { roomId: id },
    });

    await prisma.reservation.deleteMany({
      where: { roomId: id },
    });

    await prisma.room.delete({
      where: { id },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'ROOM_DELETED',
        userId: session.user.id,
        tenantId: room.tenantId,
        details: {
          roomId: id,
          name: room.name,
        },
      },
    });

    return NextResponse.json({ message: 'Room deleted' });
  } catch (error) {
    console.error('DELETE /api/rooms/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
