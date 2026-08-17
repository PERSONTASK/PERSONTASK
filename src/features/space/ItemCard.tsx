import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { Paperclip, MessageSquare, CalendarClock, CheckSquare, Square } from 'lucide-react';
import type { CustomFieldDef, Item } from '@/types';
import { Avatar } from '@/components/Avatar';
import { cn, dueTone, formatDate } from '@/lib/utils';
import { formatFieldValue } from './fieldDisplay';
import { checklistPct } from './ChecklistsEditor';

const TONE_CLASS: Record<string, string> = {
  overdue: 'text-red-500',
  soon: 'text-amber-500',
  ok: 'text-ink-faint',
  none: 'text-ink-faint',
};

export function ItemCard({
  item,
  fieldDefs,
  locale,
  leadDays,
  onOpen,
}: {
  item: Item;
  fieldDefs: CustomFieldDef[];
  locale: string;
  leadDays: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', columnId: item.column_id },
  });

  const style = { transform: CSS.Translate.toString(transform), transition };
  const tone = dueTone(item.due_at, leadDays);

  const faceFields = (item.field_values ?? [])
    .filter((fv) => fv.show_on_face)
    .map((fv) => ({ fv, def: fieldDefs.find((d) => d.id === fv.field_def_id) }))
    .filter((x) => x.def) as { fv: NonNullable<Item['field_values']>[number]; def: CustomFieldDef }[];

  const attachCount = item.attachments?.length ?? 0;
  const commentCount = item.comments?.length ?? 0;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        'group w-full cursor-grab rounded-lg border border-line/10 bg-surface-raised p-3 text-left shadow-card transition hover:border-brand-indigo/50 hover:shadow-lift active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      {item.labels && item.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {item.labels.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${l.color}22`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>

      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{item.description}</p>
      )}

      {faceFields.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {faceFields.map(({ fv, def }) =>
            def.type === 'checkbox' ? (
              <div key={def.id} className="flex items-center gap-1 text-[11px]">
                {fv.value === true ? (
                  <CheckSquare size={13} className="text-emerald-500" />
                ) : (
                  <Square size={13} className="text-ink-faint" />
                )}
                <span className="text-ink-soft">{def.name}</span>
              </div>
            ) : (
              <div key={def.id} className="flex gap-1 text-[11px]">
                <span className="font-medium text-ink-faint">{def.name}:</span>
                <span className="text-ink-soft">{formatFieldValue(def, fv, locale)}</span>
              </div>
            ),
          )}
        </div>
      )}

      {(item.checklists ?? []).length > 0 && (
        <div className="mt-2 space-y-1">
          {(item.checklists ?? []).map((cl) => {
            const p = checklistPct(cl);
            return (
              <div key={cl.id} className="flex items-center gap-1.5 text-[10px]">
                <CheckSquare size={11} className="shrink-0 text-ink-faint" />
                <span className="max-w-[80px] truncate text-ink-faint">{cl.title}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/15">
                  <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${p}%` }} />
                </div>
                <span className="tabular-nums text-ink-faint">{p}%</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px]">
          {item.due_at && (
            <span className={cn('inline-flex items-center gap-1 font-medium', TONE_CLASS[tone])}>
              <CalendarClock size={12} />
              {tone === 'overdue' ? `⚠ ${formatDate(item.due_at, locale)}` : formatDate(item.due_at, locale)}
            </span>
          )}
          {attachCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-ink-faint">
              <Paperclip size={12} /> {attachCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-ink-faint">
              <MessageSquare size={12} /> {commentCount}
            </span>
          )}
        </div>
        {item.assignees && item.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {item.assignees.slice(0, 4).map((p) => (
              <Avatar
                key={p.id}
                name={p.name}
                src={p.avatar_url}
                id={p.id}
                size={22}
                className="ring-2 ring-surface-raised"
              />
            ))}
          </div>
        )}
      </div>
      <span className="sr-only">{t('common.edit')}</span>
    </button>
  );
}
