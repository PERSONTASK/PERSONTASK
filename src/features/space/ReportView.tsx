import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CalendarRange, CheckCircle2, FileSpreadsheet, FileText, Settings2, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { useSpace } from '@/contexts/SpaceContext';
import { Spinner } from '@/components/Spinner';
import { BarsH, BarsV, Donut, Kpi, Panel, paletteColor, type Slice } from '@/components/Charts';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import { effectiveSchedule } from '@/lib/schedule';
import { exportReportToPdf, exportReportToXlsx, type ExportReport } from '@/lib/exportTable';
import {
  buildBuckets,
  describeRange,
  inRange,
  PERIOD_KINDS,
  referenceDate,
  resolveRange,
  type Bucket,
  type Period,
} from '@/lib/period';
import { cn } from '@/lib/utils';
import { ItemDetail } from './ItemDetail';
import { ReportConfigDialog } from './ReportConfigDialog';
import type { Board, Column, ColumnRole, Item, ReportConfig } from '@/types';

type Tab = 'funnel' | 'tasks';

const ROLE_COLOR: Record<ColumnRole, string> = {
  open: '#3B82F6',
  won: '#10B981',
  lost: '#EF4444',
  ignore: '#64748B',
};

// ── Cálculo (separado da tela, para a exportação usar os MESMOS números) ──

interface FunnelData {
  open: Item[];
  won: Item[];
  lost: Item[];
  openValue: number;
  wonValue: number;
  lostValue: number;
  ticket: number;
  conversion: number | null;
  byStage: { label: string; value: number; count: number; color: string }[];
  months: { label: string; value: number }[];
  /** Negócios ganhos sem data — ficam fora do gráfico de evolução. */
  undated: number;
  owners: { label: string; value: number; count: number }[];
  top: Item[];
  valueOf: (item: Item) => number;
}

function buildFunnel(
  items: Item[],
  columns: Column[],
  config: ReportConfig,
  buckets: Bucket[],
  noOwnerLabel: string,
): FunnelData {
  const roleOf = (columnId: string): ColumnRole => config.columnRoles[columnId] ?? 'open';
  const valueOf = (item: Item): number => {
    const fv = (item.field_values ?? []).find((v) => v.field_def_id === config.valueFieldId);
    const n = Number(fv?.value);
    return Number.isFinite(n) ? n : 0;
  };

  const counted = items.filter((i) => roleOf(i.column_id) !== 'ignore');
  const open = counted.filter((i) => roleOf(i.column_id) === 'open');
  const won = counted.filter((i) => roleOf(i.column_id) === 'won');
  const lost = counted.filter((i) => roleOf(i.column_id) === 'lost');
  const sum = (list: Item[]) => list.reduce((s, i) => s + valueOf(i), 0);

  const closed = won.length + lost.length;

  const byStage = columns
    .filter((c) => roleOf(c.id) !== 'ignore')
    .map((c) => {
      const inCol = counted.filter((i) => i.column_id === c.id);
      const role = roleOf(c.id);
      return {
        label: c.title,
        value: sum(inCol),
        count: inCol.length,
        color: role === 'open' ? c.color || ROLE_COLOR.open : ROLE_COLOR[role],
      };
    });

  // Ganhos ao longo do tempo, na granularidade do período escolhido.
  const months = buckets.map((b) => ({ label: b.label, value: 0 }));
  let undated = 0;
  for (const deal of won) {
    const ms = referenceDate(deal);
    const slot = ms === null ? -1 : buckets.findIndex((b) => ms >= b.from && ms <= b.to);
    if (slot >= 0) months[slot].value += valueOf(deal);
    else undated += 1;
  }

  const ownerMap = new Map<string, { label: string; value: number; count: number }>();
  for (const deal of open) {
    const people = deal.assignees?.length ? deal.assignees : [{ id: '—', name: noOwnerLabel }];
    for (const p of people) {
      const cur = ownerMap.get(p.id) ?? { label: p.name, value: 0, count: 0 };
      cur.value += valueOf(deal);
      cur.count += 1;
      ownerMap.set(p.id, cur);
    }
  }

  return {
    open,
    won,
    lost,
    openValue: sum(open),
    wonValue: sum(won),
    lostValue: sum(lost),
    ticket: won.length ? sum(won) / won.length : 0,
    conversion: closed ? Math.round((won.length / closed) * 100) : null,
    byStage,
    months,
    undated,
    owners: [...ownerMap.values()].sort((a, b) => b.value - a.value),
    top: [...open].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 8),
    valueOf,
  };
}

interface TasksData {
  onTime: Item[];
  soon: Item[];
  overdue: Item[];
  done: Item[];
  noDate: Item[];
  byColumn: { label: string; value: number }[];
  owners: { label: string; value: number }[];
}

function buildTasks(items: Item[], columnById: Map<string, Column>, noOwnerLabel: string): TasksData {
  const done = items.filter((i) => i.done_at);
  const live = items.filter((i) => !i.done_at);
  const withDate = live.filter((i) => effectiveSchedule(i).end);

  const columnMap = new Map<string, number>();
  const ownerMap = new Map<string, { label: string; value: number }>();
  const overdue = withDate.filter((i) => effectiveSchedule(i).status === 'red');

  for (const i of overdue) {
    const title = columnById.get(i.column_id)?.title ?? '—';
    columnMap.set(title, (columnMap.get(title) ?? 0) + 1);
    const people = i.assignees?.length ? i.assignees : [{ id: '—', name: noOwnerLabel }];
    for (const p of people) {
      const cur = ownerMap.get(p.id) ?? { label: p.name, value: 0 };
      cur.value += 1;
      ownerMap.set(p.id, cur);
    }
  }

  return {
    done,
    overdue: [...overdue].sort(
      (a, b) =>
        new Date(effectiveSchedule(a).end ?? 0).getTime() - new Date(effectiveSchedule(b).end ?? 0).getTime(),
    ),
    soon: withDate.filter((i) => effectiveSchedule(i).status === 'yellow'),
    onTime: withDate.filter((i) => effectiveSchedule(i).status === 'green'),
    noDate: live.filter((i) => !effectiveSchedule(i).end),
    byColumn: [...columnMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    owners: [...ownerMap.values()].sort((a, b) => b.value - a.value),
  };
}

// ── Tela ──────────────────────────────────────────────────────────────────

/**
 * Relatório do Painel — terceira visão, ao lado de Quadro e Lista.
 *
 *  • **Funil**: precisa da configuração do Painel (qual campo é o valor do
 *    negócio e o que cada Coluna significa). Sem ela não há como calcular
 *    "ganho" nem taxa de conversão, então a aba convida a configurar.
 *  • **Tarefas**: prazos. Serve para qualquer Painel, sem configuração.
 *
 * Tudo é calculado no cliente, a partir dos itens que já vêm do Painel —
 * nenhuma consulta nova, nenhum número gravado. A exportação usa os mesmos
 * cálculos da tela (`buildFunnel` / `buildTasks`), então o arquivo nunca
 * diverge do que está sendo visto.
 */
export function ReportView({
  board,
  query,
  canConfigure,
  onBoardChanged,
}: {
  board: Board;
  query: string;
  canConfigure: boolean;
  onBoardChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'pt-BR';
  const { space, fieldDefs, profileMap, labelMap } = useSpace();
  const currency = space?.currency || DEFAULT_CURRENCY;
  const money = (v: number) => formatMoney(v, currency, locale);
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(locale) : '—');

  const [columns, setColumns] = useState<Column[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(board.report_config?.valueFieldId ? 'funnel' : 'tasks');
  const [configOpen, setConfigOpen] = useState(false);
  const [period, setPeriod] = useState<Period>({ kind: 'all' });
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  async function reload() {
    const cols = await api.columns.list(board.id);
    const raw = await api.items.listByBoard(cols.map((c) => c.id));
    setColumns(cols);
    setItems(raw.map((r) => api.items.hydrate(r, profileMap, labelMap)));
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => void 0)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, profileMap, labelMap]);

  const range = useMemo(() => resolveRange(period), [period]);
  const buckets = useMemo(() => buildBuckets(range, locale), [range, locale]);

  /** A busca da barra superior e o período filtram o relatório juntos. */
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!term || `${i.title} ${i.description ?? ''}`.toLowerCase().includes(term)) &&
        inRange(i, range),
    );
  }, [items, query, range]);

  /** Cards sem data, que um período ativo deixa de fora. */
  const outOfPeriod = useMemo(
    () => (range ? items.filter((i) => referenceDate(i) === null).length : 0),
    [items, range],
  );

  const config = board.report_config ?? null;
  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const funnel = useMemo(
    () =>
      config?.valueFieldId
        ? buildFunnel(visible, columns, config, buckets, t('report.noOwner'))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, columns, config, buckets],
  );

  const tasks = useMemo(
    () => buildTasks(visible, columnById, t('report.noOwner')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, columnById],
  );

  const canExport = tab === 'tasks' || !!funnel;

  function buildExport(): ExportReport {
    if (tab === 'funnel' && funnel) {
      return {
        title: `${t('report.tab_funnel')} — ${board.name}`,
        fileName: `relatorio-funil-${board.name}`,
        blocks: [
          {
            heading: t('report.summary'),
            headers: [t('report.indicator'), t('report.value')],
            rows: [
              [t('report.periodLabel'), describeRange(range, locale, t('report.period_all'))],
              [t('report.openValue'), money(funnel.openValue)],
              [t('report.wonValue'), money(funnel.wonValue)],
              [t('report.lostValue'), money(funnel.lostValue)],
              [t('report.ticket'), money(funnel.ticket)],
              [t('report.conversionRate'), funnel.conversion === null ? '—' : `${funnel.conversion}%`],
              [t('report.open'), funnel.open.length],
              [t('report.won'), funnel.won.length],
              [t('report.lost'), funnel.lost.length],
            ],
          },
          {
            heading: t('report.byStage'),
            headers: [t('schedule.col_phase'), t('report.value'), t('report.dealCount', { count: 2 })],
            rows: funnel.byStage.map((s) => [s.label, money(s.value), s.count]),
          },
          {
            heading: t('report.wonOverTime'),
            headers: [t('report.month'), t('report.value')],
            rows: funnel.months.map((m) => [m.label, money(m.value)]),
          },
          {
            heading: t('report.byOwner'),
            headers: [t('schedule.col_assignees'), t('report.value'), t('report.dealCount', { count: 2 })],
            rows: funnel.owners.map((o) => [o.label, money(o.value), o.count]),
          },
          {
            heading: t('report.topOpen'),
            headers: [t('schedule.col_task'), t('crm.organization'), t('report.value')],
            rows: funnel.top.map((i) => [i.title, i.organization?.name ?? '—', money(funnel.valueOf(i))]),
          },
        ],
      };
    }

    return {
      title: `${t('report.tab_tasks')} — ${board.name}`,
      fileName: `relatorio-tarefas-${board.name}`,
      blocks: [
        {
          heading: t('report.summary'),
          headers: [t('report.indicator'), t('report.value')],
          rows: [
            [t('report.periodLabel'), describeRange(range, locale, t('report.period_all'))],
            [t('report.onTime'), tasks.onTime.length],
            [t('report.dueSoon'), tasks.soon.length],
            [t('report.overdue'), tasks.overdue.length],
            [t('report.doneCount'), tasks.done.length],
            [t('report.noDate'), tasks.noDate.length],
          ],
        },
        {
          heading: t('report.overdueByColumn'),
          headers: [t('schedule.col_phase'), t('report.overdue')],
          rows: tasks.byColumn.map((c) => [c.label, c.value]),
        },
        {
          heading: t('report.overdueByOwner'),
          headers: [t('schedule.col_assignees'), t('report.overdue')],
          rows: tasks.owners.map((o) => [o.label, o.value]),
        },
        {
          heading: t('report.overdueList'),
          headers: [t('schedule.col_task'), t('schedule.col_phase'), t('item.dueDate')],
          rows: tasks.overdue.map((i) => [
            i.title,
            columnById.get(i.column_id)?.title ?? '—',
            fmtDate(effectiveSchedule(i).end),
          ]),
        },
      ],
    };
  }

  async function doExport(kind: 'xlsx' | 'pdf') {
    setExporting(kind);
    try {
      const report = buildExport();
      if (kind === 'xlsx') await exportReportToXlsx(report);
      else await exportReportToPdf(report);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Abas do relatório, exportação e configuração */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex gap-0.5 rounded-lg bg-surface-base p-0.5 shadow-card">
          {(['funnel', 'tasks'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                tab === v ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {v === 'funnel' ? <Target size={13} /> : <CheckCircle2 size={13} />}
              {t(`report.tab_${v}`)}
            </button>
          ))}
        </div>

        {/* Período de exibição */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-base p-0.5 shadow-card">
          <CalendarRange size={14} className="ml-1.5 shrink-0 text-ink-faint" />
          {PERIOD_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setPeriod((p) => (p.kind === k ? p : { kind: k }))}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-semibold transition',
                period.kind === k ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {t(`report.period_${k}`)}
            </button>
          ))}
        </div>

        {period.kind === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="field w-[150px] py-1 text-xs"
              value={period.from ?? ''}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value || null }))}
            />
            <span className="text-xs text-ink-faint">→</span>
            <input
              type="date"
              className="field w-[150px] py-1 text-xs"
              value={period.to ?? ''}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value || null }))}
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() => doExport('xlsx')}
            disabled={exporting !== null || !canExport}
          >
            {exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet size={15} />} {t('schedule.exportExcel')}
          </button>
          <button
            className="btn-secondary"
            onClick={() => doExport('pdf')}
            disabled={exporting !== null || !canExport}
          >
            {exporting === 'pdf' ? <Spinner /> : <FileText size={15} />} {t('schedule.exportPdf')}
          </button>
          {canConfigure && (
            <button className="btn-secondary" onClick={() => setConfigOpen(true)}>
              <Settings2 size={15} /> {t('report.configure')}
            </button>
          )}
        </div>
      </div>

      {/* O período esconde cards sem data — dizer isso evita número "errado" */}
      {range && outOfPeriod > 0 && (
        <p className="mx-4 mb-2 rounded-lg bg-surface-base px-3 py-1.5 text-[11px] text-ink-soft shadow-card">
          {describeRange(range, locale)} · {t('report.outOfPeriod', { count: outOfPeriod })}
        </p>
      )}

      <div className="flex-1 overflow-auto px-4 pb-6">
        {loading ? (
          <div className="flex justify-center py-20 text-brand-indigo">
            <Spinner className="h-7 w-7" />
          </div>
        ) : tab === 'funnel' ? (
          funnel ? (
            <FunnelReport data={funnel} money={money} onOpenItem={setOpenItemId} />
          ) : (
            <NotConfigured onConfigure={canConfigure ? () => setConfigOpen(true) : undefined} />
          )
        ) : (
          <TasksReport
            data={tasks}
            columnById={columnById}
            fmtDate={fmtDate}
            onOpenItem={setOpenItemId}
          />
        )}
      </div>

      {configOpen && (
        <ReportConfigDialog
          board={board}
          columns={columns}
          numberFields={fieldDefs.filter((f) => f.type === 'number')}
          onClose={() => setConfigOpen(false)}
          onSaved={() => {
            setConfigOpen(false);
            setTab('funnel');
            onBoardChanged();
          }}
        />
      )}

      {openItemId && (
        <ItemDetail
          itemId={openItemId}
          onClose={() => setOpenItemId(null)}
          onChanged={() => reload().catch(() => void 0)}
        />
      )}
    </div>
  );
}

function NotConfigured({ onConfigure }: { onConfigure?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-line/10 bg-surface-base p-8 text-center shadow-card">
      <Target size={34} className="mx-auto text-ink-faint" />
      <p className="mt-3 text-sm font-semibold">{t('report.notConfigured')}</p>
      <p className="mt-1 text-xs text-ink-soft">{t('report.notConfiguredHint')}</p>
      {onConfigure && (
        <button className="btn-primary mx-auto mt-4" onClick={onConfigure}>
          <Settings2 size={15} /> {t('report.configure')}
        </button>
      )}
    </div>
  );
}

function FunnelReport({
  data,
  money,
  onOpenItem,
}: {
  data: FunnelData;
  money: (v: number) => string;
  onOpenItem: (id: string) => void;
}) {
  const { t } = useTranslation();

  const stageSlices: Slice[] = data.byStage.map((s) => ({
    label: s.label,
    value: s.value,
    color: s.color,
    display: `${money(s.value)} · ${s.count}`,
  }));

  const ownerSlices: Slice[] = data.owners.map((o) => ({
    label: o.label,
    value: o.value,
    display: `${money(o.value)} · ${o.count}`,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('report.openValue')} value={money(data.openValue)} note={t('report.dealCount', { count: data.open.length })} />
        <Kpi label={t('report.wonValue')} value={money(data.wonValue)} note={t('report.dealCount', { count: data.won.length })} tone="good" />
        <Kpi label={t('report.lostValue')} value={money(data.lostValue)} note={t('report.dealCount', { count: data.lost.length })} tone="bad" />
        <Kpi
          label={t('report.ticket')}
          value={money(data.ticket)}
          note={data.conversion === null ? t('report.noClosed') : t('report.conversionNote', { value: data.conversion })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('report.byStage')} subtitle={t('report.byStageHint')}>
          <BarsH data={stageSlices} emptyLabel={t('report.empty')} />
        </Panel>

        <Panel title={t('report.conversion')} subtitle={t('report.conversionHint')}>
          <Donut
            centerLabel={t('report.conversionRate')}
            centerValue={data.conversion === null ? '—' : `${data.conversion}%`}
            data={[
              { label: t('report.won'), value: data.won.length, color: ROLE_COLOR.won, display: String(data.won.length) },
              { label: t('report.lost'), value: data.lost.length, color: ROLE_COLOR.lost, display: String(data.lost.length) },
              { label: t('report.open'), value: data.open.length, color: ROLE_COLOR.open, display: String(data.open.length) },
            ]}
          />
        </Panel>

        <Panel
          title={t('report.wonOverTime')}
          subtitle={data.undated > 0 ? t('report.undated', { count: data.undated }) : t('report.wonOverTimeHint')}
        >
          <BarsV
            data={data.months.map((m) => ({ label: m.label, value: m.value, display: m.value ? money(m.value) : '' }))}
            emptyLabel={t('report.empty')}
          />
        </Panel>

        <Panel title={t('report.byOwner')} subtitle={t('report.byOwnerHint')}>
          <BarsH data={ownerSlices} emptyLabel={t('report.empty')} />
        </Panel>
      </div>

      <Panel title={t('report.topOpen')} subtitle={t('report.topOpenHint')}>
        <ItemList
          items={data.top}
          right={(i) => money(data.valueOf(i))}
          onOpenItem={onOpenItem}
          emptyLabel={t('report.empty')}
        />
      </Panel>
    </div>
  );
}

function TasksReport({
  data,
  columnById,
  fmtDate,
  onOpenItem,
}: {
  data: TasksData;
  columnById: Map<string, Column>;
  fmtDate: (iso?: string | null) => string;
  onOpenItem: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={t('report.onTime')} value={String(data.onTime.length)} tone="good" />
        <Kpi label={t('report.dueSoon')} value={String(data.soon.length)} tone="warn" note={t('report.dueSoonNote')} />
        <Kpi label={t('report.overdue')} value={String(data.overdue.length)} tone="bad" />
        <Kpi label={t('report.doneCount')} value={String(data.done.length)} />
        <Kpi label={t('report.noDate')} value={String(data.noDate.length)} note={t('report.noDateNote')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('report.overdueByColumn')} subtitle={t('report.overdueByColumnHint')}>
          <BarsH
            data={data.byColumn.map((c, i) => ({ ...c, color: paletteColor(i) }))}
            emptyLabel={t('report.noOverdue')}
          />
        </Panel>
        <Panel title={t('report.overdueByOwner')} subtitle={t('report.overdueByOwnerHint')}>
          <BarsH data={data.owners} emptyLabel={t('report.noOverdue')} />
        </Panel>
      </div>

      <Panel title={t('report.overdueList')} subtitle={t('report.overdueListHint')}>
        <ItemList
          items={data.overdue}
          right={(i) => fmtDate(effectiveSchedule(i).end)}
          rightTone="bad"
          subtitle={(i) => columnById.get(i.column_id)?.title}
          onOpenItem={onOpenItem}
          emptyLabel={t('report.noOverdue')}
        />
      </Panel>
    </div>
  );
}

/** Lista clicável usada pelos dois relatórios. */
function ItemList({
  items,
  right,
  rightTone,
  subtitle,
  onOpenItem,
  emptyLabel,
}: {
  items: Item[];
  right: (item: Item) => string;
  rightTone?: 'bad';
  subtitle?: (item: Item) => string | undefined;
  onOpenItem: (id: string) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-faint">{emptyLabel}</p>;
  }
  return (
    <div className="divide-y divide-line/10">
      {items.map((item) => {
        const sub = subtitle?.(item) ?? item.organization?.name;
        return (
          <button
            key={item.id}
            onClick={() => onOpenItem(item.id)}
            className="flex w-full items-center gap-3 py-2 text-left transition hover:bg-line/5"
          >
            <BarChart3 size={13} className="shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{item.title}</span>
              {sub && <span className="block truncate text-[11px] text-ink-faint">{sub}</span>}
            </span>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                rightTone === 'bad' ? 'text-red-500' : 'text-ink',
              )}
            >
              {right(item)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
