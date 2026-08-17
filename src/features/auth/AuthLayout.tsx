import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Users, Bell } from 'lucide-react';
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
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <Logo forceVariant="onDark" className="relative h-9" />
        <div className="relative space-y-6">
          <h2 className="max-w-sm text-3xl font-extrabold leading-tight text-balance">
            {t('common.tagline')}
          </h2>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-center gap-3">
              <Users size={20} /> {t('members.title')}
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={20} /> {t('nav.overview')}
            </li>
            <li className="flex items-center gap-3">
              <Bell size={20} /> {t('profile.emailNotifications')}
            </li>
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
