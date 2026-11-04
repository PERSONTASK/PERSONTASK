import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, List, Pencil, Plus, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import type { Contact, Organization } from '@/types';

const PHONE_TYPES = ['commercial', 'mobile', 'home', 'other'] as const;
const EMAIL_TYPES = ['commercial', 'personal', 'other'] as const;

/** Linha "rótulo: valor" do painel somente-leitura. */
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 text-ink-faint">{label}:</span>
      <span className="min-w-0 break-words font-medium text-ink">{value}</span>
    </div>
  );
}

/** Valor sentinela do item "➕ Outro…" da lista suspensa. */
const NEW_OPTION = '__new__';

/**
 * Lista suspensa que se constrói sozinha: as opções são os valores já usados
 * no Espaço. O item "➕ Outro…" troca para um campo de texto, e o valor
 * digitado passa a aparecer na lista dali em diante (sem deploy, sem config).
 */
function SelectOrNew({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [typing, setTyping] = useState(false);

  const all = useMemo(() => {
    const set = new Set(options.filter(Boolean));
    if (value) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  if (typing) {
    return (
      <div>
        <label className="label">{label}</label>
        <div className="mt-1 flex gap-1.5">
          <input
            className="field"
            autoFocus
            value={value}
            placeholder={t('crm.newValue')}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary shrink-0 px-2.5"
            title={t('crm.backToList')}
            onClick={() => setTyping(false)}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="field mt-1"
        value={value}
        onChange={(e) => {
          if (e.target.value === NEW_OPTION) {
            onChange('');
            setTyping(true);
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">—</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={NEW_OPTION}>{t('crm.addNewOption')}</option>
      </select>
    </div>
  );
}

/**
 * Seção "Cliente" do card (negócio): vincula o Item a um cadastro de
 * Organização e de Pessoa de contato, e mostra os dados vindos desses
 * cadastros (somente leitura — para editar, abre o cadastro).
 */
export function ClientSection({
  spaceId,
  userId,
  organizationId,
  contactId,
  canEdit,
  onChange,
}: {
  spaceId: string;
  userId: string;
  organizationId: string | null;
  contactId: string | null;
  canEdit: boolean;
  onChange: (patch: { organization_id?: string | null; contact_id?: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgForm, setOrgForm] = useState<Organization | 'new' | null>(null);
  const [contactForm, setContactForm] = useState<Contact | 'new' | null>(null);

  async function reload() {
    const [o, c] = await Promise.all([api.organizations.list(spaceId), api.contacts.list(spaceId)]);
    setOrgs(o);
    setPeople(c);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => void 0)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  const org = useMemo(() => orgs.find((o) => o.id === organizationId) ?? null, [orgs, organizationId]);
  const person = useMemo(() => people.find((p) => p.id === contactId) ?? null, [people, contactId]);

  /** Pessoas da organização escolhida (ou todas, se nenhuma escolhida). */
  const peopleForOrg = useMemo(
    () => (organizationId ? people.filter((p) => !p.organization_id || p.organization_id === organizationId) : people),
    [people, organizationId],
  );

  function pickOrganization(id: string) {
    const next = id || null;
    // Se a pessoa vinculada é de outra organização, desvincula.
    const keepsPerson = !person || !next || !person.organization_id || person.organization_id === next;
    onChange({ organization_id: next, ...(keepsPerson ? {} : { contact_id: null }) });
  }

  function pickContact(id: string) {
    const next = id || null;
    const chosen = people.find((p) => p.id === next);
    // Ao escolher uma pessoa, puxa a organização dela se ainda não houver uma.
    if (chosen?.organization_id && !organizationId) {
      onChange({ contact_id: next, organization_id: chosen.organization_id });
    } else {
      onChange({ contact_id: next });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4 text-brand-indigo">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Organização */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Building2 size={12} /> {t('crm.organization')}
          </label>
          <div className="mt-1 flex gap-1.5">
            <select
              className="field"
              disabled={!canEdit}
              value={organizationId ?? ''}
              onChange={(e) => pickOrganization(e.target.value)}
            >
              <option value="">—</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                className="btn-secondary shrink-0 px-2.5"
                title={t('crm.newOrganization')}
                onClick={() => setOrgForm('new')}
              >
                <Plus size={15} />
              </button>
            )}
            {canEdit && org && (
              <button
                className="btn-secondary shrink-0 px-2.5"
                title={t('crm.editOrganization')}
                onClick={() => setOrgForm(org)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pessoa de contato */}
        <div>
          <label className="label flex items-center gap-1.5">
            <UserIcon size={12} /> {t('crm.contact')}
          </label>
          <div className="mt-1 flex gap-1.5">
            <select
              className="field"
              disabled={!canEdit}
              value={contactId ?? ''}
              onChange={(e) => pickContact(e.target.value)}
            >
              <option value="">—</option>
              {peopleForOrg.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                className="btn-secondary shrink-0 px-2.5"
                title={t('crm.newContact')}
                onClick={() => setContactForm('new')}
              >
                <Plus size={15} />
              </button>
            )}
            {canEdit && person && (
              <button
                className="btn-secondary shrink-0 px-2.5"
                title={t('crm.editContact')}
                onClick={() => setContactForm(person)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Painel somente-leitura, vindo dos cadastros */}
      {(person || org) && (
        <div className="grid gap-3 rounded-xl border border-line/10 bg-surface-raised p-3 sm:grid-cols-2">
          {person && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {t('crm.contact')}
              </p>
              <Row
                label={t('crm.phone')}
                value={
                  person.phone
                    ? `${person.phone}${person.phone_type ? ` (${t(`crm.type_${person.phone_type}`)})` : ''}`
                    : null
                }
              />
              <Row
                label={t('crm.email')}
                value={
                  person.email
                    ? `${person.email}${person.email_type ? ` (${t(`crm.type_${person.email_type}`)})` : ''}`
                    : null
                }
              />
            </div>
          )}
          {org && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {t('crm.organization')}
              </p>
              <Row label={t('crm.cnpj')} value={org.cnpj} />
              <Row label={t('crm.fantasyName')} value={org.fantasy_name} />
              <Row label={t('crm.system')} value={org.system} />
              <Row label={t('crm.segment')} value={org.segment} />
              <Row label={t('crm.status')} value={org.status} />
            </div>
          )}
        </div>
      )}

      {orgForm && (
        <OrganizationForm
          spaceId={spaceId}
          userId={userId}
          organizations={orgs}
          initial={orgForm === 'new' ? null : orgForm}
          onClose={() => setOrgForm(null)}
          onSaved={async (saved) => {
            setOrgForm(null);
            await reload();
            if (saved.id !== organizationId) onChange({ organization_id: saved.id });
          }}
        />
      )}

      {contactForm && (
        <ContactForm
          spaceId={spaceId}
          userId={userId}
          organizations={orgs}
          defaultOrganizationId={organizationId}
          initial={contactForm === 'new' ? null : contactForm}
          onClose={() => setContactForm(null)}
          onSaved={async (saved) => {
            setContactForm(null);
            await reload();
            if (saved.id !== contactId) onChange({ contact_id: saved.id });
          }}
        />
      )}
    </div>
  );
}

// ── Formulário de Organização ─────────────────────────────────────────────

export function OrganizationForm({
  spaceId,
  userId,
  organizations,
  initial,
  onClose,
  onSaved,
}: {
  spaceId: string;
  userId: string;
  /** Usado para montar as listas de Sistema e Segmento com o que já existe. */
  organizations: Organization[];
  initial: Organization | null;
  onClose: () => void;
  onSaved: (org: Organization) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    fantasy_name: initial?.fantasy_name ?? '',
    cnpj: initial?.cnpj ?? '',
    status: initial?.status ?? '',
    system: initial?.system ?? '',
    segment: initial?.segment ?? '',
    address: initial?.address ?? '',
    website: initial?.website ?? '',
    email: initial?.email ?? '',
  });
  const [busy, setBusy] = useState(false);

  // Listas que se constroem sozinhas a partir do que já foi cadastrado.
  const systemOptions = useMemo(
    () => Array.from(new Set(organizations.map((o) => o.system).filter(Boolean) as string[])),
    [organizations],
  );
  const segmentOptions = useMemo(
    () => Array.from(new Set(organizations.map((o) => o.segment).filter(Boolean) as string[])),
    [organizations],
  );

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = {
        space_id: spaceId,
        name: f.name.trim(),
        fantasy_name: f.fantasy_name.trim() || null,
        cnpj: f.cnpj.trim() || null,
        status: f.status.trim() || null,
        system: f.system.trim() || null,
        segment: f.segment.trim() || null,
        address: f.address.trim() || null,
        website: f.website.trim() || null,
        email: f.email.trim() || null,
        created_by: userId,
      };
      if (initial) {
        await api.organizations.update(initial.id, payload);
        await onSaved({ ...initial, ...payload } as Organization);
      } else {
        const created = await api.organizations.create(payload);
        await onSaved(created);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? t('crm.editOrganization') : t('crm.newOrganization')}
      width={520}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={!f.name.trim() || busy}>
            {busy ? <Spinner /> : null} {t('common.save')}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">{t('crm.name')}</label>
          <input className="field mt-1" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <div>
          <label className="label">{t('crm.fantasyName')}</label>
          <input className="field mt-1" value={f.fantasy_name} onChange={set('fantasy_name')} />
        </div>
        <div>
          <label className="label">{t('crm.cnpj')}</label>
          <input className="field mt-1" value={f.cnpj} onChange={set('cnpj')} />
        </div>
        <SelectOrNew
          label={t('crm.system')}
          value={f.system}
          options={systemOptions}
          onChange={(v) => setF((prev) => ({ ...prev, system: v }))}
        />
        <SelectOrNew
          label={t('crm.segment')}
          value={f.segment}
          options={segmentOptions}
          onChange={(v) => setF((prev) => ({ ...prev, segment: v }))}
        />
        <div>
          <label className="label">{t('crm.status')}</label>
          <input className="field mt-1" value={f.status} onChange={set('status')} />
        </div>
        <div>
          <label className="label">{t('crm.website')}</label>
          <input className="field mt-1" value={f.website} onChange={set('website')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t('crm.email')}</label>
          <input className="field mt-1" type="email" value={f.email} onChange={set('email')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t('crm.address')}</label>
          <input className="field mt-1" value={f.address} onChange={set('address')} />
        </div>
      </div>
    </Modal>
  );
}

// ── Formulário de Pessoa de contato ───────────────────────────────────────

export function ContactForm({
  spaceId,
  userId,
  organizations,
  defaultOrganizationId,
  initial,
  onClose,
  onSaved,
}: {
  spaceId: string;
  userId: string;
  organizations: Organization[];
  defaultOrganizationId?: string | null;
  initial: Contact | null;
  onClose: () => void;
  onSaved: (contact: Contact) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    organization_id: initial?.organization_id ?? defaultOrganizationId ?? '',
    phone: initial?.phone ?? '',
    phone_type: initial?.phone_type ?? 'commercial',
    email: initial?.email ?? '',
    email_type: initial?.email_type ?? 'commercial',
  });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = {
        space_id: spaceId,
        organization_id: f.organization_id || null,
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        phone_type: f.phone.trim() ? f.phone_type : null,
        email: f.email.trim() || null,
        email_type: f.email.trim() ? f.email_type : null,
        created_by: userId,
      };
      if (initial) {
        await api.contacts.update(initial.id, payload);
        await onSaved({ ...initial, ...payload } as Contact);
      } else {
        const created = await api.contacts.create(payload);
        await onSaved(created);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? t('crm.editContact') : t('crm.newContact')}
      width={480}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={!f.name.trim() || busy}>
            {busy ? <Spinner /> : null} {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">{t('crm.name')}</label>
          <input className="field mt-1" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <div>
          <label className="label">{t('crm.organization')}</label>
          <select className="field mt-1" value={f.organization_id} onChange={set('organization_id')}>
            <option value="">—</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('crm.phone')}</label>
          <div className="mt-1 flex gap-2">
            <input className="field" value={f.phone} onChange={set('phone')} />
            <select className="field w-40" value={f.phone_type} onChange={set('phone_type')}>
              {PHONE_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`crm.type_${ty}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('crm.email')}</label>
          <div className="mt-1 flex gap-2">
            <input className="field" type="email" value={f.email} onChange={set('email')} />
            <select className="field w-40" value={f.email_type} onChange={set('email_type')}>
              {EMAIL_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`crm.type_${ty}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
