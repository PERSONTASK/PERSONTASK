import type { Item } from '@/types';
import { effectiveSchedule } from './schedule';

/**
 * Período de exibição dos relatórios.
 *
 * Um card entra no período pela sua **data de referência**: a data em que
 * foi concluído e, na falta dela, o Término. É a data que responde "quando
 * isso aconteceu" tanto para um negócio ganho quanto para uma tarefa.
 */

export type PeriodKind = 'all' | 'week' | 'month' | 'year' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Só em `custom`, no formato YYYY-MM-DD. */
  from?: string | null;
  to?: string | null;
}

export const PERIOD_KINDS: PeriodKind[] = ['all', 'week', 'month', 'year', 'custom'];

export const DEFAULT_PERIOD: Period = { kind: 'all' };

/** Intervalo em milissegundos; `null` quando o período é "tudo". */
export interface Range {
  from: number;
  to: number;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

/** Resolve o período numa faixa de datas. `null` = sem filtro. */
export function resolveRange(period: Period, now: Date = new Date()): Range | null {
  switch (period.kind) {
    case 'week': {
      // Semana começando na segunda-feira.
      const start = new Date(now);
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case 'custom': {
      if (!period.from && !period.to) return null;
      const from = period.from ? startOfDay(new Date(`${period.from}T12:00:00`)) : -Infinity;
      const to = period.to ? endOfDay(new Date(`${period.to}T12:00:00`)) : Infinity;
      return { from, to };
    }
    default:
      return null;
  }
}

/** Data que posiciona o card no tempo: conclusão e, na falta, Término. */
export function referenceDate(item: Item): number | null {
  const iso = item.done_at ?? effectiveSchedule(item).end;
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** true se o card cai no período (sem período, tudo cai). */
export function inRange(item: Item, range: Range | null): boolean {
  if (!range) return true;
  const ms = referenceDate(item);
  if (ms === null) return false;
  return ms >= range.from && ms <= range.to;
}

export interface Bucket {
  label: string;
  from: number;
  to: number;
}

/**
 * Colunas do gráfico de evolução, com a granularidade que couber:
 * até 2 semanas por dia, até ~3 meses por semana, acima disso por mês.
 * Sem período definido, mostra os últimos 6 meses.
 */
export function buildBuckets(range: Range | null, locale = 'pt-BR', now: Date = new Date()): Bucket[] {
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    const out: Bucket[] = [];
    for (let back = 5; back >= 0; back -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 0);
      out.push({
        label: start.toLocaleDateString(locale, { month: 'short' }),
        from: startOfDay(start),
        to: endOfDay(end),
      });
    }
    return out;
  }

  const days = Math.round((range.to - range.from) / 86_400_000) + 1;
  const out: Bucket[] = [];

  if (days <= 14) {
    const cursor = new Date(range.from);
    while (cursor.getTime() <= range.to && out.length < 40) {
      out.push({
        label: cursor.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
        from: startOfDay(cursor),
        to: endOfDay(cursor),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  if (days <= 92) {
    const cursor = new Date(range.from);
    while (cursor.getTime() <= range.to && out.length < 40) {
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      out.push({
        label: cursor.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
        from: startOfDay(cursor),
        to: Math.min(endOfDay(end), range.to),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return out;
  }

  const cursor = new Date(new Date(range.from).getFullYear(), new Date(range.from).getMonth(), 1);
  while (cursor.getTime() <= range.to && out.length < 40) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    out.push({
      label: cursor.toLocaleDateString(locale, { month: 'short' }),
      from: startOfDay(cursor),
      to: endOfDay(end),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Texto do período para o cabeçalho das exportações. */
export function describeRange(range: Range | null, locale = 'pt-BR', allLabel = '—'): string {
  if (!range) return allLabel;
  const fmt = (ms: number) =>
    Number.isFinite(ms) ? new Date(ms).toLocaleDateString(locale) : '…';
  return `${fmt(range.from)} → ${fmt(range.to)}`;
}
