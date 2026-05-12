-- ══════════════════════════════════════════════════════════════
-- FIX: push_token en profiles + real-time en propuestas y mensajes
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Agregar columna push_token a profiles (si no existe)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Habilitar real-time para propuestas y mensajes
--    (Supabase usa una publication de PostgreSQL para real-time)
ALTER PUBLICATION supabase_realtime ADD TABLE propuestas;
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;

-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN: correr esto después para confirmar que quedó ok
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Debe aparecer: mensajes, propuestas (y cualquier otra tabla que tengas)
-- ══════════════════════════════════════════════════════════════
