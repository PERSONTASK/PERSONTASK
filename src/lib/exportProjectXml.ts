import type { Resource, ScheduleCalendar, ScheduleTask } from '@/types';
import { computeWbs, isSummary, resourceIdsOf, taskDuration } from './schedule';

/**
 * Exportação do cronograma em **XML no padrão MSPDI** (Microsoft Project
 * Data Interchange) — o formato de intercâmbio publicado pela Microsoft.
 * O arquivo gerado abre no Microsoft Project por Arquivo › Abrir, e também
 * em outros apps de gestão de projetos que leem esse padrão.
 *
 * Por que não .MPP: o .mpp é binário e proprietário, sem especificação
 * pública para gravação — não existe forma legítima de gerá-lo no
 * navegador. O XML é o caminho oficial para levar o cronograma ao Project.
 *
 * Limitações conhecidas (propositais, para o arquivo abrir sem erro):
 *  - os feriados do calendário do PERSONTASK não viram exceções de
 *    calendário no Project; as datas já exportadas, porém, respeitam eles;
 *  - as Observações das tarefas não são enviadas.
 */

/** 1 = domingo … 7 = sábado, na numeração do Project. */
const PROJECT_DAY = [1, 2, 3, 4, 5, 6, 7];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Data local no formato do Project (sem fuso): YYYY-MM-DDTHH:MM:SS. */
function mspDate(iso: string, hour: number, minute = 0): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

/** Duração no formato do Project: PT{h}H{m}M0S. */
function mspDuration(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60));
  return `PT${Math.floor(total / 60)}H${total % 60}M0S`;
}

/** Valores monetários no MSPDI são gravados multiplicados por 100. */
function mspMoney(value: number | null | undefined): string {
  return String(Math.round((value ?? 0) * 100));
}

function hhmm(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function buildCalendar(cal: ScheduleCalendar): string {
  const from = hhmm(8);
  const to = hhmm(8 + Math.min(14, Math.max(1, cal.hoursPerDay)));

  const weekDays = PROJECT_DAY.map((projectDay) => {
    // No Project o dia 1 é domingo; no nosso calendário, 0.
    const working = cal.workdays.includes(projectDay - 1);
    if (!working) {
      return `        <WeekDay>\n          <DayType>${projectDay}</DayType>\n          <DayWorking>0</DayWorking>\n        </WeekDay>`;
    }
    return [
      '        <WeekDay>',
      `          <DayType>${projectDay}</DayType>`,
      '          <DayWorking>1</DayWorking>',
      '          <WorkingTimes>',
      '            <WorkingTime>',
      `              <FromTime>${from}</FromTime>`,
      `              <ToTime>${to}</ToTime>`,
      '            </WorkingTime>',
      '          </WorkingTimes>',
      '        </WeekDay>',
    ].join('\n');
  }).join('\n');

  return [
    '  <Calendars>',
    '    <Calendar>',
    '      <UID>1</UID>',
    '      <Name>PERSONTASK</Name>',
    '      <IsBaseCalendar>1</IsBaseCalendar>',
    '      <BaseCalendarUID>-1</BaseCalendarUID>',
    '      <WeekDays>',
    weekDays,
    '      </WeekDays>',
    '    </Calendar>',
    '  </Calendars>',
  ].join('\n');
}

export interface ProjectXmlInput {
  /** Nome do projeto (título do card). */
  name: string;
  tasks: ScheduleTask[];
  calendar: ScheduleCalendar;
  resources: Resource[];
  /** Nome do arquivo, sem extensão. */
  fileName: string;
}

/** Monta o XML MSPDI do cronograma (exposto para teste/reuso). */
export function buildProjectXml(input: ProjectXmlInput): string {
  const { tasks, calendar } = input;
  const wbs = computeWbs(tasks);
  const uidByTask = new Map<string, number>();
  tasks.forEach((task, i) => uidByTask.set(task.id, i + 1));

  const dates = tasks.flatMap((task) => [task.start, task.end]).filter(Boolean) as string[];
  const times = dates.map((d) => new Date(d).getTime());
  const startDate = times.length ? mspDate(new Date(Math.min(...times)).toISOString(), 8) : mspDate(new Date().toISOString(), 8);
  const finishDate = times.length
    ? mspDate(new Date(Math.max(...times)).toISOString(), 8 + calendar.hoursPerDay)
    : startDate;

  // ── Tarefas ───────────────────────────────────────────────────────────
  const taskXml = tasks.map((task, i) => {
    const days = task.duration ?? taskDuration(task, calendar) ?? 1;
    const summary = isSummary(tasks, i);
    const lines = [
      '    <Task>',
      `      <UID>${i + 1}</UID>`,
      `      <ID>${i + 1}</ID>`,
      `      <Name>${escapeXml(task.name || '—')}</Name>`,
      '      <Type>1</Type>',
      '      <IsNull>0</IsNull>',
      `      <WBS>${escapeXml(wbs[i])}</WBS>`,
      `      <OutlineLevel>${(task.indent ?? 0) + 1}</OutlineLevel>`,
      '      <Priority>500</Priority>',
    ];
    if (task.start) lines.push(`      <Start>${mspDate(task.start, 8)}</Start>`);
    if (task.end) lines.push(`      <Finish>${mspDate(task.end, 8 + calendar.hoursPerDay)}</Finish>`);
    lines.push(
      `      <Duration>${mspDuration(days * calendar.hoursPerDay)}</Duration>`,
      '      <DurationFormat>7</DurationFormat>',
      `      <Work>${mspDuration(task.work ?? days * calendar.hoursPerDay)}</Work>`,
      '      <Milestone>0</Milestone>',
      `      <Summary>${summary ? 1 : 0}</Summary>`,
      `      <PercentComplete>${Math.round(task.progress ?? 0)}</PercentComplete>`,
      `      <Cost>${mspMoney(task.cost)}</Cost>`,
    );
    for (const pid of task.predecessors ?? []) {
      const uid = uidByTask.get(pid);
      if (!uid) continue;
      lines.push(
        '      <PredecessorLink>',
        `        <PredecessorUID>${uid}</PredecessorUID>`,
        '        <Type>1</Type>',
        '      </PredecessorLink>',
      );
    }
    lines.push('    </Task>');
    return lines.join('\n');
  });

  // ── Recursos (só os que estão alocados em alguma tarefa) ──────────────
  const usedIds = new Set<string>();
  tasks.forEach((task) => resourceIdsOf(task).forEach((id) => usedIds.add(id)));
  const used = input.resources.filter((r) => usedIds.has(r.id));
  const uidByResource = new Map<string, number>();
  used.forEach((r, i) => uidByResource.set(r.id, i + 1));

  const resourceXml = used.map((r, i) =>
    [
      '    <Resource>',
      `      <UID>${i + 1}</UID>`,
      `      <ID>${i + 1}</ID>`,
      `      <Name>${escapeXml(r.name)}</Name>`,
      '      <Type>1</Type>',
      '      <IsNull>0</IsNull>',
      '      <MaxUnits>1</MaxUnits>',
      `      <StandardRate>${mspMoney(r.hourly_cost)}</StandardRate>`,
      '      <StandardRateFormat>2</StandardRateFormat>',
      '    </Resource>',
    ].join('\n'),
  );

  // ── Alocações: cada responsável trabalha as horas da tarefa ───────────
  const assignmentXml: string[] = [];
  let assignmentUid = 1;
  tasks.forEach((task, i) => {
    const days = task.duration ?? taskDuration(task, calendar) ?? 1;
    const hours = task.work ?? days * calendar.hoursPerDay;
    for (const rid of resourceIdsOf(task)) {
      const ruid = uidByResource.get(rid);
      if (!ruid) continue;
      assignmentXml.push(
        [
          '    <Assignment>',
          `      <UID>${assignmentUid}</UID>`,
          `      <TaskUID>${i + 1}</TaskUID>`,
          `      <ResourceUID>${ruid}</ResourceUID>`,
          '      <Units>1</Units>',
          `      <Work>${mspDuration(hours)}</Work>`,
          '    </Assignment>',
        ].join('\n'),
      );
      assignmentUid += 1;
    }
  });

  const minutesPerDay = Math.round(calendar.hoursPerDay * 60);
  const minutesPerWeek = minutesPerDay * Math.max(1, calendar.workdays.length);

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    '  <SaveVersion>14</SaveVersion>',
    `  <Name>${escapeXml(input.fileName)}.xml</Name>`,
    `  <Title>${escapeXml(input.name)}</Title>`,
    '  <ScheduleFromStart>1</ScheduleFromStart>',
    `  <StartDate>${startDate}</StartDate>`,
    `  <FinishDate>${finishDate}</FinishDate>`,
    '  <CalendarUID>1</CalendarUID>',
    `  <DefaultStartTime>${hhmm(8)}</DefaultStartTime>`,
    `  <DefaultFinishTime>${hhmm(8 + calendar.hoursPerDay)}</DefaultFinishTime>`,
    `  <MinutesPerDay>${minutesPerDay}</MinutesPerDay>`,
    `  <MinutesPerWeek>${minutesPerWeek}</MinutesPerWeek>`,
    '  <DaysPerMonth>20</DaysPerMonth>',
    '  <DefaultTaskType>1</DefaultTaskType>',
    '  <DurationFormat>7</DurationFormat>',
    '  <WorkFormat>2</WorkFormat>',
    buildCalendar(calendar),
    '  <Tasks>',
    ...taskXml,
    '  </Tasks>',
    '  <Resources>',
    ...resourceXml,
    '  </Resources>',
    '  <Assignments>',
    ...assignmentXml,
    '  </Assignments>',
    '</Project>',
    '',
  ].join('\n');
}

/** Gera e baixa o .xml do cronograma. */
export function exportToProjectXml(input: ProjectXmlInput): void {
  const xml = buildProjectXml(input);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${input.fileName.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
