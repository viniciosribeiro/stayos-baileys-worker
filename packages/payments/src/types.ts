// StayOS Payments Types
// Tipos para o Gateway de Pagamentos Unificado

import { z } from 'zod';

// ============================================================================
// Payment Providers
// ============================================================================

export type PaymentProvider = 'stripe' | 'mercado_pago' | 'asaas';

export type PaymentMethodType = 'card' | 'pix' | 'boleto' | 'transfer';

export type Currency = 'BRL' | 'USD' | 'EUR';

// ============================================================================
// Customer Types
// ============================================================================

export interface CustomerCreateParams {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  address?: CustomerCreateParams['address'];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Payment Method Types
// ============================================================================

export interface PaymentMethodCreateParams {
  customerId: string;
  type: PaymentMethodType;
  // Card
  cardNumber?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  cardCvc?: string;
  cardHolderName?: string;
  // PIX
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  // Boleto
  boletoDueDate?: Date;
  // Transfer
  bank?: string;
  agency?: string;
  account?: string;
  accountType?: 'checking' | 'savings';
}

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  customerId: string;
  type: PaymentMethodType;
  // Card
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  // Status
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface SubscriptionCreateParams {
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  trialDays?: number;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  customerId: string;
  planId: string;
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  cancellationReason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Invoice Types
// ============================================================================

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number; // em centavos
  quantity?: number;
  type: 'subscription' | 'token_usage' | 'commission' | 'addon' | 'adjustment';
  referenceId?: string;
}

export interface InvoiceCreateParams {
  customerId: string;
  subscriptionId?: string;
  items: InvoiceItem[];
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  customerId: string;
  subscriptionId?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  subtotal: number; // em centavos
  taxAmount: number; // em centavos
  totalAmount: number; // em centavos
  items: InvoiceItem[];
  dueDate?: Date;
  paidAt?: Date;
  paymentMethodId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentCreateParams {
  invoiceId?: string;
  customerId: string;
  amount: number; // em centavos
  currency: Currency;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  // Split Payment (Módulo 14)
  transferData?: {
    destination: string; // Conta Conectada do Tenant
    amount: number; // Valor a ser transferido
  };
  applicationFeeAmount?: number; // Comissão retida (Módulo 1.B)
}

export interface Payment {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  invoiceId?: string;
  customerId: string;
  amount: number; // em centavos
  currency: Currency;
  paymentMethodId?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  description?: string;
  metadata: Record<string, unknown>;
  // Split Payment
  transferData?: PaymentCreateParams['transferData'];
  applicationFeeAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Connected Account Types (KYC - Módulo 1.B)
// ============================================================================

export interface ConnectedAccountCreateParams {
  tenantId: string;
  provider: PaymentProvider;
  // Stripe Connect
  stripeAccountId?: string;
  // Mercado Pago Marketplace
  mercadoPagoUserId?: string;
  // Asaas Subcontas
  asaasAccountId?: string;
  // Dados Bancários
  bankAccount?: {
    bank: string;
    agency: string;
    account: string;
    cpfCnpj: string;
    accountType: 'checking' | 'savings';
  };
  metadata?: Record<string, unknown>;
}

export interface ConnectedAccount {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  tenantId: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycDetails?: Record<string, unknown>;
  bankAccount?: ConnectedAccountCreateParams['bankAccount'];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Split Payment Types (Módulo 14)
// ============================================================================

export interface SplitPaymentParams {
  // Tenant (destinatário)
  tenantId: string;
  connectedAccountId: string;
  // Valor
  amount: number; // em centavos
  // Comissão (Módulo 1.B)
  applicationFeeAmount: number; // em centavos
  // Descrição
  description?: string;
  // Metadados
  metadata?: Record<string, unknown>;
}

export interface SplitPaymentResult {
  paymentId: string;
  provider: PaymentProvider;
  tenantId: string;
  amount: number;
  applicationFeeAmount: number;
  netAmount: number;
  status: 'pending' | 'succeeded' | 'failed';
  providerPaymentId: string;
  createdAt: Date;
}

// ============================================================================
// Dunning Types (Módulo 1.B)
// ============================================================================

export interface DunningConfig {
  retryDays: number[]; // [1, 3, 7]
  channels: ('email' | 'sms' | 'whatsapp')[];
  templates: {
    email?: {
      subject: string;
      body: string;
    };
    sms?: string;
    whatsapp?: string;
  };
}

export interface DunningAttempt {
  id: string;
  subscriptionId: string;
  invoiceId?: string;
  attemptNumber: number;
  channel: 'email' | 'sms' | 'whatsapp';
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  response?: Record<string, unknown>;
  nextAttemptAt?: Date;
  createdAt: Date;
}

// ============================================================================
// Fiscal Document Types (Módulo 1.B)
// ============================================================================

export type FiscalDocumentType = 'NFS_E' | 'NF_E' | 'RECEIPT';

export interface FiscalDocumentCreateParams {
  tenantId: string;
  invoiceId?: string;
  type: FiscalDocumentType;
  amount: number; // em centavos
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface FiscalDocument {
  id: string;
  provider: PaymentProvider;
  providerId: string;
  tenantId: string;
  invoiceId?: string;
  type: FiscalDocumentType;
  documentNumber?: string;
  documentDate?: Date;
  amount: number;
  fileUrl?: string;
  status: 'pending' | 'issued' | 'cancelled';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  id: string;
  provider: PaymentProvider;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

// ============================================================================
// Schemas Zod
// ============================================================================

export const CustomerCreateSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  cpfCnpj: z.string().optional(),
  address: z.object({
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('BR'),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PaymentMethodCreateSchema = z.object({
  customerId: z.string(),
  type: z.enum(['card', 'pix', 'boleto', 'transfer']),
  cardNumber: z.string().optional(),
  cardExpMonth: z.number().int().min(1).max(12).optional(),
  cardExpYear: z.number().int().min(2024).max(2100).optional(),
  cardCvc: z.string().optional(),
  cardHolderName: z.string().optional(),
  pixKey: z.string().optional(),
  pixKeyType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional(),
  boletoDueDate: z.date().optional(),
  bank: z.string().optional(),
  agency: z.string().optional(),
  account: z.string().optional(),
  accountType: z.enum(['checking', 'savings']).optional(),
});

export const SubscriptionCreateSchema = z.object({
  customerId: z.string(),
  planId: z.string(),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().int().positive().optional(),
  trialEnd: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PaymentCreateSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string(),
  amount: z.number().int().positive(),
  currency: z.enum(['BRL', 'USD', 'EUR']),
  paymentMethodId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  transferData: z.object({
    destination: z.string(),
    amount: z.number().int().positive(),
  }).optional(),
  applicationFeeAmount: z.number().int().positive().optional(),
});

export const SplitPaymentSchema = z.object({
  tenantId: z.string(),
  connectedAccountId: z.string(),
  amount: z.number().int().positive(),
  applicationFeeAmount: z.number().int().positive(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;
export type PaymentMethodCreateInput = z.infer<typeof PaymentMethodCreateSchema>;
export type SubscriptionCreateInput = z.infer<typeof SubscriptionCreateSchema>;
export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>;
export type SplitPaymentInput = z.infer<typeof SplitPaymentSchema>;
