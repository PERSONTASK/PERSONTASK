-- ═══════════════════════════════════════════════════════════════════════
--  PERSONTASK — Agendamento do e-mail de "vencimento próximo"
--  Requer as extensões pg_cron e pg_net (habilite em Database → Extensions).
--  Chama a Edge Function notify-due-soon 1x/dia (08:00 UTC). Idempotente.
--  Como a function foi implantada com --no-verify-jwt, basta a chave pública
--  (anon/publishable) para chamá-la — não precisa da service_role aqui.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove o agendamento anterior, se existir (idempotência)
do $$ begin
  perform cron.unschedule('persontask-due-soon');
exception when others then null; end $$;

select cron.schedule(
  'persontask-due-soon',
  '0 8 * * *',                         -- todos os dias às 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/notify-due-soon',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_OR_PUBLISHABLE_KEY>',
      'Authorization', 'Bearer <ANON_OR_PUBLISHABLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir:   select * from cron.job where jobname = 'persontask-due-soon';
-- Remover:    select cron.unschedule('persontask-due-soon');
