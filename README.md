# StayOS - Hotelaria Multi-tenant SaaS Platform

## 🚀 Visão Geral

StayOS é uma plataforma SaaS de nível mundial para gestão de pousadas e hotéis, focada em **automação inteligente** e **experiência de usuário (UX) de ponta**. A plataforma é desenvolvida com uma arquitetura moderna e escalável, utilizando as melhores tecnologias do mercado.

## 🏗️ Arquitetura

### Stack Tecnológica

| Camada | Tecnologia | Finalidade |
|--------|------------|------------|
| **Frontend** | Next.js 14 (App Router) | SSR/SEO, Server Components |
| **Backend** | Node.js 20 | Workers stateful, WebSockets |
| **Estilos** | TailwindCSS | Design System modular e responsivo |
| **Componentes** | Radix UI / Shadcn | Componentes acessíveis e customizáveis |
| **Estado** | Zustand | Gerenciamento de estado client-side |
| **Banco de Dados** | PostgreSQL | Multi-tenant com RLS nativo |
| **Cache/Filas** | Redis + BullMQ | Cache e processamento assíncrono |
| **IA** | OpenAI, Anthropic, ElevenLabs | LLM, STT, TTS |

### Estrutura do Monorepo (Turborepo)

```
stayos-platform/
├── apps/
│   ├── web/          # Next.js (Frontend + API Serverless)
│   └── worker/       # Node.js (Workers stateful)
├── packages/
│   ├── db/           # Prisma Client + Migrations
│   ├── ai/           # Gateway de LLM Unificado
│   ├── payments/     # Gateway de Pagamentos Unificado
│   ├── training/     # Motor de Tours Guiados
│   └── ui/           # Design System compartilhado
└── docker-compose.yml
```

## 📋 Módulos da Plataforma

### 👑 Nível 1: Admin Master

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Módulo 0** | Identidade e Personalização Profunda do Painel Master | ✅ Implementado |
| **Módulo 1** | Command Center de Vendas (Bloomberg Terminal) | ✅ Implementado |
| **Módulo 1.B** | SaaS Billing Engine & Revenue Operations | ✅ Implementado |
| **Módulo 2** | Gestão e Revenda de IA (Token Metering) | ✅ Implementado |
| **Módulo 3** | Configurações Globais & Cofre de Chaves | ✅ Implementado |
| **Módulo 4** | White-Label & Landing Page | ✅ Implementado |
| **Módulo 5** | Design System & Tema Studio | ✅ Implementado |
| **Módulo 6** | Auditoria, Segurança e Conformidade | ✅ Implementado |
| **Módulo 21** | Copiloto de Treinamento (100% cobertura) | ✅ Implementado |

### 🏨 Nível 2: Tenant

#### Domínio A: Inteligência e Atendimento
| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Módulo 7** | Chat & IA (Unified Inbox) | 📋 Planejado |
| **Módulo 8** | Voz IA (STT/TTS) | 📋 Planejado |
| **Módulo 9** | Aprendizagem & IA (RAG) | 📋 Planejado |
| **Módulo 10** | IA Comportamental | 📋 Planejado |

#### Domínio B: Comercial e Reservas
| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Módulo 11** | Tarifário (Motor Matemático) | 📋 Planejado |
| **Módulo 12** | Quartos & Reservas (Booking Engine) | 📋 Planejado |
| **Módulo 13** | Channel Manager & Sincronização | 📋 Planejado |
| **Módulo 14** | Checkout & Pagamentos | 📋 Planejado |

#### Domínio C: Gestão e Retenção
| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Módulo 15** | Dashboard do Tenant | ✅ Implementado |
| **Módulo 16** | Financeiro (Gestão de Receita) | 📋 Planejado |
| **Módulo 17** | Clientes (CRM Inteligente) | 📋 Planejado |
| **Módulo 18** | Mídias (Galeria e Arsenal da IA) | 📋 Planejado |

#### Domínio D: Configuração e Expansão
| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Módulo 19** | Conexões (Omnichannel) | 📋 Planejado |
| **Módulo 20** | Página (Site White-Label) | 📋 Planejado |
| **Módulo 22** | Financeiro SaaS (Minha Assinatura) | 📋 Planejado |

## 💰 Correntes Financeiras

A plataforma possui **três correntes de dinheiro distintas e desacopladas**:

1. **Tenant → Master**: Pagamento da assinatura SaaS + excedentes de IA + comissão transacional
2. **Hóspede → Tenant**: Pagamento da reserva, com repasse automático via split de pagamento
3. **Master → Provedores de IA**: Custo de insumo (OpenAI, Anthropic, ElevenLabs)

Todas convergem no **Ledger Financeiro Consolidado do Master** (Módulo 1.B), fonte de verdade real de MRR, ARR e margem líquida.

## 🎯 Premissas Fundamentais

### 1. Treinamento Obrigatório (Módulo 21)
- **Nenhuma funcionalidade** pode ser lançada em produção sem uma trilha de treinamento guiado correspondente
- Cobertura de **100% do painel**, auditável através de um dashboard de cobertura dedicado ao Master
- Requisito de **Definition of Done** de engenharia

### 2. Isolamento Multi-tenant
- **RLS (Row Level Security)** nativo no PostgreSQL
- Cada tenant tem seus dados completamente isolados
- Políticas de acesso baseadas no papel do usuário

### 3. Integração com IA
- **Function Calling** estrito: IA nunca inventa preços ou dados
- **Fallback automático** entre provedores de LLM
- **Token Metering** com markup dinâmico

## 🚀 Como Executar

### Pré-requisitos

- Node.js 20+
- pnpm 8.15+
- PostgreSQL 15+
- Redis 7+
- Docker (opcional)

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/viniciosribeiro/stayos-baileys-worker.git
cd stayos-baileys-worker

# Instalar dependências
pnpm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# Gerar client do Prisma
pnpm db:generate

# Aplicar migrações
pnpm db:push

# Popular banco com dados iniciais
pnpm db:seed
```

### Desenvolvimento

```bash
# Iniciar todos os serviços com Docker
pnpm dev

# Ou manualmente:
# Terminal 1: PostgreSQL e Redis
docker-compose up -d postgres redis

# Terminal 2: Worker
pnpm --filter @stayos/worker dev

# Terminal 3: Web
pnpm --filter @stayos/web dev
```

### Produção

```bash
# Build de todos os pacotes
pnpm build

# Iniciar com Docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔐 Credenciais Iniciais

Após executar o seed, as seguintes credenciais serão criadas:

- **Usuário Master**: viniciosribeiro@stayos.com
- **Senha**: vr1986123@
- **Papel**: MASTER_ADMIN

## 📊 Métricas e Monitoramento

### Dashboard do Master (Módulo 1)
- Funil de conversão em tempo real
- Métricas financeiras ao vivo (MRR, ARR, Churn, LTV)
- Lista de leads quentes com score de intenção por IA
- Painel de assinaturas com status visual

### Dashboard do Tenant (Módulo 15)
- Visão 360°: ocupação, receita, hóspedes na casa
- Saúde da IA e Omnichannel
- Alertas inteligentes

## 🎨 Personalização (Módulo 0)

O Admin Master pode personalizar:
- Logo, nome e identidade do sistema
- Paleta de cores completa (HSL)
- Tipografia global (Google Fonts)
- Bordas e raios
- Comportamento de telas e janelas
- Layout de dashboard (drag-and-drop)

## 🔧 Configurações Importantes

### Módulo 1.B - SaaS Billing Engine
- **Gateway Unificado**: Stripe, Mercado Pago, Asaas
- **Planos SaaS**: Starter (R$ 99), Pro (R$ 299), Enterprise (R$ 999)
- **Comissão Transacional**: Escalonada por volume
- **Split de Pagamento**: Direto para Conta Conectada do Tenant
- **Dunning Management**: Réguas de retry automático
- **Emissão Fiscal**: NFS-e automática

### Módulo 2 - Gestão de IA
- **Token Metering**: Por tenant, com markup dinâmico
- **Orquestrador**: A/B Testing com fallback automático
- **Alertas**: Consumo em 80% e 100% da cota

### Módulo 3 - Cofre de Chaves
- Chaves centralizadas (AES-256)
- Modo Enterprise (BYOK)
- Gateway de LLM unificado

## 📚 Documentação

- [Arquitetura Detalhada](docs/architecture.md)
- [Esquema do Banco de Dados](docs/database.md)
- [API Reference](docs/api.md)
- [Guia de Implantação](docs/deployment.md)

## 🤝 Contribuição

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

MIT

## 📞 Contato

- **Email**: viniciosribeiro@stayos.com
- **Site**: https://stayos.com
- **Documentação**: https://docs.stayos.com

---

**StayOS - Automação Inteligente para Pousadas e Hotéis**
