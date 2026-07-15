import { PrismaClient, UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do StayOS...');

  // ============================================================================
  // 1. CRIAR USUÁRIO MASTER (Credenciais Seed)
  // ============================================================================
  console.log('🔐 Criando usuário Master...');
  
  const masterPassword = 'vr1986123@';
  const passwordHash = await bcrypt.hash(masterPassword, 12);
  
  const masterUser = await prisma.user.upsert({
    where: { email: 'viniciosribeiro@stayos.com' },
    update: {},
    create: {
      email: 'viniciosribeiro@stayos.com',
      passwordHash,
      firstName: 'Vinicios',
      lastName: 'Ribeiro',
      role: UserRole.MASTER_ADMIN,
      isActive: true,
      preferences: {
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo'
      }
    }
  });
  
  console.log(`✅ Usuário Master criado: ${masterUser.email}`);

  // ============================================================================
  // 2. CONFIGURAÇÕES DE UI DO PAINEL MASTER (Módulo 0)
  // ============================================================================
  console.log('🎨 Configurando UI do Painel Master...');
  
  await prisma.masterUISettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      systemName: 'StayOS',
      logoUrl: '/assets/logo.svg',
      logoCompactUrl: '/assets/logo-compact.svg',
      faviconUrl: '/assets/favicon.ico',
      colorConfig: {
        primary: { h: 210, s: 100, l: 50 },
        secondary: { h: 160, s: 100, l: 40 },
        accent: { h: 280, s: 100, l: 50 },
        success: { h: 140, s: 100, l: 45 },
        warning: { h: 45, s: 100, l: 50 },
        error: { h: 0, s: 100, l: 50 }
      },
      fontHeadings: 'Inter',
      fontBody: 'Inter',
      borderRadius: 8,
      defaultModuleOpenMode: 'FULL_PAGE',
      interfaceDensity: 'COMFORTABLE',
      themeMode: 'DARK',
      animationsEnabled: true,
      sidebarInitialState: 'EXPANDED',
      sidebarHoverBehavior: 'EXPAND',
      dashboardLayout: [
        { i: 'mrr', x: 0, y: 0, w: 4, h: 2 },
        { i: 'newTenants', x: 4, y: 0, w: 4, h: 2 },
        { i: 'tokenConsumption', x: 8, y: 0, w: 4, h: 2 },
        { i: 'conversionFunnel', x: 0, y: 2, w: 6, h: 2 },
        { i: 'tenantsMap', x: 6, y: 2, w: 6, h: 2 },
        { i: 'topTenants', x: 0, y: 4, w: 6, h: 2 },
        { i: 'commissionRevenue', x: 6, y: 4, w: 3, h: 2 },
        { i: 'netMargin', x: 9, y: 4, w: 3, h: 2 },
        { i: 'trainingCoverage', x: 0, y: 6, w: 12, h: 2 }
      ]
    }
  });
  
  console.log('✅ Configurações de UI do Master criadas');

  // ============================================================================
  // 3. PLANOS DA PLATAFORMA (Módulo 1.B)
  // ============================================================================
  console.log('💰 Criando planos da plataforma...');
  
  const starterPlan = await prisma.platformPlan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: {
      name: 'Starter',
      description: 'Plano inicial para pequenas pousadas',
      basePrice: 9900, // R$ 99,00
      annualPrice: 99000, // R$ 990,00 (10% desconto)
      tokenQuota: 10000, // 10K tokens/mês
      tokenMarkup: 100, // 100% markup
      commissionTiers: [
        { tier: 1, minAmount: 0, maxAmount: 2000000, percentage: 3.5 },
        { tier: 2, minAmount: 2000000, maxAmount: 5000000, percentage: 2.5 },
        { tier: 3, minAmount: 5000000, maxAmount: null, percentage: 1.5 }
      ],
      channelQuota: 2,
      featureFlags: {
        voiceCloning: false,
        byok: false,
        advancedAnalytics: false,
        multiLanguage: true,
        basicChat: true,
        calendarSync: true,
        bookingEngine: true,
        channelManager: false
      },
      isActive: true,
      isPublic: true,
      sortOrder: 1
    }
  });
  
  const proPlan = await prisma.platformPlan.upsert({
    where: { name: 'Pro' },
    update: {},
    create: {
      name: 'Pro',
      description: 'Plano profissional para pousadas em crescimento',
      basePrice: 29900, // R$ 299,00
      annualPrice: 299000, // R$ 2.990,00 (15% desconto)
      tokenQuota: 50000, // 50K tokens/mês
      tokenMarkup: 80, // 80% markup
      commissionTiers: [
        { tier: 1, minAmount: 0, maxAmount: 2000000, percentage: 3.0 },
        { tier: 2, minAmount: 2000000, maxAmount: 5000000, percentage: 2.0 },
        { tier: 3, minAmount: 5000000, maxAmount: null, percentage: 1.0 }
      ],
      channelQuota: 5,
      featureFlags: {
        voiceCloning: false,
        byok: false,
        advancedAnalytics: true,
        multiLanguage: true,
        basicChat: true,
        calendarSync: true,
        bookingEngine: true,
        channelManager: true,
        whiteLabel: true
      },
      isActive: true,
      isPublic: true,
      sortOrder: 2
    }
  });
  
  const enterprisePlan = await prisma.platformPlan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      description: 'Plano empresarial para hotéis e redes',
      basePrice: 99900, // R$ 999,00
      annualPrice: 999000, // R$ 9.990,00 (20% desconto)
      tokenQuota: 200000, // 200K tokens/mês
      tokenMarkup: 50, // 50% markup
      commissionTiers: [
        { tier: 1, minAmount: 0, maxAmount: 2000000, percentage: 2.5 },
        { tier: 2, minAmount: 2000000, maxAmount: 5000000, percentage: 1.5 },
        { tier: 3, minAmount: 5000000, maxAmount: null, percentage: 0.5 }
      ],
      channelQuota: 20,
      featureFlags: {
        voiceCloning: true,
        byok: true,
        advancedAnalytics: true,
        multiLanguage: true,
        basicChat: true,
        calendarSync: true,
        bookingEngine: true,
        channelManager: true,
        whiteLabel: true,
        prioritySupport: true,
        customIntegrations: true
      },
      isActive: true,
      isPublic: true,
      sortOrder: 3
    }
  });
  
  console.log(`✅ Planos criados: ${starterPlan.name}, ${proPlan.name}, ${enterprisePlan.name}`);

  // ============================================================================
  // 4. DESIGN SYSTEM THEMES (Módulo 5)
  // ============================================================================
  console.log('🎨 Criando temas do Design System...');
  
  await prisma.designSystemTheme.upsert({
    where: { name: 'Default' },
    update: {},
    create: {
      name: 'Default',
      description: 'Tema padrão do StayOS',
      colors: {
        primary: '#3b82f6',
        primary50: '#eff6ff',
        primary100: '#dbeafe',
        primary200: '#bfdbfe',
        primary300: '#93c5fd',
        primary400: '#60a5fa',
        primary500: '#3b82f6',
        primary600: '#2563eb',
        primary700: '#1d4ed8',
        primary800: '#1e40af',
        primary900: '#1e3a8a',
        secondary: '#10b981',
        secondary50: '#ecfdf5',
        secondary100: '#d1fae5',
        secondary200: '#a7f3d0',
        secondary300: '#6ee7b7',
        secondary400: '#34d399',
        secondary500: '#10b981',
        accent: '#8b5cf6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      fontFamily: {
        headings: 'Inter',
        body: 'Inter'
      },
      fontSizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '1rem'
      },
      allowedPlans: ['Starter', 'Pro', 'Enterprise'],
      allowTenantOverride: true
    }
  });
  
  await prisma.designSystemTheme.upsert({
    where: { name: 'Corporate' },
    update: {},
    create: {
      name: 'Corporate',
      description: 'Tema corporativo com cores sóbrias',
      colors: {
        primary: '#1e40af',
        primary50: '#eef2ff',
        primary100: '#e0e7ff',
        primary200: '#c7d2fe',
        primary300: '#a5b4fc',
        primary400: '#818cf8',
        primary500: '#6366f1',
        primary600: '#4f46e5',
        primary700: '#4338ca',
        primary800: '#3730a3',
        primary900: '#312e81',
        secondary: '#059669',
        accent: '#7c3aed',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626'
      },
      fontFamily: {
        headings: 'Roboto',
        body: 'Roboto'
      },
      fontSizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.375rem'
      },
      allowedPlans: ['Pro', 'Enterprise'],
      allowTenantOverride: false
    }
  });
  
  console.log('✅ Temas do Design System criados');

  // ============================================================================
  // 5. CHAVES DE API (Módulo 3)
  // ============================================================================
  console.log('🔑 Configurando cofre de chaves...');
  
  // Chaves placeholder (em produção, devem ser criptografadas com AES-256)
  await prisma.aPIKey.upsert({
    where: { provider: 'openai' },
    update: {},
    create: {
      provider: 'openai',
      encryptedKey: 'ENCRYPTED_OPENAI_KEY_PLACEHOLDER',
      description: 'Chave OpenAI para modelos GPT',
      isActive: true
    }
  });
  
  await prisma.aPIKey.upsert({
    where: { provider: 'anthropic' },
    update: {},
    create: {
      provider: 'anthropic',
      encryptedKey: 'ENCRYPTED_ANTHROPIC_KEY_PLACEHOLDER',
      description: 'Chave Anthropic para modelos Claude',
      isActive: true
    }
  });
  
  await prisma.aPIKey.upsert({
    where: { provider: 'elevenlabs' },
    update: {},
    create: {
      provider: 'elevenlabs',
      encryptedKey: 'ENCRYPTED_ELEVENLABS_KEY_PLACEHOLDER',
      description: 'Chave ElevenLabs para TTS',
      isActive: true
    }
  });
  
  await prisma.aPIKey.upsert({
    where: { provider: 'stripe' },
    update: {},
    create: {
      provider: 'stripe',
      encryptedKey: 'ENCRYPTED_STRIPE_KEY_PLACEHOLDER',
      description: 'Chave Stripe para pagamentos',
      isActive: true
    }
  });
  
  await prisma.aPIKey.upsert({
    where: { provider: 'mercado_pago' },
    update: {},
    create: {
      provider: 'mercado_pago',
      encryptedKey: 'ENCRYPTED_MERCADO_PAGO_KEY_PLACEHOLDER',
      description: 'Chave Mercado Pago para pagamentos',
      isActive: true
    }
  });
  
  await prisma.aPIKey.upsert({
    where: { provider: 'asaas' },
    update: {},
    create: {
      provider: 'asaas',
      encryptedKey: 'ENCRYPTED_ASAAS_KEY_PLACEHOLDER',
      description: 'Chave Asaas para pagamentos e NFS-e',
      isActive: true
    }
  });
  
  console.log('✅ Chaves de API configuradas');

  // ============================================================================
  // 6. CONFIGURAÇÕES DE GATEWAY DE LLM (Módulo 3)
  // ============================================================================
  console.log('🤖 Configurando gateways de LLM...');
  
  await prisma.lLMGatewayConfig.upsert({
    where: { provider: TokenProvider.OPENAI },
    update: {},
    create: {
      provider: TokenProvider.OPENAI,
      config: {
        baseUrl: 'https://api.openai.com/v1',
        apiVersion: '2024-02-15',
        timeout: 30000
      },
      fallbackOrder: [1, 2, 3], // OpenAI -> Anthropic -> ElevenLabs
      isActive: true
    }
  });
  
  await prisma.lLMGatewayConfig.upsert({
    where: { provider: TokenProvider.ANTHROPIC },
    update: {},
    create: {
      provider: TokenProvider.ANTHROPIC,
      config: {
        baseUrl: 'https://api.anthropic.com/v1',
        apiVersion: '2023-06-01',
        timeout: 30000
      },
      fallbackOrder: [2, 1, 3],
      isActive: true
    }
  });
  
  await prisma.lLMGatewayConfig.upsert({
    where: { provider: TokenProvider.ELEVENLABS },
    update: {},
    create: {
      provider: TokenProvider.ELEVENLABS,
      config: {
        baseUrl: 'https://api.elevenlabs.io/v1',
        timeout: 30000
      },
      fallbackOrder: [3, 1, 2],
      isActive: true
    }
  });
  
  console.log('✅ Gateways de LLM configurados');

  // ============================================================================
  // 7. PLANOS DE TOKENS (Módulo 2)
  // ============================================================================
  console.log('💎 Configurando planos de tokens...');
  
  await prisma.aITokenPlan.upsert({
    where: { provider: TokenProvider.OPENAI },
    update: {},
    create: {
      provider: TokenProvider.OPENAI,
      pricePer1KTokens: 300, // R$ 3,00 por 1K tokens (GPT-4)
      markupPercentage: 100, // 100% markup
      isActive: true
    }
  });
  
  await prisma.aITokenPlan.upsert({
    where: { provider: TokenProvider.ANTHROPIC },
    update: {},
    create: {
      provider: TokenProvider.ANTHROPIC,
      pricePer1KTokens: 250, // R$ 2,50 por 1K tokens (Claude 3)
      markupPercentage: 100,
      isActive: true
    }
  });
  
  await prisma.aITokenPlan.upsert({
    where: { provider: TokenProvider.ELEVENLABS },
    update: {},
    create: {
      provider: TokenProvider.ELEVENLABS,
      pricePer1KTokens: 50, // R$ 0,50 por 1K caracteres
      markupPercentage: 200, // 200% markup
      isActive: true
    }
  });
  
  console.log('✅ Planos de tokens configurados');

  // ============================================================================
  // 8. BLOCOS DA LANDING PAGE (Módulo 4)
  // ============================================================================
  console.log('🌐 Criando blocos da landing page...');
  
  await prisma.landingPageBlock.createMany({
    data: [
      {
        blockType: 'hero',
        content: {
          title: 'Automação Inteligente para Pousadas e Hotéis',
          subtitle: 'Transforme a gestão da sua propriedade com IA de ponta',
          ctaText: 'Comece Grátis',
          ctaLink: '/test-drive',
          imageUrl: '/assets/hero-image.png'
        },
        sortOrder: 1,
        isActive: true,
        variant: 'A'
      },
      {
        blockType: 'features',
        content: {
          title: 'Tudo o que você precisa em um só lugar',
          features: [
            { icon: 'chat', title: 'Atendimento 24/7 com IA', description: 'Respostas automáticas para seus hóspedes' },
            { icon: 'calendar', title: 'Gestão de Reservas', description: 'Controle total da sua ocupação' },
            { icon: 'payment', title: 'Pagamentos Integrados', description: 'Checkout nativo com split automático' },
            { icon: 'analytics', title: 'Analytics Avançado', description: 'Métricas em tempo real' }
          ]
        },
        sortOrder: 2,
        isActive: true,
        variant: 'A'
      },
      {
        blockType: 'pricing',
        content: {
          title: 'Planos que crescem com você',
          plans: [
            { name: 'Starter', price: 'R$ 99', period: 'mês', features: ['Até 2 canais', '10K tokens/mês', 'Suporte básico'] },
            { name: 'Pro', price: 'R$ 299', period: 'mês', features: ['Até 5 canais', '50K tokens/mês', 'Suporte prioritário'] },
            { name: 'Enterprise', price: 'R$ 999', period: 'mês', features: ['Canais ilimitados', '200K tokens/mês', 'Suporte 24/7'] }
          ]
        },
        sortOrder: 3,
        isActive: true,
        variant: 'A'
      },
      {
        blockType: 'testimonials',
        content: {
          title: 'O que nossos clientes dizem',
          testimonials: [
            { name: 'Maria Silva', role: 'Dona, Pousada das Flores', quote: 'Aumentamos nossas reservas em 40% com o StayOS!' },
            { name: 'João Santos', role: 'Gerente, Hotel Praia', quote: 'A IA resolve 90% das dúvidas dos nossos hóspedes.' }
          ]
        },
        sortOrder: 4,
        isActive: true,
        variant: 'A'
      },
      {
        blockType: 'cta',
        content: {
          title: 'Pronto para transformar sua propriedade?',
          subtitle: 'Comece agora com nosso test-drive gratuito',
          ctaText: 'Testar Grátis',
          ctaLink: '/test-drive'
        },
        sortOrder: 5,
        isActive: true,
        variant: 'A'
      }
    ],
    skipDuplicates: true
  });
  
  console.log('✅ Blocos da landing page criados');

  // ============================================================================
  // 9. TRILHAS DE TREINAMENTO (Módulo 21)
  // ============================================================================
  console.log('🎓 Criando trilhas de treinamento...');
  
  // Tour de Boas-Vindas para Master
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '0', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.WELCOME } },
    update: {},
    create: {
      moduleId: '0',
      hierarchyLevel: TourHierarchyLevel.WELCOME,
      targetRole: [UserRole.MASTER_ADMIN],
      title: 'Bem-vindo ao Painel Master do StayOS',
      description: 'Tour inicial para conhecer o painel de controle da plataforma',
      steps: [
        {
          selector: '#sidebar',
          text: 'Aqui está a barra lateral com todos os módulos da plataforma. Navegue livremente.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#dashboard-widgets',
          text: 'Este é o seu dashboard personalizável. Arraste e solte widgets para organizar.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#module-1',
          text: 'O Módulo 1 é o Command Center de Vendas, onde você monitora o funil de conversão.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#module-1b',
          text: 'O Módulo 1.B é o SaaS Billing Engine, o coração financeiro da plataforma.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#module-21',
          text: 'O Módulo 21 é o Copiloto de Treinamento, com cobertura 100% do painel.',
          position: 'right',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour de Boas-Vindas para Tenant
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: 'tenant-welcome', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.WELCOME } },
    update: {},
    create: {
      moduleId: 'tenant-welcome',
      hierarchyLevel: TourHierarchyLevel.WELCOME,
      targetRole: [UserRole.TENANT_ADMIN, UserRole.TENANT_MANAGER, UserRole.TENANT_RECEPTIONIST],
      title: 'Bem-vindo ao StayOS',
      description: 'Tour inicial para conhecer a plataforma de gestão da sua pousada/hotel',
      steps: [
        {
          selector: '#sidebar',
          text: 'Aqui está a barra lateral com os domínios operacionais.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '.domain-a',
          text: 'Domínio A: Inteligência e Atendimento - Chat, Voz IA e Aprendizagem.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '.domain-b',
          text: 'Domínio B: Comercial e Reservas - Tarifário, Quartos, Channel Manager e Checkout.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '.domain-c',
          text: 'Domínio C: Gestão e Retenção - Dashboard, Financeiro, CRM e Mídias.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '.domain-d',
          text: 'Domínio D: Configuração e Expansão - Conexões, Página e Treinamento.',
          position: 'right',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 1 (Command Center de Vendas)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '1', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '1',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.MASTER_ADMIN],
      title: 'Command Center de Vendas',
      description: 'Monitoramento em tempo real do funil de conversão e métricas financeiras',
      steps: [
        {
          selector: '#funnel-chart',
          text: 'Funil de conversão em tempo real: de visitante único até pagamento confirmado.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#heatmap-overlay',
          text: 'Mapa de calor mostrando pontos de abandono na landing page.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#financial-metrics',
          text: 'Métricas financeiras ao vivo: MRR, ARR, Churn Rate, LTV e Taxa de Ativação.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#hot-leads',
          text: 'Lista de leads quentes com score de intenção calculado pela IA.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#take-lead-button',
          text: 'Botão para assumir o chat ao vivo quando a IA sinaliza dificuldade.',
          position: 'top',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 1.B (SaaS Billing Engine)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '1b', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '1b',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.MASTER_ADMIN],
      title: 'SaaS Billing Engine & Revenue Operations',
      description: 'Motor financeiro da plataforma: assinaturas, comissões e reconciliação',
      steps: [
        {
          selector: '#plans-list',
          text: 'Lista de planos SaaS com preços, cotas de tokens e comissões escalonadas.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#subscriptions-table',
          text: 'Tabela de assinaturas dos tenants com status em tempo real.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#ledger-dashboard',
          text: 'Ledger financeiro consolidado: receitas vs. custos de IA.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#reconciliation-status',
          text: 'Status de reconciliação automática entre webhooks e extratos.',
          position: 'top',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 7 (Chat & IA)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '7', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '7',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.TENANT_ADMIN, UserRole.TENANT_MANAGER, UserRole.TENANT_RECEPTIONIST],
      title: 'Chat & IA - Unified Inbox',
      description: 'Atendimento híbrido com IA e intervenção humana',
      steps: [
        {
          selector: '#conversation-list',
          text: 'Lista unificada de conversas de todos os canais (WhatsApp, Instagram, etc.).',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#conversation-detail',
          text: 'Detalhes da conversa com contexto visual enriquecido.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#guest-profile',
          text: 'Perfil do hóspede com histórico, preferências e tags inteligentes.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#ai-suggestions',
          text: 'Sugestões de resposta da IA baseadas no contexto.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#takeover-button',
          text: 'Botão para assumir o atendimento manualmente.',
          position: 'top',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 12 (Quartos & Reservas)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '12', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '12',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.TENANT_ADMIN, UserRole.TENANT_MANAGER],
      title: 'Quartos & Reservas - Booking Engine',
      description: 'Gestão de inventário e reservas com visualização de calendário',
      steps: [
        {
          selector: '#room-list',
          text: 'Lista de quartos com fotos, comodidades e status operacional.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#calendar-view',
          text: 'Visualização de calendário com drag-to-create e drag-to-move.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#availability-map',
          text: 'Mapa de disponibilidade mostrando ocupação por período.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#create-reservation',
          text: 'Formulário para criar reservas manuais com cálculo automático.',
          position: 'right',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 14 (Checkout & Pagamentos)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '14', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '14',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.TENANT_ADMIN, UserRole.TENANT_MANAGER],
      title: 'Checkout & Pagamentos',
      description: 'Processamento de pagamentos com split automático de comissão',
      steps: [
        {
          selector: '#checkout-form',
          text: 'Formulário de checkout nativo processado pela Conta Conectada.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#split-configuration',
          text: 'Configuração do split de pagamento: comissão retida automaticamente.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#payment-methods',
          text: 'Métodos de pagamento disponíveis: cartão, PIX, boleto.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#rolling-reserve',
          text: 'Rolling Reserve: percentual retido por 7 dias para proteção contra chargebacks.',
          position: 'top',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 21 (Copiloto de Treinamento)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '21', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '21',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.MASTER_ADMIN, UserRole.TENANT_ADMIN],
      title: 'Copiloto de Treinamento',
      description: 'Central de conhecimento universal com cobertura 100% do painel',
      steps: [
        {
          selector: '#help-button',
          text: 'Botão flutuante "❓ Central de Ajuda" presente em todas as telas.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#search-bar',
          text: 'Busca semântica com atalho Cmd+K para encontrar trilhas.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#onboarding-checklist',
          text: 'Checklist de onboarding gamificado para novos tenants.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#coverage-dashboard',
          text: 'Dashboard de cobertura de treinamento (exclusivo do Master).',
          position: 'right',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  // Tour do Módulo 22 (Financeiro SaaS do Tenant)
  await prisma.guidedTour.upsert({
    where: { moduleId_submoduleId_functionId_hierarchyLevel: { moduleId: '22', submoduleId: null, functionId: null, hierarchyLevel: TourHierarchyLevel.MODULE } },
    update: {},
    create: {
      moduleId: '22',
      hierarchyLevel: TourHierarchyLevel.MODULE,
      targetRole: [UserRole.TENANT_ADMIN, UserRole.TENANT_MANAGER],
      title: 'Financeiro SaaS - Minha Assinatura',
      description: 'Portal self-service de faturamento da plataforma',
      steps: [
        {
          selector: '#subscription-info',
          text: 'Informações da assinatura: plano atual, ciclo e próxima fatura.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#payment-method',
          text: 'Gerenciamento de método de pagamento via Stripe Elements.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#invoice-history',
          text: 'Histórico de faturas com PDF e NFS-e correspondente.',
          position: 'left',
          requiresAction: false
        },
        {
          selector: '#token-usage',
          text: 'Consumo de tokens de IA: usados vs. cota do plano.',
          position: 'right',
          requiresAction: false
        },
        {
          selector: '#commission-statement',
          text: 'Extrato de comissões por reserva com status de liquidação.',
          position: 'top',
          requiresAction: false
        },
        {
          selector: '#kyc-status',
          text: 'Status do onboarding financeiro (KYC). Checkout desabilitado até conclusão.',
          position: 'top',
          requiresAction: false
        }
      ],
      status: TourStatus.PUBLISHED,
      version: 1
    }
  });
  
  console.log('✅ Trilhas de treinamento criadas');

  // ============================================================================
  // 10. REGISTRO DE COBERTURA DE TREINAMENTO (Módulo 21)
  // ============================================================================
  console.log('📊 Configurando registro de cobertura de treinamento...');
  
  // Módulos do Master
  const masterModules = ['0', '1', '1b', '2', '3', '4', '5', '6', '21'];
  for (const moduleId of masterModules) {
    await prisma.tourCoverageRegistry.upsert({
      where: { moduleId },
      update: {},
      create: {
        moduleId,
        coverage: {
          welcome: true,
          module: true,
          submodule: false,
          function: false,
          microhelp: false
        },
        status: 'partial'
      }
    });
  }
  
  // Módulos do Tenant
  const tenantModules = ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22'];
  for (const moduleId of tenantModules) {
    await prisma.tourCoverageRegistry.upsert({
      where: { moduleId },
      update: {},
      create: {
        moduleId,
        coverage: {
          welcome: false,
          module: true,
          submodule: false,
          function: false,
          microhelp: false
        },
        status: 'partial'
      }
    });
  }
  
  console.log('✅ Registro de cobertura de treinamento configurado');

  // ============================================================================
  // 11. CONFIGURAÇÕES DO SISTEMA
  // ============================================================================
  console.log('⚙️ Configurando configurações do sistema...');
  
  await prisma.systemConfig.upsert({
    where: { key: 'platform_name' },
    update: {},
    create: {
      key: 'platform_name',
      value: 'StayOS',
      description: 'Nome da plataforma'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'platform_version' },
    update: {},
    create: {
      key: 'platform_version',
      value: '1.0.0',
      description: 'Versão da plataforma'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'default_currency' },
    update: {},
    create: {
      key: 'default_currency',
      value: 'BRL',
      description: 'Moeda padrão da plataforma'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'rolling_reserve_percentage' },
    update: {},
    create: {
      key: 'rolling_reserve_percentage',
      value: 5,
      description: 'Percentual de Rolling Reserve (5%)'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'rolling_reserve_days' },
    update: {},
    create: {
      key: 'rolling_reserve_days',
      value: 7,
      description: 'Dias de retenção do Rolling Reserve'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'trial_days' },
    update: {},
    create: {
      key: 'trial_days',
      value: 14,
      description: 'Dias de trial padrão'
    }
  });
  
  await prisma.systemConfig.upsert({
    where: { key: 'dunning_retry_days' },
    update: {},
    create: {
      key: 'dunning_retry_days',
      value: [1, 3, 7],
      description: 'Dias para retry automático de dunning'
    }
  });
  
  console.log('✅ Configurações do sistema aplicadas');

  // ============================================================================
  // 12. LOG DE AUDITORIA INICIAL
  // ============================================================================
  console.log('📝 Criando log de auditoria inicial...');
  
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_INITIALIZATION',
      userId: masterUser.id,
      userEmail: masterUser.email,
      details: {
        message: 'Sistema inicializado via seed',
        modules: ['0', '1', '1b', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'],
        timestamp: new Date().toISOString()
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Seed Script'
    }
  });
  
  console.log('✅ Log de auditoria inicial criado');

  // ============================================================================
  // FINALIZAÇÃO
  // ============================================================================
  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Resumo:');
  console.log(`  - Usuário Master: ${masterUser.email}`);
  console.log(`  - Senha: ${masterPassword} (criptografada com bcrypt)`);
  console.log(`  - Planos: Starter (R$ 99), Pro (R$ 299), Enterprise (R$ 999)`);
  console.log(`  - Temas: Default, Corporate`);
  console.log(`  - Trilhas: 8 trilhas criadas (Boas-Vindas + Módulos 1, 1.B, 7, 12, 14, 21, 22)`);
  console.log(`  - Cobertura: ${masterModules.length + tenantModules.length} módulos registrados`);
  console.log('\n⚠️  IMPORTANTE: Em produção, substitua as chaves placeholder por chaves reais criptografadas!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
