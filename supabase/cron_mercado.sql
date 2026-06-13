-- ══════════════════════════════════════════════════════════════
-- CRON: Scraper diario de Pulso Laboral LatAm (mercado_stats)
--
-- ANTES DE EJECUTAR: reemplazá los dos valores con los de tu proyecto
-- Supabase Dashboard → Settings → API
--   • Project URL   → reemplazá TU_URL
--   • service_role  → reemplazá TU_SERVICE_ROLE_KEY
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Borrar si ya existe para poder re-ejecutar
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'scraper-mercado-diario';

-- Todos los días a las 10:00 UTC (7am Uruguay)
-- Se ejecuta después del scraper de concursos (6:00 UTC)
SELECT cron.schedule(
  'scraper-mercado-diario',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := 'TU_URL/functions/v1/scraper-mercado',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── Verificar ──
-- SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'scraper-mercado-diario';
