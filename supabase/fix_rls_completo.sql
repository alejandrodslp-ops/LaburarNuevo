-- ══════════════════════════════════════════════════════════════
-- REVISIÓN COMPLETA DE RLS — todas las tablas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: waevdcqdkovqaxkonlvj
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- TABLA: profiles
-- Quién necesita leer: todos los usuarios autenticados
--   (BuscarScreen lista workers, MensajesScreen lee nombres, etc.)
-- Quién puede editar: solo el propio dueño del perfil
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select  ON profiles;
DROP POLICY IF EXISTS profiles_insert  ON profiles;
DROP POLICY IF EXISTS profiles_update  ON profiles;
DROP POLICY IF EXISTS profiles_delete  ON profiles;

-- Cualquier usuario logueado puede ver perfiles (necesario para búsquedas y chat)
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Cada usuario solo puede crear su propio perfil
CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Cada usuario solo puede editar su propio perfil
CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Nadie puede borrar perfiles desde la app (solo service_role)
CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (false);

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;


-- ─────────────────────────────────────────────────────────────
-- TABLA: ofertas
-- SELECT: cualquier usuario autenticado (los trabajadores ven la oferta
--         del empleador en el ChatScreen y PropuestaScreen)
-- INSERT/UPDATE/DELETE: solo el empleador dueño de la oferta
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ofertas_own    ON ofertas;
DROP POLICY IF EXISTS ofertas_select ON ofertas;
DROP POLICY IF EXISTS ofertas_modify ON ofertas;

CREATE POLICY ofertas_select ON ofertas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY ofertas_modify ON ofertas
  FOR ALL USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ofertas TO authenticated;
GRANT ALL ON ofertas TO service_role;


-- ─────────────────────────────────────────────────────────────
-- TABLA: pagos
-- Quién necesita leer: el usuario dueño del pago
-- Quién inserta: solo service_role (webhook de MercadoPago)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagos_select ON pagos;
DROP POLICY IF EXISTS pagos_insert ON pagos;

-- El usuario ve sus propios pagos (como employer o como worker)
CREATE POLICY pagos_select ON pagos
  FOR SELECT USING (auth.uid() = employer_id OR auth.uid() = worker_id);

-- Inserts solo desde service_role (webhook). Authenticated no puede insertar pagos.
-- (service_role bypasses RLS automáticamente, esta policy bloquea al cliente)
CREATE POLICY pagos_insert ON pagos
  FOR INSERT WITH CHECK (false);

GRANT SELECT ON pagos TO authenticated;
GRANT ALL ON pagos TO service_role;


-- ─────────────────────────────────────────────────────────────
-- CONFIRMACIÓN: estas tablas ya tienen sus políticas correctas
-- (creadas en sesiones anteriores, incluidas aquí como referencia)
--
-- propuestas: propuestas_own FOR ALL → employer_id OR worker_id ✓
-- mensajes:   mensajes_select, _insert, _update (sender/receiver) ✓
-- visualizaciones: employers_select_own, employers_insert_own ✓
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- DATOS DE PRUEBA — limpiar perfil de test Juan García
-- Descomentar y ejecutar solo si querés limpiar el entorno
-- ─────────────────────────────────────────────────────────────
-- DELETE FROM visualizaciones WHERE employer_id = '49c3016e-6932-4b61-9c99-fc1219eb4171';
-- DELETE FROM propuestas        WHERE employer_id = '49c3016e-6932-4b61-9c99-fc1219eb4171';
-- DELETE FROM mensajes          WHERE sender_id   = '49c3016e-6932-4b61-9c99-fc1219eb4171'
--                                  OR receiver_id = '49c3016e-6932-4b61-9c99-fc1219eb4171';
-- DELETE FROM pagos             WHERE employer_id = '49c3016e-6932-4b61-9c99-fc1219eb4171';
-- DELETE FROM profiles          WHERE id          = '49c3016e-6932-4b61-9c99-fc1219eb4171';
-- -- ÚLTIMO: borrar el usuario de Auth (hacerlo desde Dashboard → Authentication → Users)
-- ─────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════
-- VERIFICAR que todo quedó bien:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
-- Todas deben mostrar rowsecurity = true
-- ══════════════════════════════════════════════════════════════
