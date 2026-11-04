import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import type { Board, Column, ColumnRole, CustomFieldDef } from '@/types';

const ROLES: ColumnRole[] = ['open', 'won', 'lost', 'ignore'];

const ROLE_CLASS: Record<ColumnRole, string> = {
  open: 'bg-blue-500 text-white',
  won: 'bg-emerald-500 text-white',
  lost: 'bg-red-500 text-white',
  ignore: 'bg-ink-faint/60 text-white',
};

/**
 * Configuração do relatório de Funil, por Painel: qual campo numérico é o
 * VALOR do negócio e o que cada Coluna significa. É o mínimo que só o dono
 * do processo sabe — sem isso não dá para calcular ganho, perda nem
 * conversão.
 */
export function ReportConfigDialog({
  board,
  columns,
  numberFields,
  onClose,
  onSaved,
}: {
  board: Board;
  columns: Column[];
  numberFields: CustomFieldDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [valueFieldId, setValueFieldId] = useState(board.report_config?.valueFieldId ?? '');
  const [roles, setRoles] = useState<Record<string, ColumnRole>>(() => {
    const saved = board.report_config?.columnRoles ?? {};
    const next: Record<string, ColumnRole> = {};
    columns.forEach((c) => (next[c.id] = saved[c.id] ?? 'open'));
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.boards.setReportConfig(board.id, {
        valueFieldId: valueFieldId || null,
        columnRoles: roles,
      });
      onSaved();
    } catch (e) {
      console.error('[report] não consegui salvar a configuração', e);
      setError(t('report.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={`${t('report.configure')} — ${board.name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !valueFieldId}>
            {saving ? <Spinner /> : <Save size={15} />} {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">{t('report.valueField')}</label>
          <select
            className="field mt-1"
            value={valueFieldId}
            onChange={(e) => setValueFieldId(e.target.value)}
          >
            <option value="">{t('report.pickField')}</option>
            {numberFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.config.money ? ` · ${t('fields.money')}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-faint">
            {numberFields.length === 0 ? t('report.noNumberField') : t('report.valueFieldHint')}
          </p>
        </div>

        <div>
          <label className="label">{t('report.columnRoles')}</label>
          <p className="mb-2 text-[11px] text-ink-faint">{t('report.columnRolesHint')}</p>
          <div className="space-y-1.5">
            {columns.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                <div className="flex shrink-0 gap-0.5 rounded-lg bg-surface-raised p-0.5">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => setRoles((prev) => ({ ...prev, [c.id]: role }))}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                        roles[c.id] === role ? ROLE_CLASS[role] : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {t(`report.role_${role}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
