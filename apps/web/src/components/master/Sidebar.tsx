// StayOS Master Sidebar
// Sidebar do Painel Master (Módulo 0)

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MasterUISettings } from '@prisma/client';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Brain,
  BarChart3,
  FileText,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Palette,
  Bell,
  Shield,
  TrendingUp,
  Wallet,
  MessageSquare,
  Hotel,
  Calendar,
  Globe,
  BookOpen,
  GraduationCap,
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
function getMenuItems(settings?: MasterUISettings | null): MenuItem[] {
  return [
    {
      id: 'dashboard',
      title: 'Dashboard',
      href: '/master/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      id: 'sales',
      title: 'Vendas',
      href: '/master/sales',
      icon: <TrendingUp className="h-5 w-5" />,
      children: [
        {
          id: 'command-center',
          title: 'Command Center',
          href: '/master/sales/command-center',
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'tenants',
          title: 'Tenants',
          href: '/master/tenants',
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: 'billing',
          title: 'Billing Engine',
          href: '/master/billing',
          icon: <CreditCard className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'ai',
      title: 'IA',
      href: '/master/ai',
      icon: <Brain className="h-5 w-5" />,
      children: [
        {
          id: 'token-metering',
          title: 'Token Metering',
          href: '/master/ai/token-metering',
          icon: <Wallet className="h-4 w-4" />,
        },
        {
          id: 'model-router',
          title: 'Orquestrador',
          href: '/master/ai/model-router',
          icon: <Globe className="h-4 w-4" />,
        },
        {
          id: 'finops',
          title: 'FinOps',
          href: '/master/ai/finops',
          icon: <BarChart3 className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'settings',
      title: 'Configurações',
      href: '/master/settings',
      icon: <Settings className="h-5 w-5" />,
      children: [
        {
          id: 'ui-config',
          title: 'UI & Tema',
          href: '/master/settings/ui',
          icon: <Palette className="h-4 w-4" />,
        },
        {
          id: 'api-keys',
          title: 'Chaves de API',
          href: '/master/settings/api-keys',
          icon: <Shield className="h-4 w-4" />,
        },
        {
          id: 'landing-page',
          title: 'Landing Page',
          href: '/master/settings/landing-page',
          icon: <FileText className="h-4 w-4" />,
        },
        {
          id: 'design-system',
          title: 'Design System',
          href: '/master/settings/design-system',
          icon: <BookOpen className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'training',
      title: 'Treinamento',
      href: '/master/training',
      icon: <GraduationCap className="h-5 w-5" />,
      children: [
        {
          id: 'tours',
          title: 'Trilhas Guiadas',
          href: '/master/training/tours',
          icon: <HelpCircle className="h-4 w-4" />,
        },
        {
          id: 'coverage',
          title: 'Cobertura',
          href: '/master/training/coverage',
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'metrics',
          title: 'Métricas',
          href: '/master/training/metrics',
          icon: <TrendingUp className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'reports',
      title: 'Relatórios',
      href: '/master/reports',
      icon: <FileText className="h-5 w-5" />,
      children: [
        {
          id: 'financial',
          title: 'Financeiro',
          href: '/master/reports/financial',
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          id: 'tenants',
          title: 'Tenants',
          href: '/master/reports/tenants',
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: 'ai-usage',
          title: 'Uso de IA',
          href: '/master/reports/ai-usage',
          icon: <Brain className="h-4 w-4" />,
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
  settings,
}: {
  settings?: MasterUISettings | null;
}) {
  const pathname = usePathname();
  const menuItems = getMenuItems(settings);

  return (
    <aside className="sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 pb-6">
          <Link href="/master/dashboard" className="flex items-center gap-3">
            {settings?.logoCompactUrl ? (
              <img
                src={settings.logoCompactUrl}
                alt="Logo"
                className="h-8 w-8"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
            )}
            <span className="font-bold">{settings?.systemName || 'StayOS'}</span>
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
            href="/master/settings"
            className={cn(
              'sidebar-item',
              pathname.startsWith('/master/settings') && 'sidebar-item-active'
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </Link>
          <Link
            href="/master/training"
            className={cn(
              'sidebar-item mt-2',
              pathname.startsWith('/master/training') && 'sidebar-item-active'
            )}
          >
            <GraduationCap className="h-5 w-5" />
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
