import type { ChecklistValue, CustomFieldDef, ItemFieldValue } from '@/types';
import { formatDate } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

/**
 * Human-readable representation of a custom field value (for the Item face
 * & detail). Campo numérico marcado como moeda sai formatado na moeda do
 * Espaço (`R$ 41.150,00`).
 */
export function formatFieldValue(
  def: CustomFieldDef,
  fv: ItemFieldValue | undefined,
  locale = 'pt',
  currency?: string,
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
      return def.config.money
        ? formatMoney(fv.value as number, currency, locale)
        : Number(fv.value).toLocaleString(locale);
    case 'select':
    case 'text':
    default:
      return String(fv.value);
  }
}
