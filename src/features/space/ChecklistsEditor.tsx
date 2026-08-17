import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import type { Checklist } from '@/types';
import { cn } from '@/lib/utils';

export function checklistPct(cl: Checklist): number {
  const total = cl.items.length;
  return total ? Math.round((cl.items.filter((i) => i.done).length / total) * 100) : 0;
}

export function ChecklistsEditor({
  checklists,
  disabled,
  onChange,
}: {
  checklists: Checklist[];
  disabled?: boolean;
  onChange: (next: Checklist[]) => void;
}) {
  const { t } = useTranslation();
  const editCl = (id: string, patch: Partial<Checklist>) =>
    onChange(checklists.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-4">
      {checklists.map((cl) => {
        const p = checklistPct(cl);
        return (
          <div key={cl.id} className="rounded-lg border border-line/10 bg-surface-raised p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                className="flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-bold outline-none focus:bg-surface-overlay"
                value={cl.title}
                disabled={disabled}
                placeholder={t('checklist.title')}
                onChange={(e) => editCl(cl.id, { title: e.target.value })}
              />
              {!disabled && (
                <button
                  className="text-ink-faint hover:text-red-500"
                  title={t('checklist.remove')}
                  onClick={() => onChange(checklists.filter((c) => c.id !== cl.id))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="mb-2 flex items-center gap-2">
              <span className="w-9 text-xs font-semibold tabular-nums text-ink-soft">{p}%</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/15">
                <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${p}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              {cl.items.map((it) => (
                <div key={it.id} className="group flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand-indigo"
                    checked={it.done}
                    disabled={disabled}
                    onChange={() =>
                      editCl(cl.id, { items: cl.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)) })
                    }
                  />
                  <span className={cn('flex-1 text-sm', it.done && 'text-ink-faint line-through')}>{it.text}</span>
                  {!disabled && (
                    <button
                      className="text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      onClick={() => editCl(cl.id, { items: cl.items.filter((x) => x.id !== it.id) })}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!disabled && (
              <input
                className="field mt-2 py-1 text-sm"
                placeholder={t('checklist.addItem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    editCl(cl.id, {
                      items: [...cl.items, { id: crypto.randomUUID(), text: e.currentTarget.value.trim(), done: false }],
                    });
                    e.currentTarget.value = '';
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
