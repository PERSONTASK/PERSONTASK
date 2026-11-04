-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PERSONTASK — Recursos (pessoas + custo) e Calendário do projeto     ║
-- ║  Rode no Supabase → SQL Editor. É IDEMPOTENTE (pode rodar de novo).  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Recursos do Espaço (pessoas envolvidas, com custo por hora) ───────────
-- Ficam no Espaço para serem reaproveitados por TODOS os projetos.

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  name        text not null,
  role        text,            -- função/cargo (ex.: Consultor, Analista)
  hourly_cost numeric,         -- custo por hora
  email       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resources_space_idx on public.resources(space_id);

alter table public.resources enable row level security;

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources for select
  using (public.is_space_member(space_id));

drop policy if exists resources_write on public.resources;
create policy resources_write on public.resources for all
  using (public.has_space_permission(space_id, 'item.edit'))
  with check (public.has_space_permission(space_id, 'item.edit'));

drop trigger if exists resources_touch on public.resources;
create trigger resources_touch before update on public.resources
  for each row execute function public.touch_updated_at();

-- ── Calendário do projeto (dias úteis, feriados, horas/dia) ───────────────
-- Guardado no próprio card, em JSONB. Nulo = usa o padrão (seg–sex, 8h).
-- Formato: {"workdays":[1,2,3,4,5],"holidays":["2026-12-25"],"hoursPerDay":8}
-- (workdays: 0=domingo … 6=sábado)

alter table public.items
  add column if not exists schedule_calendar jsonb;

-- Pronto. Recursos e calendário do projeto prontos para uso. ✅
