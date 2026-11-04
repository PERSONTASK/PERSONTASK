-- PERSONTASK — marcar um card como CONCLUÍDO
-- Idempotente: pode rodar quantas vezes quiser no SQL Editor do Supabase.
--
-- `done_at` guarda QUANDO o card foi concluído (nulo = em aberto). Um card
-- concluído fica verde no semáforo e para de gerar aviso de prazo, mesmo
-- com a Data de entrega vencida. Não precisa de RLS nova: a coluna entra
-- em `items`, que já é protegida pelas políticas do Espaço.

alter table public.items
  add column if not exists done_at timestamptz;

comment on column public.items.done_at is
  'Quando o card foi marcado como concluído. Nulo = em aberto. Silencia o semáforo e os avisos de prazo.';

create index if not exists items_done_at_idx on public.items (space_id, done_at);
