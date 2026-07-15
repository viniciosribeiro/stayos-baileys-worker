// StayOS Auth Layout
// Layout para páginas de autenticação

import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Autenticação - StayOS',
  description: 'Faça login para acessar o StayOS',
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirecionar se já estiver autenticado
  if (session?.user) {
    if (session.user.role === 'MASTER_ADMIN') {
      redirect('/master/dashboard');
    } else {
      redirect('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">StayOS</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} StayOS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
