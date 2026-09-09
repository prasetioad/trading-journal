-- Schedules (PRD §4.5 / §6). Requires pg_cron + pg_net (enabled by default on
-- Supabase). Replace <PROJECT_REF> and set the service-role key as a Vault secret
-- before running: select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- helper: invoke an Edge Function with the service-role key
create or replace function public.invoke_edge(fn text)
returns void language plpgsql security definer as $$
declare
  key text;
begin
  select decrypted_secret into key from vault.decrypted_secrets where name = 'service_role_key';
  perform net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/' || fn,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
end $$;

-- Price / prediction verifier — every 5 minutes
select cron.schedule('price-verifier-5min', '*/5 * * * *', $$select public.invoke_edge('price-verifier')$$);

-- AI daily insight — 17:00 WIB == 10:00 UTC
select cron.schedule('ai-daily-1700wib', '0 10 * * *', $$select public.invoke_edge('ai-daily')$$);

-- to remove:  select cron.unschedule('price-verifier-5min');
