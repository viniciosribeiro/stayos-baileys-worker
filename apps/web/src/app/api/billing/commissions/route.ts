// StayOS API - Commissions
// Gerenciamento de Comissões (Módulo 1.B ↔ Módulo 14)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { PaymentProviderFactory } from '@stayos/payments';

// GET /api/billing/commissions - Listar comissões
export async function GET() {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let commissions;
    
    // Master vê todas as comissões
    if (session.user.role === UserRole.MASTER_ADMIN) {
      commissions = await prisma.commissionLedger.findMany({
        include: { 
          // reservation: true, // Descomentar quando Reservation estiver implementado
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Tenant vê apenas suas comissões
      commissions = await prisma.commissionLedger.findMany({
        where: { tenantId: session.user.tenantId },
        include: { 
          // reservation: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json(commissions);
  } catch (error) {
    console.error('GET /api/billing/commissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/commissions - Registrar comissão (chamado pelo Checkout)
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação (pode ser chamado pelo sistema)
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();

    // Validar dados
    const Schema = z.object({
      reservationId: z.string(),
      tenantId: z.string(),
      grossAmount: z.number().int().positive(),
      paymentMethod: z.string().optional(),
      paymentReference: z.string().optional(),
    });

    const validatedData = Schema.parse(body);

    // Buscar tenant e plano
    const tenant = await prisma.tenant.findUnique({
      where: { id: validatedData.tenantId },
      include: { platformSubscription: { include: { plan: true } } },
    });

    if (!tenant || !tenant.platformSubscription?.plan) {
      return NextResponse.json(
        { error: 'Tenant or plan not found' },
        { status: 404 }
      );
    }

    const plan = tenant.platformSubscription.plan;
    const commissionTiers = plan.commissionTiers as Array<{
      tier: number;
      minAmount: number | null;
      maxAmount: number | null;
      percentage: number;
    }>;

    // Calcular comissão com base nos tiers
    let commissionPercentage = 0;
    for (const tier of commissionTiers.sort((a, b) => a.tier - b.tier)) {
      if (tier.minAmount === null || validatedData.grossAmount >= tier.minAmount) {
        if (tier.maxAmount === null || validatedData.grossAmount <= tier.maxAmount) {
          commissionPercentage = tier.percentage;
          break;
        }
      }
    }

    const commissionAmount = Math.round((validatedData.grossAmount * commissionPercentage) / 100);
    const netAmount = validatedData.grossAmount - commissionAmount;

    // Salvar no ledger
    const commission = await prisma.commissionLedger.create({
      data: {
        reservationId: validatedData.reservationId,
        tenantId: validatedData.tenantId,
        grossAmount: validatedData.grossAmount,
        commissionAmount,
        netAmount,
        status: 'pending',
        paymentMethod: validatedData.paymentMethod || 'split',
        paymentReference: validatedData.paymentReference,
      },
    });

    // Atualizar ledger financeiro do Master
    await prisma.masterFinancialLedger.create({
      data: {
        entryType: 'revenue_commission',
        tenantId: validatedData.tenantId,
        amount: commissionAmount,
        category: 'commission',
        provider: 'stripe', // ou o provider usado
        period: new Date(),
        status: 'pending',
        metadata: { 
          commissionId: commission.id,
          reservationId: validatedData.reservationId,
          grossAmount: validatedData.grossAmount,
        },
      },
    });

    // Log de auditoria
    if (session?.user) {
      await prisma.auditLog.create({
        data: {
          action: 'COMMISSION_RECORDED',
          userId: session.user.id,
          tenantId: validatedData.tenantId,
          details: {
            commissionId: commission.id,
            reservationId: validatedData.reservationId,
            grossAmount: validatedData.grossAmount,
            commissionAmount,
            netAmount,
          },
        },
      });
    }

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/commissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/commissions/:id - Obter comissão
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
    
    // Buscar comissão
    const commission = await prisma.commissionLedger.findUnique({
      where: { id },
      include: { 
        // reservation: true,
      },
    });

    if (!commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== commission.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(commission);
  } catch (error) {
    console.error('GET /api/billing/commissions/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/billing/commissions/:id/liquidate - Liquidar comissão
export async function PUT_LIQUIDATE(
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

    // Buscar comissão
    const commission = await prisma.commissionLedger.findUnique({
      where: { id },
    });

    if (!commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    // Verificar se já foi liquidada
    if (commission.status === 'liquidated') {
      return NextResponse.json(
        { error: 'Commission already liquidated' },
        { status: 400 }
      );
    }

    // Buscar configuração de rolling reserve
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_percentage' },
    });

    const rollingReservePercentage = parseInt(systemConfig?.value as string || '5');
    const rollingReserveDays = parseInt((await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_days' },
    }))?.value as string || '7');

    const rollingReserveAmount = Math.round((commission.netAmount * rollingReservePercentage) / 100);

    // Atualizar comissão
    const liquidatedCommission = await prisma.commissionLedger.update({
      where: { id },
      data: {
        status: 'rolling_reserve',
        rollingReserveAmount,
        rollingReserveReleasedAt: new Date(Date.now() + rollingReserveDays * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
      },
    });

    // Atualizar ledger financeiro
    await prisma.masterFinancialLedger.create({
      data: {
        entryType: 'revenue_commission',
        tenantId: commission.tenantId,
        amount: commission.commissionAmount,
        category: 'commission',
        provider: 'stripe',
        period: new Date(),
        status: 'confirmed',
        metadata: { 
          commissionId: commission.id,
          reservationId: commission.reservationId,
        },
      },
    });

    // Agendar liberação do rolling reserve
    setTimeout(async () => {
      await prisma.commissionLedger.update({
        where: { id: commission.id },
        data: {
          status: 'liquidated',
          rollingReserveReleasedAt: new Date(),
        },
      });

      // Atualizar ledger financeiro
      await prisma.masterFinancialLedger.create({
        data: {
          entryType: 'revenue_commission',
          tenantId: commission.tenantId,
          amount: commission.netAmount - rollingReserveAmount,
          category: 'commission_rolling_reserve',
          provider: 'stripe',
          period: new Date(),
          status: 'confirmed',
          metadata: { 
            commissionId: commission.id,
            reservationId: commission.reservationId,
          },
        },
      });
    }, rollingReserveDays * 24 * 60 * 60 * 1000);

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'COMMISSION_LIQUIDATED',
        userId: session.user.id,
        tenantId: commission.tenantId,
        details: {
          commissionId: id,
          grossAmount: commission.grossAmount,
          commissionAmount: commission.commissionAmount,
          netAmount: commission.netAmount,
          rollingReserveAmount,
        },
      },
    });

    return NextResponse.json(liquidatedCommission);
  } catch (error) {
    console.error('PUT /api/billing/commissions/:id/liquidate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/commissions/tenant/:tenantId - Comissões por tenant
export async function GET_BY_TENANT(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = await params;

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar comissões
    const commissions = await prisma.commissionLedger.findMany({
      where: { tenantId },
      include: { 
        // reservation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular totais
    const totalGross = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
    const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalNet = commissions.reduce((sum, c) => sum + c.netAmount, 0);

    return NextResponse.json({
      commissions,
      totals: {
        gross: totalGross,
        commission: totalCommission,
        net: totalNet,
      },
    });
  } catch (error) {
    console.error('GET /api/billing/commissions/tenant/:tenantId error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
