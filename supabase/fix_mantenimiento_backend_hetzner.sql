-- 2026-09-25: wrappers para que backend-hetzner pueda correr, vía RPC, el
-- mantenimiento que hoy hacen crons de SQL directo en Supabase. PostgREST/
-- supabase-js no ejecuta UPDATE con subquery+LIMIT directo, por eso van
-- envueltos en función (VACUUM queda aparte, no puede ir en una función).

CREATE OR REPLACE FUNCTION public.desactivar_concursos_vencidos_job()
RETURNS void LANGUAGE sql AS $$
  UPDATE concursos SET activo=false WHERE id IN (
    SELECT id FROM concursos WHERE activo=true AND fecha_cierre IS NOT NULL
      AND fecha_cierre < NOW() ORDER BY fecha_cierre LIMIT 3000
  );
$$;

CREATE OR REPLACE FUNCTION public.desactivar_suscripciones_vencidas_job()
RETURNS void LANGUAGE sql AS $$
  UPDATE profiles SET suscripcion_activa = false
  WHERE suscripcion_activa = true AND suscripcion_vence_at < now();
$$;

CREATE OR REPLACE FUNCTION public.actualizar_stats_concursos_job()
RETURNS void LANGUAGE sql AS $$
  UPDATE stats SET value = (SELECT COALESCE(SUM(total),0) FROM stats_por_pais), updated_at = NOW()
  WHERE key = 'concursos_activos';
$$;
