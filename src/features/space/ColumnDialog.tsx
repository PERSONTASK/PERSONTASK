import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import { Modal } from '@/components/Modal';
import type { Column } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#6366F1', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#EF4444'];

export function ColumnDialog({
  open,
  column,
  canPickColor,
  onClose,
  onSave,
}: {
  open: boolean;
  column: Column | null;
  /** Cor personalizada de Coluna é recurso Premium. */
  canPickColor: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (open) {
      setTitle(column?.title ?? '');
      setColor(column?.color ?? COLORS[0]);
    }
  }, [open, column]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={column ? t('common.edit') : t('column.add')}
      width={400}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={() => onSave(title.trim(), color)} disabled={!title.trim()}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">{t('column.title')}</label>
          <input
            className="field mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('column.titlePlaceholder')}
            autoFocus
          />
        </div>
        <div>
          <label className="label">{t('column.color')}</label>
          {canPickColor ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition',
                    color === c ? 'border-ink' : 'border-transparent',
                  )}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
              <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Crown size={13} /> {t('column.premiumColor')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
