// StayOS Landing Page
// Página inicial com A/B Testing (Módulo 4)

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LandingPageBlock } from '@prisma/client';
import { formatCurrency } from '@/lib/utils';

// Componente de Bloco da Landing Page
function BlockRenderer({ block }: { block: LandingPageBlock }) {
  const content = block.content as Record<string, unknown>;

  switch (block.blockType) {
    case 'hero':
      return (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
          <div className="container relative z-10 py-24 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                {content.title as string}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground">
                {content.subtitle as string}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={content.ctaLink as string}
                  className="btn btn-primary btn-lg"
                >
                  {content.ctaText as string}
                </a>
                <a
                  href="/pricing"
                  className="btn btn-outline btn-lg"
                >
                  Ver Planos
                </a>
              </div>
            </div>
          </div>
        </section>
      );

    case 'features':
      return (
        <section className="section">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {content.title as string}
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {(content.features as Array<Record<string, string>>).map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-xl">{feature.icon}</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case 'pricing':
      return (
        <section className="section bg-muted/50">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {content.title as string}
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {(content.plans as Array<Record<string, unknown>>).map((plan, index) => {
                const features = plan.features as string[];
                return (
                  <div
                    key={index}
                    className="card flex flex-col p-8"
                  >
                    <h3 className="text-xl font-bold">{plan.name as string}</h3>
                    <p className="mt-2 text-muted-foreground">
                      {plan.description as string}
                    </p>
                    <div className="my-8">
                      <span className="text-4xl font-bold">
                        {plan.price as string}
                      </span>
                      <span className="text-muted-foreground">
                        /{plan.period as string}
                      </span>
                    </div>
                    <ul className="flex-1 space-y-4">
                      {features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="/test-drive"
                      className="btn btn-primary mt-8 w-full"
                    >
                      Comece Grátis
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );

    case 'testimonials':
      return (
        <section className="section">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {content.title as string}
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              {(content.testimonials as Array<Record<string, string>>).map((testimonial, index) => (
                <div key={index} className="card p-8">
                  <p className="text-lg italic">"{testimonial.quote}"</p>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case 'cta':
      return (
        <section className="section">
          <div className="container">
            <div className="rounded-2xl border bg-gradient-to-r from-primary to-secondary p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                {content.title as string}
              </h2>
              <p className="mt-4 text-lg text-white/80">
                {content.subtitle as string}
              </p>
              <a
                href={content.ctaLink as string}
                className="btn btn-secondary mt-8 inline-block"
              >
                {content.ctaText as string}
              </a>
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

// Landing Page
export default async function HomePage() {
  const session = await auth();

  // Redirecionar se já estiver autenticado
  if (session?.user) {
    if (session.user.role === 'MASTER_ADMIN') {
      redirect('/master/dashboard');
    } else {
      redirect('/dashboard');
    }
  }

  // Buscar blocos da landing page (Módulo 4)
  const blocks = await prisma.landingPageBlock.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  // Buscar métricas para Prova Social (Módulo 4)
  const tenantCount = await prisma.tenant.count();
  const reservationCount = await prisma.reservation.count();

  return (
    <main>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">StayOS</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/features" className="text-sm font-medium hover:text-primary">
              Recursos
            </a>
            <a href="/pricing" className="text-sm font-medium hover:text-primary">
              Planos
            </a>
            <a href="/about" className="text-sm font-medium hover:text-primary">
              Sobre
            </a>
            <a href="/contact" className="text-sm font-medium hover:text-primary">
              Contato
            </a>
            <a href="/auth/login" className="btn btn-primary">
              Entrar
            </a>
          </nav>
        </div>
      </header>

      {/* Landing Page Blocks */}
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}

      {/* Prova Social (Módulo 4) */}
      <section className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">{tenantCount}+</p>
              <p className="text-sm text-muted-foreground">Pousadas e Hotéis</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{reservationCount}+</p>
              <p className="text-sm text-muted-foreground">Reservas Processadas</p>
            </div>
            <div>
              <p className="text-3xl font-bold">99.9%</p>
              <p className="text-sm text-muted-foreground">Tempo de Atividade</p>
            </div>
            <div>
              <p className="text-3xl font-bold">24/7</p>
              <p className="text-sm text-muted-foreground">Suporte</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold">StayOS</h3>
              <p className="mt-4 text-sm text-muted-foreground">
                Automação Inteligente para Pousadas e Hotéis
              </p>
            </div>
            <div>
              <h4 className="font-medium">Produtos</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href="/features" className="text-sm hover:text-primary">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="/pricing" className="text-sm hover:text-primary">
                    Planos
                  </a>
                </li>
                <li>
                  <a href="/test-drive" className="text-sm hover:text-primary">
                    Test-Drive
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Recursos</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href="/docs" className="text-sm hover:text-primary">
                    Documentação
                  </a>
                </li>
                <li>
                  <a href="/api" className="text-sm hover:text-primary">
                    API
                  </a>
                </li>
                <li>
                  <a href="/support" className="text-sm hover:text-primary">
                    Suporte
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Legal</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href="/privacy" className="text-sm hover:text-primary">
                    Privacidade
                  </a>
                </li>
                <li>
                  <a href="/terms" className="text-sm hover:text-primary">
                    Termos
                  </a>
                </li>
                <li>
                  <a href="/cookies" className="text-sm hover:text-primary">
                    Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} StayOS. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
