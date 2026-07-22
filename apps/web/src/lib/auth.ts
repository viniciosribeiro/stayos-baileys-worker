// StayOS Authentication
// Configuração do NextAuth com autenticação customizada

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { UserRole, TenantStatus } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      tenantId?: string | null;
      isActive: boolean;
    };
  }

  interface User {
    role: UserRole;
    tenantId?: string | null;
    isActive: boolean;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    tenantId?: string | null;
    isActive: boolean;
  }
}

// Provider de autenticação customizado
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios');
        }

        // Buscar usuário
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            tenant: true,
          },
        });

        if (!user) {
          throw new Error('Usuário não encontrado');
        }

        // Verificar senha
        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValidPassword) {
          throw new Error('Senha incorreta');
        }

        // Verificar se usuário está ativo
        if (!user.isActive) {
          throw new Error('Usuário inativo');
        }

        // Verificar status do tenant (se não for Master)
        if (user.role !== UserRole.MASTER_ADMIN && user.tenantId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
          });

          if (!tenant) {
            throw new Error('Tenant não encontrado');
          }

          // Bloquear acesso se tenant estiver suspenso ou cancelado
          if ([TenantStatus.SUSPENDED, TenantStatus.CANCELLED].includes(tenant.status)) {
            throw new Error('Acesso bloqueado: assinatura suspensa ou cancelada');
          }

          // Verificar se assinatura está ativa
          const subscription = await prisma.platformSubscription.findUnique({
            where: { tenantId: user.tenantId },
          });

          if (subscription && [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED, SubscriptionStatus.UNAID].includes(subscription.status as any)) {
            throw new Error('Acesso bloqueado: pagamento pendente');
          }
        }

        // Log de auditoria
        await prisma.auditLog.create({
          data: {
            action: 'LOGIN',
            userId: user.id,
            userEmail: user.email,
            tenantId: user.tenantId || null,
            details: {
              ipAddress: 'unknown', // Será preenchido no middleware
              userAgent: 'unknown',
            },
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email,
          role: user.role,
          tenantId: user.tenantId || null,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.isActive = user.isActive;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.isActive = token.isActive;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authOptions);
