-- Monitoreo de cron jobs: detecta fallos para alertar.
-- crons_fallidos_24h() lee cron.job_run_details (security definer = corre como owner,
-- que sí tiene acceso al schema cron) y devuelve los crons que fallaron en las últimas 24h.
-- La edge function monitor-crons la llama y, si hay fallos, manda email vía Resend.

create or replace function public.crons_fallidos_24h()
returns table(jobname text, fallos bigint, ultimo_error text)
language sql
security definer
set search_path = cron, public
as $$
  select c.jobname::text,
         count(*) as fallos,
         max(left(coalesce(j.return_message,''), 200)) as ultimo_error
  from cron.job_run_details j
  join cron.job c on c.jobid = j.jobid
  where j.status = 'failed'
    and j.start_time > now() - interval '24 hours'
  group by c.jobname
  order by 2 desc;
$$;

revoke all on function public.crons_fallidos_24h() from public, anon;
grant execute on function public.crons_fallidos_24h() to service_role;
