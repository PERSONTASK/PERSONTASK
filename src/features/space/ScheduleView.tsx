import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useSpace } from '@/contexts/SpaceContext';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { effectiveSchedule, type EffectiveSchedule, type ScheduleStatus } from '@/lib/schedule';
import { exportToPdf, exportToXlsx } from '@/lib/exportTable';
import { ItemDetail } from './ItemDetail';
import type { Column, Item } from '@/types';

const STATUS_EMOJI: Record<ScheduleStatus, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  none: '⚪',
};

const STATUS_CHIP: Record<ScheduleStatus, string> = {
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  yellow: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
  none: 'bg-line/10 text-ink-faint',
};

interface Row {
  n: number;
  item: Item;
  columnTitle: string;
  /** Números do card: consolidados das tarefas internas, ou os campos dele. */
  eff: EffectiveSchedule;
}

/**
 * Visão "Cronograma" do Painel: tabela estilo gerenciamento de projetos
 * (ID, EDT, duração, datas, % concluído x previsto, semáforo, trabalho,
 * custo, modo) com exportação para Excel e PDF.
 */
export function ScheduleView({
  boardId,
  boardName,
  query,
}: {
  boardId: string;
  boardName: string;
  query: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'pt-BR';
  const { space, profileMap, labelMap } = useSpace();

  const [columns, setColumns] = useState<Column[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  async function reload() {
    const cols = await api.columns.list(boardId);
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
  }, [boardId, profileMap, labelMap]);

  /** Linhas na ordem do quadro: por Coluna (fase) e, dentro dela, por posição. */
  const rows = useMemo<Row[]>(() => {
    const term = query.trim().toLowerCase();
    const out: Row[] = [];
    let n = 0;
    columns.forEach((col) => {
      const inCol = items
        .filter((i) => i.column_id === col.id)
        .sort((a, b) => a.position - b.position);
      inCol.forEach((item) => {
        if (term && !`${item.title} ${item.description ?? ''}`.toLowerCase().includes(term)) return;
        n += 1;
        out.push({
          n,
          item,
          columnTitle: col.title,
          eff: effectiveSchedule(item),
        });
      });
    });
    return out;
  }, [columns, items, query]);

  const totals = useMemo(
    () => rows.reduce((acc, r) => ({ cost: acc.cost + (r.eff.cost ?? 0) }), { cost: 0 }),
    [rows],
  );

  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(locale) : '—');
  /** Custo sai na moeda do Espaço: R$ 41.150,00. */
  const money = (v?: number | null) => formatMoney(v, space?.currency, locale);

  const headers = [
    t('schedule.col_id'),
    t('schedule.col_task'),
    t('schedule.col_phase'),
    t('schedule.col_duration'),
    t('schedule.col_start'),
    t('schedule.col_end'),
    t('schedule.col_status'),
    t('schedule.col_cost'),
    t('schedule.col_notes'),
  ];
  const STATUS_COLUMN = 6;

  function buildExport() {
    const statuses: ScheduleStatus[] = [];
    const body = rows.map((r) => {
      const st = r.eff.status;
      statuses.push(st);
      return [
        r.n,
        r.item.title,
        r.columnTitle,
        r.eff.duration ?? '—',
        fmtDate(r.eff.start),
        fmtDate(r.eff.end),
        `${STATUS_EMOJI[st]} ${t(`schedule.status_${st}`)}`,
        money(r.eff.cost),
        (r.item.description ?? '').replace(/\s+/g, ' ').slice(0, 140),
      ];
    });
    return {
      title: `${t('view.schedule')} — ${boardName}`,
      headers,
      rows: body,
      fileName: `lista-${boardName}`,
      statusColumn: STATUS_COLUMN,
      statuses,
    };
  }

  async function doExport(kind: 'xlsx' | 'pdf') {
    setExporting(kind);
    try {
      const table = buildExport();
      if (kind === 'xlsx') await exportToXlsx(table);
      else await exportToPdf(table);
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-brand-indigo">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <span className="rounded-full bg-surface-base px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft shadow-card">
          {t('schedule.taskCount', { count: rows.length })}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => doExport('xlsx')}
            disabled={exporting !== null || rows.length === 0}
          >
            {exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet size={15} />} {t('schedule.exportExcel')}
          </button>
          <button
            className="btn-secondary"
            onClick={() => doExport('pdf')}
            disabled={exporting !== null || rows.length === 0}
          >
            {exporting === 'pdf' ? <Spinner /> : <FileText size={15} />} {t('schedule.exportPdf')}
          </button>
        </div>
      </div>

      {/* Tabela — num cartão opaco, para não disputar com o fundo do Espaço */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {rows.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-line/10 bg-surface-base p-8 shadow-card">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <Download size={34} className="text-ink-faint" />
              <p className="text-sm text-ink-soft">{t('schedule.empty')}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line/10 bg-surface-base shadow-card">
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'whitespace-nowrap border-b border-line/15 bg-surface-raised px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft',
                      i === 1 && 'min-w-[240px]',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = r.eff.status;
                return (
                  <tr key={r.item.id} className="transition hover:bg-line/5">
                    <td className="border-b border-line/10 px-3 py-2 text-ink-faint">{r.n}</td>
                    <td className="border-b border-line/10 px-3 py-2">
                      <button
                        className="text-left font-medium hover:text-brand-indigo hover:underline"
                        onClick={() => setOpenItemId(r.item.id)}
                      >
                        {r.item.title}
                      </button>
                      {r.eff.fromTasks && (
                        <span className="ml-2 whitespace-nowrap rounded-full bg-brand-indigo/10 px-2 py-0.5 text-[10px] font-bold text-brand-indigo">
                          {t('schedule.taskCount', { count: r.eff.count })}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-line/10 px-3 py-2 text-xs text-ink-soft">
                      {r.columnTitle}
                    </td>
                    <td className="border-b border-line/10 px-3 py-2 text-ink-soft">
                      {r.eff.duration ?? '—'}
                    </td>
                    <td className="whitespace-nowrap border-b border-line/10 px-3 py-2 text-ink-soft">
                      {fmtDate(r.eff.start)}
                    </td>
                    <td className="whitespace-nowrap border-b border-line/10 px-3 py-2 text-ink-soft">
                      {fmtDate(r.eff.end)}
                    </td>
                    <td className="border-b border-line/10 px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold',
                          STATUS_CHIP[st],
                        )}
                      >
                        {STATUS_EMOJI[st]} {t(`schedule.status_${st}`)}
                      </span>
                    </td>
                    <td className="border-b border-line/10 px-3 py-2 tabular-nums text-ink-soft">
                      {money(r.eff.cost)}
                    </td>
                    <td className="max-w-[260px] border-b border-line/10 px-3 py-2 text-xs text-ink-faint">
                      <span className="line-clamp-2">{r.item.description || '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={7} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-ink-faint">
                  {t('schedule.totals')}
                </td>
                <td className="px-3 py-2 tabular-nums">{money(totals.cost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>

      {openItemId && (
        <ItemDetail
          itemId={openItemId}
          onClose={() => setOpenItemId(null)}
          onChanged={() => {
            reload().catch(() => void 0);
          }}
        />
      )}
    </div>
  );
}
