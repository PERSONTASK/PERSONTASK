import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Upload, Crown, CheckSquare, Columns3, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatDate } from '@/lib/utils';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.split('-')[0] || 'pt';
  const { profile, user, isPremium, updateProfile } = useAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [myItems, setMyItems] = useState<{ id: string; title: string; due_at: string | null }[]>([]);
  const [myColumns, setMyColumns] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    api.me.items(user.id).then(setMyItems).catch(() => void 0);
    api.me.columns(user.id).then(setMyColumns).catch(() => void 0);
  }, [user]);

  if (!profile) return null;

  async function uploadAvatar(file: File) {
    const url = await api.storage.uploadAvatar(user!.id, file);
    await updateProfile({ avatar_url: url });
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line/10 bg-surface-base/90 px-5 backdrop-blur">
        <Link to="/" className="btn-ghost h-9 w-9 rounded-lg p-0" title={t('common.back')}>
          <ArrowLeft size={18} />
        </Link>
        <Logo className="h-7" />
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="mb-6 text-2xl font-extrabold">{t('profile.title')}</h1>

        {/* Identity */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={profile.name} src={profile.avatar_url} id={profile.id} size={72} />
              <button
                onClick={() => avatarInput.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lift"
                title={t('profile.changeAvatar')}
              >
                <Upload size={14} />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
            </div>
            <div className="flex-1">
              <input
                className="w-full rounded-lg bg-transparent text-lg font-bold outline-none focus:bg-surface-raised focus:px-2 focus:py-1"
                defaultValue={profile.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== profile.name && updateProfile({ name: e.target.value.trim() })}
              />
              <p className="text-sm text-ink-soft">{profile.email}</p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="card mt-4 divide-y divide-line/10 p-5">
          <Row label={t('profile.language')}>
            <LanguageSwitcher />
          </Row>
          <Row label={t('profile.theme')}>
            <ThemeToggle />
          </Row>
          <Row label={t('profile.emailNotifications')}>
            <input
              type="checkbox"
              className="h-5 w-9 accent-brand-indigo"
              checked={profile.email_notifications}
              onChange={(e) => updateProfile({ email_notifications: e.target.checked })}
            />
          </Row>
          <Row label={t('profile.plan')}>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  isPremium ? 'bg-amber-400/15 text-amber-500' : 'bg-line/10 text-ink-soft'
                }`}
              >
                {isPremium && <Crown size={12} />}
                {isPremium ? t('plan.premium') : t('plan.free')}
              </span>
              {/* Sem gateway de pagamento nesta versão: o plano é um campo do perfil. */}
              <button
                className="text-xs font-semibold text-brand-indigo hover:underline"
                onClick={() => updateProfile({ plan: isPremium ? 'free' : 'premium' })}
                title={t('plan.upgradeSoon')}
              >
                {isPremium ? t('plan.free') : t('plan.upgrade')}
              </button>
            </div>
          </Row>
        </div>

        {/* My Items & Columns */}
        <h2 className="mb-3 mt-8 text-lg font-bold">{t('profile.myItems')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <CheckSquare size={15} /> Itens ({myItems.length})
            </h3>
            <ul className="space-y-1.5">
              {myItems.length === 0 && <li className="text-xs text-ink-faint">{t('common.empty')}</li>}
              {myItems.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-raised px-3 py-2 text-sm">
                  <span className="truncate">{it.title}</span>
                  {it.due_at && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                      <CalendarClock size={12} /> {formatDate(it.due_at, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <Columns3 size={15} /> Colunas ({myColumns.length})
            </h3>
            <ul className="space-y-1.5">
              {myColumns.length === 0 && <li className="text-xs text-ink-faint">{t('common.empty')}</li>}
              {myColumns.map((c) => (
                <li key={c.id} className="rounded-lg bg-surface-raised px-3 py-2 text-sm">
                  {c.title || '—'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
