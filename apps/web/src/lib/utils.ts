// StayOS Utilities
// Funções utilitárias para a aplicação

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge de classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatação de moeda (BRL)
export function formatCurrency(amount: number, currency: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount / 100); // amount está em centavos
}

// Formatação de número
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

// Formatação de data
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(dateObj);
}

// Formatação de data curta
export function formatShortDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

// Formatação de hora
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

// Formatação de data e hora
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

// Truncar texto
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

// Capitalizar primeira letra
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Gerar ID único
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// Debounce
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Sleep (para async/await)
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Verificar se é ambiente de produção
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Verificar se é ambiente de desenvolvimento
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Obter variável de ambiente com fallback
export function getEnvVar(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

// Validar CPF
export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/[^0-9]/g, '');
  if (cleanCPF.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Calcular dígitos verificadores
  let sum = 0;
  let remainder: number;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
}

// Validar CNPJ
export function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/[^0-9]/g, '');
  if (cleanCNPJ.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  let pos = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }
  
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleanCNPJ.charAt(12))) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  pos = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }
  
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleanCNPJ.charAt(13))) return false;
  
  return true;
}

// Formatar CPF/CNPJ
export function formatCPFCNPJ(value: string): string {
  const cleanValue = value.replace(/[^0-9]/g, '');
  
  if (cleanValue.length <= 11) {
    // CPF
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(\d{11})(\d{1,2})/, '$1');
  } else {
    // CNPJ
    return cleanValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(\d{14})(\d{1,2})/, '$1');
  }
}

// Formatar telefone
export function formatPhone(value: string): string {
  const cleanValue = value.replace(/[^0-9]/g, '');
  
  if (cleanValue.length <= 10) {
    // 10 dígitos: (XX) XXXX-XXXX
    return cleanValue
      .replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else {
    // 11 dígitos: (XX) XXXXX-XXXX
    return cleanValue
      .replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
}

// Gerar cor aleatória
export function getRandomColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Obter iniciais do nome
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// Calcular porcentagem
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

// Arredondar número
export function roundNumber(value: number, decimals: number = 2): number {
  return parseFloat(value.toFixed(decimals));
}
