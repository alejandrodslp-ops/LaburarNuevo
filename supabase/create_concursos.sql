-- ══════════════════════════════════════════════════════════════
-- SISTEMA CONCURSA — tablas y RLS
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- TABLA: concursos
-- Almacena llamados/concursos públicos de toda Sudamérica
-- Poblada por la Edge Function scraper-concursos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concursos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id       TEXT NOT NULL,            -- ID externo del portal origen
  fuente          TEXT NOT NULL,            -- 'uruguay_concursa' | 'argentina_ingresopublico' | ...
  pais            TEXT NOT NULL DEFAULT 'UY', -- código ISO 2 letras
  numero_llamado  TEXT,                     -- "6336/2026"
  titulo          TEXT NOT NULL,            -- cargo/posición completa
  cargo           TEXT,                     -- solo el nombre del cargo
  organismo       TEXT,                     -- organismo convocante
  descripcion     TEXT,                     -- descripción de función
  requisitos      TEXT,                     -- requisitos específicos
  tipo_tarea      TEXT,                     -- 'Técnicas' | 'Administrativas' | ...
  tipo_vinculo    TEXT,                     -- 'Contratado' | 'Efectivo' | ...
  lugar           TEXT,                     -- lugar de desempeño
  fecha_inicio    DATE,
  fecha_cierre    DATE,
  puestos         INTEGER DEFAULT 1,
  url_detalle     TEXT,                     -- URL de la ficha completa
  url_postulacion TEXT,                     -- URL para postularse
  keywords        TEXT[],                   -- palabras clave extraídas del cargo
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fuente, fuente_id)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: concurso_matches
-- Resultado del matching entre trabajadores y concursos
-- Actualizada por la Edge Function match-concursos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concurso_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id     UUID REFERENCES concursos(id) ON DELETE CASCADE,
  worker_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score           INTEGER DEFAULT 0,        -- 0-100 porcentaje de compatibilidad
  cumple          BOOLEAN DEFAULT FALSE,    -- true si score >= 40
  keywords_match  TEXT[],                   -- palabras del perfil que coincidieron
  notificado      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concurso_id, worker_id)
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_concursos_pais_activo   ON concursos(pais, activo);
CREATE INDEX IF NOT EXISTS idx_concursos_fecha_cierre  ON concursos(fecha_cierre) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_matches_worker_cumple   ON concurso_matches(worker_id, cumple);
CREATE INDEX IF NOT EXISTS idx_matches_worker_score    ON concurso_matches(worker_id, score DESC);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_matches ENABLE ROW LEVEL SECURITY;

-- Concursos: cualquier usuario autenticado puede leer
DROP POLICY IF EXISTS concursos_select ON concursos;
CREATE POLICY concursos_select ON concursos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo service_role puede escribir concursos (scraper usa service_role key)
DROP POLICY IF EXISTS concursos_insert ON concursos;
CREATE POLICY concursos_insert ON concursos
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS concursos_update ON concursos;
CREATE POLICY concursos_update ON concursos
  FOR UPDATE USING (false);

-- Matches: el trabajador solo ve sus propios matches
DROP POLICY IF EXISTS matches_select ON concurso_matches;
CREATE POLICY matches_select ON concurso_matches
  FOR SELECT USING (auth.uid() = worker_id);

DROP POLICY IF EXISTS matches_insert ON concurso_matches;
CREATE POLICY matches_insert ON concurso_matches
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS matches_update ON concurso_matches;
CREATE POLICY matches_update ON concurso_matches
  FOR UPDATE USING (false);

GRANT SELECT ON concursos        TO authenticated;
GRANT SELECT ON concurso_matches TO authenticated;
GRANT ALL    ON concursos        TO service_role;
GRANT ALL    ON concurso_matches TO service_role;

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: actualizar updated_at automáticamente
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_concursos_updated_at    ON concursos;
DROP TRIGGER IF EXISTS set_matches_updated_at      ON concurso_matches;

CREATE TRIGGER set_concursos_updated_at
  BEFORE UPDATE ON concursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_matches_updated_at
  BEFORE UPDATE ON concurso_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN:
-- SELECT COUNT(*) FROM concursos;
-- SELECT COUNT(*) FROM concurso_matches;
-- ══════════════════════════════════════════════════════════════
