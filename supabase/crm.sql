-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PERSONTASK — CRM: Organizações e Pessoas de contato                 ║
-- ║  Rode no Supabase → SQL Editor. É IDEMPOTENTE (pode rodar de novo).  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Tabelas ───────────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  name          text not null,
  fantasy_name  text,            -- Nome Fantasia
  cnpj          text,
  status        text,
  system        text,            -- SISTEMA
  segment       text,            -- SEGMENTO
  address       text,            -- Endereço
  website       text,
  email         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references public.spaces(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  name            text not null,
  phone           text,
  phone_type      text,          -- Comercial / Celular / Residencial
  email           text,
  email_type      text,          -- Comercial / Pessoal
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Ligação do Item (negócio) com os cadastros ────────────────────────────
-- Um card pode apontar para uma Organização e uma Pessoa de contato.
-- on delete set null: apagar um cadastro NÃO apaga os negócios.

alter table public.items
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.items
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

-- ── Índices ───────────────────────────────────────────────────────────────

create index if not exists organizations_space_idx on public.organizations(space_id);
create index if not exists contacts_space_idx      on public.contacts(space_id);
create index if not exists contacts_org_idx        on public.contacts(organization_id);
create index if not exists items_org_idx           on public.items(organization_id);
create index if not exists items_contact_idx       on public.items(contact_id);

-- ── RLS (mesmo padrão do schema: ver = membro, escrever = permissão) ──────

alter table public.organizations enable row level security;
alter table public.contacts      enable row level security;

drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select
  using (public.is_space_member(space_id));

drop policy if exists orgs_write on public.organizations;
create policy orgs_write on public.organizations for all
  using (public.has_space_permission(space_id, 'item.edit'))
  with check (public.has_space_permission(space_id, 'item.edit'));

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select
  using (public.is_space_member(space_id));

drop policy if exists contacts_write on public.contacts;
create policy contacts_write on public.contacts for all
  using (public.has_space_permission(space_id, 'item.edit'))
  with check (public.has_space_permission(space_id, 'item.edit'));

-- ── updated_at automático (reaproveita a função já existente) ─────────────

drop trigger if exists organizations_touch on public.organizations;
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

-- Pronto. Se não apareceu erro, as tabelas e as ligações já existem. ✅
