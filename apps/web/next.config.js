/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  
  // Otimizações
  reactStrictMode: true,
  swcMinify: true,
  
  // Imagens
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.stayos.com',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
      },
    ],
    // Tamanhos de imagem
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Headers de segurança
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Redirecionamentos
  async redirects() {
    return [
      {
        source: '/',
        has: [
          {
            type: 'cookie',
            key: 'next-auth.session-token',
          },
        ],
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
