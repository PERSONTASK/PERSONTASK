import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CustomFieldDef, FieldType } from '@/types';

const TYPES: FieldType[] = ['text', 'number', 'datetime', 'checkbox', 'select'];

export function FieldsManager({
  spaceId,
  fieldDefs,
  onChanged,
}: {
  spaceId: string;
  fieldDefs: CustomFieldDef[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('text');

  async function add() {
    if (!name.trim()) return;
    await api.fields.createDef({
      space_id: spaceId,
      name: name.trim(),
      type,
      config: type === 'select' ? { options: [] } : {},
      show_on_face_default: false,
      position: fieldDefs.length,
    });
    setName('');
    setType('text');
    await onChanged();
  }

  async function remove(def: CustomFieldDef) {
    if (!confirm(`${t('common.delete')} "${def.name}"?`)) return;
    await api.fields.removeDef(def.id);
    await onChanged();
  }

  async function addOption(def: CustomFieldDef, option: string) {
    if (!option.trim()) return;
    const options = [...(def.config.options ?? []), option.trim()];
    await api.fields.updateDef(def.id, { config: { ...def.config, options } });
    await onChanged();
  }

  async function removeOption(def: CustomFieldDef, idx: number) {
    const options = (def.config.options ?? []).filter((_, i) => i !== idx);
    await api.fields.updateDef(def.id, { config: { ...def.config, options } });
    await onChanged();
  }

  async function toggleFace(def: CustomFieldDef) {
    await api.fields.updateDef(def.id, { show_on_face_default: !def.show_on_face_default });
    await onChanged();
  }

  return (
    <div className="space-y-3">
      {fieldDefs.map((def) => (
        <div key={def.id} className="rounded-lg border border-line/10 bg-surface-raised p-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-semibold">{def.name}</span>
            <span className="rounded-full bg-brand-indigo/10 px-2 py-0.5 text-[10px] font-bold text-brand-indigo">
              {t(`fields.${def.type}`)}
            </span>
            <label className="flex items-center gap-1 text-[11px] text-ink-soft">
              <input
                type="checkbox"
                className="accent-brand-indigo"
                checked={def.show_on_face_default}
                onChange={() => toggleFace(def)}
              />
              {t('item.showOnFace')}
            </label>
            <button className="text-ink-faint hover:text-red-500" onClick={() => remove(def)}>
              <Trash2 size={14} />
            </button>
          </div>

          {def.type === 'select' && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {(def.config.options ?? []).map((o, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-full bg-line/10 px-2 py-0.5 text-xs"
                  >
                    {o}
                    <button onClick={() => removeOption(def, i)} className="text-ink-faint hover:text-red-500">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                className="field mt-1.5 py-1 text-xs"
                placeholder={t('fields.addOption')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addOption(def, e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex items-end gap-2 rounded-lg border border-dashed border-line/15 p-3">
        <div className="flex-1">
          <label className="label">{t('fields.fieldName')}</label>
          <input className="field mt-1 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('fields.fieldType')}</label>
          <select className="field mt-1 py-1.5" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`fields.${ty}`)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={add} disabled={!name.trim()}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
