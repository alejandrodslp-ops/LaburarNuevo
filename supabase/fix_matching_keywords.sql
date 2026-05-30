-- ══════════════════════════════════════════════════════════════
-- FIX: Matching por palabras individuales + prefijo de 7 chars
-- Problema: "Odontologo/a" no matchea "odontologia" con LIKE
-- Solución: extraer palabras individuales de los labels y
--           comparar por prefijo de 7 caracteres
-- ══════════════════════════════════════════════════════════════

-- 1. Columna keywords_norm en profiles (palabras extraídas y normalizadas)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS keywords_norm TEXT[] DEFAULT '{}';

-- 2. Función: extrae palabras individuales normalizadas de un array de labels
CREATE OR REPLACE FUNCTION extraer_keywords_norm(arr TEXT[])
RETURNS TEXT[] AS $$
  SELECT coalesce(array_agg(DISTINCT word), '{}')
  FROM (
    SELECT regexp_split_to_table(normalizar_texto(label), '\s+') AS word
    FROM unnest(coalesce(arr, '{}')) AS label
  ) sub
  WHERE length(word) > 4
$$ LANGUAGE sql IMMUTABLE;

-- 3. GIN index sobre keywords_norm para pre-filtro rápido
CREATE INDEX IF NOT EXISTS idx_profiles_keywords_norm ON profiles USING GIN (keywords_norm);

-- 4. Poblar keywords_norm para todos los workers existentes
UPDATE profiles
SET keywords_norm = extraer_keywords_norm(
  coalesce(servicios,'{}') || coalesce(profesiones,'{}') || coalesce(especialidades,'{}')
)
WHERE rol = 'worker';

-- 5. Actualizar calcular_score_match para usar palabras individuales
CREATE OR REPLACE FUNCTION calcular_score_match(
  p_worker_id UUID,
  p_concurso_id UUID
)
RETURNS TABLE(score INT, cumple BOOL, keywords_match TEXT[]) AS $$
DECLARE
  v_pais_iso    TEXT;
  v_ciudad      TEXT;
  v_keywords    TEXT[];  -- palabras normalizadas del worker
  v_c_keywords  TEXT[];
  v_c_pais      TEXT;
  v_c_lugar     TEXT;
  v_matched     TEXT[];
  v_score       INT := 0;
  kw            TEXT;
  ckw           TEXT;
BEGIN
  -- Datos del worker: usar keywords_norm (palabras individuales normalizadas)
  SELECT
    pais_a_iso(p.pais),
    p.ciudad,
    coalesce(p.keywords_norm, '{}')
  INTO v_pais_iso, v_ciudad, v_keywords
  FROM profiles p WHERE p.id = p_worker_id;

  SELECT c.keywords, c.pais, c.lugar
  INTO v_c_keywords, v_c_pais, v_c_lugar
  FROM concursos c WHERE c.id = p_concurso_id;

  IF coalesce(array_length(v_keywords, 1), 0) = 0
     OR coalesce(array_length(v_c_keywords, 1), 0) = 0 THEN
    RETURN QUERY SELECT 0::INT, false, '{}'::TEXT[];
    RETURN;
  END IF;

  -- Match: igual, substring, O prefijo de 7 chars (cubre odontologo vs odontologia)
  v_matched := '{}';
  FOREACH kw IN ARRAY v_keywords LOOP
    FOREACH ckw IN ARRAY v_c_keywords LOOP
      IF normalizar_texto(ckw) = kw
         OR normalizar_texto(ckw) LIKE '%' || kw || '%'
         OR kw LIKE '%' || normalizar_texto(ckw) || '%'
         OR (length(kw) >= 7 AND length(normalizar_texto(ckw)) >= 7
             AND left(kw, 7) = left(normalizar_texto(ckw), 7))
      THEN
        IF NOT (kw = ANY(v_matched)) THEN
          v_matched := array_append(v_matched, kw);
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  v_score := round(
    (cardinality(v_matched)::FLOAT / array_length(v_keywords, 1)::FLOAT) * 80
  )::INT;

  IF v_pais_iso = v_c_pais THEN v_score := v_score + 15; END IF;

  IF v_ciudad IS NOT NULL AND v_c_lugar IS NOT NULL THEN
    IF normalizar_texto(v_c_lugar) LIKE '%' || normalizar_texto(v_ciudad) || '%'
       OR normalizar_texto(v_ciudad) LIKE '%' || normalizar_texto(v_c_lugar) || '%'
    THEN v_score := v_score + 5; END IF;
  END IF;

  v_score := LEAST(v_score, 100);
  RETURN QUERY SELECT v_score, v_score >= 40, v_matched;
END;
$$ LANGUAGE plpgsql;

-- 6. Actualizar match_concurso_vs_workers para usar keywords_norm en el pre-filtro
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

  FOR r IN
    SELECT p.id
    FROM profiles p
    WHERE p.rol = 'worker'
      AND p.perfil_activo = true
      AND pais_a_iso(p.pais) = v_pais
      AND (
        p.keywords_norm && v_keywords OR
        EXISTS (
          SELECT 1 FROM unnest(p.keywords_norm) kn, unnest(v_keywords) ck
          WHERE length(kn) >= 7 AND length(normalizar_texto(ck)) >= 7
            AND left(kn, 7) = left(normalizar_texto(ck), 7)
        )
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

-- 7. Actualizar trigger de perfil para mantener keywords_norm
CREATE OR REPLACE FUNCTION trigger_match_perfil_actualizado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol = 'worker' AND (
    NEW.servicios      IS DISTINCT FROM OLD.servicios OR
    NEW.profesiones    IS DISTINCT FROM OLD.profesiones OR
    NEW.especialidades IS DISTINCT FROM OLD.especialidades OR
    NEW.pais           IS DISTINCT FROM OLD.pais
  ) THEN
    NEW.keywords_norm := extraer_keywords_norm(
      coalesce(NEW.servicios,'{}') || coalesce(NEW.profesiones,'{}') || coalesce(NEW.especialidades,'{}')
    );
    PERFORM match_worker_vs_concursos(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Re-matchar al usuario Maxi ahora mismo
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM profiles WHERE nombre = 'Maxi' AND rol = 'worker' LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM match_worker_vs_concursos(v_id);
    RAISE NOTICE 'Re-match de Maxi completado';
  END IF;
END;
$$;
