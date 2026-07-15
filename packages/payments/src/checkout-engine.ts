// StayOS Checkout Engine
// Motor de Checkout com Split de Pagamento (Módulo 14)

import { prisma } from '@stayos/db';
import { PaymentProviderFactory, PaymentProvider } from './payment-provider';
import { BillingEngine } from './billing-engine';
import { SplitPaymentParams, SplitPaymentResult } from './types';
import { ReservationStatus, PaymentStatus } from '@prisma/client';

export class CheckoutEngine {
  private billingEngine: BillingEngine;
  private static instance: CheckoutEngine;

  private constructor() {
    this.billingEngine = BillingEngine.getInstance();
  }

  public static getInstance(): CheckoutEngine {
    if (!CheckoutEngine.instance) {
      CheckoutEngine.instance = new CheckoutEngine();
    }
    return CheckoutEngine.instance;
  }

  // ============================================================================
  // CHECKOUT
  // ============================================================================

  /**
   * Criar um novo checkout
   * @param tenantId - ID do tenant
   * @param reservationId - ID da reserva
   * @param amount - Valor total em centavos
   * @param currency - Moeda (BRL, USD, EUR)
   * @param paymentMethod - Método de pagamento (card, pix, boleto)
   * @param metadata - Metadados adicionais
   */
  async createCheckout(
    tenantId: string,
    reservationId: string,
    amount: number,
    currency: string = 'BRL',
    paymentMethod: string = 'card',
    metadata?: Record<string, unknown>
  ): Promise<CheckoutResult> {
    // Buscar tenant e reserva
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        platformSubscription: true,
        connectedAccount: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Verificar se tenant tem assinatura ativa
    if (!tenant.platformSubscription || 
        ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(tenant.platformSubscription.status as any)) {
      throw new Error('Tenant subscription is not active');
    }

    // Verificar se tenant tem conta conectada ativa
    if (!tenant.connectedAccount || !tenant.connectedAccount.isActive) {
      throw new Error('Tenant connected account is not active or verified');
    }

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Verificar se reserva já tem checkout
    const existingCheckout = await prisma.checkout.findFirst({
      where: { reservationId },
    });

    if (existingCheckout) {
      throw new Error('Reservation already has a checkout');
    }

    // Buscar plano do tenant para calcular comissão
    const plan = await prisma.platformPlan.findUnique({
      where: { id: tenant.platformSubscription.planId },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Calcular comissão
    const commissionPercentage = this.getCommissionPercentage(plan, amount);
    const commissionAmount = Math.round((amount * commissionPercentage) / 100);
    const netAmount = amount - commissionAmount;

    // Determinar provider com base na assinatura
    const provider = tenant.platformSubscription.provider as PaymentProvider;

    // Criar split payment
    const splitPayment: SplitPaymentParams = {
      tenantId,
      connectedAccountId: tenant.connectedAccount.id,
      amount: netAmount,
      applicationFeeAmount: commissionAmount,
      description: `Checkout para reserva ${reservationId}`,
      metadata: {
        reservationId,
        tenantId,
        checkoutId: `checkout-${Date.now()}`,
        ...metadata,
      },
    };

    // Criar payment no provider
    const paymentResult = await PaymentProviderFactory.createSplitPayment(
      provider,
      splitPayment
    );

    // Salvar checkout no banco
    const checkout = await prisma.checkout.create({
      data: {
        tenantId,
        reservationId,
        provider,
        providerCheckoutId: paymentResult.providerPaymentId,
        amount,
        currency,
        paymentMethod,
        commissionAmount,
        netAmount,
        status: 'pending',
        paymentStatus: 'pending',
        metadata: metadata || {},
      },
    });

    // Atualizar reserva
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkoutId: checkout.id,
        paymentStatus: 'pending',
      },
    });

    // Registrar comissão no ledger
    await this.billingEngine.recordCommission(
      reservationId,
      tenantId,
      amount
    );

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CREATED',
        tenantId,
        details: {
          checkoutId: checkout.id,
          reservationId,
          amount,
          commissionAmount,
          netAmount,
          provider,
        },
      },
    });

    return {
      ...checkout,
      paymentLink: paymentResult.paymentId,
    };
  }

  /**
   * Obter checkout
   */
  async getCheckout(checkoutId: string): Promise<CheckoutResult | null> {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: {
        reservation: true,
      },
    });

    if (!checkout) return null;

    return checkout as CheckoutResult;
  }

  /**
   * Confirmar pagamento do checkout
   */
  async confirmPayment(
    checkoutId: string,
    paymentProviderId: string,
    provider: PaymentProvider
  ): Promise<CheckoutResult> {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: {
        reservation: true,
      },
    });

    if (!checkout) {
      throw new Error('Checkout not found');
    }

    // Verificar pagamento no provider
    const payment = await PaymentProviderFactory.getPayment(
      provider,
      paymentProviderId
    );

    if (!payment || payment.status !== 'succeeded') {
      throw new Error('Payment not confirmed');
    }

    // Atualizar checkout
    const updatedCheckout = await prisma.checkout.update({
      where: { id: checkoutId },
      data: {
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentProviderId,
        paidAt: new Date(),
      },
    });

    // Atualizar reserva
    await prisma.reservation.update({
      where: { id: checkout.reservationId },
      data: {
        status: ReservationStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentReference: paymentProviderId,
      },
    });

    // Liquidar comissão
    await this.billingEngine.liquidateCommission(
      (await prisma.commissionLedger.findFirst({
        where: { reservationId: checkout.reservationId },
      }))?.id || ''
    );

    // Propagar bloqueio para Channel Manager (Módulo 13)
    await this.propagateToChannelManager(checkout.reservationId);

    // Enviar confirmação para hóspede
    await this.sendConfirmation(checkout.reservationId);

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CONFIRMED',
        tenantId: checkout.tenantId,
        details: {
          checkoutId,
          reservationId: checkout.reservationId,
          amount: checkout.amount,
          paymentProviderId,
        },
      },
    });

    return updatedCheckout as CheckoutResult;
  }

  /**
   * Cancelar checkout
   */
  async cancelCheckout(checkoutId: string): Promise<CheckoutResult> {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
      include: {
        reservation: true,
      },
    });

    if (!checkout) {
      throw new Error('Checkout not found');
    }

    // Atualizar checkout
    const updatedCheckout = await prisma.checkout.update({
      where: { id: checkoutId },
      data: {
        status: 'canceled',
        paymentStatus: 'canceled',
        canceledAt: new Date(),
      },
    });

    // Atualizar reserva
    await prisma.reservation.update({
      where: { id: checkout.reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        paymentStatus: PaymentStatus.CANCELED,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CHECKOUT_CANCELED',
        tenantId: checkout.tenantId,
        details: {
          checkoutId,
          reservationId: checkout.reservationId,
        },
      },
    });

    return updatedCheckout as CheckoutResult;
  }

  /**
   * Gerar link de pagamento
   */
  async generatePaymentLink(
    tenantId: string,
    reservationId: string,
    amount: number,
    currency: string = 'BRL'
  ): Promise<PaymentLinkResult> {
    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        connectedAccount: true,
      },
    });

    if (!tenant || !tenant.connectedAccount?.isActive) {
      throw new Error('Tenant connected account is not active');
    }

    // Determinar provider
    const provider = tenant.platformSubscription?.provider as PaymentProvider || PaymentProvider.STRIPE;

    // Gerar link de pagamento
    const paymentLink = await PaymentProviderFactory.createPayment(provider, {
      customerId: tenantId,
      amount,
      currency: currency as any,
      description: `Pagamento para reserva ${reservationId}`,
      metadata: {
        tenantId,
        reservationId,
        type: 'checkout',
      },
    });

    // Salvar pré-checkout
    const preCheckout = await prisma.checkout.create({
      data: {
        tenantId,
        reservationId,
        provider,
        providerCheckoutId: paymentLink.id,
        amount,
        currency: currency as any,
        paymentMethod: 'card',
        status: 'pending',
        paymentStatus: 'pending',
        metadata: {
          paymentLink: paymentLink.id,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
        },
      },
    });

    return {
      paymentLink: paymentLink.id,
      checkoutId: preCheckout.id,
      expiresAt: preCheckout.metadata.expiresAt as Date,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Obter percentual de comissão com base no plano e valor
   */
  private getCommissionPercentage(plan: any, amount: number): number {
    const commissionTiers = plan.commissionTiers as Array<{
      tier: number;
      minAmount: number | null;
      maxAmount: number | null;
      percentage: number;
    }>;

    for (const tier of commissionTiers.sort((a, b) => a.tier - b.tier)) {
      if (tier.minAmount === null || amount >= tier.minAmount) {
        if (tier.maxAmount === null || amount <= tier.maxAmount) {
          return tier.percentage;
        }
      }
    }

    // Se não encontrar tier, usar o último
    return commissionTiers[commissionTiers.length - 1]?.percentage || 0;
  }

  /**
   * Propagar bloqueio para Channel Manager
   */
  private async propagateToChannelManager(reservationId: string): Promise<void> {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
      },
    });

    if (!reservation) return;

    // Atualizar calendário de disponibilidade
    for (let date = new Date(reservation.checkInDate); 
         date <= new Date(reservation.checkOutDate); 
         date.setDate(date.getDate() + 1)) {
      
      await prisma.calendarAvailability.upsert({
        where: {
          roomId_date: {
            roomId: reservation.roomId,
            date,
          },
        },
        update: {
          status: 'OCCUPIED',
          blockedById: reservationId,
        },
        create: {
          roomId: reservation.roomId,
          date,
          status: 'OCCUPIED',
          blockedById: reservationId,
        },
      });
    }

    // Sincronizar com canais externos (iCal)
    // Implementação no Módulo 13
  }

  /**
   * Enviar confirmação para hóspede
   */
  private async sendConfirmation(reservationId: string): Promise<void> {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: true,
      },
    });

    if (!reservation || !reservation.guest) return;

    // Enviar email de confirmação
    console.log(`Enviando email de confirmação para ${reservation.guest.email}`);
    
    // Enviar mensagem via Chat (Módulo 7)
    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: reservation.tenantId,
        guestId: reservation.guestId,
      },
    });

    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: `✅ Reserva confirmada! Código: ${reservation.confirmationCode}\n\n` +
                   `Quarto: ${reservation.room?.name}\n` +
                   `Check-in: ${reservation.checkInDate.toLocaleDateString('pt-BR')}\n` +
                   `Check-out: ${reservation.checkOutDate.toLocaleDateString('pt-BR')}\n` +
                   `Valor: R$ ${(reservation.totalAmount / 100).toFixed(2)}\n\n` +
                   `Obrigado por escolher nossa pousada!`,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.SENT,
          senderType: 'ai',
          metadata: { type: 'confirmation' },
        },
      });
    }
  }

  // ============================================================================
  // ROLLING RESERVE
  // ============================================================================

  /**
   * Verificar rolling reserve
   */
  async checkRollingReserve(checkoutId: string): Promise<RollingReserveResult> {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
    });

    if (!checkout) {
      throw new Error('Checkout not found');
    }

    // Buscar configuração de rolling reserve
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_percentage' },
    });

    const rollingReservePercentage = parseInt(systemConfig?.value as string || '5');
    const rollingReserveDays = parseInt((await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_days' },
    }))?.value as string || '7');

    const rollingReserveAmount = Math.round((checkout.netAmount * rollingReservePercentage) / 100);
    const releaseDate = new Date(checkout.paidAt!.getTime() + rollingReserveDays * 24 * 60 * 60 * 1000);

    return {
      amount: rollingReserveAmount,
      percentage: rollingReservePercentage,
      days: rollingReserveDays,
      releaseDate,
      isReleased: new Date() >= releaseDate,
    };
  }

  /**
   * Liberar rolling reserve
   */
  async releaseRollingReserve(checkoutId: string): Promise<void> {
    const checkout = await prisma.checkout.findUnique({
      where: { id: checkoutId },
    });

    if (!checkout) {
      throw new Error('Checkout not found');
    }

    // Verificar se já pode liberar
    const rollingReserve = await this.checkRollingReserve(checkoutId);
    
    if (!rollingReserve.isReleased) {
      throw new Error('Rolling reserve not ready for release');
    }

    // Atualizar checkout
    await prisma.checkout.update({
      where: { id: checkoutId },
      data: {
        rollingReserveReleasedAt: new Date(),
      },
    });

    // Atualizar ledger financeiro
    await prisma.masterFinancialLedger.create({
      data: {
        entryType: 'revenue_commission',
        tenantId: checkout.tenantId,
        amount: rollingReserve.amount,
        category: 'rolling_reserve_release',
        provider: checkout.provider,
        period: new Date(),
        status: 'confirmed',
        metadata: {
          checkoutId,
          reservationId: checkout.reservationId,
        },
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'ROLLING_RESERVE_RELEASED',
        tenantId: checkout.tenantId,
        details: {
          checkoutId,
          amount: rollingReserve.amount,
        },
      },
    });
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  /**
   * Processar webhook de pagamento
   */
  async handlePaymentWebhook(
    provider: PaymentProvider,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    switch (eventType) {
      case 'payment_intent.succeeded':
      case 'payment.succeeded':
        await this.handlePaymentSuccess(provider, payload);
        break;
      case 'payment_intent.payment_failed':
      case 'payment.failed':
        await this.handlePaymentFailed(provider, payload);
        break;
      default:
        console.log(`Unhandled payment event type: ${eventType}`);
    }
  }

  private async handlePaymentSuccess(
    provider: PaymentProvider,
    payload: Record<string, unknown>
  ): Promise<void> {
    const paymentId = payload.id as string;
    const metadata = payload.metadata as Record<string, unknown>;

    // Buscar checkout associado
    const checkout = await prisma.checkout.findFirst({
      where: {
        providerCheckoutId: paymentId,
        OR: { paymentProviderId: paymentId },
      },
    });

    if (!checkout) {
      console.warn(`No checkout found for payment ${paymentId}`);
      return;
    }

    // Confirmar pagamento
    await this.confirmPayment(checkout.id, paymentId, provider);
  }

  private async handlePaymentFailed(
    provider: PaymentProvider,
    payload: Record<string, unknown>
  ): Promise<void> {
    const paymentId = payload.id as string;
    const metadata = payload.metadata as Record<string, unknown>;

    // Buscar checkout associado
    const checkout = await prisma.checkout.findFirst({
      where: {
        providerCheckoutId: paymentId,
        OR: { paymentProviderId: paymentId },
      },
    });

    if (!checkout) {
      console.warn(`No checkout found for payment ${paymentId}`);
      return;
    }

    // Atualizar checkout como falhado
    await prisma.checkout.update({
      where: { id: checkout.id },
      data: {
        status: 'failed',
        paymentStatus: 'failed',
        errorMessage: payload.error?.message as string || 'Payment failed',
      },
    });

    // Atualizar reserva
    await prisma.reservation.update({
      where: { id: checkout.reservationId },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    // Iniciar dunning
    const subscription = await prisma.platformSubscription.findUnique({
      where: { tenantId: checkout.tenantId },
    });

    if (subscription) {
      await this.billingEngine.startDunning(subscription.id);
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_FAILED',
        tenantId: checkout.tenantId,
        details: {
          checkoutId: checkout.id,
          paymentId: paymentId,
          error: payload.error?.message,
        },
      },
    });
  }
}

// ============================================================================
// Types
// ============================================================================

interface CheckoutResult {
  id: string;
  tenantId: string;
  reservationId: string;
  provider: PaymentProvider;
  providerCheckoutId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  commissionAmount: number;
  netAmount: number;
  status: string;
  paymentStatus: string;
  paymentProviderId?: string;
  paidAt?: Date;
  canceledAt?: Date;
  rollingReserveReleasedAt?: Date;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  paymentLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentLinkResult {
  paymentLink: string;
  checkoutId: string;
  expiresAt: Date;
}

interface RollingReserveResult {
  amount: number;
  percentage: number;
  days: number;
  releaseDate: Date;
  isReleased: boolean;
}

// Singleton
export const checkoutEngine = CheckoutEngine.getInstance();
