import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ALL_PERMISSIONS, type AccessProfile, type Permission } from '@/types';
import { Spinner } from '@/components/Spinner';

export function AccessProfilesEditor({
  spaceId,
  accessProfiles,
  onChanged,
}: {
  spaceId: string;
  accessProfiles: AccessProfile[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function togglePerm(ap: AccessProfile, perm: Permission) {
    const has = ap.permissions.includes(perm);
    const next = has ? ap.permissions.filter((p) => p !== perm) : [...ap.permissions, perm];
    await api.accessProfiles.update(ap.id, { permissions: next });
    await onChanged();
  }

  async function rename(ap: AccessProfile, name: string) {
    if (name.trim() && name !== ap.name) {
      await api.accessProfiles.update(ap.id, { name: name.trim() });
      await onChanged();
    }
  }

  async function addProfile() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.accessProfiles.create(spaceId, newName.trim(), ['item.create', 'comment.create']);
      setNewName('');
      setAdding(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(ap: AccessProfile) {
    if (!confirm(`${t('common.delete')} "${ap.name}"?`)) return;
    await api.accessProfiles.remove(ap.id);
    await onChanged();
  }

  return (
    <div className="space-y-3">
      {accessProfiles.map((ap) => (
        <div key={ap.id} className="rounded-xl border border-line/10 bg-surface-raised p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={15} className="text-brand-indigo" />
            <input
              className="flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-bold outline-none focus:bg-surface-overlay"
              defaultValue={ap.name}
              disabled={ap.is_system}
              onBlur={(e) => rename(ap, e.target.value)}
            />
            {ap.is_system ? (
              <span className="rounded-full bg-line/10 px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                padrão
              </span>
            ) : (
              <button className="text-ink-faint hover:text-red-500" onClick={() => remove(ap)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="accent-brand-indigo"
                  checked={ap.permissions.includes(perm)}
                  onChange={() => togglePerm(ap, perm)}
                />
                {t(`permissions.${perm}`)}
              </label>
            ))}
          </div>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="field flex-1"
            placeholder={t('members.profileName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProfile()}
          />
          <button className="btn-primary" onClick={addProfile} disabled={busy || !newName.trim()}>
            {busy ? <Spinner /> : t('common.add')}
          </button>
        </div>
      ) : (
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-brand-indigo hover:underline"
          onClick={() => setAdding(true)}
        >
          <Plus size={15} /> {t('members.addProfile')}
        </button>
      )}
    </div>
  );
}
