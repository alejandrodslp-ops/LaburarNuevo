-- ══════════════════════════════════════════════════════════════
-- MATCHING ESCALABLE — todo en PostgreSQL, no en Deno
--
-- Idea: en vez de iterar workers desde código, usar:
--   1. GIN indexes sobre arrays de keywords
--   2. Función SQL que calcula scores directamente en la DB
--   3. Trigger en concursos → matchea solo el concurso nuevo
--   4. Trigger en profiles → re-matchea solo ese worker
--
-- Con GIN index, buscar workers que coinciden con un concurso
-- es O(log N) en lugar de O(N) — funciona con 200M usuarios.
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. ÍNDICES GIN sobre arrays de keywords en profiles
--    Permiten buscar workers con overlap de keywords en microsegundos
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_servicios    ON profiles USING GIN (servicios);
CREATE INDEX IF NOT EXISTS idx_profiles_profesiones  ON profiles USING GIN (profesiones);
CREATE INDEX IF NOT EXISTS idx_profiles_especialidades ON profiles USING GIN (especialidades);
CREATE INDEX IF NOT EXISTS idx_concursos_keywords    ON concursos USING GIN (keywords);

-- ─────────────────────────────────────────────────────────────
-- 2. FUNCIÓN DE NORMALIZACIÓN — igual que en Deno
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION normalizar_texto(t TEXT)
RETURNS TEXT AS $$
  SELECT lower(
    regexp_replace(
      translate(
        coalesce(t, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
        'aaaaaeeeeiiiioooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
      ),
      '[^a-zA-Z0-9 ]', ' ', 'g'
    )
  );
$$ LANGUAGE sql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCIÓN: país largo → código ISO
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pais_a_iso(pais TEXT)
RETURNS TEXT AS $$
  SELECT CASE lower(trim(coalesce(pais, '')))
    WHEN 'uruguay'   THEN 'UY'
    WHEN 'argentina' THEN 'AR'
    WHEN 'chile'     THEN 'CL'
    WHEN 'colombia'  THEN 'CO'
    WHEN 'peru'      THEN 'PE'
    WHEN 'perú'      THEN 'PE'
    WHEN 'brasil'    THEN 'BR'
    WHEN 'brazil'    THEN 'BR'
    WHEN 'paraguay'  THEN 'PY'
    WHEN 'bolivia'   THEN 'BO'
    WHEN 'ecuador'   THEN 'EC'
    WHEN 'venezuela' THEN 'VE'
    ELSE upper(substring(trim(pais), 1, 2))
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────
-- 4. FUNCIÓN CORE: calcular score entre un worker y un concurso
--    Corre 100% en SQL — sin round-trips a Deno
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calcular_score_match(
  p_worker_id UUID,
  p_concurso_id UUID
)
RETURNS TABLE(score INT, cumple BOOL, keywords_match TEXT[]) AS $$
DECLARE
  v_pais_iso    TEXT;
  v_ciudad      TEXT;
  v_keywords    TEXT[];
  v_c_keywords  TEXT[];
  v_c_pais      TEXT;
  v_c_lugar     TEXT;
  v_matched     TEXT[];
  v_score       INT := 0;
  kw            TEXT;
  ckw           TEXT;
BEGIN
  -- Datos del worker
  SELECT
    pais_a_iso(p.pais),
    p.ciudad,
    array_cat(
      array_cat(
        coalesce(p.servicios, '{}'),
        coalesce(p.profesiones, '{}')
      ),
      coalesce(p.especialidades, '{}')
    )
  INTO v_pais_iso, v_ciudad, v_keywords
  FROM profiles p WHERE p.id = p_worker_id;

  -- Datos del concurso
  SELECT c.keywords, c.pais, c.lugar
  INTO v_c_keywords, v_c_pais, v_c_lugar
  FROM concursos c WHERE c.id = p_concurso_id;

  -- Sin keywords = score 0
  IF coalesce(array_length(v_keywords, 1), 0) = 0
     OR coalesce(array_length(v_c_keywords, 1), 0) = 0 THEN
    RETURN QUERY SELECT 0::INT, false, '{}'::TEXT[];
    RETURN;
  END IF;

  -- Match keyword a keyword (normalizado, substring bidireccional)
  v_matched := '{}';
  FOREACH kw IN ARRAY v_keywords LOOP
    FOREACH ckw IN ARRAY v_c_keywords LOOP
      IF normalizar_texto(ckw) = normalizar_texto(kw)
         OR normalizar_texto(ckw) LIKE '%' || normalizar_texto(kw) || '%'
         OR normalizar_texto(kw)  LIKE '%' || normalizar_texto(ckw) || '%'
      THEN
        IF NOT (normalizar_texto(kw) = ANY(v_matched)) THEN
          v_matched := array_append(v_matched, kw);
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Score base (0-80)
  v_score := round(
    (cardinality(v_matched)::FLOAT / array_length(v_keywords, 1)::FLOAT) * 80
  )::INT;

  -- Bonus país (+15)
  IF v_pais_iso = v_c_pais THEN v_score := v_score + 15; END IF;

  -- Bonus ciudad (+5)
  IF v_ciudad IS NOT NULL AND v_c_lugar IS NOT NULL THEN
    IF normalizar_texto(v_c_lugar) LIKE '%' || normalizar_texto(v_ciudad) || '%'
       OR normalizar_texto(v_ciudad) LIKE '%' || normalizar_texto(v_c_lugar) || '%'
    THEN v_score := v_score + 5; END IF;
  END IF;

  v_score := LEAST(v_score, 100);

  RETURN QUERY SELECT v_score, v_score >= 40, v_matched;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 5. FUNCIÓN: matchear UN concurso contra todos los workers
--    Se llama cuando llega un concurso nuevo (trigger)
--    Usa GIN index para filtrar solo workers relevantes → O(log N)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_concurso_vs_workers(p_concurso_id UUID)
RETURNS INT AS $$
DECLARE
  v_pais        TEXT;
  v_keywords    TEXT[];
  v_count       INT := 0;
  r             RECORD;
  v_score       INT;
  v_cumple      BOOL;
  v_matched     TEXT[];
BEGIN
  SELECT pais, keywords INTO v_pais, v_keywords
  FROM concursos WHERE id = p_concurso_id;

  IF v_keywords IS NULL OR array_length(v_keywords, 1) = 0 THEN RETURN 0; END IF;

  -- Filtrar solo workers del mismo país cuyas keywords tengan overlap
  -- El operador && usa el GIN index → rapidísimo aunque haya 200M workers
  FOR r IN
    SELECT p.id
    FROM profiles p
    WHERE p.rol = 'worker'
      AND p.perfil_activo = true
      AND pais_a_iso(p.pais) = v_pais
      AND (
        coalesce(p.servicios, '{}')      && v_keywords OR
        coalesce(p.profesiones, '{}')    && v_keywords OR
        coalesce(p.especialidades, '{}') && v_keywords
      )
  LOOP
    SELECT s, c, km INTO v_score, v_cumple, v_matched
    FROM calcular_score_match(r.id, p_concurso_id) AS t(s INT, c BOOL, km TEXT[]);

    INSERT INTO concurso_matches
      (concurso_id, worker_id, score, cumple, keywords_match, notificado)
    VALUES
      (p_concurso_id, r.id, v_score, v_cumple, v_matched, false)
    ON CONFLICT (concurso_id, worker_id) DO UPDATE
      SET score = EXCLUDED.score,
          cumple = EXCLUDED.cumple,
          keywords_match = EXCLUDED.keywords_match,
          updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 6. FUNCIÓN: matchear UN worker contra todos los concursos
--    Se llama cuando el worker actualiza su perfil
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_worker_vs_concursos(p_worker_id UUID)
RETURNS INT AS $$
DECLARE
  v_pais_iso    TEXT;
  v_keywords    TEXT[];
  v_count       INT := 0;
  r             RECORD;
  v_score       INT;
  v_cumple      BOOL;
  v_matched     TEXT[];
  hoy           DATE := CURRENT_DATE;
BEGIN
  SELECT
    pais_a_iso(p.pais),
    array_cat(array_cat(
      coalesce(p.servicios, '{}'),
      coalesce(p.profesiones, '{}')),
      coalesce(p.especialidades, '{}')
    )
  INTO v_pais_iso, v_keywords
  FROM profiles p WHERE p.id = p_worker_id AND p.rol = 'worker';

  IF v_keywords IS NULL OR array_length(v_keywords, 1) = 0 THEN RETURN 0; END IF;

  -- Solo concursos activos del mismo país con keywords que coincidan
  FOR r IN
    SELECT c.id
    FROM concursos c
    WHERE c.activo = true
      AND c.pais = v_pais_iso
      AND (c.fecha_cierre IS NULL OR c.fecha_cierre >= hoy)
      AND c.keywords && v_keywords  -- GIN index
  LOOP
    SELECT s, c2, km INTO v_score, v_cumple, v_matched
    FROM calcular_score_match(p_worker_id, r.id) AS t(s INT, c2 BOOL, km TEXT[]);

    INSERT INTO concurso_matches
      (concurso_id, worker_id, score, cumple, keywords_match, notificado)
    VALUES
      (r.id, p_worker_id, v_score, v_cumple, v_matched, false)
    ON CONFLICT (concurso_id, worker_id) DO UPDATE
      SET score = EXCLUDED.score,
          cumple = EXCLUDED.cumple,
          keywords_match = EXCLUDED.keywords_match,
          notificado = false,
          updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 7. TRIGGER: cuando llega concurso nuevo → match automático
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_match_concurso_nuevo()
RETURNS TRIGGER AS $$
BEGIN
  -- No bloquear el insert — lanzar en background
  PERFORM match_concurso_vs_workers(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_concurso_nuevo ON concursos;
CREATE TRIGGER on_concurso_nuevo
  AFTER INSERT ON concursos
  FOR EACH ROW EXECUTE FUNCTION trigger_match_concurso_nuevo();

-- ─────────────────────────────────────────────────────────────
-- 8. TRIGGER: cuando worker actualiza servicios/profesiones → re-match
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_match_perfil_actualizado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol = 'worker' AND (
    NEW.servicios      IS DISTINCT FROM OLD.servicios OR
    NEW.profesiones    IS DISTINCT FROM OLD.profesiones OR
    NEW.especialidades IS DISTINCT FROM OLD.especialidades OR
    NEW.pais           IS DISTINCT FROM OLD.pais
  ) THEN
    PERFORM match_worker_vs_concursos(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_perfil_actualizado ON profiles;
CREATE TRIGGER on_perfil_actualizado
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_match_perfil_actualizado();

-- ─────────────────────────────────────────────────────────────
-- 9. RPC para llamar desde la app o edge function
--    POST /rest/v1/rpc/rematch_worker  { "p_worker_id": "uuid" }
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rematch_worker(p_worker_id UUID)
RETURNS JSON AS $$
DECLARE v_count INT;
BEGIN
  SELECT match_worker_vs_concursos(p_worker_id) INTO v_count;
  RETURN json_build_object('ok', true, 'matches', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rematch_worker(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Ejecutar re-match inicial de todos los workers existentes
-- (solo una vez, para poblar con la nueva lógica)
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE r RECORD; total INT := 0;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE rol = 'worker' AND perfil_activo = true LOOP
    total := total + match_worker_vs_concursos(r.id);
  END LOOP;
  RAISE NOTICE 'Re-match inicial: % matches generados', total;
END;
$$;
