// StayOS Dashboard Redirect
// Redireciona para o painel correto com base no papel do usuário

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Redirecionar com base no papel
  if (session.user.role === UserRole.MASTER_ADMIN) {
    redirect('/master/dashboard');
  } else {
    redirect('/tenant/dashboard');
  }
}
