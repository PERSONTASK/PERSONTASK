import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import type { Label } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#6366F1', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#EF4444'];

export function LabelPicker({
  labels,
  selectedIds,
  canManage,
  disabled,
  onToggle,
  onCreate,
}: {
  labels: Label[];
  selectedIds: string[];
  canManage: boolean;
  disabled?: boolean;
  onToggle: (labelId: string) => void;
  onCreate: (name: string, color: string) => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const sel = selectedIds.includes(l.id);
          return (
            <button
              key={l.id}
              disabled={disabled}
              onClick={() => onToggle(l.id)}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50',
                sel ? 'ring-2' : 'opacity-70 hover:opacity-100',
              )}
              style={{
                background: `${l.color}22`,
                color: l.color,
                boxShadow: sel ? `0 0 0 2px ${l.color}` : undefined,
              }}
            >
              {sel && <Check size={12} />}
              {l.name}
            </button>
          );
        })}
        {canManage && !adding && (
          <button
            className="flex items-center gap-1 rounded-full border border-dashed border-line/25 px-2.5 py-1 text-xs text-ink-faint hover:border-brand-indigo/50 hover:text-brand-indigo"
            onClick={() => setAdding(true)}
          >
            <Plus size={12} /> {t('labels.add')}
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-2 rounded-lg border border-line/10 bg-surface-raised p-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('labels.namePlaceholder')}
            className="field flex-1 py-1"
          />
          <div className="flex gap-1">
            {COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn('h-5 w-5 rounded-full', color === c && 'ring-2 ring-ink')}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            className="btn-primary px-2 py-1 text-xs"
            onClick={() => {
              if (name.trim()) onCreate(name.trim(), color);
              setName('');
              setAdding(false);
            }}
          >
            {t('common.add')}
          </button>
        </div>
      )}
    </div>
  );
}
