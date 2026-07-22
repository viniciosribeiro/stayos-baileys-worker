// StayOS Stripe Provider
// Implementação do Gateway de Pagamentos para Stripe

import Stripe from 'stripe';
import { prisma } from '@stayos/db';
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
} from './types';
import { PaymentProvider, Currency } from './types';

// Singleton do Stripe
export class StripeProvider {
  private stripe: Stripe;
  private static instance: StripeProvider;

  private constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-01-30',
    });
  }

  public static getInstance(apiKey: string): StripeProvider {
    if (!StripeProvider.instance) {
      StripeProvider.instance = new StripeProvider(apiKey);
    }
    return StripeProvider.instance;
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(params: CustomerCreateParams): Promise<Customer> {
    try {
      const stripeCustomer = await this.stripe.customers.create({
        name: params.name,
        email: params.email,
        phone: params.phone,
        metadata: params.metadata || {},
        address: params.address ? {
          line1: params.address.street,
          line2: params.address.complement,
          city: params.address.city,
          state: params.address.state,
          postal_code: params.address.zipCode,
          country: params.address.country,
        } : undefined,
      });

      return {
        id: stripeCustomer.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeCustomer.id,
        name: stripeCustomer.name || '',
        email: stripeCustomer.email || '',
        phone: stripeCustomer.phone || undefined,
        cpfCnpj: undefined,
        address: params.address,
        metadata: stripeCustomer.metadata,
        createdAt: new Date(stripeCustomer.created * 1000),
        updatedAt: new Date(stripeCustomer.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe createCustomer error:', error);
      throw error;
    }
  }

  async getCustomer(providerId: string): Promise<Customer | null> {
    try {
      const stripeCustomer = await this.stripe.customers.retrieve(providerId);
      
      return {
        id: stripeCustomer.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeCustomer.id,
        name: stripeCustomer.name || '',
        email: stripeCustomer.email || '',
        phone: stripeCustomer.phone || undefined,
        cpfCnpj: undefined,
        address: stripeCustomer.address ? {
          street: stripeCustomer.address.line1 || '',
          number: stripeCustomer.address.line2 || '',
          complement: undefined,
          neighborhood: '',
          city: stripeCustomer.address.city || '',
          state: stripeCustomer.address.state || '',
          zipCode: stripeCustomer.address.postal_code || '',
          country: stripeCustomer.address.country || '',
        } : undefined,
        metadata: stripeCustomer.metadata,
        createdAt: new Date(stripeCustomer.created * 1000),
        updatedAt: new Date(stripeCustomer.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe getCustomer error:', error);
      return null;
    }
  }

  async updateCustomer(providerId: string, params: Partial<CustomerCreateParams>): Promise<Customer> {
    try {
      const stripeCustomer = await this.stripe.customers.update(providerId, {
        name: params.name,
        email: params.email,
        phone: params.phone,
        metadata: params.metadata,
        address: params.address ? {
          line1: params.address.street,
          line2: params.address.complement,
          city: params.address.city,
          state: params.address.state,
          postal_code: params.address.zipCode,
          country: params.address.country,
        } : undefined,
      });

      return {
        id: stripeCustomer.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeCustomer.id,
        name: stripeCustomer.name || '',
        email: stripeCustomer.email || '',
        phone: stripeCustomer.phone || undefined,
        cpfCnpj: undefined,
        address: params.address,
        metadata: stripeCustomer.metadata,
        createdAt: new Date(stripeCustomer.created * 1000),
        updatedAt: new Date(stripeCustomer.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe updateCustomer error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPaymentMethod(params: PaymentMethodCreateParams): Promise<PaymentMethod> {
    try {
      // Criar PaymentMethod no Stripe
      const stripePaymentMethod = await this.stripe.paymentMethods.create({
        type: params.type === 'card' ? 'card' : 'us_bank_account',
        card: params.type === 'card' ? {
          number: params.cardNumber,
          exp_month: params.cardExpMonth,
          exp_year: params.cardExpYear,
          cvc: params.cardCvc,
        } : undefined,
        billing_details: {
          name: params.cardHolderName,
          email: params.customerId, // Usar email do customer
        },
      });

      // Anexar ao customer
      await this.stripe.paymentMethods.attach(stripePaymentMethod.id, {
        customer: params.customerId,
      });

      // Definir como padrão se necessário
      if (params.type === 'card') {
        await this.stripe.customers.update(params.customerId, {
          invoice_settings: {
            default_payment_method: stripePaymentMethod.id,
          },
        });
      }

      return {
        id: stripePaymentMethod.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripePaymentMethod.id,
        customerId: params.customerId,
        type: params.type,
        cardBrand: stripePaymentMethod.card?.brand as string | undefined,
        cardLast4: stripePaymentMethod.card?.last4,
        cardExpMonth: stripePaymentMethod.card?.exp_month,
        cardExpYear: stripePaymentMethod.card?.exp_year,
        isDefault: true,
        isActive: true,
        createdAt: new Date(stripePaymentMethod.created * 1000),
        updatedAt: new Date(stripePaymentMethod.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe createPaymentMethod error:', error);
      throw error;
    }
  }

  async getPaymentMethod(providerId: string): Promise<PaymentMethod | null> {
    try {
      const stripePaymentMethod = await this.stripe.paymentMethods.retrieve(providerId);
      
      return {
        id: stripePaymentMethod.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripePaymentMethod.id,
        customerId: stripePaymentMethod.customer as string,
        type: stripePaymentMethod.type as PaymentMethodType,
        cardBrand: stripePaymentMethod.card?.brand as string | undefined,
        cardLast4: stripePaymentMethod.card?.last4,
        cardExpMonth: stripePaymentMethod.card?.exp_month,
        cardExpYear: stripePaymentMethod.card?.exp_year,
        isDefault: false,
        isActive: true,
        createdAt: new Date(stripePaymentMethod.created * 1000),
        updatedAt: new Date(stripePaymentMethod.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe getPaymentMethod error:', error);
      return null;
    }
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const stripePaymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return stripePaymentMethods.data.map((pm) => ({
        id: pm.id,
        provider: PaymentProvider.STRIPE,
        providerId: pm.id,
        customerId: pm.customer as string,
        type: pm.type as PaymentMethodType,
        cardBrand: pm.card?.brand as string | undefined,
        cardLast4: pm.card?.last4,
        cardExpMonth: pm.card?.exp_month,
        cardExpYear: pm.card?.exp_year,
        isDefault: false,
        isActive: true,
        createdAt: new Date(pm.created * 1000),
        updatedAt: new Date(pm.updated * 1000),
      }));
    } catch (error) {
      console.error('Stripe listPaymentMethods error:', error);
      return [];
    }
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async createSubscription(params: SubscriptionCreateParams): Promise<Subscription> {
    try {
      // Buscar plano no banco
      const plan = await prisma.platformPlan.findUnique({
        where: { id: params.planId },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Criar assinatura no Stripe
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: params.customerId,
        items: [{
          price_data: {
            currency: 'brl',
            product_data: {
              name: plan.name,
              description: plan.description || '',
            },
            unit_amount: plan.basePrice,
            recurring: {
              interval: 'month',
            },
          },
        }],
        default_payment_method: params.paymentMethodId,
        trial_period_days: params.trialDays,
        metadata: params.metadata || {},
      });

      return {
        id: stripeSubscription.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeSubscription.id,
        customerId: stripeSubscription.customer as string,
        planId: params.planId,
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : undefined,
        cancellationReason: stripeSubscription.cancellation_details?.reason,
        metadata: stripeSubscription.metadata,
        createdAt: new Date(stripeSubscription.created * 1000),
        updatedAt: new Date(stripeSubscription.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe createSubscription error:', error);
      throw error;
    }
  }

  async getSubscription(providerId: string): Promise<Subscription | null> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(providerId);
      
      return {
        id: stripeSubscription.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeSubscription.id,
        customerId: stripeSubscription.customer as string,
        planId: stripeSubscription.items.data[0]?.price.id || '',
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : undefined,
        cancellationReason: stripeSubscription.cancellation_details?.reason,
        metadata: stripeSubscription.metadata,
        createdAt: new Date(stripeSubscription.created * 1000),
        updatedAt: new Date(stripeSubscription.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe getSubscription error:', error);
      return null;
    }
  }

  async updateSubscription(subscriptionId: string, params: Partial<SubscriptionCreateParams>): Promise<Subscription> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        default_payment_method: params.paymentMethodId,
        metadata: params.metadata,
      });

      return {
        id: stripeSubscription.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeSubscription.id,
        customerId: stripeSubscription.customer as string,
        planId: stripeSubscription.items.data[0]?.price.id || '',
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : undefined,
        cancellationReason: stripeSubscription.cancellation_details?.reason,
        metadata: stripeSubscription.metadata,
        createdAt: new Date(stripeSubscription.created * 1000),
        updatedAt: new Date(stripeSubscription.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe updateSubscription error:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = false): Promise<Subscription> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.cancel(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      return {
        id: stripeSubscription.id,
        provider: PaymentProvider.STRIPE,
        providerId: stripeSubscription.id,
        customerId: stripeSubscription.customer as string,
        planId: stripeSubscription.items.data[0]?.price.id || '',
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : undefined,
        cancellationReason: stripeSubscription.cancellation_details?.reason,
        metadata: stripeSubscription.metadata,
        createdAt: new Date(stripeSubscription.created * 1000),
        updatedAt: new Date(stripeSubscription.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe cancelSubscription error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async createPayment(params: PaymentCreateParams): Promise<Payment> {
    try {
      // Criar PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency.toLowerCase() as Currency,
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        description: params.description,
        metadata: params.metadata || {},
        // Split Payment (Módulo 14)
        transfer_data: params.transferData ? {
          destination: params.transferData.destination,
          amount: params.transferData.amount,
        } : undefined,
        application_fee_amount: params.applicationFeeAmount,
        confirm: true,
      });

      return {
        id: paymentIntent.id,
        provider: PaymentProvider.STRIPE,
        providerId: paymentIntent.id,
        invoiceId: undefined,
        customerId: paymentIntent.customer as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency as Currency,
        paymentMethodId: paymentIntent.payment_method as string | undefined,
        status: paymentIntent.status as any,
        description: paymentIntent.description || undefined,
        metadata: paymentIntent.metadata,
        transferData: params.transferData,
        applicationFeeAmount: params.applicationFeeAmount,
        createdAt: new Date(paymentIntent.created * 1000),
        updatedAt: new Date(paymentIntent.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe createPayment error:', error);
      throw error;
    }
  }

  async getPayment(providerId: string): Promise<Payment | null> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(providerId);
      
      return {
        id: paymentIntent.id,
        provider: PaymentProvider.STRIPE,
        providerId: paymentIntent.id,
        invoiceId: paymentIntent.invoice as string | undefined,
        customerId: paymentIntent.customer as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency as Currency,
        paymentMethodId: paymentIntent.payment_method as string | undefined,
        status: paymentIntent.status as any,
        description: paymentIntent.description || undefined,
        metadata: paymentIntent.metadata,
        transferData: undefined,
        applicationFeeAmount: paymentIntent.application_fee_amount,
        createdAt: new Date(paymentIntent.created * 1000),
        updatedAt: new Date(paymentIntent.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe getPayment error:', error);
      return null;
    }
  }

  // ============================================================================
  // CONNECTED ACCOUNTS (Stripe Connect - Módulo 1.B)
  // ============================================================================

  async createConnectedAccount(params: ConnectedAccountCreateParams): Promise<ConnectedAccount> {
    try {
      // Criar Account no Stripe Connect
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: params.tenantId, // Usar email do tenant
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: params.metadata || {},
      });

      return {
        id: account.id,
        provider: PaymentProvider.STRIPE,
        providerId: account.id,
        tenantId: params.tenantId,
        kycStatus: 'pending',
        kycDetails: {},
        bankAccount: params.bankAccount,
        isActive: false,
        metadata: account.metadata,
        createdAt: new Date(account.created * 1000),
        updatedAt: new Date(account.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe createConnectedAccount error:', error);
      throw error;
    }
  }

  async getConnectedAccount(providerId: string): Promise<ConnectedAccount | null> {
    try {
      const account = await this.stripe.accounts.retrieve(providerId);
      
      return {
        id: account.id,
        provider: PaymentProvider.STRIPE,
        providerId: account.id,
        tenantId: account.metadata.tenantId || '',
        kycStatus: account.charges_enabled ? 'verified' : 'pending',
        kycDetails: {},
        bankAccount: undefined,
        isActive: account.charges_enabled,
        metadata: account.metadata,
        createdAt: new Date(account.created * 1000),
        updatedAt: new Date(account.updated * 1000),
      };
    } catch (error) {
      console.error('Stripe getConnectedAccount error:', error);
      return null;
    }
  }

  // ============================================================================
  // SPLIT PAYMENTS (Módulo 14)
  // ============================================================================

  async createSplitPayment(params: SplitPaymentParams): Promise<SplitPaymentResult> {
    try {
      // Buscar Conta Conectada
      const connectedAccount = await prisma.connectedAccount.findUnique({
        where: { id: params.connectedAccountId },
      });

      if (!connectedAccount) {
        throw new Error('Connected account not found');
      }

      // Criar PaymentIntent com split
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount + params.applicationFeeAmount,
        currency: 'brl',
        customer: params.tenantId, // Customer do Tenant
        payment_method_types: ['card'],
        transfer_data: {
          destination: connectedAccount.providerId,
          amount: params.amount,
        },
        application_fee_amount: params.applicationFeeAmount,
        description: params.description,
        metadata: {
          ...params.metadata,
          tenantId: params.tenantId,
          connectedAccountId: params.connectedAccountId,
        },
      });

      return {
        paymentId: paymentIntent.id,
        provider: PaymentProvider.STRIPE,
        tenantId: params.tenantId,
        amount: params.amount,
        applicationFeeAmount: params.applicationFeeAmount,
        netAmount: params.amount - params.applicationFeeAmount,
        status: paymentIntent.status as any,
        providerPaymentId: paymentIntent.id,
        createdAt: new Date(paymentIntent.created * 1000),
      };
    } catch (error) {
      console.error('Stripe createSplitPayment error:', error);
      throw error;
    }
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(payload: Buffer, signature: string): Promise<boolean> {
    try {
      const apiKey = process.env.STRIPE_SECRET_KEY;
      if (!apiKey) {
        throw new Error('STRIPE_SECRET_KEY not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      // Processar evento
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object);
          break;
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return true;
    } catch (error) {
      console.error('Stripe webhook error:', error);
      return false;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'payment_intent.succeeded',
        provider: PaymentProvider.STRIPE,
        payload: paymentIntent as any,
        idempotencyKey: paymentIntent.id,
        processed: false,
      },
    });

    // Atualizar status do pagamento
    await prisma.platformInvoice.updateMany({
      where: { providerId: paymentIntent.invoice as string },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_PROCESSED',
        userId: paymentIntent.metadata.userId,
        tenantId: paymentIntent.metadata.tenantId,
        details: {
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      },
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'payment_intent.payment_failed',
        provider: PaymentProvider.STRIPE,
        payload: paymentIntent as any,
        idempotencyKey: paymentIntent.id,
        processed: false,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_FAILED',
        userId: paymentIntent.metadata.userId,
        tenantId: paymentIntent.metadata.tenantId,
        details: {
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          error: paymentIntent.last_payment_error,
        },
      },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'invoice.paid',
        provider: PaymentProvider.STRIPE,
        payload: invoice as any,
        idempotencyKey: invoice.id,
        processed: false,
      },
    });

    // Atualizar fatura
    await prisma.platformInvoice.update({
      where: { providerId: invoice.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_PAID',
        tenantId: invoice.metadata.tenantId,
        details: {
          invoiceId: invoice.id,
          amount: invoice.amount_paid,
          subscriptionId: invoice.subscription,
        },
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'invoice.payment_failed',
        provider: PaymentProvider.STRIPE,
        payload: invoice as any,
        idempotencyKey: invoice.id,
        processed: false,
      },
    });

    // Criar tentativa de dunning
    await prisma.dunningAttempt.create({
      data: {
        subscriptionId: invoice.subscription as string,
        invoiceId: invoice.id,
        attemptNumber: 1,
        channel: 'email',
        status: 'PENDING',
        nextAttemptAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h depois
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_PAYMENT_FAILED',
        tenantId: invoice.metadata.tenantId,
        details: {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          subscriptionId: invoice.subscription,
        },
      },
    });
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'subscription.created',
        provider: PaymentProvider.STRIPE,
        payload: subscription as any,
        idempotencyKey: subscription.id,
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: subscription.id },
      data: {
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CREATED',
        tenantId: subscription.metadata.tenantId,
        details: {
          subscriptionId: subscription.id,
          planId: subscription.items.data[0]?.price.id,
          status: subscription.status,
        },
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'subscription.updated',
        provider: PaymentProvider.STRIPE,
        payload: subscription as any,
        idempotencyKey: subscription.id,
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: subscription.id },
      data: {
        status: subscription.status as any,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
        cancellationReason: subscription.cancellation_details?.reason,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATUS_CHANGE',
        tenantId: subscription.metadata.tenantId,
        details: {
          subscriptionId: subscription.id,
          oldStatus: subscription.previous_attributes?.status,
          newStatus: subscription.status,
        },
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'subscription.deleted',
        provider: PaymentProvider.STRIPE,
        payload: subscription as any,
        idempotencyKey: subscription.id,
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(subscription.canceled_at * 1000),
        cancellationReason: subscription.cancellation_details?.reason,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CANCELED',
        tenantId: subscription.metadata.tenantId,
        details: {
          subscriptionId: subscription.id,
          reason: subscription.cancellation_details?.reason,
        },
      },
    });
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: 'account.updated',
        provider: PaymentProvider.STRIPE,
        payload: account as any,
        idempotencyKey: account.id,
        processed: false,
      },
    });

    // Atualizar conta conectada
    await prisma.connectedAccount.update({
      where: { providerId: account.id },
      data: {
        kycStatus: account.charges_enabled ? 'verified' : 'pending',
        isActive: account.charges_enabled,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'KYC_STATUS_CHANGE',
        tenantId: account.metadata.tenantId,
        details: {
          accountId: account.id,
          oldStatus: account.previous_attributes?.charges_enabled ? 'verified' : 'pending',
          newStatus: account.charges_enabled ? 'verified' : 'pending',
        },
      },
    });
  }

  // ============================================================================
  // FISCAL DOCUMENTS (Módulo 1.B)
  // ============================================================================

  async createFiscalDocument(params: FiscalDocumentCreateParams): Promise<FiscalDocument> {
    // Integração com Asaas ou Focus NFe
    // Por enquanto, apenas criar registro no banco
    
    const fiscalDocument = await prisma.fiscalDocument.create({
      data: {
        provider: PaymentProvider.STRIPE,
        providerId: `stripe-${Date.now()}`,
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        type: params.type,
        amount: params.amount,
        status: 'pending',
        metadata: params.metadata || {},
      },
    });

    return fiscalDocument;
  }
}
