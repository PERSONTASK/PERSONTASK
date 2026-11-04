-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PERSONTASK — Cronograma (Fase 2): campos nativos de projeto         ║
-- ║  Rode no Supabase → SQL Editor. É IDEMPOTENTE (pode rodar de novo).  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- O Item já tem `due_at` (Término). Aqui entram os demais campos de
-- cronograma. Não precisa de RLS nova: as policies de `items` já cobrem
-- estas colunas.

alter table public.items add column if not exists start_at      timestamptz; -- Início
alter table public.items add column if not exists work_hours    numeric;     -- Trabalho (horas)
alter table public.items add column if not exists cost          numeric;     -- Custo
alter table public.items add column if not exists progress      integer;     -- % Concluído (0–100)
alter table public.items add column if not exists schedule_mode text;        -- 'manual' | 'auto'

-- % Concluído só aceita 0–100 (nulo = usa o % do checklist).
do $$
begin
  alter table public.items
    add constraint items_progress_range
    check (progress is null or (progress >= 0 and progress <= 100));
exception
  when duplicate_object then null;
  when duplicate_table  then null;
end $$;

-- Índice para ordenar/filtrar por data de início no cronograma.
create index if not exists items_start_idx on public.items(start_at);

-- Pronto. Se não apareceu erro, os campos de cronograma já existem. ✅
