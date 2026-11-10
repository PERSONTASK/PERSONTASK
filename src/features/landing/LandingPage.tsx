import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  Check,
  FileSpreadsheet,
  GanttChartSquare,
  Globe,
  LayoutGrid,
  Smartphone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';

/**
 * Página de abertura pública (visitante não autenticado em `/`).
 *
 * O argumento é um só: **três ferramentas num app só** — CRM, projetos e
 * tarefas — simples de usar e mais barato que comprar as três separadas.
 * Tudo que está aqui é função que existe de verdade no produto.
 */
export function LandingPage() {
  const { t } = useTranslation();

  const pillars = [
    {
      icon: Building2,
      title: t('landing.p1Title'),
      text: t('landing.p1Text'),
      points: [t('landing.p1a'), t('landing.p1b'), t('landing.p1c')],
      color: '#3B82F6',
    },
    {
      icon: GanttChartSquare,
      title: t('landing.p2Title'),
      text: t('landing.p2Text'),
      points: [t('landing.p2a'), t('landing.p2b'), t('landing.p2c')],
      color: '#6366F1',
    },
    {
      icon: LayoutGrid,
      title: t('landing.p3Title'),
      text: t('landing.p3Text'),
      points: [t('landing.p3a'), t('landing.p3b'), t('landing.p3c')],
      color: '#8B5CF6',
    },
  ];

  const extras = [
    { icon: BarChart3, label: t('landing.x1') },
    { icon: Bell, label: t('landing.x2') },
    { icon: FileSpreadsheet, label: t('landing.x3') },
    { icon: Users, label: t('landing.x4') },
    { icon: Globe, label: t('landing.x5') },
    { icon: Smartphone, label: t('landing.x6') },
  ];

  const steps = [t('landing.s1'), t('landing.s2'), t('landing.s3')];

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Barra do topo */}
      <header className="sticky top-0 z-30 border-b border-line/10 bg-surface-base/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <Logo className="h-8" />
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link to="/login" className="btn-secondary hidden sm:inline-flex">
              {t('auth.login')}
            </Link>
            <Link to="/signup" className="btn-primary">
              {t('landing.startFree')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Topo: a promessa */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)' }}
          />
          <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-indigo/10 px-3 py-1 text-xs font-bold text-brand-indigo">
              <Sparkles size={13} /> {t('landing.badge')}
            </span>

            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t('landing.h1a')}{' '}
              <span className="bg-brand-gradient bg-clip-text text-transparent">{t('landing.h1b')}</span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base text-ink-soft sm:text-lg">{t('landing.sub')}</p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup" className="btn-primary px-5 py-2.5 text-base">
                {t('landing.startFree')} <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="btn-secondary px-5 py-2.5 text-base">
                {t('auth.login')}
              </Link>
            </div>
            <p className="mt-3 text-xs text-ink-faint">{t('landing.noCard')}</p>
          </div>
        </section>

        {/* Os três pilares */}
        <section className="mx-auto max-w-6xl px-5 pb-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {pillars.map((p) => (
              <article
                key={p.title}
                className="rounded-2xl border border-line/10 bg-surface-raised p-6 shadow-card"
              >
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ background: p.color }}
                >
                  <p.icon size={21} />
                </span>
                <h2 className="mt-4 text-lg font-bold">{p.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{p.text}</p>
                <ul className="mt-4 space-y-1.5">
                  {p.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-ink-soft">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: p.color }} />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* O argumento central */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="rounded-2xl border border-line/10 bg-brand-gradient p-8 text-white sm:p-12">
            <h2 className="max-w-2xl text-2xl font-bold sm:text-3xl">{t('landing.oneAppTitle')}</h2>
            <p className="mt-3 max-w-2xl text-white/85">{t('landing.oneAppText')}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="mt-2 text-sm text-white/90">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Galeria: as telas de verdade do produto */}
        <Gallery />

        {/* O resto que vem junto */}
        <section className="mx-auto max-w-6xl px-5 pb-14">
          <h2 className="text-center text-2xl font-bold">{t('landing.extrasTitle')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-soft">{t('landing.extrasText')}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((e) => (
              <div
                key={e.label}
                className="flex items-start gap-3 rounded-xl border border-line/10 bg-surface-raised p-4"
              >
                <e.icon size={18} className="mt-0.5 shrink-0 text-brand-indigo" />
                <span className="text-sm text-ink-soft">{e.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Para quem é */}
        <section className="border-y border-line/10 bg-surface-raised/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-center text-2xl font-bold">{t('landing.forWhoTitle')}</h2>
            <div className="mx-auto mt-7 grid max-w-4xl gap-4 sm:grid-cols-3">
              {[
                { icon: Target, label: t('landing.w1') },
                { icon: CalendarRange, label: t('landing.w2') },
                { icon: Users, label: t('landing.w3') },
              ].map((w) => (
                <div key={w.label} className="text-center">
                  <w.icon size={22} className="mx-auto text-brand-indigo" />
                  <p className="mt-2 text-sm text-ink-soft">{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fechamento */}
        <section className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('landing.closeTitle')}</h2>
          <p className="mt-3 text-ink-soft">{t('landing.closeText')}</p>
          <Link to="/signup" className="btn-primary mx-auto mt-7 px-5 py-2.5 text-base">
            {t('landing.startFree')} <ArrowRight size={17} />
          </Link>
          <p className="mt-3 text-xs text-ink-faint">{t('landing.noCard')}</p>
        </section>
      </main>

      <footer className="border-t border-line/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:text-left">
          <Logo className="h-7" />
          <div className="sm:ml-auto sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {t('landing.poweredBy')}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              © {new Date().getFullYear()} PERSONTASK · {t('landing.rights')}
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a href="/manual.html" className="text-xs text-ink-soft hover:text-brand-indigo">
              {t('nav.manual')}
            </a>
            <a href="/termos.html" className="text-xs text-ink-soft hover:text-brand-indigo">
              {t('legal.terms')}
            </a>
            <a href="/privacidade.html" className="text-xs text-ink-soft hover:text-brand-indigo">
              {t('legal.privacy')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Telas do produto, em abas. As imagens ficam em `public/landing/`. */
function Gallery() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const shots = [
    { file: 'quadro', icon: LayoutGrid, title: t('landing.g1'), text: t('landing.g1Text') },
    { file: 'cronograma', icon: CalendarRange, title: t('landing.g2'), text: t('landing.g2Text') },
    { file: 'cronograma2', icon: GanttChartSquare, title: t('landing.g3'), text: t('landing.g3Text') },
    { file: 'relatorio', icon: BarChart3, title: t('landing.g4'), text: t('landing.g4Text') },
  ];
  const shot = shots[active];

  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <h2 className="text-center text-2xl font-bold">{t('landing.galleryTitle')}</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-soft">{t('landing.galleryText')}</p>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {shots.map((s, i) => (
          <button
            key={s.file}
            onClick={() => setActive(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
              i === active ? 'bg-brand-gradient text-white' : 'bg-surface-raised text-ink-soft hover:text-ink',
            )}
          >
            <s.icon size={15} /> {s.title}
          </button>
        ))}
      </div>

      <figure className="mt-5">
        <div className="overflow-hidden rounded-2xl border border-line/10 bg-surface-raised shadow-lift">
          {/* Barra de janela, para a captura parecer uma tela de verdade */}
          <div className="flex items-center gap-1.5 border-b border-line/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 text-[11px] text-ink-faint">persontask.com.br</span>
          </div>

          {broken[shot.file] ? (
            <div
              className="flex aspect-[16/9] items-center justify-center text-sm font-semibold text-white/80"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)' }}
            >
              <span className="flex items-center gap-2">
                <shot.icon size={18} /> {shot.title} · {t('landing.gallerySoon')}
              </span>
            </div>
          ) : (
            <img
              src={`/landing/${shot.file}.png`}
              alt={shot.title}
              loading="lazy"
              className="block w-full"
              onError={() => setBroken((b) => ({ ...b, [shot.file]: true }))}
            />
          )}
        </div>
        <figcaption className="mt-3 text-center text-sm text-ink-soft">{shot.text}</figcaption>
      </figure>
    </section>
  );
}
