// StayOS Tenant Chat
// Unified Inbox - Chat & IA (Módulo 7)

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TenantStatus } from '@prisma/client';
import { formatDate, formatTime } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Componente de Lista de Conversas
async function ConversationList({ tenantId }: { tenantId: string }) {
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

  return (
    <div className="w-80 border-r p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Conversas</h2>
        <Link href="/tenant/chat/new" className="btn btn-primary btn-sm">
          Nova Conversa
        </Link>
      </div>

      <div className="space-y-2">
        {conversations.map((conversation) => {
          const lastMessage = conversation.messages[0];
          const unreadCount = 0; // Implementar contagem de não lidas

          return (
            <Link
              key={conversation.id}
              href={`/tenant/chat/${conversation.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {conversation.guest?.firstName?.charAt(0) || 'G'}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{conversation.guest?.firstName} {conversation.guest?.lastName}</p>
                  <span className="text-xs text-muted-foreground">
                    {conversation.channel?.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {lastMessage?.content || 'Nova conversa'}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {lastMessage ? formatTime(lastMessage.createdAt) : formatDate(conversation.createdAt)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Header da Conversa
function ConversationHeader({ conversation }: any) {
  return (
    <div className="border-b p-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <span className="text-lg font-medium">
            {conversation.guest?.firstName?.charAt(0) || 'G'}
          </span>
        </div>
        <div>
          <h2 className="font-bold">
            {conversation.guest?.firstName} {conversation.guest?.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {conversation.channel?.type} - {conversation.status}
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente de Mensagem
function MessageBubble({ message }: any) {
  const isInbound = message.direction === 'INBOUND';
  const isAI = message.senderType === 'ai';

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-4 ${
          isInbound ? 'bg-muted' : 'bg-primary text-primary-foreground'
        }`}
      >
        {isAI && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs">🤖</span>
            </div>
            <span className="text-xs opacity-70">StayOS AI</span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.mediaUrl && (
          <div className="mt-2">
            <img
              src={message.mediaUrl}
              alt="Mídia"
              className="max-w-full h-auto rounded-lg"
            />
          </div>
        )}
        <p className={`text-xs mt-2 ${isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

// Componente de Área de Mensagens
async function MessagesArea({ conversationId }: { conversationId: string }) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      conversation: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {messages.length > 0 ? (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Nenhuma mensagem ainda. Inicie uma conversa!</p>
        </div>
      )}
    </div>
  );
}

// Componente de Input de Mensagem
function MessageInput({ conversationId }: { conversationId: string }) {
  return (
    <div className="border-t p-4">
      <form className="flex gap-2" action={`/tenant/chat/${conversationId}/send`} method="POST">
        <input
          type="text"
          name="content"
          placeholder="Digite sua mensagem..."
          className="flex-1 input"
          required
        />
        <button type="submit" className="btn btn-primary">
          Enviar
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-2">
        Pressione Enter para enviar. A IA responderá automaticamente.
      </p>
    </div>
  );
}

// Componente de Perfil do Hóspede
async function GuestProfile({ guestId }: { guestId: string }) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      memory: true,
      reservations: {
        orderBy: { checkInDate: 'desc' },
        take: 3,
      },
    },
  });

  if (!guest) return null;

  return (
    <div className="w-80 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Perfil do Hóspede</h2>
        <Link href={`/tenant/guests/${guest.id}`} className="text-sm hover:text-primary">
          Ver Perfil Completo
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xl font-medium">
              {guest.firstName?.charAt(0) || 'G'}
            </span>
          </div>
          <div>
            <h3 className="font-bold">{guest.firstName} {guest.lastName}</h3>
            <p className="text-sm text-muted-foreground">{guest.email}</p>
            <p className="text-sm text-muted-foreground">{guest.phone}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Memória</h4>
          {guest.memory.length > 0 ? (
            <div className="space-y-2">
              {guest.memory.map((memory: any) => (
                <div key={memory.id} className="p-2 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{memory.memoryType}</p>
                  <p className="text-sm">{memory.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma memória registrada</p>
          )}
        </div>

        <div>
          <h4 className="font-medium mb-2">Últimas Reservas</h4>
          {guest.reservations.length > 0 ? (
            <div className="space-y-2">
              {guest.reservations.map((reservation: any) => (
                <div key={reservation.id} className="p-2 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{reservation.room?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(reservation.checkInDate)} - {formatDate(reservation.checkOutDate)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma reserva</p>
          )}
        </div>

        <div>
          <h4 className="font-medium mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {guest.tags.map((tag: string) => (
              <span key={tag} className="badge badge-secondary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de Contexto da IA
async function AIContext({ conversationId }: { conversationId: string }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      guest: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!conversation) return null;

  return (
    <div className="w-80 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Contexto da IA</h2>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Informações da Conversa</h4>
          <div className="space-y-1">
            <p className="text-sm"><span className="text-muted-foreground">Hóspede:</span> {conversation.guest?.firstName} {conversation.guest?.lastName}</p>
            <p className="text-sm"><span className="text-muted-foreground">Canal:</span> {conversation.channel?.type}</p>
            <p className="text-sm"><span className="text-muted-foreground">Status:</span> {conversation.status}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Últimas Mensagens</h4>
          {conversation.messages.length > 0 ? (
            <div className="space-y-2">
              {conversation.messages.map((message: any) => (
                <div key={message.id} className="p-2 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{message.senderType}</p>
                  <p className="text-sm truncate">{message.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
          )}
        </div>

        <div>
          <h4 className="font-medium mb-2">Sugestões da IA</h4>
          <div className="space-y-2">
            <button className="w-full text-left p-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm">
              Verificar disponibilidade
            </button>
            <button className="w-full text-left p-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm">
              Calcular preço
            </button>
            <button className="w-full text-left p-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm">
              Criar reserva
            </button>
            <button className="w-full text-left p-2 bg-primary/10 rounded-lg hover:bg-primary/20 text-sm">
              Gerar link de pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tenant Chat Page
export default async function TenantChatPage({
  searchParams,
}: {
  searchParams: { conversationId?: string };
}) {
  const session = await auth();

  // Verificar autenticação
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Verificar papel
  if (session.user.role === UserRole.MASTER_ADMIN) {
    redirect('/master/dashboard');
  }

  if (!session.user.tenantId) {
    redirect('/auth/select-tenant');
  }

  // Buscar tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  if (!tenant) {
    redirect('/auth/error?code=tenant_not_found');
  }

  // Se não tiver conversationId, mostrar lista de conversas
  if (!searchParams.conversationId) {
    const conversations = await prisma.conversation.findMany({
      where: { tenantId: tenant.id },
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

    return (
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Chat & IA</h1>
          <p className="text-muted-foreground">
            Unified Inbox - Atendimento híbrido com IA
          </p>
        </div>

        {/* Lista de Conversas */}
        <div className="flex">
          <ConversationList tenantId={tenant.id} />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <svg className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Bem-vindo ao Chat</h2>
              <p className="text-muted-foreground mb-4">
                Selecione uma conversa para começar ou crie uma nova.
              </p>
              <Link href="/tenant/chat/new" className="btn btn-primary">
                Nova Conversa
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Buscar conversa
  const conversation = await prisma.conversation.findUnique({
    where: { id: searchParams.conversationId },
    include: {
      guest: true,
      channel: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    redirect('/tenant/chat');
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Chat & IA</h1>
        <p className="text-muted-foreground">
          Conversa com {conversation.guest?.firstName} {conversation.guest?.lastName}
        </p>
      </div>

      {/* Layout do Chat */}
      <div className="flex h-[calc(100vh-200px)]">
        {/* Lista de Conversas */}
        <ConversationList tenantId={tenant.id} />

        {/* Área Principal do Chat */}
        <div className="flex-1 flex flex-col">
          {/* Header da Conversa */}
          <ConversationHeader conversation={conversation} />

          {/* Mensagens */}
          <MessagesArea conversationId={conversation.id} />

          {/* Input */}
          <MessageInput conversationId={conversation.id} />
        </div>

        {/* Sidebar Direito */}
        <div className="w-80 border-l">
          {/* Perfil do Hóspede */}
          {conversation.guestId && (
            <GuestProfile guestId={conversation.guestId} />
          )}

          {/* Contexto da IA */}
          <AIContext conversationId={conversation.id} />
        </div>
      </div>
    </div>
  );
}
