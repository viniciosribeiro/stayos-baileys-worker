// StayOS Master Header
// Header do Painel Master

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, getInitials } from '@/lib/utils';
import { MasterUISettings, AuditLog } from '@prisma/client';
import {
  Menu,
  Bell,
  Search,
  User,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';

// Componente de Notificação
function NotificationItem({ notification }: { notification: AuditLog }) {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'text-success';
      case 'LOGOUT':
        return 'text-muted-foreground';
      case 'AUTH_FAILURE':
        return 'text-error';
      case 'SUBSCRIPTION_STATUS_CHANGE':
        return 'text-warning';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-accent rounded-lg">
      <div className={cn('p-1 rounded-full', getActionColor(notification.action))}>
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{notification.action}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(notification.createdAt).toLocaleString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// Componente de Perfil
function ProfileDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-8 rounded-full"
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-sm font-medium">VR</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Vinicios Ribeiro</p>
            <p className="text-xs leading-none text-muted-foreground">
              viniciosribeiro@stayos.com
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/master/settings/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/master/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/auth/logout">
            <span>Sair</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Componente de Header
export function Header({
  settings,
  notifications,
}: {
  settings?: MasterUISettings | null;
  notifications: AuditLog[];
}) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  // Detectar scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtrar notificações
  const unreadNotifications = notifications.filter(
    (n) => !n.details?.read
  );

  return (
    <header
      className={cn(
        'header',
        isScrolled && 'shadow-sm'
      )}
    >
      <div className="container flex h-full items-center justify-between">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Notificações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-lg"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="notification-badge">
                    {unreadNotifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                    />
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma notificação
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/master/notifications">
                  Ver todas as notificações
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Perfil */}
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
