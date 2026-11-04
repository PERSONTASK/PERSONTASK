import type { Item, ScheduleCalendar, ScheduleTask } from '@/types';

/**
 * Cálculos do cronograma (gestão de projetos).
 *
 * Nada aqui é gravado no banco: duração, % previsto e o semáforo são sempre
 * derivados de Início (`start_at`), Término (`due_at`) e do % concluído.
 */

const DAY = 86_400_000;

/** Zera a hora (00:00) para comparar dias sem ruído de fuso/horário. */
function startOfDay(value: string | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fim do dia (23:59:59) do Término. */
function endOfDay(value: string | Date): number {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** % do checklist do card (null se não houver nenhum item de checklist). */
export function checklistProgress(item: Item): number | null {
  const entries = (item.checklists ?? []).flatMap((l) => l.items ?? []);
  if (entries.length === 0) return null;
  return Math.round((entries.filter((i) => i.done).length / entries.length) * 100);
}

/** % concluído efetivo: o explícito; na falta dele, o do checklist; senão 0. */
export function actualProgress(item: Item): number {
  if (item.progress !== null && item.progress !== undefined) return item.progress;
  return checklistProgress(item) ?? 0;
}

/** Duração em dias (inclusiva). null se faltar Início ou Término. */
export function durationDays(item: Item): number | null {
  if (!item.start_at || !item.due_at) return null;
  const start = startOfDay(item.start_at);
  const end = startOfDay(item.due_at);
  if (end < start) return null;
  return Math.round((end - start) / DAY) + 1;
}

/** Término calculado a partir de Início + duração (para edição por duração). */
export function endFromDuration(startISO: string, days: number): string {
  const d = new Date(startISO);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(1, Math.round(days)) - 1);
  return d.toISOString();
}

/** % previsto pelo tempo decorrido (0–100). null se faltar data. */
export function plannedProgress(item: Item, now: Date = new Date()): number | null {
  if (!item.start_at || !item.due_at) return null;
  const start = startOfDay(item.start_at);
  const end = endOfDay(item.due_at);
  if (end <= start) return now.getTime() >= end ? 100 : 0;
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 100;
  return Math.round(((t - start) / (end - start)) * 100);
}

export type ScheduleStatus = 'green' | 'yellow' | 'red' | 'none';

/** Dias restantes até o Término (negativo = atrasado). null se não houver Término. */
export function daysToDue(item: Item, now: Date = new Date()): number | null {
  if (!item.due_at) return null;
  return Math.ceil((endOfDay(item.due_at) - now.getTime()) / DAY);
}

/**
 * Semáforo do cronograma:
 * 🟢 verde   — no prazo ou adiantado (ou já 100% concluído)
 * 🟡 amarelo — vence nos próximos 5 dias
 * 🔴 vermelho — Término já passou e a tarefa não está concluída
 * ⚪ none    — sem data de Término
 */
export function scheduleStatus(item: Item, now: Date = new Date()): ScheduleStatus {
  if (item.done_at) return 'green'; // concluído na mão: nada mais atrasa
  if (!item.due_at) return 'none';
  if (actualProgress(item) >= 100) return 'green';
  const remaining = daysToDue(item, now);
  if (remaining === null) return 'none';
  if (remaining < 0) return 'red';
  if (remaining <= 5) return 'yellow';
  return 'green';
}

/**
 * Farol de DESEMPENHO — o farol geral do cronograma. Compara o avanço
 * real com o previsto pelo tempo decorrido:
 *   🟢 real igual ou acima do previsto
 *   🟡 real abaixo do previsto em até 10 pontos percentuais
 *   🔴 real abaixo do previsto em mais de 10 pontos
 *   ⚪ sem previsto (faltam datas no cronograma)
 */
export function performanceStatus(real: number, planned: number | null): ScheduleStatus {
  if (planned === null) return 'none';
  const deviation = Math.round(real) - Math.round(planned);
  if (deviation >= 0) return 'green';
  if (deviation >= -10) return 'yellow';
  return 'red';
}

/** true quando o avanço real está abaixo do previsto (útil como alerta extra). */
export function isBehindPlan(item: Item, now: Date = new Date()): boolean {
  const planned = plannedProgress(item, now);
  if (planned === null) return false;
  return actualProgress(item) < planned;
}

// ── Cronograma do projeto (tarefas dentro do card) ───────────────────────

/** Duração em dias entre duas datas (inclusiva). */
function spanDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (e < s) return null;
  return Math.round((e - s) / DAY) + 1;
}

/** % previsto pelo tempo decorrido num intervalo de datas (0–100). */
export function plannedFor(start?: string | null, end?: string | null, now: Date = new Date()): number | null {
  if (!start || !end) return null;
  const s = startOfDay(start);
  const e = endOfDay(end);
  if (e <= s) return now.getTime() >= e ? 100 : 0;
  const t = now.getTime();
  if (t <= s) return 0;
  if (t >= e) return 100;
  return Math.round(((t - s) / (e - s)) * 100);
}

function statusFor(end: string | null | undefined, progress: number, now: Date = new Date()): ScheduleStatus {
  if (!end) return 'none';
  if (progress >= 100) return 'green';
  const remaining = Math.ceil((endOfDay(end) - now.getTime()) / DAY);
  if (remaining < 0) return 'red';
  if (remaining <= 5) return 'yellow';
  return 'green';
}

// ── Calendário do projeto (dias úteis / feriados) ────────────────────────

/** Padrão: segunda a sexta, 8 h por dia, sem feriados. */
export const DEFAULT_CALENDAR: ScheduleCalendar = {
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
  hoursPerDay: 8,
};

/** Calendário efetivo do card (cai no padrão quando não há configuração). */
export function calendarOf(item: Item): ScheduleCalendar {
  const c = item.schedule_calendar;
  return {
    workdays: c?.workdays?.length ? c.workdays : DEFAULT_CALENDAR.workdays,
    holidays: c?.holidays ?? [],
    hoursPerDay: c?.hoursPerDay ?? DEFAULT_CALENDAR.hoursPerDay,
  };
}

/** Folga para comparar durações fracionárias sem sustos de ponto flutuante. */
const EPS = 1e-6;

/** Chave YYYY-MM-DD usando a data LOCAL (evita erro de fuso). */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** true se a data é dia útil no calendário (não é fim de semana nem feriado). */
export function isWorkday(date: Date, cal: ScheduleCalendar): boolean {
  if (!cal.workdays.includes(date.getDay())) return false;
  return !cal.holidays.includes(dateKey(date));
}

/** Quantidade de dias ÚTEIS entre duas datas (inclusivo nas pontas). */
export function workingDaysBetween(startISO: string, endISO: string, cal: ScheduleCalendar): number {
  const cursor = new Date(startOfDay(startISO));
  const end = startOfDay(endISO);
  if (end < cursor.getTime()) return 0;
  let count = 0;
  let guard = 0;
  while (cursor.getTime() <= end && guard < 20000) {
    if (isWorkday(cursor, cal)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return count;
}

/**
 * Término = início + N dias ÚTEIS (o próprio início conta como o 1º dia).
 * Se o início cair em fim de semana/feriado, pula para o próximo dia útil.
 */
export function addWorkingDays(startISO: string, days: number, cal: ScheduleCalendar): string {
  const cursor = new Date(startOfDay(startISO));
  let guard = 0;
  while (!isWorkday(cursor, cal) && guard < 400) {
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  // ceil: uma tarefa de 1,5 dia encosta no 2º dia — ele é o último dia dela.
  let remaining = Math.max(1, Math.ceil(days - EPS)) - 1;
  guard = 0;
  while (remaining > 0 && guard < 20000) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkday(cursor, cal)) remaining -= 1;
    guard += 1;
  }
  cursor.setHours(12, 0, 0, 0);
  return cursor.toISOString();
}

/** Próximo dia útil DEPOIS da data informada. */
export function nextWorkday(iso: string, cal: ScheduleCalendar): string {
  const cursor = new Date(startOfDay(iso));
  cursor.setDate(cursor.getDate() + 1);
  let guard = 0;
  while (!isWorkday(cursor, cal) && guard < 400) {
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  cursor.setHours(12, 0, 0, 0);
  return cursor.toISOString();
}

/**
 * Régua de dias ÚTEIS **fracionários**. A posição 0 é o começo do primeiro
 * dia útil a partir da origem; 1,5 é a metade do segundo dia útil.
 *
 * É o que permite tratar meio dia de trabalho: uma tarefa de 1,5 dia ocupa
 * `[0, 1.5)` — encosta no 2º dia mas só consome metade dele, e a tarefa
 * seguinte emenda **no mesmo 2º dia**, nas horas que sobraram.
 */
class WorkdayRuler {
  private readonly days: Date[] = [];

  constructor(origin: Date, private readonly cal: ScheduleCalendar) {
    const first = new Date(startOfDay(origin));
    let guard = 0;
    while (!isWorkday(first, cal) && guard < 400) {
      first.setDate(first.getDate() + 1);
      guard += 1;
    }
    this.days.push(first);
  }

  /** Data do N-ésimo dia útil (estende a régua conforme precisa). */
  dateAt(index: number): Date {
    const target = Math.max(0, Math.floor(index));
    let guard = 0;
    while (this.days.length <= target && guard < 20000) {
      const next = new Date(this.days[this.days.length - 1]);
      do {
        next.setDate(next.getDate() + 1);
        guard += 1;
      } while (!isWorkday(next, this.cal) && guard < 20000);
      this.days.push(next);
    }
    return this.days[Math.min(target, this.days.length - 1)];
  }

  /** ISO (meio-dia local) do N-ésimo dia útil. */
  isoAt(index: number): string {
    const d = new Date(this.dateAt(index));
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  /** Posição de uma data na régua (0 = primeiro dia útil da origem). */
  indexOf(iso: string): number {
    const target = startOfDay(iso);
    if (target <= this.dateAt(0).getTime()) return 0;
    let i = 0;
    while (i < 20000 && this.dateAt(i).getTime() < target) i += 1;
    return i;
  }
}

/** Duração da tarefa em dias úteis (pode ser fracionária: 0,5 = meio dia). */
function plannedDuration(task: ScheduleTask, cal: ScheduleCalendar): number | null {
  if (task.duration !== null && task.duration !== undefined) return task.duration;
  if (task.work !== null && task.work !== undefined && cal.hoursPerDay > 0) {
    return task.work / cal.hoursPerDay;
  }
  if (task.start && task.end) return workingDaysBetween(task.start, task.end, cal);
  return null;
}

/**
 * Agendamento automático: para cada tarefa em modo `auto` que tenha duração,
 * calcula Início e Término na régua de dias úteis fracionários.
 *   • com predecessoras → começa **onde a última delas terminou**, podendo
 *     ser no mesmo dia se sobrou expediente (meia tarefa → meio dia);
 *   • sem predecessoras → mantém o início já definido ou emenda na anterior.
 * Tarefas `manual` não são tocadas; fases e tarefas-resumo são **consolidadas**
 * das filhas no fim (`rollupSummaries`). É idempotente.
 */
export function autoSchedule(
  tasks: ScheduleTask[],
  cal: ScheduleCalendar,
  fallbackStart?: string | null,
): ScheduleTask[] {
  let result = tasks.map((task) => ({ ...task }));
  if (result.length === 0) return result;

  // Origem da régua: a data mais antiga que já existe no cronograma.
  const known = result.map((t) => t.start).filter(Boolean) as string[];
  const originMs = known.length
    ? Math.min(...known.map(startOfDay))
    : startOfDay(fallbackStart ?? new Date().toISOString());
  const ruler = new WorkdayRuler(new Date(originMs), cal);

  /** Uma passada de agendamento; devolve o fim (em dias úteis) de cada tarefa. */
  const schedulePass = () => {
    const endAt = new Map<string, number | null>();
    let previousEnd: number | null = null;

    for (let i = 0; i < result.length; i += 1) {
      const task = result[i];
      const summary = (task.indent ?? 0) === 0 || isSummary(result, i);

      if (summary) {
        endAt.set(task.id, task.end ? ruler.indexOf(task.end) + 1 : null);
        continue;
      }

      const duration = plannedDuration(task, cal);

      if (task.mode !== 'auto' || !duration || duration <= 0) {
        const end = task.end ? ruler.indexOf(task.end) + 1 : null;
        endAt.set(task.id, end);
        if (end !== null) previousEnd = end;
        continue;
      }

      const predEnds = (task.predecessors ?? [])
        .map((id) => endAt.get(id))
        .filter((v): v is number => typeof v === 'number');

      let start: number;
      if (predEnds.length > 0) {
        start = Math.max(...predEnds);
      } else if (task.start) {
        start = ruler.indexOf(task.start);
      } else if (previousEnd !== null) {
        start = previousEnd;
      } else {
        start = 0;
      }

      const end = start + duration;
      task.start = ruler.isoAt(Math.floor(start + EPS));
      task.end = ruler.isoAt(Math.max(Math.floor(start + EPS), Math.ceil(end - EPS) - 1));
      task.duration = duration;
      endAt.set(task.id, end);
      previousEnd = end;
    }
  };

  // Duas passadas: a 2ª resolve tarefas que dependem de uma fase, cujo
  // término só é conhecido depois da consolidação.
  schedulePass();
  result = rollupSummaries(result, cal);
  schedulePass();
  return rollupSummaries(result, cal);
}

/** Índices das filhas diretas de uma linha-resumo (vazio se for folha). */
function directChildren(tasks: ScheduleTask[], index: number): number[] {
  const level = tasks[index]?.indent ?? 0;
  const descendants: number[] = [];
  for (let i = index + 1; i < tasks.length; i += 1) {
    if ((tasks[i].indent ?? 0) <= level) break;
    descendants.push(i);
  }
  if (descendants.length === 0) return [];
  const childLevel = Math.min(...descendants.map((i) => tasks[i].indent ?? 0));
  return descendants.filter((i) => (tasks[i].indent ?? 0) === childLevel);
}

/**
 * Fases e tarefas-resumo **consolidam as filhas**, como no MS Project:
 * Início = o menor das filhas · Término = o maior · Trabalho e Custo = soma ·
 * % concluído = média ponderada pela duração. Roda de baixo para cima, então
 * resumos aninhados (subtarefa → tarefa → fase) sobem certo.
 */
export function rollupSummaries(tasks: ScheduleTask[], cal: ScheduleCalendar): ScheduleTask[] {
  const result = tasks.map((task) => ({ ...task }));

  for (let i = result.length - 1; i >= 0; i -= 1) {
    const children = directChildren(result, i).map((idx) => result[idx]);
    if (children.length === 0) continue;

    const starts = children.map((c) => c.start).filter(Boolean) as string[];
    const ends = children.map((c) => c.end).filter(Boolean) as string[];

    let work = 0;
    let cost = 0;
    let hasWork = false;
    let hasCost = false;
    let weighted = 0;
    let weight = 0;

    for (const child of children) {
      if (child.work !== null && child.work !== undefined) {
        work += child.work;
        hasWork = true;
      }
      if (child.cost !== null && child.cost !== undefined) {
        cost += child.cost;
        hasCost = true;
      }
      const w = plannedDuration(child, cal) ?? 1;
      weighted += (child.progress ?? 0) * w;
      weight += w;
    }

    const summary = result[i];
    summary.start = starts.length ? starts.reduce((a, b) => (startOfDay(a) <= startOfDay(b) ? a : b)) : null;
    summary.end = ends.length ? ends.reduce((a, b) => (startOfDay(a) >= startOfDay(b) ? a : b)) : null;
    summary.duration =
      summary.start && summary.end ? workingDaysBetween(summary.start, summary.end, cal) : null;
    summary.work = hasWork ? Number(work.toFixed(2)) : null;
    summary.cost = hasCost ? Number(cost.toFixed(2)) : null;
    summary.progress = weight > 0 ? Math.round(weighted / weight) : 0;
  }

  return result;
}

/** Nível máximo da EDT: 0 = Fase, 1 = Tarefa, 2 = Subtarefa. */
export const MAX_INDENT = 2;

/**
 * EDT (WBS) de cada tarefa em até 3 níveis, na ordem:
 * "1", "1.1", "1.2", "1.2.1", "2", "2.1"…
 */
export function computeWbs(tasks: ScheduleTask[]): string[] {
  const counters = [0, 0, 0];
  return tasks.map((task) => {
    const level = Math.min(MAX_INDENT, Math.max(0, task.indent ?? 0));
    counters[level] += 1;
    for (let deeper = level + 1; deeper < counters.length; deeper += 1) counters[deeper] = 0;
    return counters
      .slice(0, level + 1)
      .map((n) => n || 1)
      .join('.');
  });
}

/**
 * Tarefa-resumo: tem pelo menos uma linha abaixo com nível mais profundo.
 * Resumos não são agendados automaticamente — eles consolidam os filhos.
 */
export function isSummary(tasks: ScheduleTask[], index: number): boolean {
  const current = tasks[index];
  const next = tasks[index + 1];
  if (!current || !next) return false;
  return (next.indent ?? 0) > (current.indent ?? 0);
}

/**
 * Recursos alocados na tarefa, já absorvendo o formato antigo de um
 * responsável só (`resourceId`).
 */
export function resourceIdsOf(task: ScheduleTask): string[] {
  if (task.resourceIds?.length) return task.resourceIds;
  return task.resourceId ? [task.resourceId] : [];
}

/**
 * Duração da tarefa. Com um calendário, conta apenas **dias úteis**
 * (pulando fins de semana e feriados); sem ele, conta dias corridos.
 */
export function taskDuration(task: ScheduleTask, cal?: ScheduleCalendar): number | null {
  if (!task.start || !task.end) return null;
  if (cal) return workingDaysBetween(task.start, task.end, cal);
  return spanDays(task.start, task.end);
}

export function taskPlanned(task: ScheduleTask, now: Date = new Date()): number | null {
  return plannedFor(task.start, task.end, now);
}

export function taskStatus(task: ScheduleTask, now: Date = new Date()): ScheduleStatus {
  return statusFor(task.end, task.progress ?? 0, now);
}

/** Término de uma tarefa a partir do início + duração em dias. */
export function taskEndFromDuration(startISO: string, days: number): string {
  return endFromDuration(startISO, days);
}

/**
 * Copia a estrutura de um cronograma para outro card: gera ids novos,
 * remapeia as predecessoras e (opcionalmente) zera o % e desloca as datas
 * para um novo início, mantendo as durações e os intervalos entre tarefas.
 */
export function cloneTasks(
  source: ScheduleTask[],
  options: { resetProgress?: boolean; newStart?: string | null } = {},
): ScheduleTask[] {
  const idMap = new Map<string, string>();
  for (const task of source) idMap.set(task.id, crypto.randomUUID());

  let shift = 0;
  if (options.newStart) {
    const starts = source.map((task) => task.start).filter((s): s is string => !!s);
    if (starts.length > 0) {
      const earliest = Math.min(...starts.map(startOfDay));
      shift = startOfDay(options.newStart) - earliest;
    }
  }

  const shifted = (iso: string | null): string | null => {
    if (!iso) return null;
    if (!shift) return iso;
    return new Date(startOfDay(iso) + shift + 12 * 3600 * 1000).toISOString();
  };

  return source.map((task) => ({
    ...task,
    id: idMap.get(task.id) as string,
    progress: options.resetProgress ? 0 : task.progress,
    start: shifted(task.start),
    end: shifted(task.end),
    predecessors: (task.predecessors ?? [])
      .map((p) => idMap.get(p))
      .filter((p): p is string => !!p),
  }));
}

export interface ScheduleRollup {
  count: number;
  start: string | null;
  end: string | null;
  progress: number;
  work: number | null;
  cost: number | null;
}

/**
 * Consolida as tarefas: menor início, maior término, % ponderado por duração
 * e somas de Trabalho/Custo.
 *
 * ⚠️ Fases e tarefas-resumo ficam **de fora das somas**: elas já carregam o
 * consolidado das filhas (`rollupSummaries`), então contá-las de novo
 * duplicaria Trabalho, Custo e o peso do %.
 */
export function rollupTasks(tasks: ScheduleTask[]): ScheduleRollup {
  if (tasks.length === 0) {
    return { count: 0, start: null, end: null, progress: 0, work: null, cost: null };
  }

  let minStart: number | null = null;
  let maxEnd: number | null = null;
  let weighted = 0;
  let weight = 0;
  let work = 0;
  let cost = 0;
  let hasWork = false;
  let hasCost = false;
  let leaves = 0;

  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    const summary = isSummary(tasks, i);

    if (task.start) {
      const s = startOfDay(task.start);
      if (minStart === null || s < minStart) minStart = s;
    }
    if (task.end) {
      const e = startOfDay(task.end);
      if (maxEnd === null || e > maxEnd) maxEnd = e;
    }
    if (summary) continue;
    leaves += 1;

    const w = taskDuration(task) ?? 1;
    weighted += (task.progress ?? 0) * w;
    weight += w;
    if (task.work !== null && task.work !== undefined) {
      work += task.work;
      hasWork = true;
    }
    if (task.cost !== null && task.cost !== undefined) {
      cost += task.cost;
      hasCost = true;
    }
  }

  return {
    count: leaves || tasks.length,
    start: minStart === null ? null : new Date(minStart).toISOString(),
    end: maxEnd === null ? null : new Date(maxEnd).toISOString(),
    progress: weight > 0 ? Math.round(weighted / weight) : 0,
    work: hasWork ? work : null,
    cost: hasCost ? cost : null,
  };
}

/** true se o card tem cronograma de projeto (tarefas internas). */
export function hasProjectSchedule(item: Item): boolean {
  return (item.schedule_tasks?.length ?? 0) > 0;
}

export interface EffectiveSchedule extends ScheduleRollup {
  duration: number | null;
  planned: number | null;
  status: ScheduleStatus;
  /** true quando os números vieram das tarefas internas (não dos campos do card). */
  fromTasks: boolean;
}

/**
 * Números de cronograma do card: se há tarefas internas, tudo vem consolidado
 * delas; caso contrário, dos campos manuais do próprio card.
 */
export function effectiveSchedule(item: Item, now: Date = new Date()): EffectiveSchedule {
  const tasks = item.schedule_tasks ?? [];

  if (tasks.length > 0) {
    const r = rollupTasks(tasks);
    return {
      ...r,
      duration: spanDays(r.start, r.end),
      planned: plannedFor(r.start, r.end, now),
      // Card concluído na mão fica verde mesmo com tarefas em aberto.
      status: item.done_at ? 'green' : statusFor(r.end, r.progress, now),
      fromTasks: true,
    };
  }

  return {
    count: 0,
    start: item.start_at ?? null,
    end: item.due_at ?? null,
    progress: actualProgress(item),
    work: item.work_hours ?? null,
    cost: item.cost ?? null,
    duration: durationDays(item),
    planned: plannedProgress(item, now),
    status: scheduleStatus(item, now),
    fromTasks: false,
  };
}
