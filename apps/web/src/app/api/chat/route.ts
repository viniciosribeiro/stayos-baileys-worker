// StayOS API - Chat
// API para o Unified Inbox (Módulo 7)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, MessageDirection, MessageStatus } from '@prisma/client';
import { z } from 'zod';
import { chatGateway } from '@stayos/ai';

// GET /api/chat/conversations - Listar conversas
export async function GET(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      // Master pode ver conversas de todos os tenants
      const { tenantId: queryTenantId } = Object.fromEntries(
        new URL(request.url).searchParams
      );
      tenantId = queryTenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      tenantId = session.user.tenantId!;
    }

    // Buscar conversas
    const conversations = await prisma.conversation.findMany({
      where: { tenantId },
      include: {
        guest: true,
        channel: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('GET /api/chat/conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations - Criar conversa
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const Schema = z.object({
      guestId: z.string().optional(),
      channelId: z.string(),
      externalId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const validatedData = Schema.parse(body);

    let tenantId: string;
    if (session.user.role === UserRole.MASTER_ADMIN) {
      tenantId = body.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required for Master' },
          { status: 400 }
        );
      }
    } else {
      tenantId = session.user.tenantId!;
    }

    // Criar conversa
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        guestId: validatedData.guestId,
        channelId: validatedData.channelId,
        externalId: validatedData.externalId,
        status: 'open',
        metadata: validatedData.metadata || {},
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONVERSATION_CREATED',
        userId: session.user.id,
        tenantId,
        details: {
          conversationId: conversation.id,
          guestId: validatedData.guestId,
          channelId: validatedData.channelId,
        },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/chat/conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/chat/conversations/:id - Obter conversa
export async function GET_BY_ID(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        guest: true,
        channel: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== conversation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('GET /api/chat/conversations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/chat/conversations/:id - Atualizar conversa
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== conversation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Atualizar conversa
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: body,
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONVERSATION_UPDATED',
        userId: session.user.id,
        tenantId: conversation.tenantId,
        details: {
          conversationId: id,
          changes: body,
        },
      },
    });

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error('PUT /api/chat/conversations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/conversations/:id - Deletar conversa
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    // Verificar autenticação
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verificar permissão
    if (session.user.role !== UserRole.MASTER_ADMIN && 
        session.user.tenantId !== conversation.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Deletar conversa e mensagens
    await prisma.message.deleteMany({
      where: { conversationId: id },
    });

    await prisma.conversation.delete({
      where: { id },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CONVERSATION_DELETED',
        userId: session.user.id,
        tenantId: conversation.tenantId,
        details: {
          conversationId: id,
        },
      },
    });

    return NextResponse.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('DELETE /api/chat/conversations/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
