// StayOS API - Financial Ledger
// Ledger Financeiro Consolidado do Master (Módulo 1.B)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { BillingEngine } from '@stayos/payments';

// GET /api/billing/ledger - Listar lançamentos do ledger
export async function GET() {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, entryType, tenantId, status } = Object.fromEntries(
      new URL(request.url).searchParams
    );

    // Construir where clause
    const where: any = {};
    
    if (startDate) {
      where.period = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.period = { ...where.period, lte: new Date(endDate) };
    }
    if (entryType) {
      where.entryType = entryType;
    }
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (status) {
      where.status = status;
    }

    // Buscar lançamentos
    const ledgerEntries = await prisma.masterFinancialLedger.findMany({
      where,
      orderBy: { period: 'desc' },
      take: 100,
    });

    // Calcular totais
    const totalRevenue = ledgerEntries
      .filter(e => e.entryType.includes('revenue'))
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalCost = ledgerEntries
      .filter(e => e.entryType.includes('cost'))
      .reduce((sum, e) => sum + e.amount, 0);

    const netMargin = totalRevenue - totalCost;

    return NextResponse.json({
      entries: ledgerEntries,
      summary: {
        totalRevenue,
        totalCost,
        netMargin,
        marginPercentage: totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('GET /api/billing/ledger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/ledger - Criar lançamento manual
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Schema de validação
    const LedgerEntrySchema = z.object({
      entryType: z.string(),
      tenantId: z.string().optional(),
      amount: z.number().int(),
      category: z.string(),
      provider: z.string().optional(),
      period: z.date().optional(),
      status: z.string().optional(),
      reconciliationNote: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const validatedData = LedgerEntrySchema.parse(body);

    // Criar lançamento
    const entry = await prisma.masterFinancialLedger.create({
      data: {
        ...validatedData,
        period: validatedData.period || new Date(),
        status: validatedData.status || 'pending',
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'LEDGER_ENTRY_CREATED',
        userId: session.user.id,
        details: {
          entryId: entry.id,
          entryType: entry.entryType,
          amount: entry.amount,
          category: entry.category,
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/ledger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/ledger/metrics - Métricas financeiras
export async function GET_METRICS() {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const billingEngine = BillingEngine.getInstance();

    // Buscar métricas
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
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'TRIAL' } }),
      prisma.tenant.count({ where: { status: 'PAST_DUE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    ]);

    // Buscar receita por plano
    const revenueByPlan = await prisma.platformSubscription.groupBy({
      by: ['planId'],
      _sum: { 
        // Precisamos buscar o preço do plano
      },
      _count: { _all: true },
    });

    // Buscar planos
    const plans = await prisma.platformPlan.findMany();
    const planRevenue = plans.map(plan => ({
      planId: plan.id,
      planName: plan.name,
      revenue: plan.basePrice * (revenueByPlan.find(p => p.planId === plan.id)?._count._all || 0),
    }));

    return NextResponse.json({
      mrr,
      arr,
      churnRate,
      ltv,
      activationRate,
      netMargin,
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        pastDue: pastDueTenants,
        suspended: suspendedTenants,
      },
      revenueByPlan: planRevenue,
    });
  } catch (error) {
    console.error('GET /api/billing/ledger/metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/ledger/reconcile - Reconciliar lançamentos
export async function POST_RECONCILE(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação e papel
    if (!session?.user || session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const Schema = z.object({
      provider: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    });

    const validatedData = Schema.parse(body);

    const billingEngine = BillingEngine.getInstance();
    
    await billingEngine.reconcile(
      validatedData.provider as any,
      new Date(validatedData.startDate),
      new Date(validatedData.endDate)
    );

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'LEDGER_RECONCILIATION',
        userId: session.user.id,
        details: {
          provider: validatedData.provider,
          period: { startDate: validatedData.startDate, endDate: validatedData.endDate },
        },
      },
    });

    return NextResponse.json({ message: 'Reconciliation completed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/ledger/reconcile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
