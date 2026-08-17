import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, X, Trash2 } from 'lucide-react';
import type { ChecklistValue, CustomFieldDef, ItemFieldValue } from '@/types';
import { cn } from '@/lib/utils';

type ChangeFn = (defId: string, value: unknown, showOnFace: boolean) => void;

export function CustomFieldsEditor({
  fieldDefs,
  valueMap,
  disabled,
  onChange,
  onDelete,
}: {
  fieldDefs: CustomFieldDef[];
  valueMap: Map<string, ItemFieldValue>;
  disabled?: boolean;
  onChange: ChangeFn;
  /** Excluir a definição do campo (do Espaço). Só aparece se fornecido. */
  onDelete?: (defId: string) => void;
}) {
  const { t } = useTranslation();
  if (fieldDefs.length === 0) return null;

  return (
    <div className="space-y-3">
      {fieldDefs.map((def) => {
        const fv = valueMap.get(def.id);
        const show = fv?.show_on_face ?? def.show_on_face_default;
        const set = (value: unknown) => onChange(def.id, value, show);
        const toggleFace = () => onChange(def.id, fv?.value ?? null, !show);

        return (
          <div key={def.id} className="rounded-lg border border-line/10 bg-surface-raised p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="label truncate">{def.name}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={toggleFace}
                  disabled={disabled}
                  title={t('item.showOnFace')}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    show ? 'text-brand-indigo' : 'text-ink-faint',
                  )}
                >
                  {show ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(def.id)}
                    title={t('fields.deleteField')}
                    className="rounded-md px-1 py-0.5 text-ink-faint hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <FieldInput def={def} fv={fv} disabled={disabled} onSet={set} />
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  def,
  fv,
  disabled,
  onSet,
}: {
  def: CustomFieldDef;
  fv: ItemFieldValue | undefined;
  disabled?: boolean;
  onSet: (value: unknown) => void;
}) {
  const { t } = useTranslation();

  switch (def.type) {
    case 'text':
      return (
        <input
          className="field"
          disabled={disabled}
          defaultValue={(fv?.value as string) ?? ''}
          onBlur={(e) => onSet(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className="field"
          disabled={disabled}
          defaultValue={(fv?.value as number) ?? ''}
          onBlur={(e) => onSet(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'datetime':
      return (
        <input
          type="date"
          className="field"
          disabled={disabled}
          defaultValue={(fv?.value as string) ?? ''}
          onChange={(e) => onSet(e.target.value)}
        />
      );
    case 'checkbox':
      return (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-indigo"
            disabled={disabled}
            checked={fv?.value === true}
            onChange={(e) => onSet(e.target.checked)}
          />
          <span className="text-ink-soft">{fv?.value === true ? t('common.yes') : t('common.no')}</span>
        </label>
      );
    case 'select':
      return (
        <select
          className="field"
          disabled={disabled}
          value={(fv?.value as string) ?? ''}
          onChange={(e) => onSet(e.target.value)}
        >
          <option value="">—</option>
          {(def.config.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'checklist': {
      const list = ((fv?.value as ChecklistValue) ?? []) as ChecklistValue;
      const update = (next: ChecklistValue) => onSet(next);
      return (
        <div className="space-y-1.5">
          {list.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.done}
                disabled={disabled}
                className="accent-brand-indigo"
                onChange={() =>
                  update(list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))
                }
              />
              <span className={cn('flex-1 text-sm', c.done && 'text-ink-faint line-through')}>
                {c.text}
              </span>
              {!disabled && (
                <button
                  className="text-ink-faint hover:text-red-500"
                  onClick={() => update(list.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <input
              className="field py-1 text-sm"
              placeholder={t('fields.addChecklistItem')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  update([...list, { text: e.currentTarget.value.trim(), done: false }]);
                  e.currentTarget.value = '';
                }
              }}
            />
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
