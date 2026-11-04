-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PERSONTASK — Cronograma DENTRO do card (card = projeto)             ║
-- ║  Rode no Supabase → SQL Editor. É IDEMPOTENTE (pode rodar de novo).  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Guarda as tarefas do cronograma do projeto no próprio card, em JSONB —
-- exatamente como já funcionam os `checklists`. Assim o cronograma viaja
-- junto quando o card é duplicado ou movido entre Espaços, e não precisa
-- de RLS nova (as policies de `items` já valem).
--
-- Formato de cada tarefa:
--   {
--     "id": "uuid", "name": "texto", "indent": 0|1,
--     "start": "ISO|null", "end": "ISO|null",
--     "progress": 0..100, "work": número|null, "cost": número|null,
--     "mode": "manual"|"auto", "predecessors": ["id", ...], "notes": "texto"
--   }

alter table public.items
  add column if not exists schedule_tasks jsonb not null default '[]'::jsonb;

-- Pronto. Se não apareceu erro, o cronograma do projeto já pode ser salvo. ✅
