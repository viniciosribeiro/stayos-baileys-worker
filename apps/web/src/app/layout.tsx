// StayOS Root Layout
// Layout principal da aplicação com autenticação e tema dinâmico

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MasterUISettings } from '@prisma/client';

// Fontes (Módulo 0 e 5)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Metadados dinâmicos
export async function generateMetadata(): Promise<Metadata> {
  // Buscar configurações do Master
  const settings = await prisma.masterUISettings.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const systemName = settings?.systemName || 'StayOS';
  const description = `${systemName} - Automação Inteligente para Pousadas e Hotéis`;

  return {
    title: {
      default: systemName,
      template: `%s | ${systemName}`,
    },
    description,
    keywords: ['hotelaria', 'pousada', 'hotel', 'IA', 'automação', 'reservas', 'gestão'],
    authors: [{ name: 'StayOS' }],
    creator: 'StayOS',
    publisher: 'StayOS',
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: 'https://stayos.com',
      siteName: systemName,
      title: systemName,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: systemName,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: settings?.faviconUrl || '/favicon.ico',
      shortcut: settings?.faviconUrl || '/favicon-16x16.png',
      apple: settings?.faviconUrl || '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Root Layout
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  // Buscar configurações de UI do Master (Módulo 0)
  const settings = await prisma.masterUISettings.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  // Buscar configurações de tema do Tenant (Módulo 5)
  let tenantTheme = null;
  if (session?.user?.tenantId) {
    tenantTheme = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { uiConfig: true, theme: { select: { colors: true, fontFamily: true } } },
    });
  }

  // Aplicar tema dinâmico
  const themeConfig = {
    systemName: settings?.systemName || 'StayOS',
    logoUrl: settings?.logoUrl || '/logo.svg',
    colors: tenantTheme?.theme?.colors || settings?.colorConfig || {},
    fonts: {
      headings: tenantTheme?.theme?.fontFamily?.headings || settings?.fontHeadings || 'Inter',
      body: tenantTheme?.theme?.fontFamily?.body || settings?.fontBody || 'Inter',
    },
    borderRadius: tenantTheme?.uiConfig?.borderRadius || settings?.borderRadius || 8,
    themeMode: tenantTheme?.uiConfig?.themeMode || settings?.themeMode || 'DARK',
  };

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Tema Dinâmico (Módulo 0) */}
        <meta name="theme-color" content={themeConfig.themeMode === 'DARK' ? '#000000' : '#ffffff'} />
        
        {/* Fontes Dinâmicas (Módulo 0 e 5) */}
        <link 
          href={`https://fonts.googleapis.com/css2?family=${themeConfig.fonts.headings}:wght@400;500;600;700&family=${themeConfig.fonts.body}:wght@400;500;600;700&display=swap`}
          rel="stylesheet"
        />
        
        {/* CSS Variables para Tema Dinâmico */}
        <script 
          dangerouslySetInnerHTML={{
            __html: `
              // Aplicar variáveis de tema
              const theme = ${JSON.stringify(themeConfig)};
              
              // Cores
              if (theme.colors.primary) {
                document.documentElement.style.setProperty('--color-primary', theme.colors.primary);
              }
              if (theme.colors.secondary) {
                document.documentElement.style.setProperty('--color-secondary', theme.colors.secondary);
              }
              
              // Fontes
              document.documentElement.style.setProperty('--font-headings', theme.fonts.headings);
              document.documentElement.style.setProperty('--font-body', theme.fonts.body);
              
              // Border Radius
              document.documentElement.style.setProperty('--border-radius-md', theme.borderRadius + 'px');
              
              // Tema
              if (theme.themeMode === 'DARK') {
                document.documentElement.classList.add('dark');
              } else if (theme.themeMode === 'LIGHT') {
                document.documentElement.classList.remove('dark');
              }
            `,
          }}
        />
      </head>
      <body 
        className={cn(
          'min-h-screen bg-background font-body antialiased',
          inter.variable,
          themeConfig.themeMode === 'DARK' ? 'dark' : ''
        )}
        data-theme={tenantTheme?.theme?.name || 'default'}
        data-density={tenantTheme?.uiConfig?.interfaceDensity || settings?.interfaceDensity || 'COMFORTABLE'}
      >
        {children}
      </body>
    </html>
  );
}
