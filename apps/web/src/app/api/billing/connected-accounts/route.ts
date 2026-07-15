// StayOS API - Connected Accounts (KYC)
// Gerenciamento de Contas Conectadas (Módulo 1.B)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, TenantStatus } from '@prisma/client';
import { z } from 'zod';
import { PaymentProviderFactory, PaymentProvider } from '@stayos/payments';

// Schema de validação
const ConnectedAccountSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  bankAccount: z.object({
    bank: z.string(),
    agency: z.string(),
    account: z.string(),
    cpfCnpj: z.string(),
    accountType: z.enum(['checking', 'savings']),
  }).optional(),
});

// GET /api/billing/connected-accounts - Listar contas conectadas
export async function GET() {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let connectedAccounts;
    
    // Master vê todas as contas conectadas
    if (session.user.role === UserRole.MASTER_ADMIN) {
      connectedAccounts = await prisma.connectedAccount.findMany({
        include: { tenant: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Tenant vê apenas sua conta conectada
      connectedAccounts = await prisma.connectedAccount.findMany({
        where: { tenantId: session.user.tenantId },
        include: { tenant: true },
      });
    }

    return NextResponse.json(connectedAccounts);
  } catch (error) {
    console.error('GET /api/billing/connected-accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/billing/connected-accounts - Criar conta conectada (KYC)
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ConnectedAccountSchema.parse(body);

    // Determinar tenantId
    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      // Master pode criar conta para qualquer tenant
      tenantId = body.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      // Tenant cria conta para si mesmo
      tenantId = session.user.tenantId!;
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { platformSubscription: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verificar se já tem conta conectada
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: { tenantId },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Tenant already has a connected account' },
        { status: 400 }
      );
    }

    // Verificar se tenant tem assinatura ativa
    if (!tenant.platformSubscription || 
        ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(tenant.platformSubscription.status as any)) {
      return NextResponse.json(
        { error: 'Tenant must have an active subscription to create a connected account' },
        { status: 400 }
      );
    }

    // Criar conta conectada no provider
    const connectedAccount = await PaymentProviderFactory.createConnectedAccount(
      validatedData.provider,
      {
        tenantId,
        provider: validatedData.provider,
        bankAccount: validatedData.bankAccount,
        metadata: { createdBy: session.user.id },
      }
    );

    // Salvar no banco
    const dbConnectedAccount = await prisma.connectedAccount.upsert({
      where: { tenantId },
      update: {
        provider: connectedAccount.provider,
        providerId: connectedAccount.providerId,
        kycStatus: connectedAccount.kycStatus,
        kycDetails: connectedAccount.kycDetails,
        bankAccount: connectedAccount.bankAccount,
        isActive: connectedAccount.isActive,
        metadata: connectedAccount.metadata,
      },
      create: {
        tenantId,
        provider: connectedAccount.provider,
        providerId: connectedAccount.providerId,
        kycStatus: connectedAccount.kycStatus,
        kycDetails: connectedAccount.kycDetails,
        bankAccount: connectedAccount.bankAccount,
        isActive: connectedAccount.isActive,
        metadata: connectedAccount.metadata,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONNECTED_ACCOUNT_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          connectedAccountId: dbConnectedAccount.id,
          provider: validatedData.provider,
        },
      },
    });

    return NextResponse.json({ ...connectedAccount, ...dbConnectedAccount }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/billing/connected-accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/billing/connected-accounts/:id - Obter conta conectada
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
    
    // Buscar conta conectada
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!connectedAccount) {
      return NextResponse.json({ error: 'Connected account not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== connectedAccount.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(connectedAccount);
  } catch (error) {
    console.error('GET /api/billing/connected-accounts/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/billing/connected-accounts/:id - Atualizar conta conectada
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

    // Buscar conta conectada
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { id },
    });

    if (!connectedAccount) {
      return NextResponse.json({ error: 'Connected account not found' }, { status: 404 });
    }

    // Atualizar conta conectada
    const updatedConnectedAccount = await prisma.connectedAccount.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONNECTED_ACCOUNT_UPDATED',
        userId: session.user.id,
        tenantId: connectedAccount.tenantId,
        details: {
          connectedAccountId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedConnectedAccount);
  } catch (error) {
    console.error('PUT /api/billing/connected-accounts/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/connected-accounts/:id - Deletar conta conectada
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

    // Buscar conta conectada
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!connectedAccount) {
      return NextResponse.json({ error: 'Connected account not found' }, { status: 404 });
    }

    // Deletar conta conectada
    await prisma.connectedAccount.delete({
      where: { id },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONNECTED_ACCOUNT_DELETED',
        userId: session.user.id,
        tenantId: connectedAccount.tenantId,
        details: {
          connectedAccountId: id,
        },
      },
    });

    return NextResponse.json({ message: 'Connected account deleted' });
  } catch (error) {
    console.error('DELETE /api/billing/connected-accounts/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
