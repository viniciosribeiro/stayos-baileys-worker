// StayOS Asaas Provider
// Implementação do Gateway de Pagamentos para Asaas
// Especial para NFS-e e pagamentos nacionais

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
import { PaymentProvider, Currency, PaymentMethodType, FiscalDocumentType } from './types';

// Configuração da Asaas
const ASAAS_API = 'https://sandbox.asaas.com/api/v3';
// const ASAAS_API = 'https://api.asaas.com/v3'; // Produção

export class AsaasProvider {
  private apiKey: string;
  private static instance: AsaasProvider;

  private constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public static getInstance(apiKey: string): AsaasProvider {
    if (!AsaasProvider.instance) {
      AsaasProvider.instance = new AsaasProvider(apiKey);
    }
    return AsaasProvider.instance;
  }

  // Helper para requisições
  private async request(method: string, endpoint: string, data?: any) {
    const config = {
      method,
      url: `${ASAAS_API}${endpoint}`,
      headers: {
        'access_token': this.apiKey,
        'Content-Type': 'application/json',
      },
      data,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      console.error(`Asaas ${method} ${endpoint} error:`, error.response?.data || error.message);
      throw error;
    }
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(params: CustomerCreateParams): Promise<Customer> {
    try {
      const response = await this.request('POST', '/customers', {
        name: params.name,
        email: params.email,
        phone: params.phone,
        cpfCnpj: params.cpfCnpj,
        address: params.address ? {
          street: params.address.street,
          number: params.address.number,
          complement: params.address.complement,
          neighborhood: '',
          city: params.address.city,
          state: params.address.state,
          cep: params.address.zipCode,
        } : undefined,
        externalReference: params.metadata?.tenantId || undefined,
      });

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        name: response.name,
        email: response.email,
        phone: response.phone,
        cpfCnpj: response.cpfCnpj,
        address: params.address,
        metadata: params.metadata || {},
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas createCustomer error:', error);
      throw error;
    }
  }

  async getCustomer(providerId: string): Promise<Customer | null> {
    try {
      const response = await this.request('GET', `/customers/${providerId}`);
      
      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        name: response.name,
        email: response.email,
        phone: response.phone,
        cpfCnpj: response.cpfCnpj,
        address: response.address ? {
          street: response.address.street,
          number: response.address.number,
          complement: response.address.complement,
          neighborhood: response.address.neighborhood,
          city: response.address.city,
          state: response.address.state,
          zipCode: response.address.cep,
          country: 'BR',
        } : undefined,
        metadata: {},
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas getCustomer error:', error);
      return null;
    }
  }

  async updateCustomer(providerId: string, params: Partial<CustomerCreateParams>): Promise<Customer> {
    try {
      const response = await this.request('PUT', `/customers/${providerId}`, {
        name: params.name,
        email: params.email,
        phone: params.phone,
        cpfCnpj: params.cpfCnpj,
        address: params.address ? {
          street: params.address.street,
          number: params.address.number,
          complement: params.address.complement,
          neighborhood: '',
          city: params.address.city,
          state: params.address.state,
          cep: params.address.zipCode,
        } : undefined,
      });

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        name: params.name || response.name,
        email: params.email || response.email,
        phone: params.phone || response.phone,
        cpfCnpj: params.cpfCnpj || response.cpfCnpj,
        address: params.address,
        metadata: params.metadata || {},
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas updateCustomer error:', error);
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

      // Criar payment method (cartão)
      const response = await this.request('POST', '/customers/' + customerId + '/paymentMethods', {
        type: params.type === 'card' ? 'CREDIT_CARD' : 'BOLETO',
        creditCard: params.type === 'card' ? {
          number: params.cardNumber,
          expiryMonth: params.cardExpMonth,
          expiryYear: params.cardExpYear,
          cvv: params.cardCvc,
          holderName: params.cardHolderName,
        } : undefined,
        boleto: params.type === 'boleto' ? {
          dueDate: params.boletoDueDate?.toISOString().split('T')[0],
        } : undefined,
      });

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        customerId,
        type: params.type,
        cardBrand: response.creditCard?.brand,
        cardLast4: response.creditCard?.lastFourDigits,
        cardExpMonth: params.cardExpMonth,
        cardExpYear: params.cardExpYear,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Asaas createPaymentMethod error:', error);
      throw error;
    }
  }

  async getPaymentMethod(providerId: string): Promise<PaymentMethod | null> {
    try {
      const response = await this.request('GET', `/paymentMethods/${providerId}`);
      
      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        customerId: response.customer,
        type: response.type === 'CREDIT_CARD' ? PaymentMethodType.CARD : PaymentMethodType.BOLETO,
        cardBrand: response.creditCard?.brand,
        cardLast4: response.creditCard?.lastFourDigits,
        cardExpMonth: response.creditCard?.expiryMonth,
        cardExpYear: response.creditCard?.expiryYear,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Asaas getPaymentMethod error:', error);
      return null;
    }
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const response = await this.request('GET', `/customers/${customerId}/paymentMethods`);
      
      return response.data.map((pm: any) => ({
        id: pm.id,
        provider: PaymentProvider.ASAAS,
        providerId: pm.id,
        customerId: pm.customer,
        type: pm.type === 'CREDIT_CARD' ? PaymentMethodType.CARD : PaymentMethodType.BOLETO,
        cardBrand: pm.creditCard?.brand,
        cardLast4: pm.creditCard?.lastFourDigits,
        cardExpMonth: pm.creditCard?.expiryMonth,
        cardExpYear: pm.creditCard?.expiryYear,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('Asaas listPaymentMethods error:', error);
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

      // Criar assinatura
      const response = await this.request('POST', '/subscriptions', {
        customer: params.customerId,
        billingType: 'CREDIT_CARD',
        value: plan.basePrice / 100, // Converter para reais
        nextDueDate: new Date().toISOString().split('T')[0],
        plan: {
          id: params.planId,
          name: plan.name,
          description: plan.description,
          value: plan.basePrice / 100,
          cycle: 'MONTHLY',
        },
        paymentMethod: params.paymentMethodId,
        externalReference: params.metadata?.subscriptionId || undefined,
      });

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        customerId: params.customerId,
        planId: params.planId,
        status: response.status as any,
        currentPeriodStart: new Date(response.startDate),
        currentPeriodEnd: new Date(response.nextDueDate),
        trialStart: params.trialStart,
        trialEnd: params.trialEnd,
        cancelAtPeriodEnd: false,
        metadata: params.metadata || {},
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas createSubscription error:', error);
      throw error;
    }
  }

  async getSubscription(providerId: string): Promise<Subscription | null> {
    try {
      const response = await this.request('GET', `/subscriptions/${providerId}`);
      
      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        customerId: response.customer,
        planId: response.plan?.id || '',
        status: response.status as any,
        currentPeriodStart: new Date(response.startDate),
        currentPeriodEnd: new Date(response.nextDueDate),
        trialStart: undefined,
        trialEnd: undefined,
        cancelAtPeriodEnd: false,
        metadata: {},
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas getSubscription error:', error);
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
        customer: params.customerId,
        value: params.amount / 100, // Converter para reais
        dueDate: new Date().toISOString().split('T')[0],
        description: params.description,
        externalReference: params.metadata?.paymentId || undefined,
      };

      // Se tiver payment method, usar
      if (params.paymentMethodId) {
        paymentData.paymentMethod = params.paymentMethodId;
      }

      // Split Payment (Módulo 14) - Asaas não suporta split nativo
      // Precisa ser implementado manualmente
      if (params.transferData) {
        // Salvar informação para processamento posterior
        paymentData.metadata = {
          ...params.metadata,
          transferData: params.transferData,
          applicationFeeAmount: params.applicationFeeAmount,
        };
      }

      const response = await this.request('POST', '/payments', paymentData);

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
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
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas createPayment error:', error);
      throw error;
    }
  }

  async getPayment(providerId: string): Promise<Payment | null> {
    try {
      const response = await this.request('GET', `/payments/${providerId}`);
      
      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        invoiceId: undefined,
        customerId: response.customer,
        amount: Math.round(response.value * 100), // Converter para centavos
        currency: Currency.BRL,
        paymentMethodId: response.paymentMethod,
        status: response.status as any,
        description: response.description,
        metadata: response.metadata || {},
        transferData: undefined,
        applicationFeeAmount: response.metadata?.applicationFeeAmount,
        createdAt: new Date(response.dateCreated),
        updatedAt: new Date(response.dateUpdated),
      };
    } catch (error) {
      console.error('Asaas getPayment error:', error);
      return null;
    }
  }

  // ============================================================================
  // CONNECTED ACCOUNTS (Asaas Subcontas - Módulo 1.B)
  // ============================================================================

  async createConnectedAccount(params: ConnectedAccountCreateParams): Promise<ConnectedAccount> {
    try {
      // Criar subconta na Asaas
      const response = await this.request('POST', '/accounts', {
        name: params.tenantId,
        email: params.tenantId,
        cpfCnpj: params.bankAccount?.cpfCnpj,
        phone: '',
        address: params.bankAccount ? {
          street: params.bankAccount.bank,
          number: params.bankAccount.agency,
          complement: params.bankAccount.account,
          neighborhood: '',
          city: '',
          state: '',
          cep: '',
        } : undefined,
        externalReference: params.tenantId,
      });

      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        tenantId: params.tenantId,
        kycStatus: 'pending',
        kycDetails: {},
        bankAccount: params.bankAccount,
        isActive: false,
        metadata: params.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Asaas createConnectedAccount error:', error);
      throw error;
    }
  }

  async getConnectedAccount(providerId: string): Promise<ConnectedAccount | null> {
    try {
      const response = await this.request('GET', `/accounts/${providerId}`);
      
      return {
        id: response.id,
        provider: PaymentProvider.ASAAS,
        providerId: response.id,
        tenantId: response.externalReference,
        kycStatus: response.status === 'ACTIVE' ? 'verified' : 'pending',
        kycDetails: {},
        bankAccount: undefined,
        isActive: response.status === 'ACTIVE',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Asaas getConnectedAccount error:', error);
      return null;
    }
  }

  // ============================================================================
  // SPLIT PAYMENTS (Módulo 14) - Implementação Manual
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

      // Criar payment para o tenant
      const paymentResponse = await this.request('POST', '/payments', {
        customer: params.tenantId,
        value: params.amount / 100,
        dueDate: new Date().toISOString().split('T')[0],
        description: params.description,
        externalReference: `split-${params.tenantId}-${Date.now()}`,
        metadata: {
          tenantId: params.tenantId,
          connectedAccountId: params.connectedAccountId,
          applicationFeeAmount: params.applicationFeeAmount,
          netAmount: params.amount - params.applicationFeeAmount,
        },
      });

      // Salvar informação do split para processamento posterior
      await prisma.commissionLedger.create({
        data: {
          reservationId: params.metadata?.reservationId || '',
          tenantId: params.tenantId,
          grossAmount: params.amount,
          commissionAmount: params.applicationFeeAmount,
          netAmount: params.amount - params.applicationFeeAmount,
          status: 'pending',
          paymentMethod: 'asaas_split',
          paymentReference: paymentResponse.id,
        },
      });

      return {
        paymentId: paymentResponse.id,
        provider: PaymentProvider.ASAAS,
        tenantId: params.tenantId,
        amount: params.amount,
        applicationFeeAmount: params.applicationFeeAmount,
        netAmount: params.amount - params.applicationFeeAmount,
        status: 'pending',
        providerPaymentId: paymentResponse.id,
        createdAt: new Date(paymentResponse.dateCreated),
      };
    } catch (error) {
      console.error('Asaas createSplitPayment error:', error);
      throw error;
    }
  }

  // ============================================================================
  // FISCAL DOCUMENTS (NFS-e - Módulo 1.B)
  // ============================================================================

  async createFiscalDocument(params: FiscalDocumentCreateParams): Promise<FiscalDocument> {
    try {
      // Criar NFS-e na Asaas
      const response = await this.request('POST', '/invoices', {
        customer: params.tenantId,
        value: params.amount / 100,
        description: params.description || 'Fatura StayOS',
        dueDate: new Date().toISOString().split('T')[0],
        externalReference: params.invoiceId || `invoice-${Date.now()}`,
        // Dados para NFS-e
        service: {
          description: params.description || 'Serviço StayOS',
          value: params.amount / 100,
        },
        // Configurações de imposto
        tax: {
          type: 'ISS',
          value: 0, // Isento para SaaS
        },
      });

      // Salvar no banco
      const fiscalDocument = await prisma.fiscalDocument.create({
        data: {
          provider: PaymentProvider.ASAAS,
          providerId: response.id,
          tenantId: params.tenantId,
          invoiceId: params.invoiceId,
          type: FiscalDocumentType.NFS_E,
          documentNumber: response.number,
          documentDate: new Date(response.dueDate),
          amount: params.amount,
          fileUrl: response.pdfUrl,
          status: 'issued',
          metadata: params.metadata || {},
        },
      });

      return fiscalDocument;
    } catch (error) {
      console.error('Asaas createFiscalDocument error:', error);
      
      // Se falhar, criar apenas o registro no banco
      const fiscalDocument = await prisma.fiscalDocument.create({
        data: {
          provider: PaymentProvider.ASAAS,
          providerId: `asaas-${Date.now()}`,
          tenantId: params.tenantId,
          invoiceId: params.invoiceId,
          type: FiscalDocumentType.NFS_E,
          amount: params.amount,
          status: 'pending',
          metadata: params.metadata || {},
        },
      });

      return fiscalDocument;
    }
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(payload: any): Promise<boolean> {
    try {
      const eventType = payload.event;
      const data = payload.data;

      switch (eventType) {
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentConfirmed(data);
          break;
        case 'PAYMENT_FAILED':
          await this.handlePaymentFailed(data);
          break;
        case 'SUBSCRIPTION_CREATED':
          await this.handleSubscriptionCreated(data);
          break;
        case 'SUBSCRIPTION_UPDATED':
          await this.handleSubscriptionUpdated(data);
          break;
        case 'SUBSCRIPTION_DELETED':
          await this.handleSubscriptionDeleted(data);
          break;
        case 'INVOICE_CREATED':
          await this.handleInvoiceCreated(data);
          break;
        default:
          console.log(`Unhandled Asaas event type: ${eventType}`);
      }

      return true;
    } catch (error) {
      console.error('Asaas webhook error:', error);
      return false;
    }
  }

  private async handlePaymentConfirmed(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar pagamento
    await prisma.platformInvoice.updateMany({
      where: { providerId: data.id?.toString() },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Processar split se for o caso
    if (data.metadata?.transferData) {
      await prisma.commissionLedger.updateMany({
        where: { paymentReference: data.id?.toString() },
        data: { status: 'liquidated', paidAt: new Date() },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_PROCESSED',
        userId: data.customer,
        tenantId: data.metadata?.tenantId,
        details: {
          paymentId: data.id,
          amount: data.value,
          status: data.status,
        },
      },
    });
  }

  private async handlePaymentFailed(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
        errorMessage: data.failureReason,
      },
    });

    // Criar tentativa de dunning
    await prisma.dunningAttempt.create({
      data: {
        subscriptionId: data.subscription?.toString(),
        invoiceId: data.id?.toString(),
        attemptNumber: 1,
        channel: 'email',
        status: 'PENDING',
        nextAttemptAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_FAILED',
        userId: data.customer,
        tenantId: data.metadata?.tenantId,
        details: {
          paymentId: data.id,
          amount: data.value,
          reason: data.failureReason,
        },
      },
    });
  }

  private async handleSubscriptionCreated(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: data.id?.toString() },
      data: {
        status: data.status as any,
        currentPeriodStart: new Date(data.startDate),
        currentPeriodEnd: new Date(data.nextDueDate),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CREATED',
        tenantId: data.customer,
        details: {
          subscriptionId: data.id,
          planId: data.plan?.id,
          status: data.status,
        },
      },
    });
  }

  private async handleSubscriptionUpdated(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: data.id?.toString() },
      data: {
        status: data.status as any,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        canceledAt: data.canceledAt ? new Date(data.canceledAt) : undefined,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_STATUS_CHANGE',
        tenantId: data.customer,
        details: {
          subscriptionId: data.id,
          oldStatus: data.previousStatus,
          newStatus: data.status,
        },
      },
    });
  }

  private async handleSubscriptionDeleted(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar assinatura
    await prisma.platformSubscription.update({
      where: { providerId: data.id?.toString() },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancellationReason: data.reason,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'SUBSCRIPTION_CANCELED',
        tenantId: data.customer,
        details: {
          subscriptionId: data.id,
          reason: data.reason,
        },
      },
    });
  }

  private async handleInvoiceCreated(data: any) {
    // Salvar evento no banco
    await prisma.platformBillingEvent.create({
      data: {
        eventType: `asaas.${data.event}`,
        provider: PaymentProvider.ASAAS,
        payload: data,
        idempotencyKey: data.id?.toString(),
        processed: false,
      },
    });

    // Atualizar fatura
    await prisma.platformInvoice.update({
      where: { providerId: data.id?.toString() },
      data: {
        documentNumber: data.number,
        documentDate: new Date(data.dueDate),
        fileUrl: data.pdfUrl,
        status: 'issued',
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'FISCAL_DOCUMENT_ISSUED',
        tenantId: data.customer,
        details: {
          invoiceId: data.id,
          documentNumber: data.number,
          amount: data.value,
        },
      },
    });
  }
}
