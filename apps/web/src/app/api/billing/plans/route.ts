// StayOS API - Billing Plans
// Gerenciamento de Planos da Plataforma (Módulo 1.B)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

// Schema de validação
const PlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  basePrice: z.number().int().positive(),
  annualPrice: z.number().int().positive().optional(),
  tokenQuota: z.number().int().positive(),
  tokenMarkup: z.number().int().positive(),
  commissionTiers: z.array(z.object({
    tier: z.number().int().positive(),
    minAmount: z.number().int().nonnegative().optional().nullable(),
    maxAmount: z.number().int().positive().optional().nullable(),
    percentage: z.number().positive(),
  })),
  channelQuota: z.number().int().positive(),
  featureFlags: z.record(z.boolean()).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/billing/plans - Listar planos
export async function GET() {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar planos
    const plans = await prisma.platformPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('GET /api/billing/plans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/plans - Criar plano
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = PlanSchema.parse(body);

    // Criar plano
    const plan = await prisma.platformPlan.create({
      data: validatedData,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/plans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/plans/:id - Obter plano
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
    
    // Buscar plano
    const plan = await prisma.platformPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error('GET /api/billing/plans/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/billing/plans/:id - Atualizar plano
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = PlanSchema.parse(body);

    // Atualizar plano
    const plan = await prisma.platformPlan.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('PUT /api/billing/plans/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/plans/:id - Deletar plano
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Deletar plano
    await prisma.platformPlan.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error('DELETE /api/billing/plans/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
