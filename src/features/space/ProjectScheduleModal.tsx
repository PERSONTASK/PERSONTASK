import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarCog,
  CopyPlus,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GanttChartSquare,
  Indent,
  Maximize2,
  Minimize2,
  Outdent,
  Plus,
  Table as TableIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import {
  addWorkingDays,
  performanceStatus,
  plannedFor,
  resourceIdsOf,
  autoSchedule,
  calendarOf,
  cloneTasks,
  computeWbs,
  isSummary,
  MAX_INDENT,
  rollupTasks,
  taskDuration,
  taskPlanned,
  taskStatus,
  workingDaysBetween,
  type ScheduleStatus,
} from '@/lib/schedule';
import { exportToPdf, exportToXlsx } from '@/lib/exportTable';
import { exportGanttToPdf } from '@/lib/exportGantt';
import { exportToProjectXml } from '@/lib/exportProjectXml';
import { CalendarDialog, ResourcesDialog } from './ScheduleDialogs';
import type { Item, Resource, ScheduleCalendar, ScheduleTask } from '@/types';

const DAY = 86_400_000;
const ROW_H = 30;
const HEADER_H = 38;
const LABEL_W = 260;

const STATUS_EMOJI: Record<ScheduleStatus, string> = { green: '🟢', yellow: '🟡', red: '🔴', none: '⚪' };

const BAR_COLORS: Record<ScheduleStatus, { bg: string; fill: string }> = {
  green: { bg: '#d1fae5', fill: '#10b981' },
  yellow: { bg: '#fef3c7', fill: '#f59e0b' },
  red: { bg: '#fee2e2', fill: '#ef4444' },
  none: { bg: '#e6e7f0', fill: '#9898b8' },
};

function dayStart(value: string | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toDateInput(iso?: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function newTask(indent = 1): ScheduleTask {
  return {
    id: crypto.randomUUID(),
    name: '',
    indent,
    start: null,
    end: null,
    progress: 0,
    work: null,
    cost: null,
    mode: 'manual',
    predecessors: [],
    notes: '',
  };
}

/**
 * Cronograma de um projeto (card): tabela editável de tarefas + gráfico de
 * Gantt com barras, setas de dependência e linha do "hoje". As tarefas são
 * salvas em `items.schedule_tasks` (JSONB), com autosave.
 */
export function ProjectScheduleModal({
  item,
  canEdit,
  userId,
  onClose,
  onPatch,
}: {
  item: Item;
  canEdit: boolean;
  userId: string;
  onClose: () => void;
  onPatch: (patch: Partial<Item>) => void;
}) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ScheduleTask[]>(item.schedule_tasks ?? []);
  const [tab, setTab] = useState<'table' | 'gantt'>('table');
  const [zoom, setZoom] = useState<'day' | 'week'>('day');
  /** Gantt mostrando a barra do previsto embaixo da do real. */
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | 'xml' | 'gantt' | null>(null);
  const [fullScreen, setFullScreen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [calendar, setCalendar] = useState<ScheduleCalendar>(calendarOf(item));
  const [focusId, setFocusId] = useState<string | null>(null);
  const firstRun = useRef(true);

  // Foca a tarefa recém-criada (Enter cria e já deixa o cursor nela).
  useEffect(() => {
    if (!focusId) return;
    const handle = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-cell="${focusId}|name"]`);
      el?.focus();
      el?.select();
      setFocusId(null);
    });
    return () => cancelAnimationFrame(handle);
  }, [focusId, tasks]);

  // Recursos do Espaço (para alocar nas tarefas e calcular custo).
  useEffect(() => {
    api.resources
      .list(item.space_id)
      .then(setResources)
      .catch(() => void 0);
  }, [item.space_id]);

  const rateById = useMemo(() => {
    const map = new Map<string, number | null>();
    resources.forEach((r) => map.set(r.id, r.hourly_cost));
    return map;
  }, [resources]);

  // Autosave (agrupa as digitações numa única gravação).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => {
      // O Início e o Término do card acompanham o cronograma: é o
      // "término previsto" do projeto, que aparece na face do card, nos
      // alertas de vencimento e na visão de portfólio. Fica em branco
      // enquanto não houver datas nas tarefas.
      const span = rollupTasks(tasks);
      onPatch({
        schedule_tasks: tasks,
        ...(tasks.length > 0 ? { start_at: span.start, due_at: span.end } : {}),
      });
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const wbs = useMemo(() => computeWbs(tasks), [tasks]);
  const rollup = useMemo(() => rollupTasks(tasks), [tasks]);

  /** Farol geral: avanço real do projeto × previsto pelo tempo decorrido. */
  const overall = useMemo(() => {
    const real = rollup.progress;
    const planned = plannedFor(rollup.start, rollup.end);
    return {
      real,
      planned,
      deviation: planned === null ? null : Math.round(real) - Math.round(planned),
      status: performanceStatus(real, planned),
    };
  }, [rollup]);

  const wbsById = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task, i) => map.set(task.id, wbs[i]));
    return map;
  }, [tasks, wbs]);

  const idByWbs = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task, i) => map.set(wbs[i], task.id));
    return map;
  }, [tasks, wbs]);

  // ── Operações ──────────────────────────────────────────────────────────
  /**
   * Recalcula o custo: horas × SOMA dos custos/hora de todos os
   * responsáveis alocados (dois a R$ 100/h em 10 h = R$ 2.000).
   */
  const applyCost = (task: ScheduleTask): ScheduleTask => {
    const ids = resourceIdsOf(task);
    const rated = ids.map((id) => rateById.get(id) ?? null).filter((r): r is number => r !== null);
    if (!rated.length || task.work === null || task.work === undefined) return task;
    const rate = rated.reduce((sum, r) => sum + r, 0);
    return { ...task, cost: Number((task.work * rate).toFixed(2)) };
  };

  /** Marca/desmarca um responsável na tarefa e refaz o custo. */
  function toggleResource(task: ScheduleTask, resourceId: string, on: boolean) {
    const current = resourceIdsOf(task);
    const next = on ? [...current, resourceId] : current.filter((id) => id !== resourceId);
    patchWithCost(task, { resourceIds: next, resourceId: null });
  }

  /** Toda mutação passa por aqui: aplica a mudança e reagenda o que for automático. */
  const commit = (updater: (prev: ScheduleTask[]) => ScheduleTask[]) =>
    setTasks((prev) => autoSchedule(updater(prev), calendar));

  const patchTask = (id: string, patch: Partial<ScheduleTask>) =>
    commit((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));

  /** Insere uma tarefa depois do índice informado (-1 = no fim) e foca nela. */
  const addTaskAt = (index: number, indent: number) => {
    // A nova tarefa herda o modo (manual/automático) da linha de referência.
    const reference = index >= 0 ? tasks[index] : tasks[tasks.length - 1];
    const task: ScheduleTask = { ...newTask(indent), mode: reference?.mode ?? 'manual' };
    commit((prev) => {
      const next = [...prev];
      next.splice(index < 0 ? next.length : index + 1, 0, task);
      return next;
    });
    setFocusId(task.id);
  };

  const addTask = (indent: number) => addTaskAt(-1, indent);

  const removeTask = (id: string) =>
    commit((prev) =>
      prev
        .filter((task) => task.id !== id)
        .map((task) => ({ ...task, predecessors: task.predecessors.filter((p) => p !== id) })),
    );

  const moveTask = (index: number, dir: -1 | 1) =>
    commit((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  /**
   * A Duração manda: ajusta o Trabalho (dias × horas/dia) e as datas.
   * No modo automático o `autoSchedule` calcula Início/Término a partir dela.
   */
  function setDuration(task: ScheduleTask, value: string) {
    // Aceita fração de dia: 0,5 = meio dia (4 h numa jornada de 8 h).
    const days = Number(value.replace(',', '.'));
    commit((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        if (!days || days <= 0) return { ...t, duration: null };
        const next: ScheduleTask = {
          ...t,
          duration: days,
          work: Number((days * calendar.hoursPerDay).toFixed(2)),
        };
        if (next.mode !== 'auto' && next.start) {
          next.end = addWorkingDays(next.start, days, calendar);
        }
        return applyCost(next);
      }),
    );
  }

  /** Mudança manual de data mantém a duração (em dias úteis) em sincronia. */
  function setDate(task: ScheduleTask, field: 'start' | 'end', iso: string | null) {
    commit((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const next: ScheduleTask = { ...t, [field]: iso };
        if (next.start && next.end) {
          next.duration = workingDaysBetween(next.start, next.end, calendar);
        }
        return next;
      }),
    );
  }

  /** Ao mudar recurso ou horas, recalcula o custo (horas × custo/hora). */
  function patchWithCost(task: ScheduleTask, patch: Partial<ScheduleTask>) {
    commit((prev) => prev.map((t) => (t.id === task.id ? applyCost({ ...t, ...patch }) : t)));
  }

  /**
   * O Trabalho também manda na Duração: horas ÷ horas-dia (arredondando
   * para cima). Assim os dois campos ficam sempre coerentes.
   */
  function setWork(task: ScheduleTask, value: string) {
    const hours = num(value);
    commit((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const next: ScheduleTask = { ...t, work: hours };
        if (hours !== null && hours > 0 && calendar.hoursPerDay > 0) {
          // 4 h numa jornada de 8 h = 0,5 dia; 12 h = 1,5 dia.
          const days = Number((hours / calendar.hoursPerDay).toFixed(2));
          next.duration = days;
          if (next.mode !== 'auto' && next.start) {
            next.end = addWorkingDays(next.start, days, calendar);
          }
        }
        return applyCost(next);
      }),
    );
  }

  /** Foca uma célula específica (linha × coluna) da tabela. */
  function focusCell(rowIndex: number, col: string) {
    const target = tasks[rowIndex];
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-cell="${target.id}|${col}"]`);
    el?.focus();
    if (el instanceof HTMLInputElement && el.type !== 'date') el.select();
  }

  /**
   * Teclado da tabela:
   *  ↑ ↓   → andam na MESMA coluna, linha acima/abaixo
   *  Enter → cria uma linha logo abaixo e foca nela
   *  Tab   → na última coluna da última linha, também cria a próxima linha
   */
  function cellKeys(
    e: KeyboardEvent,
    rowIndex: number,
    col: string,
    opts: { indent: number; lastCol?: boolean },
  ) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(rowIndex + 1, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(rowIndex - 1, col);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addTaskAt(rowIndex, opts.indent);
    } else if (e.key === 'Tab' && !e.shiftKey && opts.lastCol && rowIndex === tasks.length - 1) {
      e.preventDefault();
      addTaskAt(rowIndex, opts.indent);
    }
  }

  function num(value: string): number | null {
    const n = Number(value.replace(',', '.'));
    return value.trim() === '' || Number.isNaN(n) ? null : n;
  }

  function predecessorsLabel(task: ScheduleTask): string {
    return task.predecessors.map((id) => wbsById.get(id)).filter(Boolean).join(', ');
  }

  function parsePredecessors(text: string, selfId: string): string[] {
    return text
      .split(/[,;]/)
      .map((piece) => piece.trim())
      .filter(Boolean)
      .map((code) => idByWbs.get(code))
      .filter((id): id is string => !!id && id !== selfId);
  }

  // ── Export ─────────────────────────────────────────────────────────────
  const headers = [
    t('schedule.col_wbs'),
    t('schedule.col_task'),
    t('schedule.col_duration'),
    t('schedule.col_start'),
    t('schedule.col_end'),
    t('schedule.col_actual'),
    t('schedule.col_planned'),
    t('schedule.col_status'),
    t('schedule.col_work'),
    t('schedule.col_resource'),
    t('schedule.col_cost'),
    t('schedule.col_mode'),
    t('schedule.col_predecessors'),
    t('schedule.col_notes'),
  ];

  async function doExport(kind: 'xlsx' | 'pdf' | 'xml' | 'gantt') {
    setExporting(kind);
    try {
      if (kind === 'xml') {
        exportToProjectXml({
          name: item.title,
          tasks,
          calendar,
          resources,
          fileName: `cronograma-${item.title}`,
        });
        return;
      }

      if (kind === 'gantt') {
        await exportGanttToPdf({
          title: `${t('schedule.projectSchedule')} — ${item.title}`,
          fileName: `gantt-${item.title}`,
          compare,
          labels: {
            real: t('schedule.real'),
            planned: t('schedule.planned'),
            today: t('schedule.today'),
          },
          rows: tasks.map((task, i) => ({
            wbs: wbs[i],
            name: task.name || '—',
            indent: task.indent ?? 0,
            start: task.start,
            end: task.end,
            progress: task.progress ?? 0,
            planned: taskPlanned(task),
            status: taskStatus(task),
          })),
        });
        return;
      }

      const statuses: ScheduleStatus[] = [];
      const rows = tasks.map((task, i) => {
        const st = taskStatus(task);
        statuses.push(st);
        const planned = taskPlanned(task);
        return [
          wbs[i],
          `${'    '.repeat(task.indent ?? 0)}${task.name || '—'}`,
          taskDuration(task, calendar) ?? '—',
          task.start ? new Date(task.start).toLocaleDateString() : '—',
          task.end ? new Date(task.end).toLocaleDateString() : '—',
          `${task.progress ?? 0}%`,
          planned === null ? '—' : `${planned}%`,
          `${STATUS_EMOJI[st]} ${t(`schedule.status_${st}`)}`,
          task.work ?? '—',
          resourceIdsOf(task)
            .map((id) => resources.find((r) => r.id === id)?.name)
            .filter(Boolean)
            .join(', ') || '—',
          task.cost ?? '—',
          t(`schedule.mode_${task.mode ?? 'manual'}`),
          predecessorsLabel(task) || '—',
          (task.notes ?? '').slice(0, 140),
        ];
      });
      const table = {
        title: `${t('schedule.projectSchedule')} — ${item.title}`,
        headers,
        rows,
        fileName: `cronograma-${item.title}`,
        statusColumn: 7,
        statuses,
      };
      if (kind === 'xlsx') await exportToXlsx(table);
      else await exportToPdf(table);
    } finally {
      setExporting(null);
    }
  }

  // ── Gantt: escala de tempo ─────────────────────────────────────────────
  const scale = useMemo(() => {
    const dates = tasks.flatMap((task) => [task.start, task.end]).filter(Boolean) as string[];
    const today = dayStart(new Date());
    const min = dates.length ? Math.min(...dates.map(dayStart)) : today;
    const max = dates.length ? Math.max(...dates.map(dayStart)) : today + 14 * DAY;
    const from = min - 2 * DAY;
    const to = max + 2 * DAY;
    const days = Math.max(1, Math.round((to - from) / DAY) + 1);
    const dayWidth = zoom === 'day' ? 26 : 9;
    return { from, days, dayWidth, width: days * dayWidth, today };
  }, [tasks, zoom]);

  const xFor = (iso: string | null) =>
    iso === null ? 0 : ((dayStart(iso) - scale.from) / DAY) * scale.dayWidth;

  /** Rótulos do cabeçalho: dia a dia (zoom dia) ou semana a semana. */
  const ticks = useMemo(() => {
    const out: { x: number; label: string; strong: boolean }[] = [];
    const step = zoom === 'day' ? 1 : 7;
    for (let i = 0; i < scale.days; i += step) {
      const d = new Date(scale.from + i * DAY);
      const strong = d.getDate() === 1 || i === 0;
      out.push({
        x: i * scale.dayWidth,
        label: zoom === 'day' ? String(d.getDate()) : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
        strong,
      });
    }
    return out;
  }, [scale, zoom]);

  const todayX = ((scale.today - scale.from) / DAY) * scale.dayWidth;

  return (
    <Modal
      open
      onClose={onClose}
      width={1240}
      fullScreen={fullScreen}
      bodyScroll={!fullScreen}
      headerExtra={
        <button
          className="btn-ghost h-8 w-8 rounded-lg p-0"
          onClick={() => setFullScreen((f) => !f)}
          title={fullScreen ? t('schedule.collapse') : t('schedule.expand')}
        >
          {fullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      }
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {t('schedule.projectSchedule')} — {item.title}
          </span>
          <span className="text-xs font-normal text-ink-soft">
            {t('schedule.taskCount', { count: tasks.length })} · {rollup.progress}%
            {rollup.start && rollup.end
              ? ` · ${new Date(rollup.start).toLocaleDateString()} → ${new Date(rollup.end).toLocaleDateString()}`
              : ''}
          </span>
        </span>
      }
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => doExport('xlsx')}
            disabled={exporting !== null || tasks.length === 0}
          >
            {exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet size={15} />} {t('schedule.exportExcel')}
          </button>
          <button
            className="btn-secondary"
            onClick={() => doExport('pdf')}
            disabled={exporting !== null || tasks.length === 0}
          >
            {exporting === 'pdf' ? <Spinner /> : <FileText size={15} />} {t('schedule.exportPdf')}
          </button>
          <button
            className="btn-secondary"
            title={t('schedule.exportXmlHint')}
            onClick={() => doExport('xml')}
            disabled={exporting !== null || tasks.length === 0}
          >
            {exporting === 'xml' ? <Spinner /> : <FileCode2 size={15} />} {t('schedule.exportXml')}
          </button>
          <button className="btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      {/* Em tela cheia o conteúdo controla a própria rolagem: a tabela rola
          dentro da área visível, então a barra horizontal fica no rodapé da
          tela — e não lá embaixo, no fim de todas as tarefas. */}
      <div className={cn(fullScreen && 'flex h-full min-h-0 flex-col')}>
      {/* Barra de ferramentas */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex gap-0.5 rounded-lg bg-surface-raised p-0.5">
          {(['table', 'gantt'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                tab === v ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {v === 'table' ? <TableIcon size={13} /> : <BarChart3 size={13} />}
              {t(`schedule.view_${v}`)}
            </button>
          ))}
        </div>

        {tab === 'gantt' && (
          <>
            <div className="flex gap-0.5 rounded-lg bg-surface-raised p-0.5">
              {(['day', 'week'] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    zoom === z ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {t(`schedule.zoom_${z}`)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCompare((v) => !v)}
              title={t('schedule.compareHint')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                compare ? 'bg-brand-gradient text-white' : 'bg-surface-raised text-ink-soft hover:text-ink',
              )}
            >
              <GanttChartSquare size={13} /> {t('schedule.compare')}
            </button>

            <button
              className="btn-secondary"
              onClick={() => doExport('gantt')}
              disabled={exporting !== null || tasks.length === 0}
            >
              {exporting === 'gantt' ? <Spinner /> : <FileText size={15} />} {t('schedule.exportGantt')}
            </button>
          </>
        )}

        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setResourcesOpen(true)}>
              <Users size={15} /> {t('schedule.resources')}
            </button>
            <button className="btn-secondary" onClick={() => setCalendarOpen(true)}>
              <CalendarCog size={15} /> {t('schedule.calendar')}
            </button>
            <button className="btn-secondary" onClick={() => setImportOpen(true)}>
              <CopyPlus size={15} /> {t('schedule.importFrom')}
            </button>
            <button className="btn-secondary" onClick={() => addTask(0)}>
              <Plus size={15} /> {t('schedule.addPhase')}
            </button>
            <button className="btn-primary" onClick={() => addTask(1)}>
              <Plus size={15} /> {t('schedule.addTask')}
            </button>
          </div>
        )}
      </div>

      {/* Farol geral do projeto: avanço real × previsto pelo tempo decorrido */}
      {tasks.length > 0 && (
        <div
          className="mb-3 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-3 py-2.5"
          style={{
            borderColor: `${BAR_COLORS[overall.status].fill}55`,
            background: `${BAR_COLORS[overall.status].bg}66`,
          }}
          title={t('schedule.overallHint')}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-base">{STATUS_EMOJI[overall.status]}</span>
            {t(`schedule.overall_${overall.status}`)}
          </span>

          <div className="min-w-[180px] flex-1">
            <div
              className="relative h-2.5 overflow-hidden rounded-full"
              style={{ background: BAR_COLORS.none.bg }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, overall.real)}%`,
                  background: BAR_COLORS[overall.status].fill,
                }}
              />
              {overall.planned !== null && (
                <span
                  className="absolute top-0 h-full w-[2px] bg-ink/70"
                  style={{ left: `${Math.min(100, overall.planned)}%` }}
                />
              )}
            </div>
          </div>

          <span className="text-xs text-ink-soft">
            {t('schedule.real')} <b className="text-ink">{overall.real}%</b>
            {overall.planned !== null && (
              <>
                {' · '}
                {t('schedule.planned')} <b className="text-ink">{overall.planned}%</b>
                {' · '}
                {t('schedule.deviation')}{' '}
                <b style={{ color: BAR_COLORS[overall.status].fill }}>
                  {overall.deviation! > 0 ? '+' : ''}
                  {overall.deviation} p.p.
                </b>
              </>
            )}
          </span>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <BarChart3 size={34} className="text-ink-faint" />
          <p className="text-sm text-ink-soft">{t('schedule.emptyProject')}</p>
        </div>
      ) : tab === 'table' ? (
        /* ── Tabela editável ─────────────────────────────────────────── */
        <>
        <div className={cn('overflow-auto', fullScreen && 'min-h-0 flex-1')}>
          <table className="w-full min-w-[1340px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {[
                  t('schedule.col_wbs'),
                  t('schedule.col_task'),
                  t('schedule.col_start'),
                  t('schedule.col_end'),
                  t('schedule.col_duration'),
                  t('schedule.col_actual'),
                  t('schedule.col_work'),
                  t('schedule.col_resource'),
                  t('schedule.col_cost'),
                  t('schedule.col_mode'),
                  t('schedule.col_predecessors'),
                  t('schedule.col_notes'),
                  '',
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      'sticky top-0 z-10 whitespace-nowrap border-b border-line/15 bg-surface-raised px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft',
                      i === 1 && 'min-w-[320px]',
                      i === 11 && 'min-w-[220px]',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => {
                const st = taskStatus(task);
                // Linha-resumo: datas, duração, %, trabalho e custo vêm
                // consolidados das filhas — não se digita neles.
                const summary = isSummary(tasks, i);
                const locked = !canEdit || summary;
                return (
                  <tr key={task.id} className="hover:bg-line/5">
                    <td className="whitespace-nowrap border-b border-line/10 px-2 py-1.5 font-mono text-xs text-ink-soft">
                      {STATUS_EMOJI[st]} {wbs[i]}
                    </td>
                    <td className="min-w-[320px] border-b border-line/10 px-2 py-1.5">
                      <input
                        className={`field w-full py-1 text-sm ${
                          (task.indent ?? 0) === 0 ? 'font-semibold' : (task.indent ?? 0) === MAX_INDENT ? 'italic' : ''
                        }`}
                        style={{ paddingLeft: 8 + (task.indent ?? 0) * 16 }}
                        disabled={!canEdit}
                        value={task.name}
                        placeholder={t('schedule.taskName')}
                        data-cell={`${task.id}|name`}
                        title={t('schedule.keyboardHint')}
                        onChange={(e) => patchTask(task.id, { name: e.target.value })}
                        onKeyDown={(e) => cellKeys(e, i, 'name', { indent: task.indent ?? 1 })}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="date"
                        className="field w-[140px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : undefined}
                        value={toDateInput(task.start)}
                        data-cell={`${task.id}|start`}
                        onKeyDown={(e) => cellKeys(e, i, 'start', { indent: task.indent ?? 1 })}
                        onChange={(e) => setDate(task, 'start', fromDateInput(e.target.value))}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="date"
                        className="field w-[140px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : undefined}
                        value={toDateInput(task.end)}
                        data-cell={`${task.id}|end`}
                        onKeyDown={(e) => cellKeys(e, i, 'end', { indent: task.indent ?? 1 })}
                        onChange={(e) => setDate(task, 'end', fromDateInput(e.target.value))}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        className="field w-[70px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : t('schedule.durationHint')}
                        value={task.duration ?? taskDuration(task, calendar) ?? ''}
                        data-cell={`${task.id}|duration`}
                        onKeyDown={(e) => cellKeys(e, i, 'duration', { indent: task.indent ?? 1 })}
                        onChange={(e) => setDuration(task, e.target.value)}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="field w-[70px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : undefined}
                        value={task.progress ?? 0}
                        data-cell={`${task.id}|progress`}
                        onKeyDown={(e) => cellKeys(e, i, 'progress', { indent: task.indent ?? 1 })}
                        onChange={(e) =>
                          patchTask(task.id, { progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                        }
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        className="field w-[80px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : undefined}
                        value={task.work ?? ''}
                        data-cell={`${task.id}|work`}
                        onKeyDown={(e) => cellKeys(e, i, 'work', { indent: task.indent ?? 1 })}
                        onChange={(e) => setWork(task, e.target.value)}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      {(() => {
                        if (summary) return <span className="text-xs text-ink-faint">—</span>;
                        const picked = resourceIdsOf(task);
                        const free = resources.filter((r) => !picked.includes(r.id));
                        return (
                          <div className="flex w-[190px] flex-wrap gap-1">
                            {picked.map((id) => {
                              const r = resources.find((x) => x.id === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                                >
                                  <span className="truncate">{r?.name ?? '—'}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="shrink-0 opacity-60 hover:opacity-100"
                                      title={t('common.remove')}
                                      onClick={() => toggleResource(task, id, false)}
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                            {canEdit && free.length > 0 && (
                              <select
                                className="field w-full py-1 text-xs"
                                value=""
                                onChange={(e) => e.target.value && toggleResource(task, e.target.value, true)}
                              >
                                <option value="">{picked.length ? t('schedule.assignResource') : '—'}</option>
                                {free.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="field w-[90px] py-1 text-sm"
                        disabled={locked}
                        title={summary ? t('schedule.summaryLocked') : undefined}
                        value={task.cost ?? ''}
                        data-cell={`${task.id}|cost`}
                        onKeyDown={(e) => cellKeys(e, i, 'cost', { indent: task.indent ?? 1 })}
                        onChange={(e) => patchTask(task.id, { cost: num(e.target.value) })}
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <select
                        className="field w-[110px] py-1 text-sm"
                        disabled={locked}
                        value={task.mode ?? 'manual'}
                        onChange={(e) => patchTask(task.id, { mode: e.target.value as 'manual' | 'auto' })}
                      >
                        <option value="manual">{t('schedule.mode_manual')}</option>
                        <option value="auto">{t('schedule.mode_auto')}</option>
                      </select>
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        className="field w-[110px] py-1 text-sm"
                        disabled={!canEdit}
                        defaultValue={predecessorsLabel(task)}
                        placeholder="1.1, 1.2"
                        title={t('schedule.predecessorsHint')}
                        data-cell={`${task.id}|pred`}
                        onKeyDown={(e) => cellKeys(e, i, 'pred', { indent: task.indent ?? 1 })}
                        onBlur={(e) =>
                          patchTask(task.id, { predecessors: parsePredecessors(e.target.value, task.id) })
                        }
                      />
                    </td>
                    <td className="border-b border-line/10 px-2 py-1.5">
                      <input
                        className="field w-full min-w-[210px] py-1 text-sm"
                        disabled={!canEdit}
                        value={task.notes ?? ''}
                        data-cell={`${task.id}|notes`}
                        onKeyDown={(e) => cellKeys(e, i, 'notes', { indent: task.indent ?? 1, lastCol: true })}
                        onChange={(e) => patchTask(task.id, { notes: e.target.value })}
                      />
                    </td>
                    <td className="whitespace-nowrap border-b border-line/10 px-2 py-1.5">
                      {canEdit && (
                        <div className="flex gap-0.5">
                          <button
                            className="btn-ghost px-1 py-1"
                            title={t('schedule.moveUp')}
                            onClick={() => moveTask(i, -1)}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            className="btn-ghost px-1 py-1"
                            title={t('schedule.moveDown')}
                            onClick={() => moveTask(i, 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            className="btn-ghost px-1 py-1"
                            title={t('schedule.toggleIndent')}
                            onClick={() =>
                              patchTask(task.id, {
                                indent: ((task.indent ?? 0) + 1) % (MAX_INDENT + 1),
                              })
                            }
                          >
                            {(task.indent ?? 0) === MAX_INDENT ? <Outdent size={13} /> : <Indent size={13} />}
                          </button>
                          <button
                            className="btn-ghost px-1 py-1 text-red-500 hover:bg-red-500/10"
                            title={t('common.delete')}
                            onClick={() => removeTask(task.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 shrink-0 px-1 text-[11px] text-ink-faint">{t('schedule.keyboardHint')}</p>
        </>
      ) : (
        /* ── Gantt ───────────────────────────────────────────────────── */
        <div className={cn('flex overflow-auto rounded-xl border border-line/10', fullScreen && 'min-h-0 flex-1')}>
          {/* Coluna de rótulos (fixa) */}
          <div className="shrink-0 border-r border-line/10 bg-surface-raised" style={{ width: LABEL_W }}>
            <div style={{ height: HEADER_H }} className="border-b border-line/10" />
            {tasks.map((task, i) => (
              <div
                key={task.id}
                style={{ height: ROW_H, paddingLeft: 10 + (task.indent ?? 0) * 14 }}
                className="flex items-center gap-1.5 border-b border-line/5 pr-2 text-xs"
              >
                <span className="font-mono text-[10px] text-ink-faint">{wbs[i]}</span>
                <span className="truncate">{task.name || '—'}</span>
              </div>
            ))}
          </div>

          {/* Área do gráfico */}
          <svg width={scale.width} height={HEADER_H + tasks.length * ROW_H} className="shrink-0">
            {/* Grade + cabeçalho de datas */}
            {ticks.map((tick) => (
              <g key={tick.x}>
                <line
                  x1={tick.x}
                  y1={0}
                  x2={tick.x}
                  y2={HEADER_H + tasks.length * ROW_H}
                  stroke="currentColor"
                  className={tick.strong ? 'text-line/40' : 'text-line/15'}
                  strokeWidth={1}
                />
                <text x={tick.x + 3} y={24} className="fill-ink-faint" fontSize={9}>
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Linha do hoje */}
            {todayX >= 0 && todayX <= scale.width && (
              <line
                x1={todayX}
                y1={HEADER_H - 8}
                x2={todayX}
                y2={HEADER_H + tasks.length * ROW_H}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}

            {/* Setas de dependência */}
            {tasks.map((task, i) =>
              (task.predecessors ?? []).map((pid) => {
                const pIndex = tasks.findIndex((p) => p.id === pid);
                const pred = tasks[pIndex];
                if (!pred || !pred.end || !task.start) return null;
                const x1 = xFor(pred.end) + scale.dayWidth;
                const y1 = HEADER_H + pIndex * ROW_H + ROW_H / 2;
                const x2 = xFor(task.start);
                const y2 = HEADER_H + i * ROW_H + ROW_H / 2;
                const midX = Math.max(x1 + 6, x2 - 8);
                return (
                  <polyline
                    key={`${task.id}-${pid}`}
                    points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth={1.2}
                    markerEnd="url(#arrow)"
                  />
                );
              }),
            )}
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#8B5CF6" />
              </marker>
            </defs>

            {/* Barras */}
            {tasks.map((task, i) => {
              if (!task.start || !task.end) return null;
              const x = xFor(task.start);
              const w = Math.max(scale.dayWidth * 0.6, xFor(task.end) + scale.dayWidth - x);
              const y = HEADER_H + i * ROW_H + 6;
              const colors = BAR_COLORS[taskStatus(task)];
              const pct = Math.min(100, Math.max(0, task.progress ?? 0));
              const full = ROW_H - 12;

              // Modo comparação: barra de cima = real, de baixo = previsto.
              if (compare) {
                const h = (full - 3) / 2;
                const planned = taskPlanned(task);
                return (
                  <g key={task.id}>
                    <title>{`${t('schedule.real')} ${pct}%${planned === null ? '' : ` · ${t('schedule.planned')} ${planned}%`}`}</title>
                    <rect x={x} y={y} width={w} height={h} rx={3} fill={colors.bg} />
                    <rect x={x} y={y} width={(w * pct) / 100} height={h} rx={3} fill={colors.fill} />
                    <rect x={x} y={y + h + 3} width={w} height={h} rx={3} fill="#e8e9f2" />
                    {planned !== null && (
                      <rect
                        x={x}
                        y={y + h + 3}
                        width={(w * Math.min(100, planned)) / 100}
                        height={h}
                        rx={3}
                        fill="#7878a0"
                      />
                    )}
                    <text x={x + w + 5} y={y + full / 2 + 3} fontSize={9} className="fill-ink-faint">
                      {pct}%
                      {planned === null ? '' : ` / ${planned}%`}
                    </text>
                  </g>
                );
              }

              return (
                <g key={task.id}>
                  <rect x={x} y={y} width={w} height={full} rx={4} fill={colors.bg} />
                  <rect x={x} y={y} width={(w * pct) / 100} height={full} rx={4} fill={colors.fill} />
                  <text x={x + w + 5} y={y + full / 2 + 3} fontSize={9} className="fill-ink-faint">
                    {pct}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      </div>

      {resourcesOpen && (
        <ResourcesDialog
          spaceId={item.space_id}
          userId={userId}
          canEdit={canEdit}
          onClose={() => setResourcesOpen(false)}
          onChanged={setResources}
        />
      )}

      {calendarOpen && (
        <CalendarDialog
          calendar={calendar}
          canEdit={canEdit}
          onClose={() => setCalendarOpen(false)}
          onSave={(next) => {
            setCalendar(next);
            setTasks((prev) => autoSchedule(prev, next));
            onPatch({ schedule_calendar: next });
            setCalendarOpen(false);
          }}
        />
      )}

      {importOpen && (
        <ImportScheduleDialog
          spaceId={item.space_id}
          exceptId={item.id}
          onClose={() => setImportOpen(false)}
          onImport={(imported) => {
            commit((prev) => [...prev, ...imported]);
            setImportOpen(false);
          }}
        />
      )}
    </Modal>
  );
}

// ── Importar a estrutura de outro card ────────────────────────────────────

function ImportScheduleDialog({
  spaceId,
  exceptId,
  onClose,
  onImport,
}: {
  spaceId: string;
  exceptId: string;
  onClose: () => void;
  onImport: (tasks: ScheduleTask[]) => void;
}) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<{ id: string; title: string; schedule_tasks: ScheduleTask[] }[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [newStart, setNewStart] = useState('');
  const [resetProgress, setResetProgress] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.items
      .listWithSchedule(spaceId, exceptId)
      .then(setSources)
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, [spaceId, exceptId]);

  const chosen = sources.find((s) => s.id === sourceId) ?? null;

  function run() {
    if (!chosen) return;
    onImport(
      cloneTasks(chosen.schedule_tasks, {
        resetProgress,
        newStart: newStart ? new Date(`${newStart}T12:00:00`).toISOString() : null,
      }),
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={460}
      title={t('schedule.importTitle')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={run} disabled={!chosen}>
            <CopyPlus size={15} /> {t('schedule.importAction')}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8 text-brand-indigo">
          <Spinner />
        </div>
      ) : sources.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">{t('schedule.importNone')}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">{t('schedule.importSource')}</label>
            <select className="field mt-1" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.schedule_tasks.length})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('schedule.importRestart')}</label>
            <input
              type="date"
              className="field mt-1"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('schedule.importRestartHint')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand-indigo"
              checked={resetProgress}
              onChange={(e) => setResetProgress(e.target.checked)}
            />
            {t('schedule.importReset')}
          </label>
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-ink-soft">
            {t('schedule.importAdds')}
          </p>
        </div>
      )}
    </Modal>
  );
}
