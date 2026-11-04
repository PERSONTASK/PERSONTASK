-- PERSONTASK — Migrar card entre Espaços mantendo o original
-- Idempotente: pode rodar quantas vezes quiser no SQL Editor do Supabase.
--
-- Tirar um card do Espaço de origem mexe no histórico dele: some dos
-- relatórios de funil (metas e valores fechados) e do controle de prazos.
-- Por isso o padrão do Espaço passa a ser MANTER o card aqui ao migrar —
-- quem quiser tirar, desmarca na hora da migração.

alter table public.spaces
  add column if not exists keep_on_migrate boolean not null default true;

comment on column public.spaces.keep_on_migrate is
  'Padrão ao migrar um card para outro Espaço: true = manter o card aqui também (cópia). O usuário pode mudar na hora.';
