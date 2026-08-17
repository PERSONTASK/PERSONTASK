import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, LayoutGrid } from 'lucide-react';
import { SpaceProvider, useSpace } from '@/contexts/SpaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import logoWatermark from '@/assets/logo-mark-outline.svg';
import type { Board, Space } from '@/types';
import { FullPageSpinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { SpaceTopBar } from './SpaceTopBar';
import { BoardView } from './BoardView';
import { MembersPanel } from './MembersPanel';
import { SpaceSettingsPanel } from './SpaceSettingsPanel';

export function SpacePage() {
  const { spaceId } = useParams();
  if (!spaceId) return <Navigate to="/" replace />;
  return (
    <SpaceProvider spaceId={spaceId} key={spaceId}>
      <SpaceInner spaceId={spaceId} />
    </SpaceProvider>
  );
}

function SpaceInner({ spaceId }: { spaceId: string }) {
  const { t } = useTranslation();
  const { isPremium } = useAuth();
  const { space, loading, can } = useSpace();

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [switchable, setSwitchable] = useState<Space[]>([]);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'members' | 'settings' | null>(null);
  const [boardDialog, setBoardDialog] = useState(false);
  const [boardName, setBoardName] = useState('');

  async function loadBoards() {
    const list = await api.boards.list(spaceId);
    setBoards(list);
    setActiveBoardId((cur) => cur && list.some((b) => b.id === cur) ? cur : list[0]?.id ?? null);
  }

  useEffect(() => {
    loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    if (isPremium) api.spaces.listMine().then(setSwitchable).catch(() => void 0);
  }, [isPremium]);

  // Aplica a fonte do Espaço (Premium). O carregamento do arquivo da fonte
  // (Google Fonts) deve ser adicionado via <link> em index.html — ver README.
  useEffect(() => {
    if (space?.font_family) {
      document.documentElement.style.setProperty('--pt-font', `"${space.font_family}"`);
    }
    return () => {
      document.documentElement.style.removeProperty('--pt-font');
    };
  }, [space?.font_family]);

  async function addBoard() {
    if (!boardName.trim()) return;
    const b = await api.boards.create(spaceId, boardName.trim(), boards.length);
    setBoardName('');
    setBoardDialog(false);
    await loadBoards();
    setActiveBoardId(b.id);
  }

  if (loading || !space) return <FullPageSpinner />;

  const canCreateBoard = can('board.create');

  return (
    <div className="flex h-screen flex-col bg-surface-base">
      <SpaceTopBar
        space={space}
        switchableSpaces={switchable}
        boards={boards}
        activeBoardId={activeBoardId}
        query={query}
        canCreateBoard={canCreateBoard}
        canManageMembers={can('members.manage')}
        canManageSpace={can('space.manage')}
        isPremium={isPremium}
        onSelectBoard={setActiveBoardId}
        onAddBoard={() => setBoardDialog(true)}
        onQuery={setQuery}
        onOpenMembers={() => setPanel('members')}
        onOpenSettings={() => setPanel('settings')}
      />

      <main
        className="relative flex flex-1 flex-col overflow-hidden"
        style={
          space.bg_image_url
            ? { backgroundImage: `url(${space.bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : space.bg_color
              ? { backgroundColor: space.bg_color }
              : undefined
        }
      >
        {space.bg_image_url && <div className="absolute inset-0 bg-surface-base/85 backdrop-blur-sm" />}
        {!space.bg_image_url && (
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden">
            <img src={logoWatermark} alt="" aria-hidden className="h-[45%] max-h-[380px] w-auto opacity-[0.12]" />
          </div>
        )}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {activeBoardId ? (
            <BoardView key={activeBoardId} boardId={activeBoardId} query={query} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <LayoutGrid size={40} className="text-ink-faint" />
              <p className="text-ink-soft">{t('board.noBoards')}</p>
              {canCreateBoard && (
                <button className="btn-primary" onClick={() => setBoardDialog(true)}>
                  <Plus size={18} /> {t('board.addBoard')}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {panel === 'members' && <MembersPanel onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SpaceSettingsPanel onClose={() => setPanel(null)} />}

      <Modal
        open={boardDialog}
        onClose={() => setBoardDialog(false)}
        title={t('board.addBoard')}
        width={380}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setBoardDialog(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={addBoard} disabled={!boardName.trim()}>
              {t('common.create')}
            </button>
          </>
        }
      >
        <label className="label">{t('board.name')}</label>
        <input
          className="field mt-1"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addBoard()}
          autoFocus
        />
      </Modal>
    </div>
  );
}
