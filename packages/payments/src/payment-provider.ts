// StayOS Payment Provider Factory
// Fábrica de Providers de Pagamento

import { BillingEngine } from './billing-engine';
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
} from './types';

// Abstract Payment Provider Interface
interface PaymentProviderInterface {
  createCustomer(params: CustomerCreateParams): Promise<Customer>;
  getCustomer(providerId: string): Promise<Customer | null>;
  updateCustomer(providerId: string, params: Partial<CustomerCreateParams>): Promise<Customer>;
  
  createPaymentMethod(params: PaymentMethodCreateParams): Promise<PaymentMethod>;
  getPaymentMethod(providerId: string): Promise<PaymentMethod | null>;
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
  
  createSubscription(params: SubscriptionCreateParams): Promise<Subscription>;
  getSubscription(providerId: string): Promise<Subscription | null>;
  updateSubscription(subscriptionId: string, params: Partial<SubscriptionCreateParams>): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<Subscription>;
  
  createPayment(params: PaymentCreateParams): Promise<Payment>;
  getPayment(providerId: string): Promise<Payment | null>;
  
  createConnectedAccount(params: ConnectedAccountCreateParams): Promise<ConnectedAccount>;
  getConnectedAccount(providerId: string): Promise<ConnectedAccount | null>;
  
  createSplitPayment(params: SplitPaymentParams): Promise<SplitPaymentResult>;
  
  createFiscalDocument(params: FiscalDocumentCreateParams): Promise<FiscalDocument>;
  
  handleWebhook(payload: Buffer, signature: string): Promise<boolean>;
}

// Payment Provider Factory
export class PaymentProviderFactory {
  private static providers: Map<PaymentProvider, PaymentProviderInterface> = new Map();

  static {
    // Inicializar providers
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const mercadoPagoKey = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    const asaasKey = process.env.ASAAS_API_KEY || '';

    if (stripeKey) {
      this.providers.set(PaymentProvider.STRIPE, StripeProvider.getInstance(stripeKey));
    }
    if (mercadoPagoKey) {
      this.providers.set(PaymentProvider.MERCADO_PAGO, MercadoPagoProvider.getInstance(mercadoPagoKey));
    }
    if (asaasKey) {
      this.providers.set(PaymentProvider.ASAAS, AsaasProvider.getInstance(asaasKey));
    }
  }

  // Obter provider específico
  static getProvider(provider: PaymentProvider): PaymentProviderInterface {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not configured`);
    }
    return providerInstance;
  }

  // Obter Billing Engine
  static getBillingEngine(): BillingEngine {
    return BillingEngine.getInstance();
  }

  // Verificar se provider está configurado
  static isProviderConfigured(provider: PaymentProvider): boolean {
    return this.providers.has(provider);
  }

  // Listar providers configurados
  static listConfiguredProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }

  // ============================================================================
  // MÉTODOS DE CONVENIÊNCIA
  // ============================================================================

  // Criar cliente no provider padrão
  static async createCustomer(provider: PaymentProvider, params: CustomerCreateParams): Promise<Customer> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createCustomer(params);
  }

  // Criar método de pagamento no provider padrão
  static async createPaymentMethod(provider: PaymentProvider, params: PaymentMethodCreateParams): Promise<PaymentMethod> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createPaymentMethod(params);
  }

  // Criar assinatura no provider padrão
  static async createSubscription(provider: PaymentProvider, params: SubscriptionCreateParams): Promise<Subscription> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createSubscription(params);
  }

  // Criar pagamento no provider padrão
  static async createPayment(provider: PaymentProvider, params: PaymentCreateParams): Promise<Payment> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createPayment(params);
  }

  // Criar conta conectada no provider padrão
  static async createConnectedAccount(provider: PaymentProvider, params: ConnectedAccountCreateParams): Promise<ConnectedAccount> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createConnectedAccount(params);
  }

  // Criar split payment no provider padrão
  static async createSplitPayment(provider: PaymentProvider, params: SplitPaymentParams): Promise<SplitPaymentResult> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.createSplitPayment(params);
  }

  // Processar webhook
  static async handleWebhook(provider: PaymentProvider, payload: Buffer, signature: string): Promise<boolean> {
    const providerInstance = this.getProvider(provider);
    return providerInstance.handleWebhook(payload, signature);
  }
}

// Exportar providers individuais
export { StripeProvider, MercadoPagoProvider, AsaasProvider, BillingEngine };
