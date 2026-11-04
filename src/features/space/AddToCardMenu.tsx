import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar, CalendarRange, CheckSquare, Users, Paperclip, Box, Building2 } from 'lucide-react';

export type AddOption =
  | 'dates'
  | 'checklist'
  | 'members'
  | 'attachment'
  | 'field'
  | 'client'
  | 'schedule';

export function AddToCardMenu({
  canManageFields,
  onSelect,
}: {
  canManageFields: boolean;
  onSelect: (o: AddOption) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const opts: { key: AddOption; icon: ReactNode; label: string; desc: string; show?: boolean }[] = [
    { key: 'client', icon: <Building2 size={16} />, label: t('crm.section'), desc: t('crm.sectionDesc') },
    { key: 'schedule', icon: <CalendarRange size={16} />, label: t('schedule.section'), desc: t('schedule.sectionDesc') },
    { key: 'dates', icon: <Calendar size={16} />, label: t('item.dueDate'), desc: t('add.datesDesc') },
    { key: 'checklist', icon: <CheckSquare size={16} />, label: t('checklist.title'), desc: t('add.checklistDesc') },
    { key: 'members', icon: <Users size={16} />, label: t('item.assignees'), desc: t('add.membersDesc') },
    { key: 'attachment', icon: <Paperclip size={16} />, label: t('item.attachments'), desc: t('add.attachmentDesc') },
    { key: 'field', icon: <Box size={16} />, label: t('item.customFields'), desc: t('add.fieldDesc'), show: canManageFields },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      >
        <Plus size={16} /> {t('common.add')}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-line/10 bg-surface-overlay py-1 shadow-lift animate-scale-in">
          <p className="px-3 py-1.5 text-center text-xs font-bold text-ink-soft">{t('add.title')}</p>
          {opts
            .filter((o) => o.show !== false)
            .map((o) => (
              <button
                key={o.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onSelect(o.key);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-line/5"
              >
                <span className="mt-0.5 text-ink-soft">{o.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-ink-faint">{o.desc}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
