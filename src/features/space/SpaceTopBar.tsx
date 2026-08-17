import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Users, Settings, Plus, LayoutGrid } from 'lucide-react';
import type { Board, Space } from '@/types';
import { Logo } from '@/components/Logo';
import { ProfileMenu } from '@/components/ProfileMenu';
import { cn } from '@/lib/utils';

export function SpaceTopBar({
  space,
  switchableSpaces,
  boards,
  activeBoardId,
  query,
  canCreateBoard,
  canManageMembers,
  canManageSpace,
  isPremium,
  onSelectBoard,
  onAddBoard,
  onQuery,
  onOpenMembers,
  onOpenSettings,
}: {
  space: Space;
  switchableSpaces: Space[];
  boards: Board[];
  activeBoardId: string | null;
  query: string;
  canCreateBoard: boolean;
  canManageMembers: boolean;
  canManageSpace: boolean;
  isPremium: boolean;
  onSelectBoard: (id: string) => void;
  onAddBoard: () => void;
  onQuery: (q: string) => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const [switcher, setSwitcher] = useState(false);
  const canSwitch = isPremium && switchableSpaces.length > 1;

  return (
    <header className="z-20 flex flex-col border-b border-line/10 bg-surface-base/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/" className="shrink-0" title={t('nav.overview')}>
          <Logo className="h-7" />
        </Link>
        <span className="text-line/30">/</span>

        {/* Company logo (Premium) */}
        {space.logo_url && (
          <img
            src={space.logo_url}
            alt=""
            className="h-6 max-w-[96px] shrink-0 rounded object-contain"
          />
        )}

        {/* Space name + switcher (Premium) */}
        <div className="relative">
          <button
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold',
              canSwitch && 'hover:bg-line/5',
            )}
            onClick={() => canSwitch && setSwitcher((s) => !s)}
            onBlur={() => setTimeout(() => setSwitcher(false), 150)}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: space.bg_color || '#6366F1' }}
            />
            {space.name}
            {canSwitch && <ChevronDown size={14} className="text-ink-faint" />}
          </button>
          {switcher && canSwitch && (
            <div className="absolute left-0 top-10 z-30 w-56 overflow-hidden rounded-xl border border-line/10 bg-surface-overlay py-1 shadow-lift">
              <p className="px-3 py-1 text-[11px] font-bold uppercase text-ink-faint">
                {t('nav.switchSpace')}
              </p>
              {switchableSpaces.map((s) => (
                <Link
                  key={s.id}
                  to={`/space/${s.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm hover:bg-line/5',
                    s.id === space.id && 'font-semibold text-brand-indigo',
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: s.bg_color }} />
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative ml-2 hidden max-w-xs flex-1 sm:block">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t('space.searchPlaceholder')}
            className="field py-1.5 pl-8"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {canManageMembers && (
            <button className="btn-ghost h-9 rounded-lg px-2.5" onClick={onOpenMembers} title={t('members.title')}>
              <Users size={17} />
              <span className="hidden md:inline">{t('nav.members')}</span>
            </button>
          )}
          {canManageSpace && (
            <button className="btn-ghost h-9 w-9 rounded-lg p-0" onClick={onOpenSettings} title={t('nav.settings')}>
              <Settings size={17} />
            </button>
          )}
          <div className="ml-1">
            <ProfileMenu />
          </div>
        </div>
      </div>

      {/* Board tabs */}
      <div className="flex items-center gap-1 px-4 pb-1.5">
        <LayoutGrid size={14} className="mr-1 text-ink-faint" />
        {boards.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelectBoard(b.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              b.id === activeBoardId
                ? 'bg-brand-gradient text-white'
                : 'text-ink-soft hover:bg-line/5 hover:text-ink',
            )}
          >
            {b.name}
          </button>
        ))}
        {canCreateBoard && (
          <button
            onClick={onAddBoard}
            className="rounded-lg px-2 py-1.5 text-ink-faint transition hover:bg-line/5 hover:text-brand-indigo"
            title={t('board.addBoard')}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
