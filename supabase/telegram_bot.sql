-- telegram_bot.sql — infraestructura del bot de Telegram (telegram-concursos)
-- Paso 1: tabla de dedupe. Paso 2: cron (ejecutar RECIÉN después del seed, ver CONFIGURAR.md).

-- ============ PASO 1: TABLA DE DEDUPE ============
-- Clave por (fuente, fuente_id, canal) — NO por uuid, porque los concursos se
-- borran y reinsertan con uuid nuevo. fuente_id es estable entre re-scrapeos.
CREATE TABLE IF NOT EXISTS telegram_publicados (
  fuente       TEXT NOT NULL,
  fuente_id    TEXT NOT NULL,
  canal        TEXT NOT NULL,
  publicado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fuente, fuente_id, canal)
);

-- Solo la edge function (service_role) la usa. RLS activo sin policies = nadie más entra.
ALTER TABLE telegram_publicados ENABLE ROW LEVEL SECURITY;

-- ============ PASO 2: CRON (ejecutar DESPUÉS del seed) ============
-- Cada hora al minuto 20. Publica máx. 12 por corrida (límite Telegram ~20 msg/min);
-- si hay más, los drena en las corridas siguientes. Idempotente por la tabla de dedupe.
-- Mismo patrón que el cron de notificar-indexacion (jobid 41).
--
-- SELECT cron.schedule('telegram-concursos-uy', '20 * * * *', $$
--   SELECT net.http_post(
--     url     := 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/telegram-concursos',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer "}'::jsonb,
--     body    := '{"pais":"UY","max":12,"horas":48}'::jsonb
--   );
-- $$);

-- Para desactivarlo si algo sale mal:
-- SELECT cron.unschedule('telegram-concursos-uy');
