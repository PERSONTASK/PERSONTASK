import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import type { Column, Item } from '@/types';
import { Spinner } from '@/components/Spinner';
import { ColumnView } from './ColumnView';
import { ColumnDialog } from './ColumnDialog';
import { ItemDetail } from './ItemDetail';

type ItemMap = Record<string, Item[]>;

export function BoardView({ boardId, query }: { boardId: string; query: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.split('-')[0] || 'pt';
  const { user, isPremium } = useAuth();
  const { space, profileMap, labelMap, fieldDefs, can } = useSpace();

  const [columns, setColumns] = useState<Column[]>([]);
  const [itemsByCol, setItemsByCol] = useState<ItemMap>({});
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [colDialog, setColDialog] = useState<{ open: boolean; column: Column | null }>({
    open: false,
    column: null,
  });
  const originColRef = useRef<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reload = useCallback(async () => {
    const cols = await api.columns.list(boardId);
    const raw = await api.items.listByBoard(cols.map((c) => c.id));
    const map: ItemMap = {};
    cols.forEach((c) => (map[c.id] = []));
    raw.forEach((r) => {
      const hydrated = api.items.hydrate(r, profileMap, labelMap);
      (map[hydrated.column_id] ??= []).push(hydrated);
    });
    setColumns(cols);
    setItemsByCol(map);
    setLoading(false);
  }, [boardId, profileMap, labelMap]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const leadDays = space?.due_soon_lead_days ?? 3;
  const canManageColumn = can('column.manage');
  const canCreateItem = can('item.create');

  const findContainer = useCallback(
    (id: string): string | undefined => {
      if (itemsByCol[id]) return id;
      return Object.keys(itemsByCol).find((col) => itemsByCol[col].some((i) => i.id === id));
    },
    [itemsByCol],
  );

  // ── DnD handlers ────────────────────────────────────────────────────────
  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === 'item') {
      const col = findContainer(String(e.active.id));
      originColRef.current = col ?? null;
      const it = col ? itemsByCol[col].find((i) => i.id === e.active.id) : null;
      setActiveItem(it ?? null);
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type !== 'item') return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;
    setItemsByCol((prev) => {
      const fromItems = [...prev[from]];
      const toItems = [...prev[to]];
      const idx = fromItems.findIndex((i) => i.id === active.id);
      if (idx < 0) return prev;
      const [moved] = fromItems.splice(idx, 1);
      moved.column_id = to;
      const overIdx = toItems.findIndex((i) => i.id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : toItems.length;
      toItems.splice(insertAt, 0, moved);
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveItem(null);
    if (!over) return;

    // Reordenar Colunas
    if (active.data.current?.type === 'column') {
      if (active.id !== over.id && columns.some((c) => c.id === over.id)) {
        const oldIndex = columns.findIndex((c) => c.id === active.id);
        const newIndex = columns.findIndex((c) => c.id === over.id);
        const next = arrayMove(columns, oldIndex, newIndex);
        setColumns(next);
        api.columns.reorder(next.map((c) => c.id)).catch(() => reload());
      }
      return;
    }

    // Reordenar / mover Itens
    const container = findContainer(String(active.id));
    if (!container) return;
    let arr = itemsByCol[container];
    const oldIndex = arr.findIndex((i) => i.id === active.id);
    const newIndex = arr.findIndex((i) => i.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      arr = arrayMove(arr, oldIndex, newIndex);
      setItemsByCol((prev) => ({ ...prev, [container]: arr }));
    }
    const index = arr.findIndex((i) => i.id === active.id);
    try {
      await api.items.setColumn(String(active.id), container, index);
      await api.items.reorder(arr.map((i) => i.id));
      const origin = originColRef.current;
      if (origin && origin !== container && itemsByCol[origin]) {
        await api.items.reorder(itemsByCol[origin].map((i) => i.id));
      }
    } catch {
      reload();
    }
  }

  async function createItem(columnId: string, title: string) {
    if (!user) return;
    const position = itemsByCol[columnId]?.length ?? 0;
    await api.items.create({ columnId, spaceId: space!.id, title, position, createdBy: user.id });
    reload();
  }

  async function saveColumn(title: string, color: string) {
    if (colDialog.column) {
      await api.columns.update(colDialog.column.id, { title, color });
    } else {
      await api.columns.create({
        boardId,
        spaceId: space!.id,
        title,
        color,
        position: columns.length,
      });
    }
    setColDialog({ open: false, column: null });
    reload();
  }

  async function deleteColumn(column: Column) {
    if (!confirm(t('column.deleteConfirm'))) return;
    await api.columns.remove(column.id);
    reload();
  }

  async function toggleCollapse(column: Column) {
    setColumns((prev) =>
      prev.map((c) => (c.id === column.id ? { ...c, collapsed: !c.collapsed } : c)),
    );
    api.columns.update(column.id, { collapsed: !column.collapsed }).catch(() => reload());
  }

  // Busca: filtra itens por título/etiqueta.
  const q = query.trim().toLowerCase();
  function visibleItems(colId: string): Item[] {
    const list = itemsByCol[colId] ?? [];
    if (!q) return list;
    return list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.labels ?? []).some((l) => l.name.toLowerCase().includes(q)),
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-brand-indigo">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 items-start gap-3 overflow-x-auto p-5">
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <ColumnView
                key={col.id}
                column={col}
                items={visibleItems(col.id)}
                fieldDefs={fieldDefs}
                locale={locale}
                leadDays={leadDays}
                canManageColumn={canManageColumn}
                canCreateItem={canCreateItem}
                onOpenItem={(it) => setOpenItemId(it.id)}
                onToggleCollapse={toggleCollapse}
                onEditColumn={(c) => setColDialog({ open: true, column: c })}
                onDeleteColumn={deleteColumn}
                onCreateItem={createItem}
              />
            ))}
          </SortableContext>

          {canManageColumn && (
            <button
              className="flex h-11 w-72 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-line/20 bg-surface-base/40 text-sm font-medium text-ink-soft backdrop-blur-sm transition hover:border-brand-indigo/50 hover:text-brand-indigo"
              onClick={() => setColDialog({ open: true, column: null })}
            >
              <Plus size={16} /> {t('column.add')}
            </button>
          )}
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="w-72 rotate-2 rounded-lg border border-brand-indigo/50 bg-surface-raised p-3 shadow-lift">
              <p className="text-sm font-semibold">{activeItem.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ColumnDialog
        open={colDialog.open}
        column={colDialog.column}
        canPickColor={isPremium}
        onClose={() => setColDialog({ open: false, column: null })}
        onSave={saveColumn}
      />

      {openItemId && (
        <ItemDetail
          itemId={openItemId}
          onClose={() => setOpenItemId(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}
