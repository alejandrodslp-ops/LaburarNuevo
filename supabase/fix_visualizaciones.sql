-- ══════════════════════════════════════════════════════════════
-- FIX: tabla visualizaciones — RLS + columna created_at
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Agregar created_at si no existe
ALTER TABLE visualizaciones
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Habilitar RLS
ALTER TABLE visualizaciones ENABLE ROW LEVEL SECURITY;

-- Política de lectura: el empleador ve sus propias visualizaciones
DROP POLICY IF EXISTS "employers_select_own" ON visualizaciones;
CREATE POLICY "employers_select_own" ON visualizaciones
  FOR SELECT USING (employer_id = auth.uid());

-- Política de inserción: el empleador inserta las suyas
DROP POLICY IF EXISTS "employers_insert_own" ON visualizaciones;
CREATE POLICY "employers_insert_own" ON visualizaciones
  FOR INSERT WITH CHECK (employer_id = auth.uid());

-- Grants
GRANT SELECT, INSERT ON visualizaciones TO authenticated;
GRANT SELECT, INSERT ON visualizaciones TO service_role;
