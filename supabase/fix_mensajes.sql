-- ══════════════════════════════════════════════════════════════
-- FIX: Tabla mensajes con RLS + Real-time
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: waevdcqdkovqaxkonlvj
-- ══════════════════════════════════════════════════════════════

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS mensajes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL CHECK (char_length(texto) > 0),
  leido       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para las queries del ChatScreen
CREATE INDEX IF NOT EXISTS idx_mensajes_sender   ON mensajes(sender_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_receiver ON mensajes(receiver_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_no_leidos ON mensajes(receiver_id, leido) WHERE leido = false;

-- 2. Habilitar RLS
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- 3. Borrar políticas viejas si existen (evita conflictos)
DROP POLICY IF EXISTS mensajes_select ON mensajes;
DROP POLICY IF EXISTS mensajes_insert ON mensajes;
DROP POLICY IF EXISTS mensajes_update ON mensajes;

-- 4. Política SELECT: cada usuario ve solo sus mensajes (enviados o recibidos)
CREATE POLICY mensajes_select ON mensajes
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 5. Política INSERT: solo podés insertar mensajes donde vos sos el sender
CREATE POLICY mensajes_insert ON mensajes
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 6. Política UPDATE: solo podés marcar como leído los mensajes que recibiste
CREATE POLICY mensajes_update ON mensajes
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 7. Dar permisos al rol authenticated (usuarios logueados en la app)
GRANT SELECT, INSERT, UPDATE ON mensajes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mensajes TO service_role;

-- 8. Habilitar real-time para que funcione la suscripción en tiempo real
-- (esto no se puede hacer por SQL puro, pero el paso siguiente lo explica)

-- ══════════════════════════════════════════════════════════════
-- PASO MANUAL OBLIGATORIO después de correr este SQL:
--
-- 1. Ir a Supabase Dashboard → Database → Replication
-- 2. Activar la tabla "mensajes" en la lista de tablas con replicación
--    (si ya aparece, verificar que esté ON)
--
-- Sin este paso, las suscripciones en tiempo real (supabase.channel)
-- no reciben eventos y los mensajes solo aparecen al recargar.
-- ══════════════════════════════════════════════════════════════
