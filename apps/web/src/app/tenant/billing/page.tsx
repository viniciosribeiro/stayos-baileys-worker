// StayOS Tenant Billing
// Financeiro SaaS - Minha Assinatura (Módulo 22)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { formatCurrency, formatDate, calculatePercentage } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Componente de Status da Assinatura
function SubscriptionStatusCard({ subscription }: any) {
  const statusConfig = {
    [SubscriptionStatus.ACTIVE]: {
      title: 'Assinatura Ativa',
      description: 'Sua assinatura está ativa e funcionando normalmente.',
      color: 'bg-success/10 text-success-foreground border-success',
      icon: (
        <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    [SubscriptionStatus.TRIALING]: {
      title: 'Período de Trial',
      description: 'Você está no período de teste gratuito.',
      color: 'bg-warning/10 text-warning-foreground border-warning',
      icon: (
        <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    [SubscriptionStatus.PAST_DUE]: {
      title: 'Pagamento Pendente',
      description: 'Sua assinatura está com pagamento pendente.',
      color: 'bg-error/10 text-error-foreground border-error',
      icon: (
        <svg className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    [SubscriptionStatus.CANCELED]: {
      title: 'Assinatura Cancelada',
      description: 'Sua assinatura foi cancelada.',
      color: 'bg-muted text-muted-foreground border-muted',
      icon: (
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      ),
    },
    [SubscriptionStatus.INACTIVE]: {
      title: 'Assinatura Inativa',
      description: 'Sua assinatura está inativa.',
      color: 'bg-muted text-muted-foreground border-muted',
      icon: (
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      ),
    },
    [SubscriptionStatus.UNAID]: {
      title: 'Pagamento Não Pago',
      description: 'Sua assinatura tem pagamentos não pagos.',
      color: 'bg-error/10 text-error-foreground border-error',
      icon: (
        <svg className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const config = statusConfig[subscription.status as any] || statusConfig[SubscriptionStatus.INACTIVE];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Status da Assinatura</h3>
      </div>
      <div className="card-content">
        <div className="flex items-center gap-6">
          <div className={`rounded-full p-4 ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <h4 className="text-xl font-bold">{config.title}</h4>
            <p className="text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano Atual</p>
            <p className="font-medium">{subscription.plan?.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">{subscription.status}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Próximo Pagamento</p>
            <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cadastro</p>
            <p className="font-medium">{formatDate(subscription.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de Informações do Plano
function PlanInfoCard({ subscription }: any) {
  const plan = subscription.plan;
  
  if (!plan) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Informações do Plano</h3>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="font-medium">{plan.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="font-medium">{plan.description}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mensalidade</p>
            <p className="font-medium">{formatCurrency(plan.basePrice)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Anualidade</p>
            <p className="font-medium">{plan.annualPrice ? formatCurrency(plan.annualPrice) : 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cota de Tokens</p>
            <p className="font-medium">{plan.tokenQuota.toLocaleString()} tokens/mês</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Canais</p>
            <p className="font-medium">{plan.channelQuota} canais</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h4 className="font-medium mb-2">Recursos Incluídos</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(plan.featureFlags as Record<string, boolean>).map(([feature, enabled]) => (
              enabled && (
                <span key={feature} className="badge badge-primary">
                  {feature}
                </span>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de Consumo de Tokens
async function TokenUsageCard({ tenantId }: { tenantId: string }) {
  // Buscar plano do tenant
  const subscription = await prisma.platformSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  if (!subscription?.plan) return null;

  // Buscar uso de tokens
  const tokenUsage = await prisma.aITokenUsage.aggregate({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    },
    _sum: { tokensUsed: true },
  });

  const tokensUsed = tokenUsage._sum.tokensUsed || 0;
  const tokenQuota = subscription.plan.tokenQuota;
  const percentage = calculatePercentage(tokensUsed, tokenQuota);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Consumo de Tokens de IA</h3>
      </div>
      <div className="card-content">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Tokens Usados</p>
            <p className="text-3xl font-bold">{tokensUsed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cota Mensal</p>
            <p className="text-3xl font-bold">{tokenQuota.toLocaleString()}</p>
          </div>
        </div>
        <div className="h-4 w-full rounded-full bg-muted overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {percentage}% da cota utilizada
        </p>
        {percentage >= 80 && (
          <div className="mt-4 p-3 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning-foreground">
              ⚠️ Você está usando {percentage}% da sua cota de tokens.
              {percentage >= 100 && ' Upgrade seu plano para continuar usando IA.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Método de Pagamento
async function PaymentMethodCard({ tenantId }: { tenantId: string }) {
  const paymentMethods = await prisma.platformPaymentMethod.findMany({
    where: { tenantId },
  });

  const defaultMethod = paymentMethods.find(pm => pm.isDefault);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Método de Pagamento</h3>
      </div>
      <div className="card-content">
        {paymentMethods.length > 0 ? (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`p-4 rounded-lg border ${method.isDefault ? 'border-primary' : 'border-muted'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {method.cardBrand || method.type} terminada em {method.cardLast4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vence em {method.cardExpMonth}/{method.cardExpYear}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="badge badge-primary">Padrão</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Nenhum método de pagamento cadastrado
            </p>
            <Link href="/tenant/billing/payment-methods" className="btn btn-primary">
              Adicionar Método de Pagamento
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Histórico de Faturas
async function InvoicesTable({ tenantId }: { tenantId: string }) {
  const invoices = await prisma.platformInvoice.findMany({
    where: { tenantId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Histórico de Faturas</h3>
      </div>
      <div className="card-content">
        {invoices.length > 0 ? (
          <div className="data-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const statusColor = {
                    draft: 'text-muted-foreground',
                    open: 'text-warning',
                    paid: 'text-success',
                    void: 'text-muted-foreground',
                    uncollectible: 'text-error',
                  }[invoice.status];

                  return (
                    <tr key={invoice.id} className="border-b">
                      <td className="py-4 text-sm">
                        {invoice.providerId || invoice.id}
                      </td>
                      <td className="py-4 text-sm">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="py-4">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className={`py-4 ${statusColor}`}>
                        {invoice.status}
                      </td>
                      <td className="py-4">
                        <Link
                          href={`/tenant/billing/invoices/${invoice.id}`}
                          className="text-sm hover:text-primary"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Extrato de Comissões
async function CommissionsStatement({ tenantId }: { tenantId: string }) {
  const commissions = await prisma.commissionLedger.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const totalGross = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
  const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalNet = commissions.reduce((sum, c) => sum + c.netAmount, 0);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Extrato de Comissões por Reserva</h3>
      </div>
      <div className="card-content">
        {commissions.length > 0 ? (
          <>
            <div className="flex gap-6 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Bruto Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalGross)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão Retida</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalCommission)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Líquido Recebido</p>
                <p className="text-xl font-bold">{formatCurrency(totalNet)}</p>
              </div>
            </div>
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Reserva</th>
                    <th>Bruto</th>
                    <th>Comissão</th>
                    <th>Líquido</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => {
                    const statusColor = {
                      pending: 'text-muted-foreground',
                      rolling_reserve: 'text-warning',
                      liquidated: 'text-success',
                      refunded: 'text-error',
                    }[commission.status];

                    return (
                      <tr key={commission.id} className="border-b">
                        <td className="py-4 text-sm">
                          {commission.reservationId}
                        </td>
                        <td className="py-4">
                          {formatCurrency(commission.grossAmount)}
                        </td>
                        <td className="py-4">
                          {formatCurrency(commission.commissionAmount)}
                        </td>
                        <td className="py-4">
                          {formatCurrency(commission.netAmount)}
                        </td>
                        <td className={`py-4 ${statusColor}`}>
                          {commission.status}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {formatDate(commission.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">Nenhuma comissão encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Onboarding Financeiro (KYC)
async function FinancialOnboardingCard({ tenantId }: { tenantId: string }) {
  const connectedAccount = await prisma.connectedAccount.findUnique({
    where: { tenantId },
  });

  const subscription = await prisma.platformSubscription.findUnique({
    where: { tenantId },
  });

  const isCheckoutEnabled = connectedAccount?.isActive && 
    subscription?.status === SubscriptionStatus.ACTIVE;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Onboarding Financeiro</h3>
      </div>
      <div className="card-content">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full p-2 bg-primary/10">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium">Conta Conectada</p>
              <p className="text-sm text-muted-foreground">
                {connectedAccount ? `Status: ${connectedAccount.kycStatus}` : 'Não configurada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-full p-2 bg-primary/10">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium">Checkout Nativo</p>
              <p className="text-sm text-muted-foreground">
                {isCheckoutEnabled ? 'Ativado' : 'Desativado (KYC pendente)'}
              </p>
            </div>
          </div>
        </div>
        
        {!connectedAccount && (
          <div className="mt-6 p-4 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning-foreground mb-4">
              ⚠️ Para ativar o Checkout Nativo e receber pagamentos diretamente, 
              você precisa concluir o onboarding financeiro (KYC).
            </p>
            <Link href="/tenant/billing/kyc" className="btn btn-primary btn-sm">
              Concluir Onboarding Financeiro
            </Link>
          </div>
        )}
        
        {connectedAccount && connectedAccount.kycStatus !== 'verified' && (
          <div className="mt-6 p-4 bg-warning/10 rounded-lg">
            <p className="text-sm text-warning-foreground mb-4">
              ⚠️ Seu KYC está {connectedAccount.kycStatus}. 
              O Checkout Nativo será ativado assim que for verificado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Tenant Billing Page
export default async function TenantBillingPage() {
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

  // Buscar tenant e assinatura
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    include: {
      platformSubscription: {
        include: { plan: true },
      },
      connectedAccount: true,
    },
  });

  if (!tenant) {
    redirect('/auth/error?code=tenant_not_found');
  }

  // Buscar faturas
  const invoices = await prisma.platformInvoice.findMany({
    where: { tenantId: tenant.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Buscar comissões
  const commissions = await prisma.commissionLedger.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Buscar uso de tokens
  const tokenUsage = await prisma.aITokenUsage.aggregate({
    where: {
      tenantId: tenant.id,
      createdAt: {
        gte: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    },
    _sum: { tokensUsed: true },
  });

  const tokensUsed = tokenUsage._sum.tokensUsed || 0;
  const tokenQuota = tenant.platformSubscription?.plan?.tokenQuota || 0;
  const tokenPercentage = calculatePercentage(tokensUsed, tokenQuota);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Minha Assinatura</h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura, faturas e pagamentos
        </p>
      </div>

      {/* Alertas */}
      {tokenPercentage >= 80 && (
        <div className="mb-6 p-4 bg-warning/10 rounded-lg border border-warning">
          <p className="text-warning-foreground">
            ⚠️ Você está usando {tokenPercentage}% da sua cota de tokens de IA.
            {tokenPercentage >= 100 && ' Upgrade seu plano para continuar usando IA.'}
          </p>
        </div>
      )}

      {tenant.platformSubscription?.status === SubscriptionStatus.PAST_DUE && (
        <div className="mb-6 p-4 bg-error/10 rounded-lg border border-error">
          <p className="text-error-foreground">
            ⚠️ Sua assinatura está com pagamento pendente. 
            Regularize para evitar suspensão do serviço.
          </p>
        </div>
      )}

      {/* Status da Assinatura */}
      {tenant.platformSubscription && (
        <div className="mb-6">
          <SubscriptionStatusCard subscription={tenant.platformSubscription} />
        </div>
      )}

      {/* Onboarding Financeiro */}
      <div className="mb-6">
        <FinancialOnboardingCard tenantId={tenant.id} />
      </div>

      {/* Informações do Plano e Consumo */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tenant.platformSubscription && (
          <PlanInfoCard subscription={tenant.platformSubscription} />
        )}
        <TokenUsageCard tenantId={tenant.id} />
      </div>

      {/* Método de Pagamento */}
      <div className="mb-6">
        <PaymentMethodCard tenantId={tenant.id} />
      </div>

      {/* Histórico de Faturas */}
      <div className="mb-6">
        <InvoicesTable tenantId={tenant.id} />
      </div>

      {/* Extrato de Comissões */}
      <div className="mb-6">
        <CommissionsStatement tenantId={tenant.id} />
      </div>

      {/* Ações */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Ações</h3>
        </div>
        <div className="card-content">
          <div className="flex flex-wrap gap-4">
            <Link href="/tenant/billing/upgrade" className="btn btn-primary">
              Upgrade de Plano
            </Link>
            <Link href="/tenant/billing/payment-methods" className="btn btn-outline">
              Gerenciar Métodos de Pagamento
            </Link>
            <Link href="/tenant/billing/kyc" className="btn btn-outline">
              Onboarding Financeiro (KYC)
            </Link>
            {tenant.platformSubscription?.status === SubscriptionStatus.ACTIVE && (
              <button className="btn btn-destructive">
                Cancelar Assinatura
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Import redirect
import { redirect } from 'next/navigation';
