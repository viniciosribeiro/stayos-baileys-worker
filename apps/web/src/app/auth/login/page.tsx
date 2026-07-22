// StayOS Login Page
// Página de login com autenticação customizada

import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MasterUISettings } from '@prisma/client';
import Link from 'next/link';

// Componente de Formulário de Login
function LoginForm() {
  async function handleSubmit(formData: FormData) {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const remember = formData.get('remember') as string;

    try {
      await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
    } catch (error) {
      console.error('Login failed:', error);
      return redirect('/auth/login?error=invalid_credentials');
    }

    redirect('/dashboard');
  }

  return (
    <form action={handleSubmit} className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className="input w-full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="Sua senha"
          className="input w-full"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            id="remember"
            name="remember"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm">Lembrar de mim</span>
        </label>

        <Link
          href="/auth/forgot-password"
          className="text-sm hover:text-primary"
        >
          Esqueceu a senha?
        </Link>
      </div>

      <button type="submit" className="btn btn-primary w-full">
        Entrar
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link href="/auth/register" className="hover:text-primary">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}

// Página de Login
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
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

  // Buscar configurações do Master
  const settings = await prisma.masterUISettings.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const errorMessage = searchParams.error === 'invalid_credentials'
    ? 'Email ou senha incorretos'
    : searchParams.error === 'tenant_suspended'
      ? 'Sua assinatura está suspensa'
      : searchParams.error === 'tenant_not_found'
        ? 'Tenant não encontrado'
        : null;

  return (
    <div className="w-full max-w-md">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Bem-vindo de volta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Faça login para acessar o {settings?.systemName || 'StayOS'}
        </p>
      </div>

      {errorMessage && (
        <div className="mt-6 alert alert-error">
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="mt-8">
        <LoginForm />
      </div>

      {/* Provedores de Autenticação (futuro) */}
      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">
              Ou continue com
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled
          >
            Google
          </button>
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled
          >
            GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
