import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Gráficos simples em SVG puro, no estilo do Gantt do cronograma.
 * Sem biblioteca de gráficos: são poucas formas, e assim o bundle não
 * engorda ~100 KB por causa de duas telas.
 */

export interface Slice {
  label: string;
  value: number;
  /** Cor da barra/fatia. Cai no gradiente da marca quando ausente. */
  color?: string;
  /** Texto pronto para o rótulo (ex.: já formatado como moeda). */
  display?: string;
}

const BRAND = ['#6366F1', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#64748B'];

export function paletteColor(i: number): string {
  return BRAND[i % BRAND.length];
}

/** Cartão de indicador: rótulo em cima, número grande, nota embaixo. */
export function Kpi({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    neutral: 'text-ink',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
  }[tone];

  return (
    <div className="rounded-xl border border-line/10 bg-surface-raised p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', toneClass)}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-ink-soft">{note}</p>}
    </div>
  );
}

/**
 * Barras horizontais — boas para listas com nomes compridos (etapas,
 * responsáveis). Cada linha mostra o rótulo, a barra e o valor.
 */
export function BarsH({ data, emptyLabel }: { data: Slice[]; emptyLabel: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <Empty label={emptyLabel} />;

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex items-center gap-2 text-xs">
          <span className="w-[34%] shrink-0 truncate text-ink-soft" title={d.label}>
            {d.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-line/10">
            <div
              className="h-full rounded-md transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? paletteColor(i) }}
            />
          </div>
          <span className="w-[22%] shrink-0 text-right font-semibold tabular-nums text-ink">
            {d.display ?? d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Barras verticais — para séries no tempo (ganhos por mês). Desenhadas em
 * SVG para o rótulo caber certinho em cima de cada barra.
 */
export function BarsV({ data, emptyLabel }: { data: Slice[]; emptyLabel: string }) {
  if (data.length === 0) return <Empty label={emptyLabel} />;
  const max = Math.max(1, ...data.map((d) => d.value));

  // Em HTML, não SVG: texto em SVG esticado por `preserveAspectRatio`
  // sai distorcido, e aqui o rótulo precisa ficar legível.
  return (
    <div className="flex h-[185px] items-stretch gap-2">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold tabular-nums text-ink-soft">
            {d.display ?? d.value.toLocaleString()}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                background: d.color ?? paletteColor(0),
              }}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-ink-faint" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Rosca para proporções (ganho × perdido × aberto). */
export function Donut({ data, centerLabel, centerValue }: { data: Slice[]; centerLabel: string; centerValue: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-[132px] w-[132px] shrink-0 -rotate-90">
        <circle cx={50} cy={50} r={R} fill="none" strokeWidth={14} className="stroke-line/15" />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={`${d.label}-${i}`}
                cx={50}
                cy={50}
                r={R}
                fill="none"
                strokeWidth={14}
                stroke={d.color ?? paletteColor(i)}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{centerLabel}</p>
        <p className="mb-2 text-xl font-bold tabular-nums">{centerValue}</p>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: d.color ?? paletteColor(i) }}
            />
            <span className="flex-1 truncate text-ink-soft">{d.label}</span>
            <span className="font-semibold tabular-nums">{d.display ?? d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Moldura padrão de cada bloco do relatório. */
export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-line/10 bg-surface-raised p-4', className)}>
      <h3 className="text-sm font-bold">{title}</h3>
      {subtitle && <p className="mb-3 mt-0.5 text-[11px] text-ink-faint">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-xs text-ink-faint">{label}</p>;
}
