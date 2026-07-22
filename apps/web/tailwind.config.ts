import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    // Incluir pacotes internos
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/training/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // Cores do Design System (Módulo 0 e 5)
      colors: {
        // Cores primárias
        primary: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
        },
        // Cores secundárias
        secondary: {
          50: 'var(--color-secondary-50, #ecfdf5)',
          100: 'var(--color-secondary-100, #d1fae5)',
          200: 'var(--color-secondary-200, #a7f3d0)',
          300: 'var(--color-secondary-300, #6ee7b7)',
          400: 'var(--color-secondary-400, #34d399)',
          500: 'var(--color-secondary-500, #10b981)',
          600: 'var(--color-secondary-600, #059669)',
          700: 'var(--color-secondary-700, #047857)',
          800: 'var(--color-secondary-800, #065f46)',
          900: 'var(--color-secondary-900, #064e3b)',
        },
        // Cores de acento
        accent: {
          50: 'var(--color-accent-50, #f5f3ff)',
          100: 'var(--color-accent-100, #ede9fe)',
          200: 'var(--color-accent-200, #ddd6fe)',
          300: 'var(--color-accent-300, #c4b5fd)',
          400: 'var(--color-accent-400, #a78bfa)',
          500: 'var(--color-accent-500, #8b5cf6)',
          600: 'var(--color-accent-600, #7c3aed)',
          700: 'var(--color-accent-700, #6d28d9)',
          800: 'var(--color-accent-800, #5b21b6)',
          900: 'var(--color-accent-900, #4c1d95)',
        },
        // Cores semânticas
        success: {
          50: 'var(--color-success-50, #f0fdf4)',
          100: 'var(--color-success-100, #dcfce7)',
          200: 'var(--color-success-200, #bbf7d0)',
          300: 'var(--color-success-300, #86efac)',
          400: 'var(--color-success-400, #4ade80)',
          500: 'var(--color-success-500, #22c55e)',
          600: 'var(--color-success-600, #16a34a)',
          700: 'var(--color-success-700, #15803d)',
          800: 'var(--color-success-800, #166534)',
          900: 'var(--color-success-900, #14532d)',
        },
        warning: {
          50: 'var(--color-warning-50, #fffbeb)',
          100: 'var(--color-warning-100, #fef3c7)',
          200: 'var(--color-warning-200, #fde68a)',
          300: 'var(--color-warning-300, #fcd34d)',
          400: 'var(--color-warning-400, #fbbf24)',
          500: 'var(--color-warning-500, #f59e0b)',
          600: 'var(--color-warning-600, #d97706)',
          700: 'var(--color-warning-700, #b45309)',
          800: 'var(--color-warning-800, #92400e)',
          900: 'var(--color-warning-900, #78350f)',
        },
        error: {
          50: 'var(--color-error-50, #fef2f2)',
          100: 'var(--color-error-100, #fee2e2)',
          200: 'var(--color-error-200, #fecaca)',
          300: 'var(--color-error-300, #fca5a5)',
          400: 'var(--color-error-400, #f87171)',
          500: 'var(--color-error-500, #ef4444)',
          600: 'var(--color-error-600, #dc2626)',
          700: 'var(--color-error-700, #b91c1c)',
          800: 'var(--color-error-800, #991b1b)',
          900: 'var(--color-error-900, #7f1d1d)',
        },
      },
      // Fontes do Design System
      fontFamily: {
        headings: 'var(--font-headings, var(--font-family, Inter, sans-serif))',
        body: 'var(--font-body, var(--font-family, Inter, sans-serif))',
      },
      // Bordas e raios
      borderRadius: {
        sm: 'var(--border-radius-sm, 0.25rem)',
        md: 'var(--border-radius-md, 0.5rem)',
        lg: 'var(--border-radius-lg, 1rem)',
      },
      // Espaçamento
      spacing: {
        xs: 'var(--spacing-xs, 0.25rem)',
        sm: 'var(--spacing-sm, 0.5rem)',
        md: 'var(--spacing-md, 1rem)',
        lg: 'var(--spacing-lg, 1.5rem)',
        xl: 'var(--spacing-xl, 2rem)',
      },
      // Animações
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      // Sombras
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      },
      // Transições
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
      },
      // Z-Index
      zIndex: {
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5',
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};

export default config;
