// StayOS Tenant Checkout
// Checkout & Pagamentos (Módulo 14)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus, ReservationStatus, PaymentStatus } from '@prisma/client';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { checkoutEngine } from '@stayos/payments';

// Componente de Resumo da Reserva
async function ReservationSummary({ reservationId }: { reservationId: string }) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      room: {
        include: {
          roomGroup: true,
          photos: { take: 1 },
        },
      },
      guest: true,
    },
  });

  if (!reservation) return null;

  // Calcular número de noites
  const checkInDate = new Date(reservation.checkInDate);
  const checkOutDate = new Date(reservation.checkOutDate);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Resumo da Reserva</h3>
      </div>
      <div className="card-content">
        <div className="flex gap-6">
          <div className="w-32 h-32 rounded-lg overflow-hidden">
            {reservation.room?.photos[0] ? (
              <img
                src={reservation.room.photos[0].fileUrl}
                alt={reservation.room.name}
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
            <h4 className="text-xl font-bold">{reservation.room?.name}</h4>
            <p className="text-muted-foreground">{reservation.room?.roomGroup?.name}</p>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Check-in</p>
                <p className="font-medium">{formatDate(reservation.checkInDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Check-out</p>
                <p className="font-medium">{formatDate(reservation.checkOutDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Noites</p>
                <p className="font-medium">{nights}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hóspedes</p>
                <p className="font-medium">{reservation.adults} adultos, {reservation.children} crianças</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-6">
          <div className="flex justify-between items-center">
            <p className="font-medium">Total</p>
            <p className="text-2xl font-bold">{formatCurrency(reservation.totalAmount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de Métodos de Pagamento
async function PaymentMethods({ tenantId }: { tenantId: string }) {
  const paymentMethods = await prisma.platformPaymentMethod.findMany({
    where: { tenantId },
  });

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Métodos de Pagamento</h3>
      </div>
      <div className="card-content">
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <p className="font-medium">
                  {method.cardBrand || method.type} terminada em {method.cardLast4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vence em {method.cardExpMonth}/{method.cardExpYear}
                </p>
              </div>
            </label>
          ))}
          
          {paymentMethods.length === 0 && (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Nenhum método de pagamento cadastrado
              </p>
              <Link href="/tenant/billing/payment-methods" className="btn btn-primary btn-sm">
                Adicionar Método de Pagamento
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente de Resumo do Pagamento
async function PaymentSummary({
  reservationId,
  tenantId,
}: {
  reservationId: string;
  tenantId: string;
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) return null;

  // Buscar plano do tenant para calcular comissão
  const subscription = await prisma.platformSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  const plan = subscription?.plan;
  const commissionPercentage = plan?.commissionTiers[0]?.percentage || 0;
  const commissionAmount = Math.round((reservation.totalAmount * commissionPercentage) / 100);
  const netAmount = reservation.totalAmount - commissionAmount;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Resumo do Pagamento</h3>
      </div>
      <div className="card-content">
        <div className="space-y-4">
          <div className="flex justify-between">
            <p className="text-muted-foreground">Subtotal</p>
            <p>{formatCurrency(reservation.totalAmount)}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-muted-foreground">Comissão da Plataforma ({commissionPercentage}%)</p>
            <p className="text-muted-foreground">- {formatCurrency(commissionAmount)}</p>
          </div>
          <div className="border-t pt-4 flex justify-between">
            <p className="font-medium">Valor a ser repassado</p>
            <p className="font-bold">{formatCurrency(netAmount)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            O valor será transferido para sua conta conectada após confirmação do pagamento.
            Rolling Reserve de 5% será retido por 7 dias para proteção contra chargebacks.
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente de Formulário de Checkout
async function CheckoutForm({
  reservationId,
  tenantId,
}: {
  reservationId: string;
  tenantId: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      connectedAccount: true,
      platformSubscription: true,
    },
  });

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!tenant || !reservation) return null;

  // Verificar se já tem checkout
  const existingCheckout = await prisma.checkout.findFirst({
    where: { reservationId },
  });

  if (existingCheckout) {
    return (
      <div className="card">
        <div className="card-content">
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Checkout já criado</h3>
            <p className="text-muted-foreground mb-4">
              Esta reserva já tem um checkout em andamento.
            </p>
            <Link
              href={`/tenant/checkout/${existingCheckout.id}`}
              className="btn btn-primary"
            >
              Ver Checkout Existente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se pode criar checkout
  const canCheckout = tenant.connectedAccount?.isActive && 
    tenant.platformSubscription?.status === SubscriptionStatus.ACTIVE;

  if (!canCheckout) {
    return (
      <div className="card">
        <div className="card-content">
          <div className="text-center py-6">
            <div className="h-16 w-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Checkout Indisponível</h3>
            <p className="text-muted-foreground mb-4">
              {tenant.connectedAccount?.isActive 
                ? 'Sua assinatura não está ativa.'
                : 'Sua conta conectada não está verificada.'}
            </p>
            {!tenant.connectedAccount?.isActive && (
              <Link
                href="/tenant/billing/kyc"
                className="btn btn-primary"
              >
                Concluir Onboarding Financeiro (KYC)
              </Link>
            )}
            {tenant.platformSubscription?.status !== SubscriptionStatus.ACTIVE && (
              <Link
                href="/tenant/billing"
                className="btn btn-primary"
              >
                Ver Minha Assinatura
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Gerar link de pagamento
  async function generatePaymentLink(formData: FormData) {
    'use server';

    const paymentMethodId = formData.get('paymentMethod') as string;

    try {
      const paymentLink = await checkoutEngine.generatePaymentLink(
        tenantId,
        reservationId,
        reservation.totalAmount,
        'BRL'
      );

      // Criar checkout no banco
      const checkout = await prisma.checkout.create({
        data: {
          tenantId,
          reservationId,
          provider: tenant.platformSubscription?.provider as any,
          providerCheckoutId: paymentLink.checkoutId,
          amount: reservation.totalAmount,
          currency: 'BRL',
          paymentMethod: paymentMethodId || 'card',
          status: 'pending',
          paymentStatus: 'pending',
          metadata: {
            paymentLink: paymentLink.paymentLink,
            expiresAt: paymentLink.expiresAt,
          },
        },
      });

      // Atualizar reserva
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          checkoutId: checkout.id,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      redirect(`/tenant/checkout/${checkout.id}`);
    } catch (error) {
      console.error('Failed to generate payment link:', error);
      return redirect(`/tenant/checkout?error=${encodeURIComponent(String(error))}`);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Finalizar Checkout</h3>
      </div>
      <div className="card-content">
        <form action={generatePaymentLink} className="space-y-4">
          <PaymentMethods tenantId={tenantId} />
          
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Ao clicar em "Finalizar Checkout", você será redirecionado para a página de pagamento.
              O valor será processado via split de pagamento, com a comissão da plataforma retida automaticamente.
            </p>
            <button type="submit" className="btn btn-primary w-full">
              Finalizar Checkout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componente de Status do Checkout
async function CheckoutStatus({ checkoutId }: { checkoutId: string }) {
  const checkout = await checkoutEngine.getCheckout(checkoutId);

  if (!checkout) return null;

  const statusConfig = {
    pending: {
      title: 'Checkout Pendente',
      description: 'Aguardando pagamento do hóspede.',
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
    confirmed: {
      title: 'Pagamento Confirmado',
      description: 'O pagamento foi processado com sucesso.',
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
    failed: {
      title: 'Pagamento Falhou',
      description: 'O pagamento não foi processado.',
      color: 'bg-error/10 text-error-foreground border-error',
      icon: (
        <svg className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24">
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
    canceled: {
      title: 'Checkout Cancelado',
      description: 'O checkout foi cancelado.',
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
  };

  const config = statusConfig[checkout.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Status do Checkout</h3>
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
            <p className="text-sm text-muted-foreground">ID do Checkout</p>
            <p className="font-medium">{checkout.id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Provider</p>
            <p className="font-medium">{checkout.provider}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="font-medium">{formatCurrency(checkout.amount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status do Pagamento</p>
            <p className="font-medium">{checkout.paymentStatus}</p>
          </div>
        </div>

        {checkout.paidAt && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">Pago em</p>
            <p className="font-medium">{formatDate(checkout.paidAt)} {formatTime(checkout.paidAt)}</p>
          </div>
        )}

        {checkout.errorMessage && (
          <div className="mt-6 p-3 bg-error/10 rounded-lg">
            <p className="text-sm text-error-foreground">{checkout.errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de Ações do Checkout
async function CheckoutActions({ checkoutId, tenantId }: { checkoutId: string; tenantId: string }) {
  const checkout = await checkoutEngine.getCheckout(checkoutId);

  if (!checkout) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Ações</h3>
      </div>
      <div className="card-content">
        <div className="flex flex-wrap gap-4">
          {checkout.status === 'pending' && (
            <>
              <Link href={`/tenant/checkout/${checkoutId}/pay`} className="btn btn-primary">
                Pagar Agora
              </Link>
              <button className="btn btn-destructive">
                Cancelar Checkout
              </button>
            </>
          )}
          {checkout.status === 'confirmed' && (
            <>
              <Link href={`/tenant/reservations/${checkout.reservationId}`} className="btn btn-primary">
                Ver Reserva
              </Link>
              <Link href="/tenant/reservations" className="btn btn-outline">
                Voltar para Reservas
              </Link>
            </>
          )}
          {checkout.status === 'failed' && (
            <>
              <Link href={`/tenant/checkout/${checkoutId}/retry`} className="btn btn-primary">
                Tentar Novamente
              </Link>
              <button className="btn btn-destructive">
                Cancelar Checkout
              </button>
            </>
          )}
          {checkout.status === 'canceled' && (
            <Link href="/tenant/reservations" className="btn btn-outline">
              Voltar para Reservas
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Tenant Checkout Page
export default async function TenantCheckoutPage({
  searchParams,
}: {
  searchParams: { reservationId?: string; checkoutId?: string; error?: string };
}) {
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
    include: {
      connectedAccount: true,
      platformSubscription: true,
    },
  });

  if (!tenant) {
    redirect('/auth/error?code=tenant_not_found');
  }

  // Se tiver checkoutId, mostrar status do checkout
  if (searchParams.checkoutId) {
    const checkout = await checkoutEngine.getCheckout(searchParams.checkoutId);

    if (!checkout || checkout.tenantId !== tenantId) {
      redirect('/tenant/reservations');
    }

    return (
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground">
            Finalize o pagamento da reserva
          </p>
        </div>

        {/* Error */}
        {searchParams.error && (
          <div className="mb-6 p-4 bg-error/10 rounded-lg border border-error">
            <p className="text-error-foreground">{decodeURIComponent(searchParams.error)}</p>
          </div>
        )}

        {/* Resumo da Reserva */}
        <div className="mb-6">
          <ReservationSummary reservationId={checkout.reservationId} />
        </div>

        {/* Status do Checkout */}
        <div className="mb-6">
          <CheckoutStatus checkoutId={checkout.id} />
        </div>

        {/* Resumo do Pagamento */}
        <div className="mb-6">
          <PaymentSummary reservationId={checkout.reservationId} tenantId={tenantId} />
        </div>

        {/* Ações */}
        <CheckoutActions checkoutId={checkout.id} tenantId={tenantId} />
      </div>
    );
  }

  // Se tiver reservationId, mostrar formulário de checkout
  if (searchParams.reservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: searchParams.reservationId },
    });

    if (!reservation || reservation.tenantId !== tenantId) {
      redirect('/tenant/reservations');
    }

    return (
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground">
            Finalize o pagamento da reserva {reservation.confirmationCode}
          </p>
        </div>

        {/* Error */}
        {searchParams.error && (
          <div className="mb-6 p-4 bg-error/10 rounded-lg border border-error">
            <p className="text-error-foreground">{decodeURIComponent(searchParams.error)}</p>
          </div>
        )}

        {/* Resumo da Reserva */}
        <div className="mb-6">
          <ReservationSummary reservationId={reservation.id} />
        </div>

        {/* Resumo do Pagamento */}
        <div className="mb-6">
          <PaymentSummary reservationId={reservation.id} tenantId={tenantId} />
        </div>

        {/* Formulário de Checkout */}
        <CheckoutForm reservationId={reservation.id} tenantId={tenantId} />
      </div>
    );
  }

  // Se não tiver nenhum parâmetro, mostrar lista de checkouts
  const checkouts = await prisma.checkout.findMany({
    where: { tenantId },
    include: {
      reservation: {
        include: {
          room: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Meus Checkouts</h1>
        <p className="text-muted-foreground">
          Histórico de checkouts e pagamentos
        </p>
      </div>

      {/* Lista de Checkouts */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Histórico de Checkouts</h3>
        </div>
        <div className="card-content">
          {checkouts.length > 0 ? (
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Reserva</th>
                    <th>Quarto</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {checkouts.map((checkout) => {
                    const statusColor = {
                      pending: 'text-warning',
                      confirmed: 'text-success',
                      failed: 'text-error',
                      canceled: 'text-muted-foreground',
                    }[checkout.status as any];

                    return (
                      <tr key={checkout.id} className="border-b">
                        <td className="py-4 text-sm">
                          {checkout.reservation?.confirmationCode}
                        </td>
                        <td className="py-4">
                          {checkout.reservation?.room?.name}
                        </td>
                        <td className="py-4">
                          {formatCurrency(checkout.amount)}
                        </td>
                        <td className={`py-4 ${statusColor}`}>
                          {checkout.status}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {formatDate(checkout.createdAt)}
                        </td>
                        <td className="py-4">
                          <Link
                            href={`/tenant/checkout/${checkout.id}`}
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
              <p className="text-muted-foreground mb-4">
                Nenhum checkout encontrado
              </p>
              <Link href="/tenant/reservations" className="btn btn-primary">
                Ver Reservas
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
