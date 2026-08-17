import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Layers, Users, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { ProfileMenu } from '@/components/ProfileMenu';
import { Spinner } from '@/components/Spinner';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import type { Space } from '@/types';

type SpaceCard = Space & { boardCount: number; memberCount: number };

export function OverviewPage() {
  const { t } = useTranslation();
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<SpaceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () =>
    api.spaces
      .listMine()
      .then(setSpaces)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Plano Grátis: 1 único Espaço.
  const atFreeLimit = !isPremium && spaces.length >= 1;

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line/10 bg-surface-base/90 px-5 backdrop-blur">
        <Logo />
        <div className="ml-auto">
          <ProfileMenu />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{t('overview.title')}</h1>
            <p className="mt-1 text-sm text-ink-soft">{t('overview.subtitle')}</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setCreating(true)}
            disabled={atFreeLimit}
            title={atFreeLimit ? t('overview.freeLimitReached') : undefined}
          >
            <Plus size={18} /> {t('overview.createSpace')}
          </button>
        </div>

        {atFreeLimit && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
            <Lock size={16} /> {t('overview.freeLimitReached')}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20 text-brand-indigo">
            <Spinner className="h-7 w-7" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-16 text-center">
            <Layers size={40} className="text-ink-faint" />
            <p className="text-ink-soft">{t('overview.noSpaces')}</p>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> {t('overview.createSpace')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <Link
                key={s.id}
                to={`/space/${s.id}`}
                className="card group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: s.bg_color || '#6366F1' }}
                />
                <h3 className="mt-1 text-lg font-bold group-hover:text-brand-indigo">{s.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-ink-soft">
                  {s.description || '—'}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-ink-faint">
                  <span className="inline-flex items-center gap-1">
                    <Layers size={14} /> {t('overview.boards', { count: s.boardCount })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={14} /> {t('overview.members', { count: s.memberCount })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateSpaceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(space) => {
          setCreating(false);
          navigate(`/space/${space.id}`);
        }}
      />
    </div>
  );
}
