-- ══════════════════════════════════════════════════════════════
-- FIX: función sumar_visualizaciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Recrear la función que llama el webhook de MercadoPago
CREATE OR REPLACE FUNCTION sumar_visualizaciones(employer_id UUID, cantidad INTEGER)
RETURNS void AS $$
BEGIN
  -- Validar que la cantidad sea razonable (previene abuso si alguien llega a invocarla)
  IF cantidad <= 0 OR cantidad > 10000 THEN
    RAISE EXCEPTION 'cantidad inválida: %', cantidad;
  END IF;

  UPDATE profiles
  SET visualizaciones_disponibles = COALESCE(visualizaciones_disponibles, 0) + cantidad
  WHERE id = employer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revocar de PUBLIC (heredado por authenticated) — solo service_role puede invocarla
REVOKE EXECUTE ON FUNCTION sumar_visualizaciones(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION sumar_visualizaciones(UUID, INTEGER) TO service_role;
