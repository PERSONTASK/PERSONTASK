import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Users, Settings, Plus, LayoutGrid, Lock, Pencil, Trash2, Building2 } from 'lucide-react';
import type { Board, Space, ViewMode } from '@/types';
import type { OverdueItem } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { ProfileMenu } from '@/components/ProfileMenu';
import { NotificationsBell } from './NotificationsBell';
import { cn } from '@/lib/utils';

export function SpaceTopBar({
  space,
  switchableSpaces,
  boards,
  activeBoardId,
  query,
  canCreateBoard,
  boardLimitReached,
  canEditBoard,
  canDeleteBoard,
  canManageMembers,
  canManageSpace,
  isPremium,
  onSelectBoard,
  onAddBoard,
  onRenameBoard,
  onDeleteBoard,
  onQuery,
  onOpenMembers,
  onOpenSettings,
  onOpenClients,
  viewMode,
  onViewMode,
  alertsToken,
  onOpenAlertItem,
  canEditItem,
}: {
  space: Space;
  switchableSpaces: Space[];
  boards: Board[];
  activeBoardId: string | null;
  query: string;
  canCreateBoard: boolean;
  boardLimitReached: boolean;
  canEditBoard: boolean;
  canDeleteBoard: boolean;
  canManageMembers: boolean;
  canManageSpace: boolean;
  isPremium: boolean;
  onSelectBoard: (id: string) => void;
  onAddBoard: () => void;
  onRenameBoard: (b: Board) => void;
  onDeleteBoard: (b: Board) => void;
  onQuery: (q: string) => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  onOpenClients: () => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  /** Muda quando algo do Espaço mudou — faz o sininho recarregar. */
  alertsToken: number;
  onOpenAlertItem: (item: OverdueItem) => void;
  canEditItem: boolean;
}) {
  const { t } = useTranslation();
  const [switcher, setSwitcher] = useState(false);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);
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
          <button
            className="btn-ghost h-9 rounded-lg px-2.5"
            onClick={onOpenClients}
            title={t('crm.manage')}
          >
            <Building2 size={17} />
            <span className="hidden lg:inline">{t('crm.organizations')}</span>
          </button>
          <NotificationsBell
            spaceId={space.id}
            canEdit={canEditItem}
            reloadToken={alertsToken}
            onOpenItem={onOpenAlertItem}
          />
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
        {boards.map((b) => {
          const active = b.id === activeBoardId;
          const hasMenu = active && (canEditBoard || canDeleteBoard);
          return (
            <div key={b.id} className="relative flex items-center">
              <button
                onClick={() => onSelectBoard(b.id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition',
                  active ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:bg-line/5 hover:text-ink',
                  hasMenu ? 'rounded-l-lg' : 'rounded-lg',
                )}
              >
                {b.name}
              </button>
              {hasMenu && (
                <button
                  onClick={() => setMenuBoardId((id) => (id === b.id ? null : b.id))}
                  onBlur={() => setTimeout(() => setMenuBoardId(null), 150)}
                  className="rounded-r-lg bg-brand-gradient py-1.5 pl-0.5 pr-2 text-white/90 transition hover:text-white"
                  title={t('common.edit')}
                >
                  <ChevronDown size={14} />
                </button>
              )}
              {menuBoardId === b.id && (
                <div className="absolute left-0 top-9 z-30 w-48 overflow-hidden rounded-xl border border-line/10 bg-surface-overlay py-1 shadow-lift">
                  {canEditBoard && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMenuBoardId(null);
                        onRenameBoard(b);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-line/5"
                    >
                      <Pencil size={14} /> {t('board.rename')}
                    </button>
                  )}
                  {canDeleteBoard && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMenuBoardId(null);
                        onDeleteBoard(b);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} /> {t('board.deleteBoard')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canCreateBoard &&
          (boardLimitReached ? (
            <button
              disabled
              className="cursor-not-allowed rounded-lg px-2 py-1.5 text-ink-faint/50"
              title={t('board.freeLimitReached')}
            >
              <Lock size={15} />
            </button>
          ) : (
            <button
              onClick={onAddBoard}
              className="rounded-lg px-2 py-1.5 text-ink-faint transition hover:bg-line/5 hover:text-brand-indigo"
              title={t('board.addBoard')}
            >
              <Plus size={16} />
            </button>
          ))}

        {/* Alternador de visão: Quadro · Lista · Relatório */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-surface-raised p-0.5">
          {(['board', 'schedule', 'report'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewMode(v)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                viewMode === v ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
