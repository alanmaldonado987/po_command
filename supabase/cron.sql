-- Programador de alertas: revisa las reglas y despacha la cola cada 15 minutos.
-- Antes de ejecutarlo, guarda estos dos secretos en Vault (SQL Editor del proyecto):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('po-alertas-tick')
where exists (select 1 from cron.job where jobname = 'po-alertas-tick');

select cron.schedule(
  'po-alertas-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"accion": "tick"}'::jsonb
  );
  $$
);

-- Integración con ClickUp: envía la cola cada minuto y reconcilia cada 10 minutos
-- (respaldo si el webhook no está disponible en el plan de ClickUp).
select cron.unschedule(jobname) from cron.job where jobname in ('po-clickup-sincronizar', 'po-clickup-reconciliar');

select cron.schedule(
  'po-clickup-sincronizar',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/clickup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"accion": "sincronizar"}'::jsonb
  );
  $$
);

select cron.schedule(
  'po-clickup-reconciliar',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/clickup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"accion": "reconciliar"}'::jsonb
  );
  $$
);
