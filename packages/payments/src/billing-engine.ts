// StayOS Billing Engine
// Motor de Billing Unificado (Módulo 1.B)
// Gerencia assinaturas, pagamentos, comissões e emissões fiscais

import { prisma } from '@stayos/db';
import { StripeProvider } from './stripe-provider';
import { MercadoPagoProvider } from './mercado-pago-provider';
import { AsaasProvider } from './asaas-provider';
import {
  CustomerCreateParams,
  Customer,
  PaymentMethodCreateParams,
  PaymentMethod,
  SubscriptionCreateParams,
  Subscription,
  PaymentCreateParams,
  Payment,
  ConnectedAccountCreateParams,
  ConnectedAccount,
  SplitPaymentParams,
  SplitPaymentResult,
  FiscalDocumentCreateParams,
  FiscalDocument,
  PaymentProvider,
  Currency,
  DunningConfig,
  DunningAttempt,
} from './types';

// Singleton do Billing Engine
export class BillingEngine {
  private stripe: StripeProvider;
  private mercadoPago: MercadoPagoProvider;
  private asaas: AsaasProvider;
  private static instance: BillingEngine;

  private constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const mercadoPagoKey = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    const asaasKey = process.env.ASAAS_API_KEY || '';

    this.stripe = StripeProvider.getInstance(stripeKey);
    this.mercadoPago = MercadoPagoProvider.getInstance(mercadoPagoKey);
    this.asaas = AsaasProvider.getInstance(asaasKey);
  }

  public static getInstance(): BillingEngine {
    if (!BillingEngine.instance) {
      BillingEngine.instance = new BillingEngine();
    }
    return BillingEngine.instance;
  }

  // ============================================================================
  // GET PROVIDER
  // ============================================================================

  private getProvider(provider: PaymentProvider) {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.stripe;
      case PaymentProvider.MERCADO_PAGO:
        return this.mercadoPago;
      case PaymentProvider.ASAAS:
        return this.asaas;
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(provider: PaymentProvider, params: CustomerCreateParams): Promise<Customer> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createCustomer(params);
  }

  async getCustomer(provider: PaymentProvider, providerId: string): Promise<Customer | null> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getCustomer(providerId);
  }

  async updateCustomer(provider: PaymentProvider, providerId: string, params: Partial<CustomerCreateParams>): Promise<Customer> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.updateCustomer(providerId, params);
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPaymentMethod(provider: PaymentProvider, params: PaymentMethodCreateParams): Promise<PaymentMethod> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createPaymentMethod(params);
  }

  async getPaymentMethod(provider: PaymentProvider, providerId: string): Promise<PaymentMethod | null> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getPaymentMethod(providerId);
  }

  async listPaymentMethods(provider: PaymentProvider, customerId: string): Promise<PaymentMethod[]> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.listPaymentMethods(customerId);
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async createSubscription(provider: PaymentProvider, params: SubscriptionCreateParams): Promise<Subscription> {
    const providerInstance = this.getProvider(provider);
    
    // Criar assinatura no provider
    const subscription = await providerInstance.createSubscription(params);
    
    // Salvar no banco
    const dbSubscription = await prisma.platformSubscription.upsert({
      where: { tenantId: params.customerId },
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
        canceledAt: subscription.canceledAt,
        cancellationReason: subscription.cancellationReason,
        metadata: subscription.metadata,
      },
      create: {
        tenantId: params.customerId,
        provider: subscription.provider,
        providerId: subscription.providerId,
        planId: subscription.planId,
        status: subscription.status as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        cancellationReason: subscription.cancellationReason,
        metadata: subscription.metadata,
      },
    });

    return { ...subscription, ...dbSubscription };
  }

  async getSubscription(provider: PaymentProvider, providerId: string): Promise<Subscription | null> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getSubscription(providerId);
  }

  async updateSubscription(provider: PaymentProvider, subscriptionId: string, params: Partial<SubscriptionCreateParams>): Promise<Subscription> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.updateSubscription(subscriptionId, params);
  }

  async cancelSubscription(provider: PaymentProvider, subscriptionId: string, cancelAtPeriodEnd: boolean = false): Promise<Subscription> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.cancelSubscription(subscriptionId, cancelAtPeriodEnd);
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async createPayment(provider: PaymentProvider, params: PaymentCreateParams): Promise<Payment> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createPayment(params);
  }

  async getPayment(provider: PaymentProvider, providerId: string): Promise<Payment | null> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getPayment(providerId);
  }

  // ============================================================================
  // CONNECTED ACCOUNTS (KYC - Módulo 1.B)
  // ============================================================================

  async createConnectedAccount(provider: PaymentProvider, params: ConnectedAccountCreateParams): Promise<ConnectedAccount> {
    const providerInstance = this.getProvider(provider);
    
    // Criar conta conectada no provider
    const connectedAccount = await providerInstance.createConnectedAccount(params);
    
    // Salvar no banco
    const dbConnectedAccount = await prisma.connectedAccount.upsert({
      where: { tenantId: params.tenantId },
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
        tenantId: params.tenantId,
        provider: connectedAccount.provider,
        providerId: connectedAccount.providerId,
        kycStatus: connectedAccount.kycStatus,
        kycDetails: connectedAccount.kycDetails,
        bankAccount: connectedAccount.bankAccount,
        isActive: connectedAccount.isActive,
        metadata: connectedAccount.metadata,
      },
    });

    return { ...connectedAccount, ...dbConnectedAccount };
  }

  async getConnectedAccount(provider: PaymentProvider, providerId: string): Promise<ConnectedAccount | null> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getConnectedAccount(providerId);
  }

  async getConnectedAccountByTenant(tenantId: string): Promise<ConnectedAccount | null> {
    return prisma.connectedAccount.findUnique({
      where: { tenantId },
    });
  }

  // ============================================================================
  // SPLIT PAYMENTS (Módulo 14 ↔ Módulo 1.B)
  // ============================================================================

  async createSplitPayment(provider: PaymentProvider, params: SplitPaymentParams): Promise<SplitPaymentResult> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createSplitPayment(params);
  }

  // ============================================================================
  // INVOICES (Módulo 1.B)
  // ============================================================================

  async createInvoice(tenantId: string, items: Array<{
    description: string;
    amount: number;
    type: string;
    referenceId?: string;
  }>): Promise<any> {
    // Buscar tenant e assinatura
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { platformSubscription: true },
    });

    if (!tenant || !tenant.platformSubscription) {
      throw new Error('Tenant or subscription not found');
    }

    const subscription = tenant.platformSubscription;
    const plan = await prisma.platformPlan.findUnique({
      where: { id: subscription.planId },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Calcular total
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = subtotal; // Sem impostos por enquanto

    // Criar fatura no banco
    const invoice = await prisma.platformInvoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        taxAmount: 0,
        totalAmount,
        status: 'draft',
        metadata: {},
      },
    });

    // Criar itens da fatura
    for (const item of items) {
      await prisma.platformInvoiceItem.create({
        data: {
          invoiceId: invoice.id,
          type: item.type as any,
          description: item.description,
          amount: item.amount,
          referenceId: item.referenceId,
        },
      });
    }

    // Criar no provider
    const providerInstance = this.getProvider(subscription.provider as PaymentProvider);
    
    try {
      // Para Stripe, criar Invoice
      if (subscription.provider === PaymentProvider.STRIPE) {
        const stripeInvoice = await (providerInstance as any).createInvoice({
          customerId: tenantId,
          subscriptionId: subscription.providerId,
          items: items.map(i => ({
            description: i.description,
            amount: i.amount,
            quantity: 1,
          })),
        });

        // Atualizar fatura com ID do provider
        await prisma.platformInvoice.update({
          where: { id: invoice.id },
          data: {
            provider: PaymentProvider.STRIPE,
            providerId: stripeInvoice.id,
            status: 'open',
          },
        });
      }
    } catch (error) {
      console.error('Failed to create invoice in provider:', error);
    }

    return invoice;
  }

  async getInvoice(invoiceId: string) {
    return prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
  }

  async listInvoices(tenantId: string) {
    return prisma.platformInvoice.findMany({
      where: { tenantId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // COMMISSION LEDGER (Módulo 14 ↔ Módulo 1.B)
  // ============================================================================

  async recordCommission(reservationId: string, tenantId: string, grossAmount: number): Promise<void> {
    // Buscar tenant e plano
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { platformSubscription: { include: { plan: true } } },
    });

    if (!tenant || !tenant.platformSubscription?.plan) {
      throw new Error('Tenant or plan not found');
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
      if (tier.minAmount === null || grossAmount >= tier.minAmount) {
        if (tier.maxAmount === null || grossAmount <= tier.maxAmount) {
          commissionPercentage = tier.percentage;
          break;
        }
      }
    }

    const commissionAmount = Math.round((grossAmount * commissionPercentage) / 100);
    const netAmount = grossAmount - commissionAmount;

    // Salvar no ledger
    await prisma.commissionLedger.create({
      data: {
        reservationId,
        tenantId,
        grossAmount,
        commissionAmount,
        netAmount,
        status: 'pending',
        paymentMethod: 'split',
      },
    });

    // Atualizar ledger financeiro do Master
    await prisma.masterFinancialLedger.create({
      data: {
        entryType: 'revenue_commission',
        tenantId,
        amount: commissionAmount,
        category: 'commission',
        provider: 'stripe', // ou o provider usado
        period: new Date(),
        status: 'pending',
        metadata: { reservationId, grossAmount },
      },
    });
  }

  async liquidateCommission(commissionId: string): Promise<void> {
    const commission = await prisma.commissionLedger.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    // Verificar rolling reserve
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_percentage' },
    });

    const rollingReservePercentage = parseInt(systemConfig?.value as string || '5');
    const rollingReserveDays = parseInt((await prisma.systemConfig.findUnique({
      where: { key: 'rolling_reserve_days' },
    }))?.value as string || '7');

    const rollingReserveAmount = Math.round((commission.netAmount * rollingReservePercentage) / 100);

    // Atualizar comissão
    await prisma.commissionLedger.update({
      where: { id: commissionId },
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
        metadata: { commissionId, reservationId: commission.reservationId },
      },
    });

    // Agendar liberação do rolling reserve
    setTimeout(async () => {
      await prisma.commissionLedger.update({
        where: { id: commissionId },
        data: {
          status: 'liquidated',
          rollingReserveReleasedAt: new Date(),
        },
      });
    }, rollingReserveDays * 24 * 60 * 60 * 1000);
  }

  // ============================================================================
  // DUNNING MANAGEMENT (Módulo 1.B)
  // ============================================================================

  async startDunning(subscriptionId: string): Promise<void> {
    const subscription = await prisma.platformSubscription.findUnique({
      where: { id: subscriptionId },
      include: { tenant: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Buscar configuração de dunning
    const dunningConfig = await this.getDunningConfig();

    // Criar tentativas de dunning
    for (let i = 0; i < dunningConfig.retryDays.length; i++) {
      const retryDay = dunningConfig.retryDays[i];
      const nextAttemptAt = new Date(Date.now() + retryDay * 24 * 60 * 60 * 1000);

      await prisma.dunningAttempt.create({
        data: {
          subscriptionId: subscription.id,
          attemptNumber: i + 1,
          channel: dunningConfig.channels[i % dunningConfig.channels.length],
          status: 'PENDING',
          nextAttemptAt,
        },
      });
    }

    // Atualizar status da assinatura
    await prisma.platformSubscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'DUNNING_STARTED',
        tenantId: subscription.tenantId,
        details: {
          subscriptionId: subscription.id,
          retryDays: dunningConfig.retryDays,
        },
      },
    });
  }

  async processDunningAttempt(attemptId: string): Promise<void> {
    const attempt = await prisma.dunningAttempt.findUnique({
      where: { id: attemptId },
      include: { subscription: { include: { tenant: true } } },
    });

    if (!attempt) {
      throw new Error('Dunning attempt not found');
    }

    const subscription = attempt.subscription;
    const tenant = subscription.tenant;

    try {
      // Enviar notificação (email, SMS, etc.)
      // Implementação dependendo do canal
      switch (attempt.channel) {
        case 'email':
          await this.sendDunningEmail(tenant, subscription, attempt);
          break;
        case 'sms':
          await this.sendDunningSMS(tenant, subscription, attempt);
          break;
        case 'whatsapp':
          await this.sendDunningWhatsApp(tenant, subscription, attempt);
          break;
      }

      // Marcar como enviado
      await prisma.dunningAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'SENT',
          response: { sentAt: new Date() },
        },
      });

      // Log de auditoria
      await prisma.auditLog.create({
        data: {
          action: 'DUNNING_ATTEMPT_SENT',
          tenantId: tenant.id,
          details: {
            attemptId,
            channel: attempt.channel,
            attemptNumber: attempt.attemptNumber,
          },
        },
      });

      // Se não for a última tentativa, agendar a próxima
      if (attempt.attemptNumber < 3) {
        const nextAttempt = await prisma.dunningAttempt.findFirst({
          where: {
            subscriptionId: subscription.id,
            attemptNumber: attempt.attemptNumber + 1,
          },
        });

        if (nextAttempt) {
          // Agendar próxima tentativa
          setTimeout(() => {
            this.processDunningAttempt(nextAttempt.id);
          }, nextAttempt.nextAttemptAt!.getTime() - Date.now());
        }
      }
    } catch (error) {
      console.error('Dunning attempt failed:', error);
      
      await prisma.dunningAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'FAILED',
          errorMessage: String(error),
        },
      });

      // Se todas as tentativas falharem, suspender assinatura
      const failedAttempts = await prisma.dunningAttempt.count({
        where: {
          subscriptionId: subscription.id,
          status: 'FAILED',
        },
      });

      const totalAttempts = await prisma.dunningAttempt.count({
        where: { subscriptionId: subscription.id },
      });

      if (failedAttempts === totalAttempts) {
        await prisma.platformSubscription.update({
          where: { id: subscription.id },
          data: { status: 'SUSPENDED' },
        });

        // Log de auditoria
        await prisma.auditLog.create({
          data: {
            action: 'SUBSCRIPTION_SUSPENDED',
            tenantId: tenant.id,
            details: {
              subscriptionId: subscription.id,
              reason: 'All dunning attempts failed',
            },
          },
        });
      }
    }
  }

  private async getDunningConfig(): Promise<DunningConfig> {
    const retryDays = await prisma.systemConfig.findUnique({
      where: { key: 'dunning_retry_days' },
    });

    return {
      retryDays: retryDays?.value as number[] || [1, 3, 7],
      channels: ['email', 'sms', 'whatsapp'],
      templates: {
        email: {
          subject: 'Pagamento Pendente - StayOS',
          body: 'Sua assinatura está com pagamento pendente. Por favor, regularize para evitar suspensão.',
        },
        sms: 'Pagamento pendente na StayOS. Regularize para evitar suspensão.',
        whatsapp: 'Olá! Seu pagamento da StayOS está pendente. Por favor, regularize para evitar suspensão do serviço.',
      },
    };
  }

  private async sendDunningEmail(tenant: any, subscription: any, attempt: any): Promise<void> {
    // Implementação de envio de email
    console.log(`Enviando email de dunning para ${tenant.email}`);
    console.log(`Assunto: ${this.getDunningConfig().templates.email?.subject}`);
    console.log(`Corpo: ${this.getDunningConfig().templates.email?.body}`);
  }

  private async sendDunningSMS(tenant: any, subscription: any, attempt: any): Promise<void> {
    // Implementação de envio de SMS
    console.log(`Enviando SMS de dunning para ${tenant.phone}`);
    console.log(`Mensagem: ${this.getDunningConfig().templates.sms}`);
  }

  private async sendDunningWhatsApp(tenant: any, subscription: any, attempt: any): Promise<void> {
    // Implementação de envio de WhatsApp
    console.log(`Enviando WhatsApp de dunning para ${tenant.phone}`);
    console.log(`Mensagem: ${this.getDunningConfig().templates.whatsapp}`);
  }

  // ============================================================================
  // FISCAL DOCUMENTS (Módulo 1.B)
  // ============================================================================

  async createFiscalDocument(provider: PaymentProvider, params: FiscalDocumentCreateParams): Promise<FiscalDocument> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createFiscalDocument(params);
  }

  async emitFiscalDocument(invoiceId: string): Promise<FiscalDocument> {
    const invoice = await prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Determinar provider com base na assinatura
    const subscription = await prisma.platformSubscription.findUnique({
      where: { tenantId: invoice.tenantId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const provider = subscription.provider as PaymentProvider;

    // Criar documento fiscal
    const fiscalDocument = await this.createFiscalDocument(provider, {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      type: FiscalDocumentType.NFS_E,
      amount: invoice.totalAmount,
      description: `Fatura StayOS - ${invoice.id}`,
      metadata: {},
    });

    // Atualizar fatura com documento fiscal
    await prisma.platformInvoice.update({
      where: { id: invoice.id },
      data: { fiscalDocumentId: fiscalDocument.id },
    });

    return fiscalDocument;
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(provider: PaymentProvider, payload: Buffer, signature: string): Promise<boolean> {
    const providerInstance = this.getProvider(provider);
    
    try {
      const result = await (providerInstance as any).handleWebhook(payload, signature);
      
      // Processar eventos pendentes
      await this.processPendingEvents(provider);
      
      return result;
    } catch (error) {
      console.error(`Webhook error for ${provider}:`, error);
      return false;
    }
  }

  private async processPendingEvents(provider: PaymentProvider): Promise<void> {
    // Processar eventos pendentes no banco
    const pendingEvents = await prisma.platformBillingEvent.findMany({
      where: {
        provider,
        processed: false,
      },
    });

    for (const event of pendingEvents) {
      try {
        // Processar evento
        await this.processEvent(event);
        
        // Marcar como processado
        await prisma.platformBillingEvent.update({
          where: { id: event.id },
          data: { processed: true, processedAt: new Date() },
        });
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error);
        
        // Atualizar com erro
        await prisma.platformBillingEvent.update({
          where: { id: event.id },
          data: { errorMessage: String(error) },
        });
      }
    }
  }

  private async processEvent(event: any): Promise<void> {
    // Processar evento com base no tipo
    switch (event.eventType) {
      case 'payment_intent.succeeded':
      case 'invoice.paid':
        await this.handlePaymentSuccess(event);
        break;
      case 'payment_intent.payment_failed':
      case 'invoice.payment_failed':
        await this.handlePaymentFailure(event);
        break;
      case 'subscription.created':
        await this.handleSubscriptionCreated(event);
        break;
      case 'subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'subscription.deleted':
        await this.handleSubscriptionCanceled(event);
        break;
      case 'account.updated':
        await this.handleAccountUpdated(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }
  }

  private async handlePaymentSuccess(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Atualizar fatura
    await prisma.platformInvoice.updateMany({
      where: { providerId: payload.invoice?.toString() },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Atualizar ledger financeiro
    await prisma.masterFinancialLedger.create({
      data: {
        entryType: 'revenue_subscription',
        tenantId: payload.metadata?.tenantId,
        amount: payload.amount,
        category: 'subscription',
        provider: event.provider,
        period: new Date(),
        status: 'confirmed',
        metadata: { eventId: event.id },
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_PROCESSED',
        tenantId: payload.metadata?.tenantId,
        details: {
          paymentId: payload.id,
          amount: payload.amount,
          provider: event.provider,
        },
      },
    });
  }

  private async handlePaymentFailure(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Iniciar dunning
    const subscription = await prisma.platformSubscription.findFirst({
      where: { tenantId: payload.metadata?.tenantId },
    });

    if (subscription) {
      await this.startDunning(subscription.id);
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_FAILED',
        tenantId: payload.metadata?.tenantId,
        details: {
          paymentId: payload.id,
          amount: payload.amount,
          reason: payload.last_payment_error?.code,
        },
      },
    });
  }

  private async handleSubscriptionCreated(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: payload.id?.toString() },
      data: {
        status: payload.status as any,
        currentPeriodStart: new Date(payload.current_period_start * 1000),
        currentPeriodEnd: new Date(payload.current_period_end * 1000),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CREATED',
        tenantId: payload.metadata?.tenantId,
        details: {
          subscriptionId: payload.id,
          planId: payload.plan?.id,
          status: payload.status,
        },
      },
    });
  }

  private async handleSubscriptionUpdated(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: payload.id?.toString() },
      data: {
        status: payload.status as any,
        cancelAtPeriodEnd: payload.cancel_at_period_end,
        canceledAt: payload.canceled_at ? new Date(payload.canceled_at * 1000) : undefined,
        cancellationReason: payload.cancellation_details?.reason,
      },
    });

    // Se for cancelamento, anonimizar dados (Módulo 6)
    if (payload.status === 'canceled') {
      const tenant = await prisma.tenant.findFirst({
        where: { platformSubscription: { providerId: payload.id?.toString() } },
      });

      if (tenant) {
        // Anonimizar dados do tenant (LGPD/GDPR)
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            name: `Anonimizado-${tenant.id}`,
            slug: `anon-${tenant.id}`,
            domain: null,
            metadata: { ...tenant.metadata, anonymized: true },
          },
        });
      }
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATUS_CHANGE',
        tenantId: payload.metadata?.tenantId,
        details: {
          subscriptionId: payload.id,
          oldStatus: payload.previous_attributes?.status,
          newStatus: payload.status,
        },
      },
    });
  }

  private async handleSubscriptionCanceled(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: payload.id?.toString() },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(payload.canceled_at * 1000),
        cancellationReason: payload.cancellation_details?.reason,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CANCELED',
        tenantId: payload.metadata?.tenantId,
        details: {
          subscriptionId: payload.id,
          reason: payload.cancellation_details?.reason,
        },
      },
    });
  }

  private async handleAccountUpdated(event: any): Promise<void> {
    const payload = event.payload as any;
    
    // Atualizar conta conectada
    await prisma.connectedAccount.update({
      where: { providerId: payload.id?.toString() },
      data: {
        kycStatus: payload.charges_enabled ? 'verified' : 'pending',
        isActive: payload.charges_enabled,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'KYC_STATUS_CHANGE',
        tenantId: payload.metadata?.tenantId,
        details: {
          accountId: payload.id,
          oldStatus: payload.previous_attributes?.charges_enabled ? 'verified' : 'pending',
          newStatus: payload.charges_enabled ? 'verified' : 'pending',
        },
      },
    });
  }

  // ============================================================================
  // RECONCILIAÇÃO FINANCEIRA (Módulo 1.B)
  // ============================================================================

  async reconcile(provider: PaymentProvider, startDate: Date, endDate: Date): Promise<void> {
    // Buscar eventos do provider no período
    const events = await prisma.platformBillingEvent.findMany({
      where: {
        provider,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        processed: true,
      },
    });

    // Buscar lançamentos no ledger
    const ledgerEntries = await prisma.masterFinancialLedger.findMany({
      where: {
        provider,
        period: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Comparar e reconciliar
    for (const event of events) {
      const matchingEntry = ledgerEntries.find(
        (entry) => entry.metadata?.eventId === event.id
      );

      if (!matchingEntry) {
        // Criar lançamento no ledger
        await prisma.masterFinancialLedger.create({
          data: {
            entryType: this.getEntryType(event.eventType),
            tenantId: event.tenantId || null,
            amount: this.getAmountFromEvent(event),
            category: this.getCategoryFromEvent(event.eventType),
            provider,
            period: new Date(event.createdAt),
            status: 'reconciled',
            reconciliationNote: `Reconciled from event ${event.id}`,
            metadata: { eventId: event.id },
          },
        });
      }
    }

    // Verificar divergências
    const ledgerTotal = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const eventsTotal = events.reduce((sum, event) => sum + this.getAmountFromEvent(event), 0);

    if (ledgerTotal !== eventsTotal) {
      console.warn(`Divergência de reconciliação para ${provider}: Ledger=${ledgerTotal}, Events=${eventsTotal}`);
      
      // Criar alerta
      await prisma.auditLog.create({
        data: {
          action: 'RECONCILIATION_DIVERGENCE',
          details: {
            provider,
            period: { startDate, endDate },
            ledgerTotal,
            eventsTotal,
            difference: eventsTotal - ledgerTotal,
          },
        },
      });
    }
  }

  private getEntryType(eventType: string): string {
    if (eventType.includes('payment') && eventType.includes('succeeded')) {
      return 'revenue_subscription';
    }
    if (eventType.includes('invoice') && eventType.includes('paid')) {
      return 'revenue_subscription';
    }
    if (eventType.includes('commission')) {
      return 'revenue_commission';
    }
    if (eventType.includes('refund')) {
      return 'refund';
    }
    return 'other';
  }

  private getAmountFromEvent(event: any): number {
    const payload = event.payload as any;
    return payload.amount || payload.totalAmount || 0;
  }

  private getCategoryFromEvent(eventType: string): string {
    if (eventType.includes('subscription')) {
      return 'subscription';
    }
    if (eventType.includes('commission')) {
      return 'commission';
    }
    if (eventType.includes('token')) {
      return 'ai_tokens';
    }
    return 'other';
  }

  // ============================================================================
  // MÉTRICAS FINANCEIRAS (Módulo 1)
  // ============================================================================

  async getMRR(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeSubscriptions = await prisma.platformSubscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { gte: startOfMonth },
      },
      include: { plan: true },
    });

    const mrr = activeSubscriptions.reduce(
      (sum, sub) => sum + (sub.plan?.basePrice || 0),
      0
    );

    return mrr;
  }

  async getARR(): Promise<number> {
    const mrr = await this.getMRR();
    return mrr * 12;
  }

  async getChurnRate(): Promise<number> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Assinaturas ativas no mês passado
    const activeLastMonth = await prisma.platformSubscription.count({
      where: {
        status: 'ACTIVE',
        currentPeriodStart: { lte: endOfLastMonth },
        currentPeriodEnd: { gte: startOfLastMonth },
      },
    });

    // Assinaturas canceladas no mês atual
    const canceledThisMonth = await prisma.platformSubscription.count({
      where: {
        status: 'CANCELED',
        canceledAt: { gte: startOfLastMonth },
      },
    });

    if (activeLastMonth === 0) return 0;
    return (canceledThisMonth / activeLastMonth) * 100;
  }

  async getLTV(): Promise<number> {
    const activeSubscriptions = await prisma.platformSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    if (activeSubscriptions.length === 0) return 0;

    const avgMonthlyValue = activeSubscriptions.reduce(
      (sum, sub) => sum + (sub.plan?.basePrice || 0),
      0
    ) / activeSubscriptions.length;

    // LTV = ARPU / Churn Rate
    const churnRate = await this.getChurnRate();
    if (churnRate === 0) return avgMonthlyValue * 12 * 100; // Assumir 100 meses
    
    return avgMonthlyValue / (churnRate / 100);
  }

  async getActivationRate(): Promise<number> {
    const totalTenants = await prisma.tenant.count();
    const activeTenants = await prisma.tenant.count({
      where: { onboardingCompleted: true },
    });

    if (totalTenants === 0) return 0;
    return (activeTenants / totalTenants) * 100;
  }

  async getNetMargin(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Receita total
    const revenue = await prisma.masterFinancialLedger.aggregate({
      where: {
        entryType: { in: ['revenue_subscription', 'revenue_commission'] },
        period: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Custo de IA
    const aiCost = await prisma.masterFinancialLedger.aggregate({
      where: {
        entryType: 'cost_ai',
        period: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const totalRevenue = revenue._sum.amount || 0;
    const totalCost = aiCost._sum.amount || 0;

    if (totalRevenue === 0) return 0;
    return ((totalRevenue - totalCost) / totalRevenue) * 100;
  }
}

// Singleton
export const billingEngine = BillingEngine.getInstance();
