import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Trash2, Upload, Palette, Type, Bell, Tag, ListChecks, Link2, Building2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import type { Label, Space } from '@/types';
import { SidePanel } from '@/components/Modal';
import { cn } from '@/lib/utils';
import { FieldsManager } from './FieldsManager';

const BG_COLORS = ['#6366F1', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#64748B'];
const FONTS = ['Roboto', 'Inter', 'Lato', 'Montserrat', 'Open Sans', 'Poppins'];

function PremiumLock({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <Crown size={14} /> <span className="font-semibold">{t('space.premiumOnly')}:</span> {text}
    </div>
  );
}

function SettingsSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-faint">
        {icon} {title}
      </h4>
      {children}
    </section>
  );
}

export function SpaceSettingsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { isPremium } = useAuth();
  const { space, isOwner, labels, fieldDefs, reloadSpace, reloadLabels, reloadFields } = useSpace();
  const navigate = useNavigate();
  const bgInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  if (!space) return null;

  async function patchSpace(p: Partial<Space>) {
    await api.spaces.update(space!.id, p);
    await reloadSpace();
  }

  async function uploadBg(file: File) {
    const url = await api.storage.uploadSpaceAsset(space!.id, file);
    await patchSpace({ bg_image_url: url });
  }

  async function uploadLogo(file: File) {
    const url = await api.storage.uploadSpaceAsset(space!.id, file);
    await patchSpace({ logo_url: url });
  }

  async function deleteSpace() {
    if (!confirm(t('space.deleteConfirm'))) return;
    await api.spaces.remove(space!.id);
    navigate('/', { replace: true });
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      title={t('space.settingsTitle')}
      width={520}
      footer={
        <button className="btn-primary" onClick={onClose}>
          <Save size={15} /> {t('common.save')}
        </button>
      }
    >
      <div className="space-y-7">
        {/* Appearance */}
        <SettingsSection icon={<Palette size={13} />} title={t('space.appearance')}>
          <div>
            <label className="label">{t('space.backgroundColor')}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => patchSpace({ bg_color: c, bg_image_url: null })}
                  className={cn(
                    'h-8 w-8 rounded-full border-2',
                    space.bg_color === c && !space.bg_image_url ? 'border-ink' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t('space.backgroundImage')}</label>
            {isPremium ? (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  ref={bgInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadBg(e.target.files[0])}
                />
                <button className="btn-secondary" onClick={() => bgInput.current?.click()}>
                  <Upload size={15} /> {t('space.backgroundImage')}
                </button>
                {space.bg_image_url && (
                  <button className="btn-ghost text-red-500" onClick={() => patchSpace({ bg_image_url: null })}>
                    <Trash2 size={14} /> {t('common.remove')}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-1.5">
                <PremiumLock text={t('space.premiumBg')} />
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Company logo (Premium) */}
        <SettingsSection icon={<Building2 size={13} />} title={t('space.companyLogo')}>
          {isPremium ? (
            <div className="flex items-center gap-3">
              {space.logo_url ? (
                <img
                  src={space.logo_url}
                  alt={t('space.companyLogo')}
                  className="h-10 max-w-[140px] rounded-md border border-line/10 bg-surface-raised object-contain p-1"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line/20 text-ink-faint">
                  <Building2 size={16} />
                </div>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              <button className="btn-secondary" onClick={() => logoInput.current?.click()}>
                <Upload size={15} /> {space.logo_url ? t('common.edit') : t('space.companyLogo')}
              </button>
              {space.logo_url && (
                <button className="btn-ghost text-red-500" onClick={() => patchSpace({ logo_url: null })}>
                  <Trash2 size={14} /> {t('common.remove')}
                </button>
              )}
            </div>
          ) : (
            <PremiumLock text={t('space.premiumLogo')} />
          )}
        </SettingsSection>

        {/* Font */}
        <SettingsSection icon={<Type size={13} />} title={t('space.font')}>
          {isPremium ? (
            <select
              className="field"
              value={space.font_family}
              onChange={(e) => patchSpace({ font_family: e.target.value })}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input className="field" value="Roboto" disabled />
              <PremiumLock text={t('space.premiumFont')} />
            </>
          )}
        </SettingsSection>

        {/* Due-soon lead days */}
        <SettingsSection icon={<Bell size={13} />} title={t('space.dueSoonDays')}>
          <input
            type="number"
            min={0}
            max={30}
            className="field w-28"
            defaultValue={space.due_soon_lead_days}
            onBlur={(e) => patchSpace({ due_soon_lead_days: Math.max(0, Number(e.target.value) || 0) })}
          />
        </SettingsSection>

        {/* Labels */}
        <SettingsSection icon={<Tag size={13} />} title={t('labels.manage')}>
          <LabelsManager spaceId={space.id} labels={labels} onChanged={reloadLabels} />
        </SettingsSection>

        {/* Custom fields */}
        <SettingsSection icon={<ListChecks size={13} />} title={t('fields.manageFields')}>
          <FieldsManager spaceId={space.id} fieldDefs={fieldDefs} onChanged={reloadFields} />
        </SettingsSection>

        {/* Linked spaces (Premium) */}
        <SettingsSection icon={<Link2 size={13} />} title={t('space.linkedSpaces')}>
          {isPremium ? (
            <LinkedSpaces spaceId={space.id} />
          ) : (
            <PremiumLock text={t('space.linkedSpaces')} />
          )}
        </SettingsSection>

        {/* Danger zone */}
        {isOwner && (
          <SettingsSection icon={<Trash2 size={13} />} title="—">
            <button className="btn-danger w-full" onClick={deleteSpace}>
              <Trash2 size={15} /> {t('space.deleteSpace')}
            </button>
          </SettingsSection>
        )}
      </div>
    </SidePanel>
  );
}

// ── Labels manager (inline) ───────────────────────────────────────────────
const LBL_COLORS = ['#6366F1', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#EF4444'];

function LabelsManager({
  spaceId,
  labels,
  onChanged,
}: {
  spaceId: string;
  labels: Label[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(LBL_COLORS[0]);

  async function add() {
    if (!name.trim()) return;
    await api.labels.create(spaceId, name.trim(), color);
    setName('');
    await onChanged();
  }
  async function remove(id: string) {
    await api.labels.remove(id);
    await onChanged();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => (
          <span
            key={l.id}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: `${l.color}22`, color: l.color }}
          >
            {l.name}
            <button onClick={() => remove(l.id)} className="opacity-70 hover:opacity-100">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="field flex-1 py-1.5"
          placeholder={t('labels.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <div className="flex gap-1">
          {LBL_COLORS.slice(0, 5).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn('h-5 w-5 rounded-full', color === c && 'ring-2 ring-ink')}
              style={{ background: c }}
            />
          ))}
        </div>
        <button className="btn-primary px-3 py-1.5" onClick={add} disabled={!name.trim()}>
          {t('common.add')}
        </button>
      </div>
    </div>
  );
}

// ── Linked spaces (Premium) ───────────────────────────────────────────────
function LinkedSpaces({ spaceId }: { spaceId: string }) {
  const { t } = useTranslation();
  const [linked, setLinked] = useState<Space[]>([]);
  const [mine, setMine] = useState<Space[]>([]);
  const [sel, setSel] = useState('');

  async function reload() {
    setLinked(await api.spaces.links(spaceId));
  }
  useEffect(() => {
    reload();
    api.spaces.listMine().then((all) => setMine(all.filter((s) => s.id !== spaceId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  async function add() {
    if (!sel) return;
    await api.spaces.link(spaceId, sel);
    setSel('');
    await reload();
  }

  return (
    <div className="space-y-2">
      {linked.length > 0 && (
        <ul className="space-y-1">
          {linked.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: s.bg_color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <select className="field flex-1" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">—</option>
          {mine.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn-secondary" onClick={add} disabled={!sel}>
          {t('space.linkSpace')}
        </button>
      </div>
    </div>
  );
}
