// StayOS Mercado Pago Provider
// Implementação do Gateway de Pagamentos para Mercado Pago

import axios from 'axios';
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
import { PaymentProvider, Currency, PaymentMethodType } from './types';

// Configuração do Mercado Pago
const MERCADO_PAGO_API = 'https://api.mercadopago.com';

export class MercadoPagoProvider {
  private accessToken: string;
  private static instance: MercadoPagoProvider;

  private constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  public static getInstance(accessToken: string): MercadoPagoProvider {
    if (!MercadoPagoProvider.instance) {
      MercadoPagoProvider.instance = new MercadoPagoProvider(accessToken);
    }
    return MercadoPagoProvider.instance;
  }

  // Helper para requisições
  private async request(method: string, endpoint: string, data?: any) {
    const config = {
      method,
      url: `${MERCADO_PAGO_API}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      data,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Mercado Pago ${method} ${endpoint} error:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(params: CustomerCreateParams): Promise<Customer> {
    try {
      const response = await this.request('POST', '/v1/customers', {
        email: params.email,
        first_name: params.name.split(' ')[0],
        last_name: params.name.split(' ').slice(1).join(' '),
        phone: {
          number: params.phone,
        },
        identification: {
          type: 'CPF',
          number: params.cpfCnpj,
        },
        address: params.address ? {
          street_name: params.address.street,
          street_number: params.address.number,
          zip_code: params.address.zipCode,
          city: params.address.city,
          state: params.address.state,
          country: params.address.country,
        } : undefined,
        metadata: params.metadata || {},
      });

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        name: params.name,
        email: params.email,
        phone: params.phone,
        cpfCnpj: params.cpfCnpj,
        address: params.address,
        metadata: response.metadata || {},
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago createCustomer error:', error);
      throw error;
    }
  }

  async getCustomer(providerId: string): Promise<Customer | null> {
    try {
      const response = await this.request('GET', `/v1/customers/${providerId}`);
      
      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        name: `${response.first_name} ${response.last_name}`,
        email: response.email,
        phone: response.phone?.number,
        cpfCnpj: response.identification?.number,
        address: response.address ? {
          street: response.address.street_name,
          number: response.address.street_number,
          complement: response.address.floor || undefined,
          neighborhood: response.address.neighborhood || '',
          city: response.address.city,
          state: response.address.state,
          zipCode: response.address.zip_code,
          country: response.address.country,
        } : undefined,
        metadata: response.metadata || {},
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago getCustomer error:', error);
      return null;
    }
  }

  async updateCustomer(providerId: string, params: Partial<CustomerCreateParams>): Promise<Customer> {
    try {
      const response = await this.request('PUT', `/v1/customers/${providerId}`, {
        email: params.email,
        first_name: params.name?.split(' ')[0],
        last_name: params.name?.split(' ').slice(1).join(' '),
        phone: params.phone ? {
          number: params.phone,
        } : undefined,
        identification: params.cpfCnpj ? {
          type: 'CPF',
          number: params.cpfCnpj,
        } : undefined,
        address: params.address ? {
          street_name: params.address.street,
          street_number: params.address.number,
          zip_code: params.address.zipCode,
          city: params.address.city,
          state: params.address.state,
          country: params.address.country,
        } : undefined,
        metadata: params.metadata,
      });

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        name: params.name || `${response.first_name} ${response.last_name}`,
        email: params.email || response.email,
        phone: params.phone || response.phone?.number,
        cpfCnpj: params.cpfCnpj || response.identification?.number,
        address: params.address,
        metadata: response.metadata || {},
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago updateCustomer error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPaymentMethod(params: PaymentMethodCreateParams): Promise<PaymentMethod> {
    try {
      // Criar customer se não existir
      let customerId = params.customerId;
      if (!customerId) {
        const customer = await this.createCustomer({
          name: 'Customer',
          email: `customer-${Date.now()}@stayos.com`,
        });
        customerId = customer.id;
      }

      // Criar card token
      const cardTokenResponse = await this.request('POST', '/v1/card_tokens', {
        card_number: params.cardNumber,
        expiration_month: params.cardExpMonth,
        expiration_year: params.cardExpYear,
        cvv: params.cardCvc,
        cardholder: {
          name: params.cardHolderName,
        },
      });

      // Criar payment method
      const response = await this.request('POST', '/v1/customers/' + customerId + '/cards', {
        token: cardTokenResponse.id,
      });

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        customerId,
        type: PaymentMethodType.CARD,
        cardBrand: response.card_brand,
        cardLast4: response.last_four_digits,
        cardExpMonth: params.cardExpMonth,
        cardExpYear: params.cardExpYear,
        isDefault: true,
        isActive: true,
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago createPaymentMethod error:', error);
      throw error;
    }
  }

  async getPaymentMethod(providerId: string): Promise<PaymentMethod | null> {
    try {
      const response = await this.request('GET', `/v1/cards/${providerId}`);
      
      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        customerId: response.customer_id.toString(),
        type: PaymentMethodType.CARD,
        cardBrand: response.card_brand,
        cardLast4: response.last_four_digits,
        cardExpMonth: response.expiration_month,
        cardExpYear: response.expiration_year,
        isDefault: false,
        isActive: true,
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago getPaymentMethod error:', error);
      return null;
    }
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const response = await this.request('GET', `/v1/customers/${customerId}/cards`);
      
      return response.results.map((card: any) => ({
        id: card.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: card.id.toString(),
        customerId: card.customer_id.toString(),
        type: PaymentMethodType.CARD,
        cardBrand: card.card_brand,
        cardLast4: card.last_four_digits,
        cardExpMonth: card.expiration_month,
        cardExpYear: card.expiration_year,
        isDefault: card.is_default,
        isActive: true,
        createdAt: new Date(card.date_created),
        updatedAt: new Date(card.date_last_updated),
      }));
    } catch (error) {
      console.error('Mercado Pago listPaymentMethods error:', error);
      return [];
    }
  }

  // ============================================================================
  // SUBSCRIPTIONS (Mercado Pago Marketplace)
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

      // Criar preapproval (assinatura recorrente)
      const response = await this.request('POST', '/preapproval', {
        payer_email: params.customerId, // Usar email do customer
        back_url: `${process.env.WEB_URL}/billing/callback`,
        reason: plan.description || plan.name,
        external_reference: params.planId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.basePrice / 100, // Converter para reais
          currency_id: 'BRL',
        },
        metadata: params.metadata || {},
      });

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        customerId: params.customerId,
        planId: params.planId,
        status: 'INACTIVE', // Será atualizado após confirmação
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialStart: params.trialStart,
        trialEnd: params.trialEnd,
        cancelAtPeriodEnd: false,
        metadata: params.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Mercado Pago createSubscription error:', error);
      throw error;
    }
  }

  async getSubscription(providerId: string): Promise<Subscription | null> {
    try {
      const response = await this.request('GET', `/preapproval/${providerId}`);
      
      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        customerId: response.payer.email,
        planId: response.external_reference,
        status: response.status.toUpperCase() as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialStart: undefined,
        trialEnd: undefined,
        cancelAtPeriodEnd: false,
        metadata: response.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Mercado Pago getSubscription error:', error);
      return null;
    }
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async createPayment(params: PaymentCreateParams): Promise<Payment> {
    try {
      // Criar payment
      const paymentData: any = {
        transaction_amount: params.amount / 100, // Converter para reais
        currency_id: 'BRL',
        description: params.description,
        payment_method_id: params.paymentMethodId,
        payer: {
          email: params.customerId,
        },
        metadata: params.metadata || {},
      };

      // Split Payment (Módulo 14)
      if (params.transferData) {
        paymentData.application_fee = params.applicationFeeAmount / 100;
      }

      const response = await this.request('POST', '/v1/payments', paymentData);

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        invoiceId: undefined,
        customerId: params.customerId,
        amount: params.amount,
        currency: Currency.BRL,
        paymentMethodId: params.paymentMethodId,
        status: response.status as any,
        description: params.description,
        metadata: params.metadata || {},
        transferData: params.transferData,
        applicationFeeAmount: params.applicationFeeAmount,
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago createPayment error:', error);
      throw error;
    }
  }

  async getPayment(providerId: string): Promise<Payment | null> {
    try {
      const response = await this.request('GET', `/v1/payments/${providerId}`);
      
      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        invoiceId: undefined,
        customerId: response.payer.email,
        amount: Math.round(response.transaction_amount * 100), // Converter para centavos
        currency: Currency.BRL,
        paymentMethodId: response.payment_method_id,
        status: response.status as any,
        description: response.description,
        metadata: response.metadata || {},
        transferData: undefined,
        applicationFeeAmount: response.application_fee ? Math.round(response.application_fee * 100) : undefined,
        createdAt: new Date(response.date_created),
        updatedAt: new Date(response.date_last_updated),
      };
    } catch (error) {
      console.error('Mercado Pago getPayment error:', error);
      return null;
    }
  }

  // ============================================================================
  // CONNECTED ACCOUNTS (Mercado Pago Marketplace - Módulo 1.B)
  // ============================================================================

  async createConnectedAccount(params: ConnectedAccountCreateParams): Promise<ConnectedAccount> {
    try {
      // Criar user no Mercado Pago Marketplace
      const response = await this.request('POST', '/users', {
        email: params.tenantId, // Usar email do tenant
        country: 'BR',
        site_id: 'MLB',
        metadata: params.metadata || {},
      });

      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        tenantId: params.tenantId,
        kycStatus: 'pending',
        kycDetails: {},
        bankAccount: params.bankAccount,
        isActive: false,
        metadata: response.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Mercado Pago createConnectedAccount error:', error);
      throw error;
    }
  }

  async getConnectedAccount(providerId: string): Promise<ConnectedAccount | null> {
    try {
      const response = await this.request('GET', `/users/${providerId}`);
      
      return {
        id: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: response.id.toString(),
        tenantId: response.metadata?.tenantId || '',
        kycStatus: response.status === 'active' ? 'verified' : 'pending',
        kycDetails: {},
        bankAccount: undefined,
        isActive: response.status === 'active',
        metadata: response.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Mercado Pago getConnectedAccount error:', error);
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

      // Criar payment com split
      const response = await this.request('POST', '/v1/payments', {
        transaction_amount: (params.amount + params.applicationFeeAmount) / 100,
        currency_id: 'BRL',
        description: params.description,
        payment_method_id: params.tenantId, // Usar payment method do tenant
        payer: {
          email: params.tenantId,
        },
        split: {
          transactions: [
            {
              collector_id: connectedAccount.providerId,
              amount: params.amount / 100,
            },
            {
              collector_id: process.env.MERCADO_PAGO_MASTER_ACCOUNT, // Conta Master
              amount: params.applicationFeeAmount / 100,
            },
          ],
        },
        metadata: {
          ...params.metadata,
          tenantId: params.tenantId,
          connectedAccountId: params.connectedAccountId,
        },
      });

      return {
        paymentId: response.id.toString(),
        provider: PaymentProvider.MERCADO_PAGO,
        tenantId: params.tenantId,
        amount: params.amount,
        applicationFeeAmount: params.applicationFeeAmount,
        netAmount: params.amount - params.applicationFeeAmount,
        status: response.status as any,
        providerPaymentId: response.id.toString(),
        createdAt: new Date(response.date_created),
      };
    } catch (error) {
      console.error('Mercado Pago createSplitPayment error:', error);
      throw error;
    }
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(payload: any, signature: string): Promise<boolean> {
    try {
      // Verificar assinatura (simplificado)
      // Em produção, usar a biblioteca oficial do Mercado Pago
      
      const eventType = payload.type;
      const data = payload.data;

      switch (eventType) {
        case 'payment':
          await this.handlePayment(data);
          break;
        case 'preapproval':
          await this.handlePreapproval(data);
          break;
        case 'subscription':
          await this.handleSubscription(data);
          break;
        case 'user':
          await this.handleUser(data);
          break;
        default:
          console.log(`Unhandled Mercado Pago event type: ${eventType}`);
      }

      return true;
    } catch (error) {
      console.error('Mercado Pago webhook error:', error);
      return false;
    }
  }

  private async handlePayment(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `mercado_pago.${data.action}`,
        provider: PaymentProvider.MERCADO_PAGO,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar pagamento
    if (data.id) {
      await prisma.platformInvoice.updateMany({
        where: { providerId: data.id.toString() },
        data: { status: data.status as any },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_PROCESSED',
        userId: data.payer?.email,
        tenantId: data.metadata?.tenantId,
        details: {
          paymentId: data.id,
          amount: data.transaction_amount,
          status: data.status,
        },
      },
    });
  }

  private async handlePreapproval(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `mercado_pago.${data.status}`,
        provider: PaymentProvider.MERCADO_PAGO,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar assinatura
    if (data.id) {
      await prisma.platformSubscription.update({
        where: { providerId: data.id.toString() },
        data: {
          status: data.status.toUpperCase() as any,
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATUS_CHANGE',
        tenantId: data.payer?.email,
        details: {
          subscriptionId: data.id,
          status: data.status,
        },
      },
    });
  }

  private async handleSubscription(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `mercado_pago.${data.status}`,
        provider: PaymentProvider.MERCADO_PAGO,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATUS_CHANGE',
        tenantId: data.payer?.email,
        details: {
          subscriptionId: data.id,
          status: data.status,
        },
      },
    });
  }

  private async handleUser(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `mercado_pago.${data.status}`,
        provider: PaymentProvider.MERCADO_PAGO,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar conta conectada
    if (data.id) {
      await prisma.connectedAccount.update({
        where: { providerId: data.id.toString() },
        data: {
          kycStatus: data.status === 'active' ? 'verified' : 'pending',
          isActive: data.status === 'active',
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'KYC_STATUS_CHANGE',
        tenantId: data.metadata?.tenantId,
        details: {
          accountId: data.id,
          status: data.status,
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
        provider: PaymentProvider.MERCADO_PAGO,
        providerId: `mercado_pago-${Date.now()}`,
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
