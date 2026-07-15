// StayOS Chat Gateway
// Unified Inbox para Chat & IA (Módulo 7)

import { prisma } from '@stayos/db';
import { llmGateway } from './llm-gateway';
import { TokenProvider, AIModel } from './types';
import { ChannelType, MessageDirection, MessageStatus } from '@prisma/client';

// ============================================================================
// Channel Providers
// ============================================================================

// Interface base para providers de canal
interface ChannelProvider {
  type: ChannelType;
  sendMessage(message: SendMessageParams): Promise<SendMessageResult>;
  receiveMessages(conversationId: string, limit?: number): Promise<ReceiveMessageResult[]>;
  createConversation(guestId: string, metadata?: Record<string, unknown>): Promise<CreateConversationResult>;
  closeConversation(conversationId: string): Promise<boolean>;
  getConversation(conversationId: string): Promise<GetConversationResult | null>;
}

// Parâmetros e resultados
interface SendMessageParams {
  conversationId: string;
  content: string;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageResult {
  id: string;
  conversationId: string;
  content: string;
  mediaUrl?: string;
  direction: MessageDirection;
  status: MessageStatus;
  providerEventId?: string;
  metadata?: Record<string, unknown>;
}

interface ReceiveMessageResult {
  id: string;
  conversationId: string;
  content: string;
  mediaUrl?: string;
  direction: MessageDirection;
  status: MessageStatus;
  senderId?: string;
  senderType?: 'guest' | 'tenant' | 'ai';
  createdAt: Date;
  providerEventId?: string;
  metadata?: Record<string, unknown>;
}

interface CreateConversationResult {
  id: string;
  channelId: string;
  guestId?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

interface GetConversationResult {
  id: string;
  channelId: string;
  guestId?: string;
  externalId?: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// WhatsApp Provider (Baileys)
// ============================================================================

class WhatsAppProvider implements ChannelProvider {
  type = ChannelType.WHATSAPP_UNOFFICIAL as ChannelType;

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    // Implementação com Baileys
    // Por enquanto, apenas simulação
    console.log(`[WhatsApp] Enviando mensagem para conversa ${params.conversationId}: ${params.content}`);

    // Salvar mensagem no banco
    const message = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        content: params.content,
        mediaUrl: params.mediaUrl,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
        senderType: 'tenant',
        metadata: params.metadata || {},
      },
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      mediaUrl: message.mediaUrl || undefined,
      direction: message.direction,
      status: message.status,
      metadata: message.metadata as Record<string, unknown>,
    };
  }

  async receiveMessages(conversationId: string, limit: number = 10): Promise<ReceiveMessageResult[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      content: msg.content,
      mediaUrl: msg.mediaUrl || undefined,
      direction: msg.direction,
      status: msg.status,
      senderId: msg.senderId || undefined,
      senderType: msg.senderType as 'guest' | 'tenant' | 'ai' || undefined,
      createdAt: msg.createdAt,
      providerEventId: msg.providerEventId || undefined,
      metadata: msg.metadata as Record<string, unknown> || undefined,
    }));
  }

  async createConversation(guestId: string, metadata?: Record<string, unknown>): Promise<CreateConversationResult> {
    // Criar conversa no banco
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: metadata?.tenantId as string,
        channelId: metadata?.channelId as string,
        guestId,
        externalId: metadata?.externalId as string || undefined,
        status: 'open',
        metadata: metadata || {},
      },
    });

    return {
      id: conversation.id,
      channelId: conversation.channelId,
      guestId: conversation.guestId || undefined,
      externalId: conversation.externalId || undefined,
      metadata: conversation.metadata as Record<string, unknown> || undefined,
    };
  }

  async closeConversation(conversationId: string): Promise<boolean> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
    return true;
  }

  async getConversation(conversationId: string): Promise<GetConversationResult | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      channelId: conversation.channelId,
      guestId: conversation.guestId || undefined,
      externalId: conversation.externalId || undefined,
      status: conversation.status,
      metadata: conversation.metadata as Record<string, unknown> || undefined,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

// ============================================================================
// Email Provider
// ============================================================================

class EmailProvider implements ChannelProvider {
  type = ChannelType.EMAIL as ChannelType;

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    console.log(`[Email] Enviando mensagem para conversa ${params.conversationId}: ${params.content}`);

    const message = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        content: params.content,
        mediaUrl: params.mediaUrl,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
        senderType: 'tenant',
        metadata: params.metadata || {},
      },
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      mediaUrl: message.mediaUrl || undefined,
      direction: message.direction,
      status: message.status,
      metadata: message.metadata as Record<string, unknown>,
    };
  }

  async receiveMessages(conversationId: string, limit: number = 10): Promise<ReceiveMessageResult[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      content: msg.content,
      mediaUrl: msg.mediaUrl || undefined,
      direction: msg.direction,
      status: msg.status,
      senderId: msg.senderId || undefined,
      senderType: msg.senderType as 'guest' | 'tenant' | 'ai' || undefined,
      createdAt: msg.createdAt,
      providerEventId: msg.providerEventId || undefined,
      metadata: msg.metadata as Record<string, unknown> || undefined,
    }));
  }

  async createConversation(guestId: string, metadata?: Record<string, unknown>): Promise<CreateConversationResult> {
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: metadata?.tenantId as string,
        channelId: metadata?.channelId as string,
        guestId,
        externalId: metadata?.externalId as string || undefined,
        status: 'open',
        metadata: metadata || {},
      },
    });

    return {
      id: conversation.id,
      channelId: conversation.channelId,
      guestId: conversation.guestId || undefined,
      externalId: conversation.externalId || undefined,
      metadata: conversation.metadata as Record<string, unknown> || undefined,
    };
  }

  async closeConversation(conversationId: string): Promise<boolean> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
    return true;
  }

  async getConversation(conversationId: string): Promise<GetConversationResult | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      channelId: conversation.channelId,
      guestId: conversation.guestId || undefined,
      externalId: conversation.externalId || undefined,
      status: conversation.status,
      metadata: conversation.metadata as Record<string, unknown> || undefined,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

// ============================================================================
// Chat Gateway
// ============================================================================

export class ChatGateway {
  private providers: Map<ChannelType, ChannelProvider>;
  private static instance: ChatGateway;

  private constructor() {
    this.providers = new Map();
    this.providers.set(ChannelType.WHATSAPP_UNOFFICIAL, new WhatsAppProvider());
    this.providers.set(ChannelType.EMAIL, new EmailProvider());
    // Adicionar outros providers conforme necessário
  }

  public static getInstance(): ChatGateway {
    if (!ChatGateway.instance) {
      ChatGateway.instance = new ChatGateway();
    }
    return ChatGateway.instance;
  }

  // Obter provider específico
  getProvider(type: ChannelType): ChannelProvider | undefined {
    return this.providers.get(type);
  }

  // Enviar mensagem
  async sendMessage(type: ChannelType, params: SendMessageParams): Promise<SendMessageResult> {
    const provider = this.getProvider(type);
    if (!provider) {
      throw new Error(`Channel provider ${type} not found`);
    }
    return provider.sendMessage(params);
  }

  // Receber mensagens
  async receiveMessages(type: ChannelType, conversationId: string, limit?: number): Promise<ReceiveMessageResult[]> {
    const provider = this.getProvider(type);
    if (!provider) {
      throw new Error(`Channel provider ${type} not found`);
    }
    return provider.receiveMessages(conversationId, limit);
  }

  // Criar conversa
  async createConversation(type: ChannelType, guestId: string, metadata?: Record<string, unknown>): Promise<CreateConversationResult> {
    const provider = this.getProvider(type);
    if (!provider) {
      throw new Error(`Channel provider ${type} not found`);
    }
    return provider.createConversation(guestId, metadata);
  }

  // Fechar conversa
  async closeConversation(type: ChannelType, conversationId: string): Promise<boolean> {
    const provider = this.getProvider(type);
    if (!provider) {
      throw new Error(`Channel provider ${type} not found`);
    }
    return provider.closeConversation(conversationId);
  }

  // Obter conversa
  async getConversation(type: ChannelType, conversationId: string): Promise<GetConversationResult | null> {
    const provider = this.getProvider(type);
    if (!provider) {
      throw new Error(`Channel provider ${type} not found`);
    }
    return provider.getConversation(conversationId);
  }

  // ============================================================================
  // IA Integration
  // ============================================================================

  // Gerar resposta da IA
  async generateAIResponse(
    tenantId: string,
    conversationId: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    // Buscar configuração de IA do tenant
    const aiConfig = await prisma.aIBehaviorConfig.findUnique({
      where: { tenantId },
    });

    // Buscar memória do hóspede
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { guest: true },
    });

    const guestId = conversation?.guestId;
    const guestMemory = guestId ? await prisma.guestMemory.findMany({
      where: { guestId },
    }) : [];

    // Buscar documentos de treinamento do tenant
    const trainingDocuments = await prisma.trainingDocument.findMany({
      where: { tenantId },
    });

    // Construir prompt com contexto
    const systemPrompt = this.buildSystemPrompt(aiConfig, tenantId);
    const contextPrompt = this.buildContextPrompt(conversation, guestMemory, trainingDocuments);
    const userPrompt = message;

    // Chamar LLM
    const response = await llmGateway.chat({
      prompt: userPrompt,
      systemPrompt: `${systemPrompt}\n\n${contextPrompt}`,
      maxTokens: 500,
      temperature: 0.7,
    });

    return response.content;
  }

  // Construir system prompt
  private buildSystemPrompt(aiConfig: any, tenantId: string): string {
    if (!aiConfig) {
      return `Você é um assistente de IA para uma pousada/hotel. Seja útil, educado e profissional.`;
    }

    return `Você é ${aiConfig.persona?.name || 'um assistente de IA'} para a pousada/hotel.
    
    ${aiConfig.persona?.description || ''}
    
    Tom de voz: ${aiConfig.persona?.tone || 'profissional e amigável'}
    
    Regras:
    - Seja útil, educado e profissional
    - Responda em português do Brasil
    - Não invente informações que você não tem certeza
    - Se não souber responder, diga que vai verificar e retornar
    - Não faça promessas que não pode cumprir
    - Respeite as políticas de privacidade
    
    ${aiConfig.autonomy?.canNegotiate ? 'Você pode negociar descontos até ' + aiConfig.autonomy?.maxDiscountPercentage + '%.' : 'Você não pode negociar descontos.'}
    `;
  }

  // Construir context prompt
  private buildContextPrompt(
    conversation: any,
    guestMemory: any[],
    trainingDocuments: any[]
  ): string {
    let context = '';

    // Adicionar contexto da conversa
    if (conversation) {
      context += `Contexto da conversa:\n`;
      context += `- Hóspede: ${conversation.guest?.firstName || 'Desconhecido'} ${conversation.guest?.lastName || ''}\n`;
      context += `- Canal: ${conversation.channel?.type || 'Desconhecido'}\n`;
      context += `- Status: ${conversation.status}\n\n`;
    }

    // Adicionar memória do hóspede
    if (guestMemory.length > 0) {
      context += `Memória do hóspede:\n`;
      guestMemory.forEach((memory: any) => {
        context += `- ${memory.memoryType}: ${memory.content}\n`;
      });
      context += '\n';
    }

    // Adicionar documentos de treinamento
    if (trainingDocuments.length > 0) {
      context += `Conhecimento da pousada:\n`;
      trainingDocuments.forEach((doc: any) => {
        context += `- ${doc.fileName}: ${doc.content?.substring(0, 200)}...\n`;
      });
      context += '\n';
    }

    return context;
  }

  // Processar mensagem com IA
  async processMessageWithAI(
    tenantId: string,
    conversationId: string,
    message: string,
    senderType: 'guest' | 'tenant' | 'ai' = 'guest'
  ): Promise<{ response: string; action?: string; actionData?: Record<string, unknown> }> {
    // Gerar resposta da IA
    const response = await this.generateAIResponse(tenantId, conversationId, message);

    // Verificar se a resposta contém uma ação (Function Calling)
    const actionMatch = response.match(/<action>(\w+)<\/action>/);
    const actionDataMatch = response.match(/<actionData>([\s\S]*?)<\/actionData>/);

    if (actionMatch && actionDataMatch) {
      return {
        response: response.replace(/<action>\w+<\/action>/, '').replace(/<actionData>[\s\S]*?<\/actionData>/, ''),
        action: actionMatch[1],
        actionData: JSON.parse(actionDataMatch[1]),
      };
    }

    return { response };
  }

  // ============================================================================
  // Function Calling
  // ============================================================================

  // Executar ação
  async executeAction(
    tenantId: string,
    action: string,
    actionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (action) {
      case 'checkAvailability':
        return this.checkAvailability(tenantId, actionData);
      case 'calculatePrice':
        return this.calculatePrice(tenantId, actionData);
      case 'createReservation':
        return this.createReservation(tenantId, actionData);
      case 'generatePaymentLink':
        return this.generatePaymentLink(tenantId, actionData);
      default:
        return { error: `Action ${action} not supported` };
    }
  }

  // Verificar disponibilidade
  private async checkAvailability(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { checkIn, checkOut, roomType, adults, children } = data as any;

    // Buscar quartos disponíveis
    const availableRooms = await prisma.room.findMany({
      where: { tenantId },
      include: {
        roomGroup: true,
        calendarAvailability: {
          where: {
            date: {
              gte: new Date(checkIn),
              lte: new Date(checkOut),
            },
            status: { in: ['AVAILABLE', 'OCCUPIED'] },
          },
        },
      },
    });

    // Filtrar quartos disponíveis
    const available = availableRooms.filter(room => {
      const unavailableDates = room.calendarAvailability
        .filter(ca => ca.status === 'OCCUPIED')
        .map(ca => ca.date);
      
      // Verificar se todas as datas estão disponíveis
      for (let date = new Date(checkIn); date <= new Date(checkOut); date.setDate(date.getDate() + 1)) {
        if (unavailableDates.some((d: any) => d.getTime() === date.getTime())) {
          return false;
        }
      }
      return true;
    });

    return {
      available: available.length > 0,
      rooms: available.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        amenities: room.amenities,
      })),
    };
  }

  // Calcular preço
  private async calculatePrice(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { roomId, checkIn, checkOut, adults, children } = data as any;

    // Buscar quarto
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomGroup: { include: { ratePlan: true } } },
    });

    if (!room) {
      return { error: 'Room not found' };
    }

    // Buscar plano tarifário
    const ratePlan = room.roomGroup?.ratePlan;
    if (!ratePlan) {
      return { error: 'Rate plan not found' };
    }

    // Calcular número de noites
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));

    // Calcular preço base
    let basePrice = ratePlan.basePrice * nights;

    // Adicionar preço por adulto extra
    if (adults > 1) {
      const extraAdults = adults - 1;
      const adultPricing = ratePlan.occupancyPricing as Record<string, number>;
      const extraAdultPrice = adultPricing?.adult || 0;
      basePrice += extraAdultPrice * extraAdults * nights;
    }

    // Adicionar preço por criança
    if (children > 0) {
      const childPricing = ratePlan.occupancyPricing as Record<string, number>;
      const childPrice = childPricing?.child || 0;
      basePrice += childPrice * children * nights;
    }

    // Verificar sazonalidade
    const seasonalRules = await prisma.seasonalRule.findMany({
      where: { tenantId },
    });

    let seasonalAdjustment = 0;
    for (const rule of seasonalRules) {
      const startDate = new Date(rule.startDate);
      const endDate = new Date(rule.endDate);
      
      if (checkInDate >= startDate && checkOutDate <= endDate) {
        if (rule.priceAdjustmentType === 'percentage') {
          seasonalAdjustment = basePrice * (rule.priceAdjustmentValue / 100);
        } else {
          seasonalAdjustment = rule.priceAdjustmentValue * nights;
        }
        break;
      }
    }

    const totalPrice = basePrice + seasonalAdjustment;

    return {
      basePrice,
      seasonalAdjustment,
      totalPrice,
      nights,
      currency: 'BRL',
    };
  }

  // Criar reserva
  private async createReservation(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { roomId, checkIn, checkOut, adults, children, guestId } = data as any;

    // Verificar disponibilidade
    const availability = await this.checkAvailability(tenantId, data);
    if (!availability.available) {
      return { error: 'No available rooms' };
    }

    // Calcular preço
    const price = await this.calculatePrice(tenantId, data);

    // Criar reserva
    const reservation = await prisma.reservation.create({
      data: {
        tenantId,
        guestId,
        roomId,
        confirmationCode: `RES-${Date.now()}`,
        checkInDate: new Date(checkIn),
        checkOutDate: new Date(checkOut),
        adults,
        children,
        subtotal: price.totalPrice as number,
        totalAmount: price.totalPrice as number,
        status: 'PENDING',
        paymentStatus: 'pending',
        metadata: { createdBy: 'ai' },
      },
    });

    return {
      reservationId: reservation.id,
      confirmationCode: reservation.confirmationCode,
      totalAmount: reservation.totalAmount,
      status: reservation.status,
    };
  }

  // Gerar link de pagamento
  private async generatePaymentLink(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { reservationId, amount } = data as any;

    // Buscar reserva
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return { error: 'Reservation not found' };
    }

    // Buscar conta conectada
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { tenantId },
    });

    if (!connectedAccount || !connectedAccount.isActive) {
      return { error: 'Connected account not configured or inactive' };
    }

    // Gerar link de pagamento (simulação)
    const paymentLink = `https://stayos.com/payment/${reservationId}?amount=${amount}&tenantId=${tenantId}`;

    return {
      paymentLink,
      reservationId,
      amount,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
    };
  }
}

// Singleton
export const chatGateway = ChatGateway.getInstance();
