-- 2026-09-22: fallback de matching de alertas-waitlist por similitud de
-- trigramas (pg_trgm) en vez de "palabra mas larga = mas distintiva".
--
-- Bug real que reemplaza: buscar_concursos_alerta con el fallback viejo
-- elegia la PALABRA MAS LARGA de cada termino como "distintiva" para volver
-- a buscar cuando el AND estricto no encontraba nada. Longitud no es lo
-- mismo que especificidad:
--   - "psicóloga institucional o psicóloga laboral" -> elegia "institucional"
--     (13 letras) en vez de "psicóloga" (9) -> mando avisos de comunicacion/
--     comercial sin relacion, Y NI SIQUIERA encontro "Psicólogo Laboral" que
--     SI estaba activo en ese momento.
--   - "Ingeniero civil" -> elegia "ingeniero" en vez de "civil" -> mando
--     "Ingeniero Electromecánico" (otra especialidad).
--
-- Esta funcion mide similitud contra la FRASE COMPLETA de cada termino
-- usando pg_trgm (ya habilitado, con indices GIN trigram compuestos
-- (pais, f_unaccent(lower(titulo/cargo))) WHERE activo=true — los mismos
-- que ya existian para buscar_concursos_alerta). Es dinamico: no depende de
-- listas de palabras "genericas" mantenidas a mano — una palabra comun como
-- "institucional" aporta poco al puntaje de similitud frente a una frase
-- larga donde "psicologa" aparece repetida. De paso tolera typos
-- ("Piscólogo" por "Psicólogo").
--
-- Verificado antes de desplegar (EXPLAIN ANALYZE + RPC real):
--   - AR / 'psicóloga institucional o psicóloga laboral' -> 9 "Psicólogo
--     Laboral" reales (incluye 1 typo), CERO avisos de comunicacion/comercial.
--   - CR / 'Ingeniero civil' -> 1 resultado razonable ("Ingeniero Jr de
--     Procesos"), NO "Ingeniero Electromecánico".
--   - Performance: ~30ms con cache tibia (usa los indices trigram
--     existentes idx_concursos_pais_titulo_norm_trgm / _cargo_norm_trgm),
--     ~1.2s en frio. Muy por debajo del limite de 150s del runtime.
--
-- Reemplaza SOLO el fallback (cuando buscar_concursos_alerta con AND
-- estricto da 0 resultados) en supabase/functions/alertas-waitlist/index.ts.
-- La busqueda principal (AND de palabras) queda intacta.

CREATE OR REPLACE FUNCTION public.buscar_concursos_alerta_similitud(
  p_pais text, p_desde timestamp with time zone, p_frase text, p_umbral real DEFAULT 0.3
)
RETURNS TABLE(id uuid, titulo text, cargo text, organismo text, pais text, lugar text, url_detalle text)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  IF p_pais IS NULL OR p_frase IS NULL OR trim(p_frase) = '' THEN
    RETURN;
  END IF;

  -- set_limit() es a nivel de sesion (no hay SET LOCAL permitido en
  -- funciones STABLE). Como p_umbral por defecto ya es 0.3 = default de
  -- pg_trgm, en el uso normal esto es un no-op; solo importaria si se
  -- llamara con un umbral distinto sobre una conexion pooleada reusada.
  PERFORM public.set_limit(p_umbral);

  RETURN QUERY
  SELECT c.id, c.titulo, c.cargo, c.organismo, c.pais, c.lugar, c.url_detalle
  FROM concursos c
  WHERE c.activo = true
    AND c.pais = p_pais
    AND c.created_at > p_desde
    AND (
      public.f_unaccent(lower(c.titulo)) % public.f_unaccent(lower(p_frase))
      OR public.f_unaccent(lower(c.cargo)) % public.f_unaccent(lower(p_frase))
    )
  ORDER BY GREATEST(
    similarity(public.f_unaccent(lower(c.titulo)), public.f_unaccent(lower(p_frase))),
    similarity(public.f_unaccent(lower(c.cargo)),  public.f_unaccent(lower(p_frase)))
  ) DESC
  LIMIT 30;
END;
$function$;
