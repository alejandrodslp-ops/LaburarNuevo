-- ══════════════════════════════════════════════════════════════
-- ÍNDICES Y FIXES DE SCHEMA — aplicados 2026-05-30
-- Ejecutados via edge function exec-sql en producción
-- ══════════════════════════════════════════════════════════════

-- ── pagos ─────────────────────────────────────────────────────
-- Idempotencia del webhook: evita procesar el mismo pago dos veces
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_referencia_externa
  ON pagos(referencia_externa) WHERE referencia_externa IS NOT NULL;

-- Queries del panel admin filtran por estado + orden por fecha
CREATE INDEX IF NOT EXISTS idx_pagos_estado_created
  ON pagos(estado, created_at DESC);

-- Queries de historial de usuario
CREATE INDEX IF NOT EXISTS idx_pagos_user_id ON pagos(user_id);

-- ── profiles ──────────────────────────────────────────────────
-- getStats() y segmentos filtran perfil_activo=true AND perfil_activo_hasta > now()
CREATE INDEX IF NOT EXISTS idx_profiles_activo_hasta
  ON profiles(perfil_activo, perfil_activo_hasta)
  WHERE perfil_activo = true;

-- ── reportes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reportes_reportado_revisado
  ON reportes(reportado_id, revisado);
CREATE INDEX IF NOT EXISTS idx_reportes_por_reportado
  ON reportes(reportado_por, reportado_id);

-- ── concurso_matches ──────────────────────────────────────────
-- notificar-matches: filtra cumple=true AND notificado=false ORDER BY score
CREATE INDEX IF NOT EXISTS idx_matches_pendientes_notif
  ON concurso_matches(cumple, notificado, score DESC)
  WHERE cumple = true AND notificado = false;

-- ── propuestas ────────────────────────────────────────────────
ALTER TABLE propuestas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── mensajes ──────────────────────────────────────────────────
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── triggers updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_propuestas_updated_at ON propuestas;
CREATE TRIGGER set_propuestas_updated_at
  BEFORE UPDATE ON propuestas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_mensajes_updated_at ON mensajes;
CREATE TRIGGER set_mensajes_updated_at
  BEFORE UPDATE ON mensajes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── concursos: DATE → TIMESTAMPTZ ────────────────────────────
-- Evita cast implícito y problemas de zona horaria al comparar con toISOString()
ALTER TABLE concursos
  ALTER COLUMN fecha_cierre TYPE TIMESTAMPTZ USING fecha_cierre::TIMESTAMPTZ,
  ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ USING fecha_inicio::TIMESTAMPTZ;
