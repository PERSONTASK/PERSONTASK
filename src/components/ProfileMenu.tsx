import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, User as UserIcon, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from './Avatar';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';

export function ProfileMenu() {
  const { t } = useTranslation();
  const { profile, signOut, isPremium } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc (em vez de onBlur, que fechava ao usar
  // controles internos como o seletor de idioma).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!profile) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-line/15"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={profile.name} src={profile.avatar_url} id={profile.id} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border border-line/10 bg-surface-overlay shadow-lift animate-scale-in">
          <div className="border-b border-line/10 p-3">
            <div className="flex items-center gap-2">
              <Avatar name={profile.name} src={profile.avatar_url} id={profile.id} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.name}</p>
                <p className="truncate text-xs text-ink-soft">{profile.email}</p>
              </div>
            </div>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                isPremium ? 'bg-amber-400/15 text-amber-500' : 'bg-line/10 text-ink-soft'
              }`}
            >
              {isPremium && <Crown size={11} />}
              {isPremium ? t('plan.premium') : t('plan.free')}
            </span>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-line/5"
              onClick={() => setOpen(false)}
            >
              <UserIcon size={16} /> {t('nav.profile')}
            </Link>
            <div className="flex items-center justify-between px-3 py-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
            >
              <LogOut size={16} /> {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
