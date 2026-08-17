import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Trash2, Send, Crown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import type { Invite } from '@/types';
import { isEmail } from '@/lib/validation';
import { SidePanel } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { AccessProfilesEditor } from './AccessProfilesEditor';

export function MembersPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { space, members, accessProfiles, isOwner, can, reloadMembers, reloadAccessProfiles } = useSpace();
  const [tab, setTab] = useState<'members' | 'profiles'>('members');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [inviteProfile, setInviteProfile] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canManage = can('members.manage');

  useEffect(() => {
    if (canManage && space) api.invites.list(space.id).then(setInvites).catch(() => void 0);
  }, [canManage, space]);

  useEffect(() => {
    if (accessProfiles.length && !inviteProfile) {
      const usuario = accessProfiles.find((a) => a.name === 'Usuário') ?? accessProfiles[0];
      setInviteProfile(usuario.id);
    }
  }, [accessProfiles, inviteProfile]);

  async function sendInvite() {
    if (!space || !user || !isEmail(email) || !inviteProfile) return;
    setBusy(true);
    try {
      await api.invites.create({
        spaceId: space.id,
        email,
        accessProfileId: inviteProfile,
        invitedBy: user.id,
      });
      setEmail('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      setInvites(await api.invites.list(space.id));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api.invites.revoke(id);
    if (space) setInvites(await api.invites.list(space.id));
  }

  async function changeProfile(userId: string, apId: string) {
    if (!space) return;
    await api.members.setAccessProfile(space.id, userId, apId);
    await reloadMembers();
  }

  async function removeMember(userId: string) {
    if (!space || !confirm(t('members.remove') + '?')) return;
    await api.members.remove(space.id, userId);
    await reloadMembers();
  }

  return (
    <SidePanel open onClose={onClose} title={t('members.title')} width={520}>
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg bg-surface-raised p-1">
        {(['members', 'profiles'] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === tb ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:text-ink',
            )}
          >
            {tb === 'members' ? t('members.title') : t('members.manageProfiles')}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <div className="space-y-6">
          {/* Invite */}
          {canManage && (
            <div className="rounded-xl border border-line/10 bg-surface-raised p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                <Mail size={15} /> {t('members.inviteByEmail')}
              </h4>
              <div className="space-y-2">
                <input
                  className="field"
                  type="email"
                  placeholder={t('members.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="flex gap-2">
                  <select
                    className="field flex-1"
                    value={inviteProfile}
                    onChange={(e) => setInviteProfile(e.target.value)}
                  >
                    {accessProfiles.map((ap) => (
                      <option key={ap.id} value={ap.id}>
                        {ap.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary" onClick={sendInvite} disabled={busy || !isEmail(email)}>
                    {busy ? <Spinner /> : <Send size={15} />}
                    {t('members.sendInvite')}
                  </button>
                </div>
                {sent && <p className="text-xs text-emerald-500">✓ {t('members.sendInvite')} ✓</p>}
              </div>

              {invites.length > 0 && (
                <div className="mt-4">
                  <p className="label mb-1">{t('members.pendingInvites')}</p>
                  <ul className="space-y-1">
                    {invites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center gap-2 rounded-lg bg-surface-overlay px-3 py-1.5 text-sm"
                      >
                        <Mail size={13} className="text-ink-faint" />
                        <span className="flex-1 truncate">{inv.email}</span>
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => revoke(inv.id)}
                        >
                          {t('members.revoke')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Members list */}
          <ul className="space-y-1.5">
            {members.map((m) => {
              const isSpaceOwner = space?.owner_id === m.user_id;
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border border-line/10 bg-surface-raised p-2.5"
                >
                  <Avatar name={m.profile?.name ?? '?'} src={m.profile?.avatar_url} id={m.user_id} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {m.profile?.name}
                      {m.user_id === user?.id && (
                        <span className="text-xs font-normal text-ink-faint">({t('members.you')})</span>
                      )}
                      {isSpaceOwner && <Crown size={12} className="text-amber-500" />}
                    </p>
                    <p className="truncate text-xs text-ink-faint">{m.profile?.email}</p>
                  </div>
                  {canManage && !isSpaceOwner ? (
                    <select
                      className="field w-32 py-1 text-xs"
                      value={m.access_profile_id ?? ''}
                      onChange={(e) => changeProfile(m.user_id, e.target.value)}
                    >
                      {accessProfiles.map((ap) => (
                        <option key={ap.id} value={ap.id}>
                          {ap.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-line/10 px-2 py-1 text-xs text-ink-soft">
                      {isSpaceOwner ? t('members.owner') : m.access_profile?.name}
                    </span>
                  )}
                  {canManage && !isSpaceOwner && (
                    <button
                      className="text-ink-faint hover:text-red-500"
                      onClick={() => removeMember(m.user_id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          {canManage || isOwner ? (
            <AccessProfilesEditor
              spaceId={space!.id}
              accessProfiles={accessProfiles}
              onChanged={reloadAccessProfiles}
            />
          ) : (
            <p className="text-sm text-ink-soft">{t('errors.permission')}</p>
          )}
        </>
      )}
    </SidePanel>
  );
}
