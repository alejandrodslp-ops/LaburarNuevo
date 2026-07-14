-- Matching de alertas insensible a tildes (2026-07-14, v3)
-- Bug original: "tecnico en hemoterapia" (sin tilde) no matcheaba
-- "Técnico de salud con orientación en hemoterapia" (con tilde) → 0 alertas.
--
-- v2→v3: plpgsql con EXECUTE (SQL dinámico). Vía PostgREST el RPC se ejecuta
-- como prepared statement → plan GENÉRICO que ignora el valor de p_pais y
-- elige el índice de created_at → escaneo global >150s → IDLE_TIMEOUT en la
-- edge function. EXECUTE inserta los valores como constantes → plan específico
-- (usa idx_concursos_pais_activo, ~2s frío / ~30ms caliente).
-- p_pais es OBLIGATORIO: los leads sin país usan el camino ilike clásico en la
-- edge function (el LIMIT interno de acá truncaría el barrido global).
-- Las palabras de p_terminos llegan YA normalizadas (minúsculas, sin tildes).

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION buscar_concursos_alerta(
  p_pais text,
  p_desde timestamptz,
  p_terminos text[]
)
RETURNS TABLE(id uuid, titulo text, cargo text, organismo text, pais text, lugar text)
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
  IF p_pais IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH base AS MATERIALIZED (
      SELECT c.id, c.titulo, c.cargo, c.organismo, c.pais, c.lugar, c.created_at
      FROM concursos c
      WHERE c.activo = true
        AND c.pais = %L
        AND c.created_at > %L::timestamptz
      ORDER BY c.created_at DESC
      LIMIT 20000
    ),
    norm AS (
      SELECT b.*,
             extensions.unaccent(lower(coalesce(b.titulo,''))) AS tn,
             extensions.unaccent(lower(coalesce(b.cargo,'')))  AS cn
      FROM base b
    )
    SELECT n.id, n.titulo, n.cargo, n.organismo, n.pais, n.lugar
    FROM norm n
    WHERE EXISTS (
      SELECT 1 FROM unnest($1) AS term
      WHERE (
        NOT EXISTS (SELECT 1 FROM regexp_split_to_table(term, '\s+') AS w
                    WHERE position(w IN n.tn) = 0)
        OR
        NOT EXISTS (SELECT 1 FROM regexp_split_to_table(term, '\s+') AS w
                    WHERE position(w IN n.cn) = 0)
      )
    )
    ORDER BY n.created_at DESC
    LIMIT 8
  $q$, p_pais, p_desde) USING p_terminos;
END $fn$;
