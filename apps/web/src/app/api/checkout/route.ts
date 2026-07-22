// StayOS API - Checkout
// API para Checkout & Pagamentos (Módulo 14)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, TenantStatus, SubscriptionStatus, ReservationStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { checkoutEngine } from '@stayos/payments';
import { PaymentProviderFactory, PaymentProvider } from '@stayos/payments';

// POST /api/checkout - Criar checkout
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const CheckoutSchema = z.object({
      reservationId: z.string(),
      amount: z.number().int().positive(),
      currency: z.string().default('BRL'),
      paymentMethod: z.string().default('card'),
      metadata: z.record(z.unknown()).optional(),
    });

    const validatedData = CheckoutSchema.parse(body);

    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      // Master pode criar checkout para qualquer tenant
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

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        platformSubscription: true,
        connectedAccount: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verificar se tenant está ativo
    if (tenant.status !== TenantStatus.ACTIVE && tenant.status !== TenantStatus.TRIAL) {
      return NextResponse.json(
        { error: 'Tenant is not active' },
        { status: 400 }
      );
    }

    // Verificar se tenant tem assinatura ativa
    if (!tenant.platformSubscription || 
        ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(tenant.platformSubscription.status as any)) {
      return NextResponse.json(
        { error: 'Tenant subscription is not active' },
        { status: 400 }
      );
    }

    // Verificar se tenant tem conta conectada ativa
    if (!tenant.connectedAccount || !tenant.connectedAccount.isActive) {
      return NextResponse.json(
        { error: 'Tenant connected account is not active or verified. Complete KYC first.' },
        { status: 400 }
      );
    }

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id: validatedData.reservationId },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Verificar se reserva pertence ao tenant
    if (reservation.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Reservation does not belong to tenant' }, { status: 403 });
    }

    // Verificar se reserva já tem checkout
    const existingCheckout = await prisma.checkout.findFirst({
      where: { reservationId: validatedData.reservationId },
    });

    if (existingCheckout) {
      return NextResponse.json(
        { error: 'Reservation already has a checkout' },
        { status: 400 }
      );
    }

    // Criar checkout
    const checkout = await checkoutEngine.createCheckout(
      tenantId,
      validatedData.reservationId,
      validatedData.amount,
      validatedData.currency,
      validatedData.paymentMethod,
      validatedData.metadata
    );

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          checkoutId: checkout.id,
          reservationId: validatedData.reservationId,
          amount: validatedData.amount,
        },
      },
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/checkout/:id - Obter checkout
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
    
    // Buscar checkout
    const checkout = await checkoutEngine.getCheckout(id);

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== checkout.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(checkout);
  } catch (error) {
    console.error('GET /api/checkout/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/checkout/:id/confirm - Confirmar pagamento
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
    const body = await request.json();

    const ConfirmSchema = z.object({
      paymentProviderId: z.string(),
      provider: z.nativeEnum(PaymentProvider),
    });

    const validatedData = ConfirmSchema.parse(body);

    // Buscar checkout
    const checkout = await checkoutEngine.getCheckout(id);

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== checkout.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Confirmar pagamento
    const confirmedCheckout = await checkoutEngine.confirmPayment(
      id,
      validatedData.paymentProviderId,
      validatedData.provider
    );

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CONFIRMED',
        userId: session.user.id,
        tenantId: checkout.tenantId,
        details: {
          checkoutId: id,
          paymentProviderId: validatedData.paymentProviderId,
        },
      },
    });

    return NextResponse.json(confirmedCheckout);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/checkout/:id/confirm error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/checkout/:id/cancel - Cancelar checkout
export async function POST_CANCEL(
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

    // Buscar checkout
    const checkout = await checkoutEngine.getCheckout(id);

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== checkout.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancelar checkout
    const canceledCheckout = await checkoutEngine.cancelCheckout(id);

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CANCELED',
        userId: session.user.id,
        tenantId: checkout.tenantId,
        details: {
          checkoutId: id,
        },
      },
    });

    return NextResponse.json(canceledCheckout);
  } catch (error) {
    console.error('POST /api/checkout/:id/cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/checkout/generate-link - Gerar link de pagamento
export async function POST_GENERATE_LINK(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const LinkSchema = z.object({
      reservationId: z.string(),
      amount: z.number().int().positive(),
      currency: z.string().default('BRL'),
    });

    const validatedData = LinkSchema.parse(body);

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

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        connectedAccount: true,
      },
    });

    if (!tenant || !tenant.connectedAccount?.isActive) {
      return NextResponse.json(
        { error: 'Tenant connected account is not active' },
        { status: 400 }
      );
    }

    // Gerar link de pagamento
    const paymentLink = await checkoutEngine.generatePaymentLink(
      tenantId,
      validatedData.reservationId,
      validatedData.amount,
      validatedData.currency
    );

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_LINK_GENERATED',
        userId: session.user.id,
        tenantId,
        details: {
          reservationId: validatedData.reservationId,
          amount: validatedData.amount,
          checkoutId: paymentLink.checkoutId,
        },
      },
    });

    return NextResponse.json(paymentLink, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/checkout/generate-link error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/checkout/tenant/:tenantId - Listar checkouts do tenant
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

    // Buscar checkouts
    const checkouts = await prisma.checkout.findMany({
      where: { tenantId },
      include: {
        reservation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(checkouts);
  } catch (error) {
    console.error('GET /api/checkout/tenant/:tenantId error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
