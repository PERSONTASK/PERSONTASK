import { useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronDown, MoreHorizontal, GripVertical } from 'lucide-react';
import type { Column, CustomFieldDef, Item } from '@/types';
import { ItemCard } from './ItemCard';
import { cn } from '@/lib/utils';

export function ColumnView({
  column,
  items,
  fieldDefs,
  locale,
  leadDays,
  canManageColumn,
  canCreateItem,
  onOpenItem,
  onToggleCollapse,
  onEditColumn,
  onDeleteColumn,
  onCreateItem,
}: {
  column: Column;
  items: Item[];
  fieldDefs: CustomFieldDef[];
  locale: string;
  leadDays: number;
  canManageColumn: boolean;
  canCreateItem: boolean;
  onOpenItem: (item: Item) => void;
  onToggleCollapse: (column: Column) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (column: Column) => void;
  onCreateItem: (columnId: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  const [menuOpen, setMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  function submitDraft(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim()) onCreateItem(column.id, draft.trim());
      setDraft('');
    } else if (e.key === 'Escape') {
      setComposing(false);
      setDraft('');
    }
  }

  if (column.collapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex h-full w-11 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border border-line/10 bg-surface-raised py-3"
        onClick={() => onToggleCollapse(column)}
        title={t('column.expand')}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.color }} />
        <span
          className="mt-1 whitespace-nowrap text-xs font-bold text-ink-soft"
          style={{ writingMode: 'vertical-rl' }}
        >
          {column.title || '—'} · {items.length}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex max-h-full w-72 shrink-0 flex-col rounded-xl border border-line/10 bg-surface-base/70 p-2 shadow-card backdrop-blur-sm',
        isDragging && 'opacity-50',
      )}
    >
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-2 px-0.5">
        <button
          className="cursor-grab text-ink-faint hover:text-ink-soft active:cursor-grabbing"
          {...attributes}
          {...listeners}
          title={t('common.edit')}
          aria-label="Reordenar coluna"
        >
          <GripVertical size={14} />
        </button>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: column.color }} />
        <button
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-soft"
          onClick={() => onToggleCollapse(column)}
        >
          {column.title || t('column.title')}
          <ChevronDown size={14} className="text-ink-faint" />
        </button>
        <span className="text-xs font-semibold text-ink-faint">{items.length}</span>
        <div className="relative ml-auto flex items-center">
          {canCreateItem && (
            <button
              className="rounded-md p-1 text-ink-faint hover:bg-line/5 hover:text-brand-indigo"
              onClick={() => setComposing((c) => !c)}
              title={t('column.addItem')}
            >
              <Plus size={16} />
            </button>
          )}
          {canManageColumn && (
            <>
              <button
                className="rounded-md p-1 text-ink-faint hover:bg-line/5 hover:text-ink"
                onClick={() => setMenuOpen((o) => !o)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-30 w-40 overflow-hidden rounded-lg border border-line/10 bg-surface-overlay shadow-lift">
                  <button
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-line/5"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      onEditColumn(column);
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="block w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteColumn(column);
                    }}
                  >
                    {t('column.deleteColumn')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-0.5">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              fieldDefs={fieldDefs}
              locale={locale}
              leadDays={leadDays}
              onOpen={() => onOpenItem(item)}
            />
          ))}
        </SortableContext>

        {composing && (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={submitDraft}
            onBlur={() => (draft.trim() ? null : setComposing(false))}
            placeholder={t('item.titlePlaceholder')}
            className="w-full resize-none rounded-lg border border-brand-indigo/50 bg-surface-raised p-2.5 text-sm outline-none"
            rows={2}
          />
        )}

        {items.length === 0 && !composing && (
          <p className="py-6 text-center text-xs text-ink-faint">{t('column.empty')}</p>
        )}
      </div>

      {canCreateItem && !composing && (
        <button
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-faint transition hover:bg-line/5 hover:text-brand-indigo"
          onClick={() => setComposing(true)}
        >
          <Plus size={14} /> {t('column.addItem')}
        </button>
      )}
    </div>
  );
}
