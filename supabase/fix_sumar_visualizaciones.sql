-- ══════════════════════════════════════════════════════════════
-- FIX: función sumar_visualizaciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Recrear la función que llama el webhook de MercadoPago
CREATE OR REPLACE FUNCTION sumar_visualizaciones(employer_id UUID, cantidad INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET visualizaciones_disponibles = COALESCE(visualizaciones_disponibles, 0) + cantidad
  WHERE id = employer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permiso al service role para ejecutarla
GRANT EXECUTE ON FUNCTION sumar_visualizaciones(UUID, INTEGER) TO service_role;
