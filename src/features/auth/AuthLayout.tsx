import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, CalendarClock, ListChecks, Users, Globe, Sparkles, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const features: { icon: LucideIcon; label: string }[] = [
    { icon: LayoutGrid, label: t('promo.f1') },
    { icon: CalendarClock, label: t('promo.f2') },
    { icon: ListChecks, label: t('promo.f3') },
    { icon: Users, label: t('promo.f4') },
    { icon: Globe, label: t('promo.f5') },
  ];
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <Logo forceVariant="onDark" className="relative h-9" />
        <div className="relative space-y-7">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-white/25">
              <Sparkles size={13} /> {t('promo.cta')}
            </span>
            <h2 className="mt-4 max-w-sm text-3xl font-extrabold leading-tight text-balance">
              {t('common.tagline')}
            </h2>
            <p className="mt-2 max-w-sm text-white/80">{t('promo.sub')}</p>
          </div>
          <ul className="space-y-3.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <f.icon size={16} />
                </span>
                <span className="max-w-xs text-sm text-white/95">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} PERSONTASK</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col bg-surface-base">
        <div className="flex items-center justify-end gap-1 p-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <h1 className="text-2xl font-extrabold text-balance">{title}</h1>
            <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
