import type { ChecklistValue, CustomFieldDef, ItemFieldValue } from '@/types';
import { formatDate } from '@/lib/utils';

/** Human-readable representation of a custom field value (for the Item face & detail). */
export function formatFieldValue(
  def: CustomFieldDef,
  fv: ItemFieldValue | undefined,
  locale = 'pt',
): string {
  if (def.type === 'checkbox') return fv?.value === true ? '✓' : '—';
  if (!fv || fv.value == null || fv.value === '') return '—';
  switch (def.type) {
    case 'datetime':
      return formatDate(String(fv.value), locale);
    case 'checklist': {
      const list = (fv.value as ChecklistValue) || [];
      const done = list.filter((c) => c.done).length;
      return `${done}/${list.length}`;
    }
    case 'number':
      return String(fv.value);
    case 'select':
    case 'text':
    default:
      return String(fv.value);
  }
}
