import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, LayoutGrid } from 'lucide-react';
import { SpaceProvider, useSpace } from '@/contexts/SpaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getTemplates, type TemplateDef } from '@/lib/templates';
import { cn } from '@/lib/utils';
import logoWatermark from '@/assets/logo-mark-outline.svg';
import type { Board, Space, ViewMode } from '@/types';
import { FullPageSpinner, Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { SpaceTopBar } from './SpaceTopBar';
import { BoardView } from './BoardView';
import { MembersPanel } from './MembersPanel';
import { SpaceSettingsPanel } from './SpaceSettingsPanel';
import { ClientsPanel } from './ClientsPanel';
import { ScheduleView } from './ScheduleView';
import { ReportView } from './ReportView';
import { ItemDetail } from './ItemDetail';

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
  const { t, i18n } = useTranslation();
  const { isPremium, user } = useAuth();
  const { space, loading, can, reloadLabels, reloadFields } = useSpace();

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [switchable, setSwitchable] = useState<Space[]>([]);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'members' | 'settings' | 'clients' | null>(null);
  const [boardDialog, setBoardDialog] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Board | null>(null);
  const [renameName, setRenameName] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [template, setTemplate] = useState<TemplateDef | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  /** Card aberto pelo sininho de avisos (independe do Painel em tela). */
  const [alertItemId, setAlertItemId] = useState<string | null>(null);
  const [alertsToken, setAlertsToken] = useState(0);

  const templates = useMemo(() => getTemplates(i18n.language), [i18n.language]);

  // Plano Grátis: 1 único Painel por Espaço.
  const boardLimitReached = !isPremium && boards.length >= 1;

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

  function openBoardDialog() {
    setTemplate(null);
    setBoardName('');
    setBoardDialog(true);
  }

  function pickTemplate(tpl: TemplateDef | null) {
    setTemplate(tpl);
    setBoardName(tpl ? tpl.boardName : '');
  }

  async function addBoard() {
    if (!boardName.trim() || boardLimitReached || creatingBoard) return;
    setCreatingBoard(true);
    try {
      let newBoardId: string;
      if (template && user) {
        newBoardId = await api.templates.apply({
          spaceId,
          userId: user.id,
          def: { ...template, boardName: boardName.trim() },
          boardPosition: boards.length,
        });
        // O template pode ter criado etiquetas/campos novos no Espaço.
        await Promise.all([reloadLabels(), reloadFields()]);
      } else {
        const b = await api.boards.create(spaceId, boardName.trim(), boards.length);
        newBoardId = b.id;
      }
      setBoardName('');
      setTemplate(null);
      setBoardDialog(false);
      await loadBoards();
      setActiveBoardId(newBoardId);
    } finally {
      setCreatingBoard(false);
    }
  }

  function startRenameBoard(b: Board) {
    setRenameTarget(b);
    setRenameName(b.name);
  }

  async function submitRenameBoard() {
    if (!renameTarget || !renameName.trim()) return;
    await api.boards.rename(renameTarget.id, renameName.trim());
    setRenameTarget(null);
    await loadBoards();
  }

  async function deleteBoard(b: Board) {
    if (!confirm(t('board.deleteConfirm'))) return;
    await api.boards.remove(b.id);
    await loadBoards();
  }

  if (loading || !space) return <FullPageSpinner />;

  const canCreateBoard = can('board.create');
  const canEditBoard = can('board.edit');
  const canDeleteBoard = can('board.delete');

  return (
    <div className="flex h-screen flex-col bg-surface-base">
      <SpaceTopBar
        space={space}
        switchableSpaces={switchable}
        boards={boards}
        activeBoardId={activeBoardId}
        query={query}
        canCreateBoard={canCreateBoard}
        boardLimitReached={boardLimitReached}
        canEditBoard={canEditBoard}
        canDeleteBoard={canDeleteBoard}
        canManageMembers={can('members.manage')}
        canManageSpace={can('space.manage')}
        isPremium={isPremium}
        onSelectBoard={setActiveBoardId}
        onAddBoard={openBoardDialog}
        onRenameBoard={startRenameBoard}
        onDeleteBoard={deleteBoard}
        onQuery={setQuery}
        onOpenMembers={() => setPanel('members')}
        onOpenSettings={() => setPanel('settings')}
        onOpenClients={() => setPanel('clients')}
        viewMode={viewMode}
        onViewMode={setViewMode}
        alertsToken={alertsToken}
        canEditItem={can('item.edit')}
        onOpenAlertItem={(item) => {
          // Vai para o Painel do card e abre o detalhe por cima.
          if (item.boardId) setActiveBoardId(item.boardId);
          setAlertItemId(item.id);
        }}
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
            viewMode === 'schedule' ? (
              <ScheduleView
                key={activeBoardId}
                boardId={activeBoardId}
                boardName={boards.find((b) => b.id === activeBoardId)?.name ?? ''}
                query={query}
              />
            ) : viewMode === 'report' ? (
              <ReportView
                key={activeBoardId}
                board={boards.find((b) => b.id === activeBoardId)!}
                query={query}
                canConfigure={canEditBoard}
                onBoardChanged={() => loadBoards().catch(() => void 0)}
              />
            ) : (
              <BoardView key={activeBoardId} boardId={activeBoardId} query={query} />
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <LayoutGrid size={40} className="text-ink-faint" />
              <p className="text-ink-soft">{t('board.noBoards')}</p>
              {canCreateBoard && (
                <button className="btn-primary" onClick={openBoardDialog}>
                  <Plus size={18} /> {t('board.addBoard')}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {panel === 'members' && <MembersPanel onClose={() => setPanel(null)} />}
      {panel === 'clients' && <ClientsPanel onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SpaceSettingsPanel onClose={() => setPanel(null)} />}

      {/* Card aberto pelo sininho: ao fechar, o sininho recarrega e o aviso
          some sozinho se o prazo foi resolvido no card. */}
      {alertItemId && (
        <ItemDetail
          itemId={alertItemId}
          onClose={() => {
            setAlertItemId(null);
            setAlertsToken((n) => n + 1);
          }}
          onChanged={() => setAlertsToken((n) => n + 1)}
        />
      )}

      <Modal
        open={boardDialog}
        onClose={() => setBoardDialog(false)}
        title={t('board.addBoard')}
        width={520}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setBoardDialog(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={addBoard}
              disabled={!boardName.trim() || creatingBoard}
            >
              {creatingBoard ? <Spinner /> : null} {t('common.create')}
            </button>
          </>
        }
      >
        <label className="label">{t('templates.startFrom')}</label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => pickTemplate(null)}
            className={cn(
              'rounded-xl border p-3 text-left transition',
              !template
                ? 'border-brand-indigo bg-brand-indigo/10'
                : 'border-line/15 hover:border-brand-indigo/50',
            )}
          >
            <span className="block text-sm font-semibold">{t('templates.blank')}</span>
            <span className="mt-0.5 block text-xs text-ink-soft">{t('templates.blankDesc')}</span>
          </button>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => pickTemplate(tpl)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                template?.id === tpl.id
                  ? 'border-brand-indigo bg-brand-indigo/10'
                  : 'border-line/15 hover:border-brand-indigo/50',
              )}
            >
              <span className="block text-sm font-semibold">{tpl.name}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{tpl.description}</span>
            </button>
          ))}
        </div>

        {template && (
          <p className="mt-2 text-xs text-ink-faint">
            {t('templates.willCreate', {
              columns: template.columns.length,
              labels: template.labels.length,
              fields: template.fields.length,
            })}
          </p>
        )}

        <label className="label mt-4 block">{t('board.name')}</label>
        <input
          className="field mt-1"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addBoard()}
          autoFocus
        />
      </Modal>

      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title={t('board.rename')}
        width={380}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRenameTarget(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={submitRenameBoard} disabled={!renameName.trim()}>
              {t('common.save')}
            </button>
          </>
        }
      >
        <label className="label">{t('board.name')}</label>
        <input
          className="field mt-1"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitRenameBoard()}
          autoFocus
        />
      </Modal>
    </div>
  );
}
