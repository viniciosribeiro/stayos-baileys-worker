// StayOS Tenant Sidebar
// Sidebar do Painel do Tenant

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tenant } from '@prisma/client';
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  Hotel,
  CreditCard,
  BarChart3,
  Image,
  Mic,
  BookOpen,
  Brain,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Palette,
  Globe,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Telegram,
  Smartphone,
} from 'lucide-react';

// Itens do Menu
interface MenuItem {
  id: string;
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  children?: MenuItem[];
}

// Configuração do Menu
function getMenuItems(tenant: Tenant, settings: Record<string, unknown>): MenuItem[] {
  // Verificar feature flags do plano
  const featureFlags = tenant.platformSubscription?.plan?.featureFlags || {};

  return [
    {
      id: 'dashboard',
      title: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      id: 'domain-a',
      title: 'Inteligência e Atendimento',
      href: '/intelligence',
      icon: <Brain className="h-5 w-5" />,
      children: [
        {
          id: 'chat',
          title: 'Chat & IA',
          href: '/chat',
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          id: 'voice',
          title: 'Voz IA',
          href: '/voice',
          icon: <Mic className="h-4 w-4" />,
        },
        {
          id: 'training',
          title: 'Aprendizagem & IA',
          href: '/training',
          icon: <BookOpen className="h-4 w-4" />,
        },
        {
          id: 'behavior',
          title: 'IA Comportamental',
          href: '/behavior',
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'domain-b',
      title: 'Comercial e Reservas',
      href: '/commercial',
      icon: <CreditCard className="h-5 w-5" />,
      children: [
        {
          id: 'tariff',
          title: 'Tarifário',
          href: '/tariff',
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'rooms',
          title: 'Quartos',
          href: '/rooms',
          icon: <Hotel className="h-4 w-4" />,
        },
        {
          id: 'reservations',
          title: 'Reservas',
          href: '/reservations',
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          id: 'channel-manager',
          title: 'Channel Manager',
          href: '/channel-manager',
          icon: <Globe className="h-4 w-4" />,
          badge: featureFlags.channelManager ? undefined : 'Pro',
        },
        {
          id: 'checkout',
          title: 'Checkout',
          href: '/checkout',
          icon: <CreditCard className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'domain-c',
      title: 'Gestão e Retenção',
      href: '/management',
      icon: <Users className="h-5 w-5" />,
      children: [
        {
          id: 'financial',
          title: 'Financeiro',
          href: '/financial',
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          id: 'guests',
          title: 'Clientes (CRM)',
          href: '/guests',
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: 'media',
          title: 'Mídias',
          href: '/media',
          icon: <Image className="h-4 w-4" />,
        },
        {
          id: 'reports',
          title: 'Relatórios',
          href: '/reports',
          icon: <BarChart3 className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'domain-d',
      title: 'Configuração e Expansão',
      href: '/configuration',
      icon: <Settings className="h-5 w-5" />,
      children: [
        {
          id: 'connections',
          title: 'Conexões',
          href: '/connections',
          icon: <Phone className="h-4 w-4" />,
        },
        {
          id: 'page',
          title: 'Página',
          href: '/page',
          icon: <Globe className="h-4 w-4" />,
        },
        {
          id: 'billing',
          title: 'Minha Assinatura',
          href: '/billing',
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          id: 'settings',
          title: 'Configurações',
          href: '/settings',
          icon: <Settings className="h-4 w-4" />,
        },
        {
          id: 'training-center',
          title: 'Central de Treinamento',
          href: '/training-center',
          icon: <HelpCircle className="h-4 w-4" />,
        },
      ],
    },
  ];
}

// Componente de Item do Menu
function MenuItemComponent({
  item,
  pathname,
  depth = 0,
  onClick,
}: {
  item: MenuItem;
  pathname: string;
  depth?: number;
  onClick?: () => void;
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = pathname.startsWith(`${item.href}/`) || pathname === item.href;

  if (hasChildren) {
    return (
      <div className={cn('space-y-1', depth > 0 && 'pl-4')}>
        <button
          onClick={onClick}
          className={cn(
            'sidebar-item w-full justify-between',
            isActive && 'sidebar-item-active'
          )}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {isExpanded && (
          <div className="space-y-1">
            {item.children?.map((child) => (
              <MenuItemComponent
                key={child.id}
                item={child}
                pathname={pathname}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'sidebar-item',
        depth > 0 && 'pl-4',
        isActive && 'sidebar-item-active'
      )}
    >
      {item.icon}
      <span>{item.title}</span>
      {item.badge && (
        <span className="badge badge-primary">{item.badge}</span>
      )}
    </Link>
  );
}

// Componente de Sidebar
export function Sidebar({
  tenant,
  settings,
}: {
  tenant: Tenant;
  settings: Record<string, unknown>;
}) {
  const pathname = usePathname();
  const menuItems = getMenuItems(tenant, settings);

  return (
    <aside className="sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 pb-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            {tenant.uiConfig?.logoCompactUrl ? (
              <img
                src={tenant.uiConfig.logoCompactUrl}
                alt="Logo"
                className="h-8 w-8"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold">
                  {tenant.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="font-bold">{tenant.name}</span>
          </Link>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <MenuItemComponent
              key={item.id}
              item={item}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Rodapé */}
        <div className="border-t pt-6">
          <Link
            href="/settings"
            className={cn(
              'sidebar-item',
              pathname.startsWith('/settings') && 'sidebar-item-active'
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </Link>
          <Link
            href="/training-center"
            className={cn(
              'sidebar-item mt-2',
              pathname.startsWith('/training-center') && 'sidebar-item-active'
            )}
          >
            <HelpCircle className="h-5 w-5" />
            <span>Treinamento</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

// Componente de Seta
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
