import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Pencil, Plus, Search, Trash2, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import { SidePanel } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { ContactForm, OrganizationForm } from './ClientSection';
import type { Contact, Organization } from '@/types';

/** Linha "rótulo: valor" compacta do card da lista. */
function Meta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="text-xs text-ink-soft">
      <span className="text-ink-faint">{label}:</span> {value}
    </span>
  );
}

/**
 * Painel central de CRM: lista, busca, edita e exclui os cadastros de
 * Organizações e Pessoas de contato do Espaço. Reaproveita os mesmos
 * formulários usados dentro do card.
 */
export function ClientsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { space, can } = useSpace();

  const [tab, setTab] = useState<'orgs' | 'people'>('orgs');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Contact[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [orgForm, setOrgForm] = useState<Organization | 'new' | null>(null);
  const [contactForm, setContactForm] = useState<Contact | 'new' | null>(null);

  const canEdit = can('item.edit');

  async function reload() {
    if (!space) return;
    const [o, c] = await Promise.all([
      api.organizations.list(space.id),
      api.contacts.list(space.id),
    ]);
    setOrgs(o);
    setPeople(c);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => void 0)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.id]);

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);
  const term = q.trim().toLowerCase();

  const filteredOrgs = useMemo(
    () =>
      orgs.filter(
        (o) =>
          !term ||
          `${o.name} ${o.fantasy_name ?? ''} ${o.cnpj ?? ''} ${o.system ?? ''} ${o.segment ?? ''}`
            .toLowerCase()
            .includes(term),
      ),
    [orgs, term],
  );

  const filteredPeople = useMemo(
    () =>
      people.filter(
        (p) =>
          !term ||
          `${p.name} ${p.email ?? ''} ${p.phone ?? ''} ${orgNameById.get(p.organization_id ?? '') ?? ''}`
            .toLowerCase()
            .includes(term),
      ),
    [people, term, orgNameById],
  );

  async function removeOrg(o: Organization) {
    if (!confirm(t('crm.deleteOrgConfirm', { name: o.name }))) return;
    await api.organizations.remove(o.id);
    await reload();
  }

  async function removeContact(c: Contact) {
    if (!confirm(t('crm.deleteContactConfirm', { name: c.name }))) return;
    await api.contacts.remove(c.id);
    await reload();
  }

  if (!space) return null;

  const tabBtn = (key: 'orgs' | 'people', icon: React.ReactNode, label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
        tab === key ? 'bg-brand-gradient text-white' : 'text-ink-soft hover:bg-line/5',
      )}
    >
      {icon} {label}
      <span className={cn('text-xs', tab === key ? 'text-white/80' : 'text-ink-faint')}>({count})</span>
    </button>
  );

  return (
    <SidePanel open onClose={onClose} title={t('crm.manage')} width={580}>
      {loading ? (
        <div className="flex justify-center py-20 text-brand-indigo">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Abas */}
          <div className="flex gap-1 rounded-xl bg-surface-raised p-1">
            {tabBtn('orgs', <Building2 size={15} />, t('crm.organizations'), orgs.length)}
            {tabBtn('people', <UserIcon size={15} />, t('crm.contacts'), people.length)}
          </div>

          {/* Busca + novo */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                className="field pl-8"
                placeholder={t('crm.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {canEdit && (
              <button
                className="btn-primary shrink-0"
                onClick={() => (tab === 'orgs' ? setOrgForm('new') : setContactForm('new'))}
              >
                <Plus size={16} />
                {tab === 'orgs' ? t('crm.newOrganization') : t('crm.newContact')}
              </button>
            )}
          </div>

          {/* Lista */}
          {tab === 'orgs' ? (
            filteredOrgs.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-soft">
                {orgs.length === 0 ? t('crm.noOrganizations') : t('crm.noResults')}
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredOrgs.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-start gap-3 rounded-xl border border-line/10 bg-surface-raised p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{o.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <Meta label={t('crm.fantasyName')} value={o.fantasy_name} />
                        <Meta label={t('crm.cnpj')} value={o.cnpj} />
                        <Meta label={t('crm.system')} value={o.system} />
                        <Meta label={t('crm.segment')} value={o.segment} />
                        <Meta label={t('crm.status')} value={o.status} />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          className="btn-ghost px-2 py-1"
                          title={t('crm.editOrganization')}
                          onClick={() => setOrgForm(o)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-500/10"
                          title={t('common.delete')}
                          onClick={() => removeOrg(o)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : filteredPeople.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">
              {people.length === 0 ? t('crm.noContacts') : t('crm.noResults')}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredPeople.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-line/10 bg-surface-raised p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <Meta
                        label={t('crm.organization')}
                        value={orgNameById.get(p.organization_id ?? '')}
                      />
                      <Meta label={t('crm.phone')} value={p.phone} />
                      <Meta label={t('crm.email')} value={p.email} />
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="btn-ghost px-2 py-1"
                        title={t('crm.editContact')}
                        onClick={() => setContactForm(p)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-500/10"
                        title={t('common.delete')}
                        onClick={() => removeContact(p)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {orgForm && user && (
        <OrganizationForm
          spaceId={space.id}
          userId={user.id}
          organizations={orgs}
          initial={orgForm === 'new' ? null : orgForm}
          onClose={() => setOrgForm(null)}
          onSaved={async () => {
            setOrgForm(null);
            await reload();
          }}
        />
      )}

      {contactForm && user && (
        <ContactForm
          spaceId={space.id}
          userId={user.id}
          organizations={orgs}
          initial={contactForm === 'new' ? null : contactForm}
          onClose={() => setContactForm(null)}
          onSaved={async () => {
            setContactForm(null);
            await reload();
          }}
        />
      )}
    </SidePanel>
  );
}
