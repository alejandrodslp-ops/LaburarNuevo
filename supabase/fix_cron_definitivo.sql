-- ══════════════════════════════════════════════════════════════
-- CRON JOBS DEFINITIVOS — valores reales del proyecto Nexu
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Borrar jobs anteriores si existen
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'scraper-concursos-manana',
  'scraper-concursos-resumen',
  'scraper-concursos-mediodia',
  'scraper-concursos-noche'
);

-- 1. 3:00am Uruguay (06:00 UTC) — scrape completo todos los países
SELECT cron.schedule(
  'scraper-concursos-manana',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SUPABASE_SERVICE_KEY_PLACEHOLDER"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 1b. 3:30am Uruguay (06:30 UTC) — enviar resumen diario por email (después del scrape)
SELECT cron.schedule(
  'scraper-concursos-resumen',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SUPABASE_SERVICE_KEY_PLACEHOLDER"}'::jsonb,
    body    := '{"modo":"resumen"}'::jsonb
  );
  $$
);

-- 2. 12:00pm Uruguay (15:00 UTC) — solo Uruguay (actualización del mediodía)
SELECT cron.schedule(
  'scraper-concursos-mediodia',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SUPABASE_SERVICE_KEY_PLACEHOLDER"}'::jsonb,
    body    := '{"paises":["UY","AR","BR"]}'::jsonb
  );
  $$
);

-- 3. 8:00pm Uruguay (23:00 UTC) — scrape nocturno resto de países
SELECT cron.schedule(
  'scraper-concursos-noche',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/scraper-concursos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SUPABASE_SERVICE_KEY_PLACEHOLDER"}'::jsonb,
    body    := '{"paises":["CL","CO","PE","PY","BO","EC","MX","VE","CR","GT","ES","PT"]}'::jsonb
  );
  $$
);

-- Verificar que quedaron creados
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname LIKE 'scraper-concursos%' ORDER BY jobid;
