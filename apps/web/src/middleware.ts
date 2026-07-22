// StayOS Middleware
// Middleware para autenticação, RLS e rate limiting

import { NextResponse, type NextRequest } from 'next/server';
import { auth } from './lib/auth';
import { prisma } from './lib/prisma';
import { UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';

// Rotas públicas (não requerem autenticação)
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/error',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/test-drive',
  '/pricing',
  '/features',
  '/about',
  '/contact',
  '/api/public',
  '/api/webhooks',
];

// Rotas do Master (apenas para MASTER_ADMIN)
const MASTER_ROUTES = [
  '/master',
  '/master/dashboard',
  '/master/tenants',
  '/master/billing',
  '/master/settings',
  '/master/ai',
  '/master/reports',
  '/master/training',
];

// Rotas do Tenant (requerem tenantId válido)
const TENANT_ROUTES = [
  '/dashboard',
  '/rooms',
  '/reservations',
  '/guests',
  '/chat',
  '/settings',
  '/financial',
  '/reports',
];

// Rotas de API protegidas
const PROTECTED_API_ROUTES = [
  '/api/tenants',
  '/api/billing',
  '/api/ai',
  '/api/chat',
  '/api/reservations',
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = await auth();
  
  // ============================================================================
  // 1. ROTAS PÚBLICAS
  // ============================================================================
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // Aplicar rate limiting para rotas públicas
    const rateLimitResponse = await checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // A/B Testing para landing page
    if (pathname === '/') {
      const response = NextResponse.next();
      const abTestCookie = request.cookies.get('ab-test-variant');
      
      if (!abTestCookie) {
        // Definir variante A/B
        const variant = Math.random() > 0.5 ? 'A' : 'B';
        response.cookies.set('ab-test-variant', variant, {
          maxAge: 60 * 60 * 24 * 30, // 30 dias
          path: '/',
        });
      }
      
      return response;
    }
    
    return NextResponse.next();
  }

  // ============================================================================
  // 2. AUTENTICAÇÃO
  // ============================================================================
  if (!session?.user) {
    // Redirecionar para login
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ============================================================================
  // 3. VERIFICAÇÃO DE PAPEL (ROLE)
  // ============================================================================
  
  // Rotas do Master
  if (MASTER_ROUTES.some((route) => pathname.startsWith(route))) {
    if (session.user.role !== UserRole.MASTER_ADMIN) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Rotas do Tenant
  if (TENANT_ROUTES.some((route) => pathname.startsWith(route)) || 
      pathname.startsWith('/tenant')) {
    
    // Verificar se usuário tem tenant
    if (!session.user.tenantId) {
      return NextResponse.redirect(new URL('/auth/select-tenant', request.url));
    }

    // Verificar status do tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      include: {
        connectedAccount: true,
        platformSubscription: true,
      },
    });

    if (!tenant) {
      return NextResponse.redirect(new URL('/auth/error?code=tenant_not_found', request.url));
    }

    // Bloquear acesso se tenant estiver suspenso ou cancelado
    if ([TenantStatus.SUSPENDED, TenantStatus.CANCELLED].includes(tenant.status)) {
      return NextResponse.redirect(new URL('/auth/error?code=tenant_suspended', request.url));
    }

    // Verificar assinatura
    if (tenant.platformSubscription) {
      const subscription = tenant.platformSubscription;
      if ([SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED, SubscriptionStatus.UNAID].includes(subscription.status as any)) {
        return NextResponse.redirect(new URL('/financial?tab=billing', request.url));
      }
    }

    // Verificar onboarding financeiro para Checkout (Módulo 14)
    if (pathname.includes('/checkout') || pathname.includes('/payments')) {
      if (!tenant.connectedAccount || !tenant.connectedAccount.isActive) {
        return NextResponse.redirect(new URL('/settings/financial?tab=kyc', request.url));
      }
    }
  }

  // ============================================================================
  // 4. RLS (ROW LEVEL SECURITY)
  // ============================================================================
  
  // Adicionar tenantId às queries de API
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Adicionar headers com contexto de autenticação
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-role', session.user.role);
    
    if (session.user.tenantId) {
      response.headers.set('x-tenant-id', session.user.tenantId);
    }
    
    return response;
  }

  // ============================================================================
  // 5. RATE LIMITING
  // ============================================================================
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // ============================================================================
  // 6. LOG DE AUDITORIA
  // ============================================================================
  if (pathname !== '/api/audit-logs' && !pathname.startsWith('/api/public')) {
    // Logar acesso (assíncrono para não bloquear a requisição)
    Promise.resolve().then(async () => {
      try {
        await prisma.auditLog.create({
          data: {
            action: 'PAGE_ACCESS',
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            tenantId: session?.user?.tenantId || null,
            details: {
              path: pathname,
              method: request.method,
              ipAddress: request.ip,
              userAgent: request.headers.get('user-agent'),
            },
          },
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
    });
  }

  return NextResponse.next();
}

// Rate Limiting com Redis
export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // Implementação com Redis (em produção)
  // Por enquanto, apenas um placeholder
  
  const ip = request.ip;
  const pathname = request.nextUrl.pathname;
  
  // Limite: 100 requisições por minuto para IPs não autenticados
  // Limite: 1000 requisições por minuto para IPs autenticados
  
  // Em produção, usar Redis para contar requisições
  // const key = `rate-limit:${ip}:${pathname}`;
  // const count = await redis.incr(key);
  // if (count === 1) {
  //   await redis.expire(key, 60);
  // }
  // if (count > limit) {
  //   return new NextResponse('Too Many Requests', { status: 429 });
  // }
  
  return null;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
