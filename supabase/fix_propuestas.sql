-- ══════════════════════════════════════════════════════════════
-- Tabla propuestas — circuito empleador → trabajador
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS propuestas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_nombre  TEXT,
  oferta           JSONB,   -- snapshot: titulo, lugar, carga_horaria, sueldo_tipo, sueldo_min, sueldo_max, descripcion, empleo
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aceptada','rechazada')),
  motivo_rechazo   TEXT,    -- 'ubicacion' | 'carga_horaria' | 'remuneracion' | 'otro'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondida_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_propuestas_worker   ON propuestas(worker_id, estado);
CREATE INDEX IF NOT EXISTS idx_propuestas_employer ON propuestas(employer_id);

ALTER TABLE propuestas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS propuestas_own ON propuestas;
CREATE POLICY propuestas_own ON propuestas
  FOR ALL USING (auth.uid() = employer_id OR auth.uid() = worker_id);

GRANT SELECT, INSERT, UPDATE ON propuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON propuestas TO service_role;
