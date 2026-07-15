// StayOS API - Chat Messages
// API para mensagens do Unified Inbox (Módulo 7)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, MessageDirection, MessageStatus } from '@prisma/client';
import { z } from 'zod';
import { chatGateway } from '@stayos/ai';

// GET /api/chat/:conversationId/messages - Listar mensagens
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    
    // Buscar conversa para verificar permissão
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== conversation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar mensagens
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/chat/:conversationId/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/chat/:conversationId/messages - Enviar mensagem
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await request.json();

    const Schema = z.object({
      content: z.string().min(1),
      mediaUrl: z.string().url().optional(),
      senderType: z.enum(['guest', 'tenant', 'ai']).optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const validatedData = Schema.parse(body);

    // Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== conversation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determinar senderType
    const senderType = validatedData.senderType || 'tenant';

    // Criar mensagem
    const message = await prisma.message.create({
      data: {
        conversationId,
        content: validatedData.content,
        mediaUrl: validatedData.mediaUrl,
        direction: senderType === 'guest' ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
        senderType: senderType as any,
        senderId: session.user.id,
        metadata: validatedData.metadata || {},
      },
    });

    // Se a mensagem for do guest, gerar resposta da IA automaticamente
    if (senderType === 'guest') {
      // Gerar resposta da IA
      const aiResponse = await chatGateway.processMessageWithAI(
        conversation.tenantId,
        conversationId,
        validatedData.content,
        'guest'
      );

      // Se houver ação, executar
      if (aiResponse.action) {
        const actionResult = await chatGateway.executeAction(
          conversation.tenantId,
          aiResponse.action,
          aiResponse.actionData || {}
        );

        // Enviar resultado da ação como mensagem
        await prisma.message.create({
          data: {
            conversationId,
            content: JSON.stringify(actionResult),
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus.SENT,
            senderType: 'ai',
            metadata: { action: aiResponse.action, actionResult },
          },
        });
      }

      // Enviar resposta da IA
      if (aiResponse.response) {
        await prisma.message.create({
          data: {
            conversationId,
            content: aiResponse.response,
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus.SENT,
            senderType: 'ai',
            metadata: { generated: true },
          },
        });
      }
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'MESSAGE_SENT',
        userId: session.user.id,
        tenantId: conversation.tenantId,
        details: {
          conversationId,
          messageId: message.id,
          content: validatedData.content.substring(0, 100),
          senderType,
        },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/chat/:conversationId/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/chat/:conversationId/messages/:id - Obter mensagem
export async function GET_BY_ID(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, id } = await params;
    
    // Buscar mensagem
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verificar permissão
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || 
        (session.user.role !== UserRole.MASTER_ADMIN && 
         session.user.tenantId !== conversation.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('GET /api/chat/:conversationId/messages/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/chat/:conversationId/messages/:id - Atualizar mensagem
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, id } = await params;
    const body = await request.json();

    // Buscar mensagem
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verificar permissão
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || 
        (session.user.role !== UserRole.MASTER_ADMIN && 
         session.user.tenantId !== conversation.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Atualizar mensagem
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'MESSAGE_UPDATED',
        userId: session.user.id,
        tenantId: conversation.tenantId,
        details: {
          messageId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('PUT /api/chat/:conversationId/messages/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/:conversationId/messages/:id - Deletar mensagem
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, id } = await params;

    // Buscar mensagem
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verificar permissão
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || 
        (session.user.role !== UserRole.MASTER_ADMIN && 
         session.user.tenantId !== conversation.tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Deletar mensagem
    await prisma.message.delete({
      where: { id },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'MESSAGE_DELETED',
        userId: session.user.id,
        tenantId: conversation.tenantId,
        details: {
          messageId: id,
        },
      },
    });

    return NextResponse.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('DELETE /api/chat/:conversationId/messages/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
