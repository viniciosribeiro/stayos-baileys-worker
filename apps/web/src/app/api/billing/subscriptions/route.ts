// StayOS API - Billing Subscriptions
// Gerenciamento de Assinaturas (Módulo 1.B)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';
import { PaymentProviderFactory } from '@stayos/payments';

// Schema de validação
const SubscriptionSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().int().positive().optional(),
});

// GET /api/billing/subscriptions - Listar assinaturas
export async function GET() {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let subscriptions;
    
    // Master vê todas as assinaturas
    if (session.user.role === UserRole.MASTER_ADMIN) {
      subscriptions = await prisma.platformSubscription.findMany({
        include: {
          tenant: true,
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Tenant vê apenas sua assinatura
      subscriptions = await prisma.platformSubscription.findMany({
        where: { tenantId: session.user.tenantId },
        include: {
          tenant: true,
          plan: true,
        },
      });
    }

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('GET /api/billing/subscriptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/subscriptions - Criar assinatura
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = SubscriptionSchema.parse(body);

    // Buscar plano
    const plan = await prisma.platformPlan.findUnique({
      where: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Determinar tenantId
    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      // Master pode criar assinatura para qualquer tenant
      tenantId = body.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      // Tenant cria assinatura para si mesmo
      tenantId = session.user.tenantId!;
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verificar se já tem assinatura ativa
    const existingSubscription = await prisma.platformSubscription.findUnique({
      where: { tenantId },
    });

    if (existingSubscription && [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(existingSubscription.status as any)) {
      return NextResponse.json(
        { error: 'Tenant already has an active subscription' },
        { status: 400 }
      );
    }

    // Determinar provider (por enquanto, usar Stripe como padrão)
    const provider = PaymentProvider.STRIPE;

    // Criar customer no provider
    const customerParams = {
      name: tenant.name,
      email: tenant.slug, // Usar slug como email único
      metadata: { tenantId },
    };

    const customer = await PaymentProviderFactory.createCustomer(
      provider,
      customerParams
    );

    // Criar assinatura no provider
    const subscriptionParams = {
      customerId: customer.id,
      planId: validatedData.planId,
      paymentMethodId: validatedData.paymentMethodId,
      trialDays: validatedData.trialDays || 14,
      metadata: { tenantId },
    };

    const subscription = await PaymentProviderFactory.createSubscription(
      provider,
      subscriptionParams
    );

    // Salvar no banco
    const dbSubscription = await prisma.platformSubscription.upsert({
      where: { tenantId },
      update: {
        provider: subscription.provider,
        providerId: subscription.providerId,
        planId: subscription.planId,
        status: subscription.status as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        metadata: subscription.metadata,
      },
      create: {
        tenantId,
        provider: subscription.provider,
        providerId: subscription.providerId,
        planId: subscription.planId,
        status: subscription.status as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        metadata: subscription.metadata,
      },
    });

    // Atualizar status do tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.TRIAL },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          subscriptionId: dbSubscription.id,
          planId: validatedData.planId,
          provider,
        },
      },
    });

    return NextResponse.json({ ...subscription, ...dbSubscription }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/subscriptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/subscriptions/:id - Obter assinatura
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
    
    // Buscar assinatura
    const subscription = await prisma.platformSubscription.findUnique({
      where: { id },
      include: {
        tenant: true,
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== subscription.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('GET /api/billing/subscriptions/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/billing/subscriptions/:id - Atualizar assinatura
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

    // Buscar assinatura
    const subscription = await prisma.platformSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Atualizar assinatura
    const updatedSubscription = await prisma.platformSubscription.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_UPDATED',
        userId: session.user.id,
        tenantId: subscription.tenantId,
        details: {
          subscriptionId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedSubscription);
  } catch (error) {
    console.error('PUT /api/billing/subscriptions/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/subscriptions/:id - Cancelar assinatura
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
    const cancelAtPeriodEnd = new URL(request.url).searchParams.get('cancelAtPeriodEnd') === 'true';

    // Buscar assinatura
    const subscription = await prisma.platformSubscription.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== subscription.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancelar no provider
    const providerInstance = PaymentProviderFactory.getProvider(subscription.provider as PaymentProvider);
    await providerInstance.cancelSubscription(subscription.providerId, cancelAtPeriodEnd);

    // Atualizar no banco
    await prisma.platformSubscription.update({
      where: { id },
      data: {
        status: cancelAtPeriodEnd ? 'CANCELED' : 'CANCELED',
        canceledAt: new Date(),
        cancellationReason: cancelAtPeriodEnd ? 'Canceled at period end' : 'Canceled immediately',
      },
    });

    // Atualizar status do tenant
    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: TenantStatus.CANCELLED },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CANCELED',
        userId: session.user.id,
        tenantId: subscription.tenantId,
        details: {
          subscriptionId: id,
          cancelAtPeriodEnd,
        },
      },
    });

    return NextResponse.json({ message: 'Subscription canceled' });
  } catch (error) {
    console.error('DELETE /api/billing/subscriptions/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
