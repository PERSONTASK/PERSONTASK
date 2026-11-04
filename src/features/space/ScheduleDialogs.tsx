import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Plus, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { DEFAULT_CALENDAR } from '@/lib/schedule';
import type { Resource, ScheduleCalendar } from '@/types';

// ── Recursos (pessoas + custo/hora) ───────────────────────────────────────

/**
 * Cadastro de recursos do Espaço — reaproveitado por todos os projetos.
 * A edição é feita direto na lista (grava ao sair do campo).
 */
export function ResourcesDialog({
  spaceId,
  userId,
  canEdit,
  onClose,
  onChanged,
}: {
  spaceId: string;
  userId: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (list: Resource[]) => void;
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.resources
      .list(spaceId)
      .then((r) => {
        setList(r);
        onChanged(r);
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  function commit(next: Resource[]) {
    setList(next);
    onChanged(next);
  }

  async function addResource() {
    setBusy(true);
    try {
      const created = await api.resources.create({
        space_id: spaceId,
        name: t('schedule.newResource'),
        role: null,
        hourly_cost: null,
        email: null,
        created_by: userId,
      });
      commit([...list, created]);
    } finally {
      setBusy(false);
    }
  }

  async function patchResource(id: string, patch: Partial<Resource>) {
    commit(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await api.resources.update(id, patch).catch(() => void 0);
  }

  async function removeResource(resource: Resource) {
    if (!confirm(t('schedule.deleteResourceConfirm', { name: resource.name }))) return;
    commit(list.filter((r) => r.id !== resource.id));
    await api.resources.remove(resource.id).catch(() => void 0);
  }

  const num = (value: string): number | null => {
    const n = Number(value.replace(',', '.'));
    return value.trim() === '' || Number.isNaN(n) ? null : n;
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={t('schedule.resources')}
      footer={
        <>
          {canEdit && (
            <button className="btn-secondary" onClick={addResource} disabled={busy}>
              {busy ? <Spinner /> : <UserPlus size={15} />} {t('schedule.addResource')}
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10 text-brand-indigo">
          <Spinner className="h-7 w-7" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">{t('schedule.noResources')}</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_110px_36px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            <span>{t('schedule.resourceName')}</span>
            <span>{t('schedule.resourceRole')}</span>
            <span>{t('schedule.hourlyCost')}</span>
            <span />
          </div>
          {list.map((resource) => (
            <div key={resource.id} className="grid grid-cols-[1fr_1fr_110px_36px] gap-2">
              <input
                className="field py-1.5 text-sm"
                disabled={!canEdit}
                defaultValue={resource.name}
                onBlur={(e) =>
                  e.target.value.trim() !== resource.name &&
                  patchResource(resource.id, { name: e.target.value.trim() || resource.name })
                }
              />
              <input
                className="field py-1.5 text-sm"
                disabled={!canEdit}
                defaultValue={resource.role ?? ''}
                onBlur={(e) => patchResource(resource.id, { role: e.target.value.trim() || null })}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                className="field py-1.5 text-sm"
                disabled={!canEdit}
                defaultValue={resource.hourly_cost ?? ''}
                onBlur={(e) => patchResource(resource.id, { hourly_cost: num(e.target.value) })}
              />
              {canEdit && (
                <button
                  className="btn-ghost px-2 text-red-500 hover:bg-red-500/10"
                  title={t('common.delete')}
                  onClick={() => removeResource(resource)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <p className="pt-1 text-[11px] text-ink-faint">{t('schedule.resourcesHint')}</p>
        </div>
      )}
    </Modal>
  );
}

// ── Calendário do projeto ─────────────────────────────────────────────────

/** Configura dias úteis, jornada e feriados de UM projeto (card). */
export function CalendarDialog({
  calendar,
  canEdit,
  onClose,
  onSave,
}: {
  calendar: ScheduleCalendar;
  canEdit: boolean;
  onClose: () => void;
  onSave: (calendar: ScheduleCalendar) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ScheduleCalendar>({
    workdays: [...calendar.workdays],
    holidays: [...calendar.holidays],
    hoursPerDay: calendar.hoursPerDay,
  });
  const [newHoliday, setNewHoliday] = useState('');

  /** Rótulos curtos dos dias da semana, no idioma do navegador. */
  const weekdays = useMemo(() => {
    const sunday = new Date(2024, 0, 7); // 07/01/2024 foi um domingo
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
    });
  }, []);

  function toggleDay(day: number) {
    setDraft((prev) => ({
      ...prev,
      workdays: prev.workdays.includes(day)
        ? prev.workdays.filter((d) => d !== day)
        : [...prev.workdays, day].sort(),
    }));
  }

  function addHoliday() {
    if (!newHoliday || draft.holidays.includes(newHoliday)) return;
    setDraft((prev) => ({ ...prev, holidays: [...prev.holidays, newHoliday].sort() }));
    setNewHoliday('');
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={t('schedule.calendar')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)} disabled={!canEdit}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">{t('schedule.workdays')}</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {weekdays.map((label, day) => (
              <button
                key={day}
                disabled={!canEdit}
                onClick={() => toggleDay(day)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                  draft.workdays.includes(day)
                    ? 'bg-brand-gradient text-white'
                    : 'bg-surface-raised text-ink-soft hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">{t('schedule.workdaysHint')}</p>
        </div>

        <div>
          <label className="label">{t('schedule.hoursPerDay')}</label>
          <input
            type="number"
            min={1}
            max={24}
            step="0.5"
            className="field mt-1 max-w-[140px]"
            disabled={!canEdit}
            value={draft.hoursPerDay}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, hoursPerDay: Number(e.target.value) || DEFAULT_CALENDAR.hoursPerDay }))
            }
          />
        </div>

        <div>
          <label className="label">{t('schedule.holidays')}</label>
          {canEdit && (
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                className="field max-w-[180px]"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
              />
              <button className="btn-secondary" onClick={addHoliday} disabled={!newHoliday}>
                <Plus size={15} /> {t('common.add')}
              </button>
            </div>
          )}
          {draft.holidays.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
              <CalendarOff size={13} /> {t('schedule.noHolidays')}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.holidays.map((holiday) => (
                <span
                  key={holiday}
                  className="flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs"
                >
                  {new Date(`${holiday}T12:00:00`).toLocaleDateString()}
                  {canEdit && (
                    <button
                      className="text-ink-faint hover:text-red-500"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, holidays: prev.holidays.filter((h) => h !== holiday) }))
                      }
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-ink-soft">
          {t('schedule.calendarHint')}
        </p>
      </div>
    </Modal>
  );
}
