-- ══════════════════════════════════════════════════════════════
-- CRON: Scraper automático de llamados públicos
--
-- ANTES DE EJECUTAR: reemplazá los dos valores de abajo con los
-- de tu proyecto. Los encontrás en:
-- Supabase Dashboard → Settings → API
--   • Project URL   → reemplazá TU_URL
--   • service_role  → reemplazá TU_SERVICE_ROLE_KEY
-- ══════════════════════════════════════════════════════════════

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Borrar jobs anteriores si existen (para re-ejecutar sin error)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('scraper-concursos-manana', 'scraper-concursos-mediodia');

-- 3. 3:00am Uruguay todos los días → scrape completo todos los países
SELECT cron.schedule(
  'scraper-concursos-manana',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'TU_URL/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 4. 12:00pm Uruguay → solo Uruguay (actualización del mediodía)
SELECT cron.schedule(
  'scraper-concursos-mediodia',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url     := 'TU_URL/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{"pais":"UY"}'::jsonb
  );
  $$
);

-- ── Verificar que quedaron creados ──
-- SELECT jobid, jobname, schedule, command FROM cron.job;

-- ── Ver historial de ejecuciones ──
-- SELECT jobid, start_time, end_time, status FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
