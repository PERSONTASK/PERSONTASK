import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, ListTree } from 'lucide-react';
import type { Item } from '@/types';
import {
  checklistProgress,
  effectiveSchedule,
  endFromDuration,
  type ScheduleStatus,
} from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { useSpace } from '@/contexts/SpaceContext';
import { ProjectScheduleModal } from './ProjectScheduleModal';

function toDateInput(iso?: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

const STATUS_STYLE: Record<ScheduleStatus, string> = {
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  yellow: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
  none: 'bg-line/10 text-ink-faint',
};

const STATUS_DOT: Record<ScheduleStatus, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  none: 'bg-ink-faint/50',
};

/** Barra comparando avanço real x previsto (marca o previsto com um traço). */
function ProgressBar({ actual, planned }: { actual: number; planned: number | null }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-line/15">
      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, actual)}%` }} />
      {planned !== null && (
        <span
          className="absolute top-0 h-full w-0.5 bg-ink/50"
          style={{ left: `${Math.min(100, planned)}%` }}
          title={`${planned}%`}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * Seção "Cronograma" do card.
 *
 * O card pode ser:
 *  • uma TAREFA simples → campos manuais (Início, Término, %, Trabalho, Custo);
 *  • um PROJETO → tem tarefas internas e os números vêm consolidados delas
 *    (os campos manuais ficam ocultos para não conflitar).
 */
export function ScheduleSection({
  item,
  canEdit,
  userId,
  onChange,
}: {
  item: Item;
  canEdit: boolean;
  userId: string;
  onChange: (patch: Partial<Item>) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'pt-BR';
  const { space } = useSpace();
  const [openProject, setOpenProject] = useState(false);

  const eff = effectiveSchedule(item);
  const fromChecklist = checklistProgress(item);
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const fmtNum = (v?: number | null) =>
    v === null || v === undefined ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  function setDuration(value: string) {
    const days = Number(value);
    if (!item.start_at || !days || days < 1) return;
    onChange({ due_at: endFromDuration(item.start_at, days) });
  }

  function num(value: string): number | null {
    const n = Number(value.replace(',', '.'));
    return value.trim() === '' || Number.isNaN(n) ? null : n;
  }

  return (
    <div className="space-y-3">
      {/* Resumo com semáforo */}
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2', STATUS_STYLE[eff.status])}>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
          <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[eff.status])} />
          {t(`schedule.status_${eff.status}`)}
        </span>
        <span className="text-xs">
          {t('schedule.actual')}: <strong>{eff.progress}%</strong>
        </span>
        {eff.planned !== null && (
          <span className="text-xs">
            {t('schedule.planned')}: <strong>{eff.planned}%</strong>
          </span>
        )}
        {eff.fromTasks && (
          <span className="ml-auto text-xs font-semibold">
            {t('schedule.taskCount', { count: eff.count })}
          </span>
        )}
      </div>

      <ProgressBar actual={eff.progress} planned={eff.planned} />

      {/* Botão do cronograma do projeto */}
      <button className="btn-secondary w-full justify-center sm:w-auto" onClick={() => setOpenProject(true)}>
        {eff.fromTasks ? <ListTree size={15} /> : <BarChart3 size={15} />}
        {eff.fromTasks ? t('schedule.openProject') : t('schedule.createProject')}
      </button>

      {eff.fromTasks ? (
        /* Projeto: números consolidados das tarefas (somente leitura) */
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Fact label={t('schedule.start')} value={fmtDate(eff.start)} />
            <Fact label={t('schedule.end')} value={fmtDate(eff.end)} />
            <Fact label={t('schedule.duration')} value={eff.duration === null ? '—' : String(eff.duration)} />
            <Fact label={t('schedule.work')} value={fmtNum(eff.work)} />
            <Fact label={t('schedule.cost')} value={formatMoney(eff.cost, space?.currency, locale)} />
            <Fact label={t('schedule.progress')} value={`${eff.progress}%`} />
          </div>
          <p className="text-[11px] text-ink-faint">{t('schedule.fromTasksHint')}</p>
        </>
      ) : (
        /* Tarefa simples: campos manuais */
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t('schedule.start')}</label>
            <input
              type="date"
              className="field mt-1"
              disabled={!canEdit}
              value={toDateInput(item.start_at)}
              onChange={(e) => onChange({ start_at: fromDateInput(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">{t('schedule.end')}</label>
            <input
              type="date"
              className="field mt-1"
              disabled={!canEdit}
              value={toDateInput(item.due_at)}
              onChange={(e) => onChange({ due_at: fromDateInput(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">{t('schedule.duration')}</label>
            <input
              type="number"
              min={1}
              className="field mt-1"
              disabled={!canEdit || !item.start_at}
              placeholder={item.start_at ? '' : t('schedule.needsStart')}
              value={eff.duration ?? ''}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t('schedule.progress')}</label>
            <input
              type="number"
              min={0}
              max={100}
              className="field mt-1"
              disabled={!canEdit}
              placeholder={fromChecklist !== null ? String(fromChecklist) : '0'}
              value={item.progress ?? ''}
              onChange={(e) => onChange({ progress: num(e.target.value) })}
            />
            {item.progress === null || item.progress === undefined ? (
              <p className="mt-1 text-[11px] text-ink-faint">
                {fromChecklist !== null ? t('schedule.fromChecklist') : t('schedule.progressHint')}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label">{t('schedule.work')}</label>
            <input
              type="number"
              min={0}
              className="field mt-1"
              disabled={!canEdit}
              value={item.work_hours ?? ''}
              onChange={(e) => onChange({ work_hours: num(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">{t('schedule.cost')}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="field mt-1"
              disabled={!canEdit}
              value={item.cost ?? ''}
              onChange={(e) => onChange({ cost: num(e.target.value) })}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="label">{t('schedule.mode')}</label>
            <select
              className="field mt-1 sm:max-w-[220px]"
              disabled={!canEdit}
              value={item.schedule_mode ?? 'manual'}
              onChange={(e) => onChange({ schedule_mode: e.target.value as 'manual' | 'auto' })}
            >
              <option value="manual">{t('schedule.mode_manual')}</option>
              <option value="auto">{t('schedule.mode_auto')}</option>
            </select>
          </div>
        </div>
      )}

      {openProject && (
        <ProjectScheduleModal
          item={item}
          canEdit={canEdit}
          userId={userId}
          onClose={() => setOpenProject(false)}
          onPatch={onChange}
        />
      )}
    </div>
  );
}
