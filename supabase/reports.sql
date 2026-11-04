-- PERSONTASK — Moeda do Espaço + Relatórios por Painel
-- Idempotente: pode rodar quantas vezes quiser no SQL Editor do Supabase.

-- 1) Moeda do Espaço (ISO 4217). Vale para Custo, Custo/hora e os campos
--    numéricos marcados como moeda. Padrão: Real.
alter table public.spaces
  add column if not exists currency text not null default 'BRL';

comment on column public.spaces.currency is
  'Moeda do Espaço em ISO 4217 (BRL, USD, EUR...). Usada para formatar todo valor monetário.';

-- 2) Configuração do relatório de Funil, por Painel. Guarda qual campo
--    numérico é o VALOR do negócio e o papel de cada Coluna
--    (open | won | lost | ignore). Nulo = Painel ainda não configurado,
--    e aí só o relatório de Tarefas aparece.
alter table public.boards
  add column if not exists report_config jsonb;

comment on column public.boards.report_config is
  'Relatório de Funil: {"valueFieldId": uuid|null, "columnRoles": {"<columnId>": "open"|"won"|"lost"|"ignore"}}. Nulo = não configurado.';
