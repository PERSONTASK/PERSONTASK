-- ═══════════════════════════════════════════════════════════════════════
--  PERSONTASK — Schema Postgres + Row Level Security (Supabase)
--  Terminologia:  Espaço=space · Painel=board · Coluna=column · Item=item
--  Execute no SQL Editor do Supabase (ou `supabase db push`).
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────
do $$ begin
  create type plan_type as enum ('free', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type field_type as enum ('datetime', 'text', 'number', 'checklist', 'checkbox', 'select');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invite_status as enum ('pending', 'accepted', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('item_assigned', 'due_soon', 'mention');
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  TABELAS
-- ═══════════════════════════════════════════════════════════════════════

-- Perfil do usuário (estende auth.users) ────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null default '',
  email               text,
  avatar_url          text,
  plan                plan_type not null default 'free',
  locale              text not null default 'pt',
  email_notifications boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Espaços (workspaces) ──────────────────────────────────────────────────
create table if not exists public.spaces (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  description         text default '',
  -- Personalização (Premium): cor sólida OU imagem de fundo, fonte.
  bg_color            text default '#6366F1',
  bg_image_url        text,
  font_family         text default 'Roboto',
  logo_url            text,                      -- logotipo da empresa (Premium)
  due_soon_lead_days  int not null default 3,    -- antecedência do e-mail de vencimento
  created_at          timestamptz not null default now()
);

-- Interligação entre Espaços do mesmo master (Premium) ──────────────────
create table if not exists public.space_links (
  space_id        uuid not null references public.spaces(id) on delete cascade,
  linked_space_id uuid not null references public.spaces(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (space_id, linked_space_id),
  check (space_id <> linked_space_id)
);

-- Perfis de acesso cadastráveis por Espaço ──────────────────────────────
create table if not exists public.access_profiles (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  name        text not null,
  permissions jsonb not null default '[]'::jsonb,  -- ex.: ["item.create","members.manage"]
  is_system   boolean not null default false,      -- os 3 padrões (editáveis)
  created_at  timestamptz not null default now()
);

-- Membros de um Espaço ──────────────────────────────────────────────────
create table if not exists public.space_members (
  space_id          uuid not null references public.spaces(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  access_profile_id uuid references public.access_profiles(id) on delete set null,
  joined_at         timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- Painéis ───────────────────────────────────────────────────────────────
create table if not exists public.boards (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  name       text not null,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Colunas ───────────────────────────────────────────────────────────────
create table if not exists public.columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null default '',
  color      text default '#6366F1',
  position   double precision not null default 0,
  collapsed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Itens ─────────────────────────────────────────────────────────────────
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references public.columns(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete cascade,
  title       text not null,
  description text default '',
  checklists  jsonb not null default '[]'::jsonb,   -- recurso próprio do card (título + itens + %)
  position    double precision not null default 0,
  due_at      timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Responsáveis (Painel / Coluna / Item) ─────────────────────────────────
create table if not exists public.board_assignees (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (board_id, user_id)
);
create table if not exists public.column_assignees (
  column_id uuid not null references public.columns(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  primary key (column_id, user_id)
);
create table if not exists public.item_assignees (
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (item_id, user_id)
);

-- Etiquetas coloridas (por Espaço) ──────────────────────────────────────
create table if not exists public.labels (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name     text not null,
  color    text not null default '#6366F1'
);
create table if not exists public.item_labels (
  item_id  uuid not null references public.items(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (item_id, label_id)
);

-- Campos personalizados (definição por Espaço, valor por Item) ──────────
create table if not exists public.custom_field_defs (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references public.spaces(id) on delete cascade,
  name                text not null,
  type                field_type not null,
  config              jsonb not null default '{}'::jsonb,  -- ex.: {"options":["A","B"]}
  show_on_face_default boolean not null default false,
  position            double precision not null default 0
);
create table if not exists public.item_field_values (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  field_def_id uuid not null references public.custom_field_defs(id) on delete cascade,
  value        jsonb,                       -- texto/número/data/checklist/select
  show_on_face boolean not null default false,
  unique (item_id, field_def_id)
);

-- Anexos ────────────────────────────────────────────────────────────────
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  space_id     uuid not null references public.spaces(id) on delete cascade,
  storage_path text not null,               -- caminho no bucket 'attachments'
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Comentários + menções ─────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.comment_mentions (
  comment_id        uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, mentioned_user_id)
);

-- Convites ──────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references public.spaces(id) on delete cascade,
  email             text not null,
  token             text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by        uuid references public.profiles(id) on delete set null,
  access_profile_id uuid references public.access_profiles(id) on delete set null,
  status            invite_status not null default 'pending',
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz
);

-- Log de notificações (idempotência dos e-mails) ────────────────────────
create table if not exists public.notifications_log (
  id         uuid primary key default gen_random_uuid(),
  type       notification_type not null,
  item_id    uuid references public.items(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  meta       jsonb default '{}'::jsonb,
  sent_at    timestamptz not null default now()
);

-- ── Índices ────────────────────────────────────────────────────────────
create index if not exists idx_boards_space   on public.boards(space_id);
create index if not exists idx_columns_board  on public.columns(board_id);
create index if not exists idx_items_column    on public.items(column_id);
create index if not exists idx_items_space     on public.items(space_id);
create index if not exists idx_items_due       on public.items(due_at) where due_at is not null;
create index if not exists idx_members_user    on public.space_members(user_id);
create index if not exists idx_attach_item     on public.attachments(item_id);
create index if not exists idx_comments_item   on public.comments(item_id);

-- ═══════════════════════════════════════════════════════════════════════
--  FUNÇÕES AUXILIARES (SECURITY DEFINER → ignoram RLS internamente,
--  evitando recursão nas políticas que consultam space_members)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_space_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from space_members m where m.space_id = p_space and m.user_id = auth.uid()
  ) or exists (
    select 1 from spaces s where s.id = p_space and s.owner_id = auth.uid()
  );
$$;

create or replace function public.has_space_permission(p_space uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    -- dono do Espaço sempre pode
    exists (select 1 from spaces s where s.id = p_space and s.owner_id = auth.uid())
    or exists (
      select 1
      from space_members m
      join access_profiles ap on ap.id = m.access_profile_id
      where m.space_id = p_space
        and m.user_id = auth.uid()
        and (ap.permissions ? p_perm or ap.permissions ? 'space.admin')
    );
$$;

create or replace function public.is_space_admin(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_space_permission(p_space, 'members.manage')
      or exists (select 1 from spaces s where s.id = p_space and s.owner_id = auth.uid());
$$;

-- Dois usuários compartilham algum Espaço? (para exibir nomes/avatares) ──
create or replace function public.shares_space_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from space_members a
    join space_members b on a.space_id = b.space_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ── Provisionar profile ao criar usuário ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'locale', 'pt')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Perfis de acesso padrão + dono como Administrador ao criar Espaço ──
create or replace function public.handle_new_space()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid;
begin
  insert into public.access_profiles (space_id, name, permissions, is_system) values
    (new.id, 'Administrador',
      '["space.admin","space.manage","members.manage","board.create","board.edit","board.delete","column.manage","item.create","item.edit","item.delete","label.manage","field.manage","comment.create"]'::jsonb,
      true)
    returning id into admin_id;
  insert into public.access_profiles (space_id, name, permissions, is_system) values
    (new.id, 'Gestor',
      '["board.create","board.edit","board.delete","column.manage","item.create","item.edit","item.delete","label.manage","field.manage","comment.create"]'::jsonb,
      true),
    (new.id, 'Usuário',
      '["item.create","item.edit","comment.create"]'::jsonb,
      true);

  insert into public.space_members (space_id, user_id, access_profile_id)
  values (new.id, new.owner_id, admin_id)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.handle_new_space();

-- ── updated_at automático nos Itens ─────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ── Aceitar convite (RPC chamada pelo app após login/cadastro) ─────────
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from invites where token = p_token and status = 'pending';
  if inv is null then raise exception 'Convite inválido ou já utilizado'; end if;

  insert into space_members (space_id, user_id, access_profile_id)
  values (inv.space_id, auth.uid(), inv.access_profile_id)
  on conflict (space_id, user_id) do nothing;

  update invites set status = 'accepted', accepted_at = now() where id = inv.id;
  return inv.space_id;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profiles           enable row level security;
alter table public.spaces             enable row level security;
alter table public.space_links        enable row level security;
alter table public.access_profiles    enable row level security;
alter table public.space_members      enable row level security;
alter table public.boards             enable row level security;
alter table public.columns            enable row level security;
alter table public.items              enable row level security;
alter table public.board_assignees    enable row level security;
alter table public.column_assignees   enable row level security;
alter table public.item_assignees     enable row level security;
alter table public.labels             enable row level security;
alter table public.item_labels        enable row level security;
alter table public.custom_field_defs  enable row level security;
alter table public.item_field_values  enable row level security;
alter table public.attachments        enable row level security;
alter table public.comments           enable row level security;
alter table public.comment_mentions   enable row level security;
alter table public.invites            enable row level security;
alter table public.notifications_log  enable row level security;

-- profiles ──────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_space_with(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

-- spaces ────────────────────────────────────────────────────────────────
drop policy if exists spaces_select on public.spaces;
create policy spaces_select on public.spaces for select
  using (public.is_space_member(id));
drop policy if exists spaces_insert on public.spaces;
create policy spaces_insert on public.spaces for insert
  with check (owner_id = auth.uid());
drop policy if exists spaces_update on public.spaces;
create policy spaces_update on public.spaces for update
  using (public.has_space_permission(id, 'space.manage'));
drop policy if exists spaces_delete on public.spaces;
create policy spaces_delete on public.spaces for delete
  using (owner_id = auth.uid());

-- space_links ───────────────────────────────────────────────────────────
drop policy if exists links_all on public.space_links;
create policy links_all on public.space_links for all
  using (public.is_space_member(space_id))
  with check (public.has_space_permission(space_id, 'space.manage'));

-- access_profiles ───────────────────────────────────────────────────────
drop policy if exists ap_select on public.access_profiles;
create policy ap_select on public.access_profiles for select
  using (public.is_space_member(space_id));
drop policy if exists ap_write on public.access_profiles;
create policy ap_write on public.access_profiles for all
  using (public.has_space_permission(space_id, 'members.manage'))
  with check (public.has_space_permission(space_id, 'members.manage'));

-- space_members ─────────────────────────────────────────────────────────
drop policy if exists members_select on public.space_members;
create policy members_select on public.space_members for select
  using (public.is_space_member(space_id));
drop policy if exists members_write on public.space_members;
create policy members_write on public.space_members for all
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

-- Helper macro para tabelas “de conteúdo” do Espaço ─────────────────────
-- boards
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards for select using (public.is_space_member(space_id));
drop policy if exists boards_ins on public.boards;
create policy boards_ins on public.boards for insert with check (public.has_space_permission(space_id,'board.create'));
drop policy if exists boards_upd on public.boards;
create policy boards_upd on public.boards for update using (public.has_space_permission(space_id,'board.edit'));
drop policy if exists boards_del on public.boards;
create policy boards_del on public.boards for delete using (public.has_space_permission(space_id,'board.delete'));

-- columns
drop policy if exists cols_select on public.columns;
create policy cols_select on public.columns for select using (public.is_space_member(space_id));
drop policy if exists cols_write on public.columns;
create policy cols_write on public.columns for all
  using (public.has_space_permission(space_id,'column.manage'))
  with check (public.has_space_permission(space_id,'column.manage'));

-- items
drop policy if exists items_select on public.items;
create policy items_select on public.items for select using (public.is_space_member(space_id));
drop policy if exists items_ins on public.items;
create policy items_ins on public.items for insert with check (public.has_space_permission(space_id,'item.create'));
drop policy if exists items_upd on public.items;
create policy items_upd on public.items for update using (public.has_space_permission(space_id,'item.edit'));
drop policy if exists items_del on public.items;
create policy items_del on public.items for delete using (public.has_space_permission(space_id,'item.delete'));

-- assignees (membership para ler; item.edit/board.edit para gravar) ─────
drop policy if exists board_assignees_sel on public.board_assignees;
create policy board_assignees_sel on public.board_assignees for select
  using (exists (select 1 from boards b where b.id = board_id and public.is_space_member(b.space_id)));
drop policy if exists board_assignees_wr on public.board_assignees;
create policy board_assignees_wr on public.board_assignees for all
  using (exists (select 1 from boards b where b.id = board_id and public.has_space_permission(b.space_id,'board.edit')))
  with check (exists (select 1 from boards b where b.id = board_id and public.has_space_permission(b.space_id,'board.edit')));

drop policy if exists column_assignees_sel on public.column_assignees;
create policy column_assignees_sel on public.column_assignees for select
  using (exists (select 1 from columns c where c.id = column_id and public.is_space_member(c.space_id)));
drop policy if exists column_assignees_wr on public.column_assignees;
create policy column_assignees_wr on public.column_assignees for all
  using (exists (select 1 from columns c where c.id = column_id and public.has_space_permission(c.space_id,'column.manage')))
  with check (exists (select 1 from columns c where c.id = column_id and public.has_space_permission(c.space_id,'column.manage')));

drop policy if exists item_assignees_sel on public.item_assignees;
create policy item_assignees_sel on public.item_assignees for select
  using (exists (select 1 from items i where i.id = item_id and public.is_space_member(i.space_id)));
drop policy if exists item_assignees_wr on public.item_assignees;
create policy item_assignees_wr on public.item_assignees for all
  using (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')))
  with check (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')));

-- labels
drop policy if exists labels_select on public.labels;
create policy labels_select on public.labels for select using (public.is_space_member(space_id));
drop policy if exists labels_write on public.labels;
create policy labels_write on public.labels for all
  using (public.has_space_permission(space_id,'label.manage'))
  with check (public.has_space_permission(space_id,'label.manage'));

drop policy if exists item_labels_sel on public.item_labels;
create policy item_labels_sel on public.item_labels for select
  using (exists (select 1 from items i where i.id = item_id and public.is_space_member(i.space_id)));
drop policy if exists item_labels_wr on public.item_labels;
create policy item_labels_wr on public.item_labels for all
  using (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')))
  with check (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')));

-- custom fields
drop policy if exists cfd_select on public.custom_field_defs;
create policy cfd_select on public.custom_field_defs for select using (public.is_space_member(space_id));
drop policy if exists cfd_write on public.custom_field_defs;
create policy cfd_write on public.custom_field_defs for all
  using (public.has_space_permission(space_id,'field.manage'))
  with check (public.has_space_permission(space_id,'field.manage'));

drop policy if exists ifv_sel on public.item_field_values;
create policy ifv_sel on public.item_field_values for select
  using (exists (select 1 from items i where i.id = item_id and public.is_space_member(i.space_id)));
drop policy if exists ifv_wr on public.item_field_values;
create policy ifv_wr on public.item_field_values for all
  using (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')))
  with check (exists (select 1 from items i where i.id = item_id and public.has_space_permission(i.space_id,'item.edit')));

-- attachments
drop policy if exists att_select on public.attachments;
create policy att_select on public.attachments for select using (public.is_space_member(space_id));
drop policy if exists att_write on public.attachments;
create policy att_write on public.attachments for all
  using (public.has_space_permission(space_id,'item.edit'))
  with check (public.has_space_permission(space_id,'item.edit'));

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (public.is_space_member(space_id));
drop policy if exists comments_ins on public.comments;
create policy comments_ins on public.comments for insert
  with check (public.has_space_permission(space_id,'comment.create') and author_id = auth.uid());
drop policy if exists comments_del on public.comments;
create policy comments_del on public.comments for delete
  using (author_id = auth.uid() or public.has_space_permission(space_id,'item.delete'));

drop policy if exists cmention_sel on public.comment_mentions;
create policy cmention_sel on public.comment_mentions for select
  using (exists (select 1 from comments c where c.id = comment_id and public.is_space_member(c.space_id)));
drop policy if exists cmention_ins on public.comment_mentions;
create policy cmention_ins on public.comment_mentions for insert
  with check (exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid()));

-- invites (admins gerenciam; convidado lê pelo token via RPC) ───────────
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select using (public.is_space_admin(space_id));
drop policy if exists invites_write on public.invites;
create policy invites_write on public.invites for all
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

-- notifications_log (somente o próprio usuário lê) ──────────────────────
drop policy if exists notif_select on public.notifications_log;
create policy notif_select on public.notifications_log for select using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
--  STORAGE (buckets + políticas)
-- ═══════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('space-backgrounds', 'space-backgrounds', true)
  on conflict (id) do nothing;

-- Convenção de caminho: attachments/{space_id}/{item_id}/{arquivo}
drop policy if exists att_obj_read on storage.objects;
create policy att_obj_read on storage.objects for select
  using (bucket_id = 'attachments' and public.is_space_member(((storage.foldername(name))[1])::uuid));
drop policy if exists att_obj_write on storage.objects;
create policy att_obj_write on storage.objects for insert
  with check (bucket_id = 'attachments' and public.has_space_permission(((storage.foldername(name))[1])::uuid, 'item.edit'));
drop policy if exists att_obj_del on storage.objects;
create policy att_obj_del on storage.objects for delete
  using (bucket_id = 'attachments' and public.has_space_permission(((storage.foldername(name))[1])::uuid, 'item.edit'));

-- avatars: leitura pública; escrita apenas na própria pasta {user_id}/...
drop policy if exists avatar_read on storage.objects;
create policy avatar_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatar_write on storage.objects;
create policy avatar_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatar_upd on storage.objects;
create policy avatar_upd on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- space-backgrounds: leitura pública; escrita por quem gerencia o Espaço
drop policy if exists spacebg_read on storage.objects;
create policy spacebg_read on storage.objects for select using (bucket_id = 'space-backgrounds');
drop policy if exists spacebg_write on storage.objects;
create policy spacebg_write on storage.objects for insert
  with check (bucket_id = 'space-backgrounds' and public.has_space_permission(((storage.foldername(name))[1])::uuid, 'space.manage'));

-- ═══════════════════════════════════════════════════════════════════════
--  REALTIME (opcional): publique as tabelas do board para colaboração live
-- ═══════════════════════════════════════════════════════════════════════
-- alter publication supabase_realtime add table public.items, public.columns, public.boards;

-- FIM
