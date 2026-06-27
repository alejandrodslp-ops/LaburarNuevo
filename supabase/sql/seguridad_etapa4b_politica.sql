-- SEGURIDAD — Etapa 4B (paso 2 de 2): cerrar la lectura de profiles a "solo tu propia fila".
-- Antes: cualquier cuenta logueada leía TODAS las filas (incl. telefono, email_otp, push_token...).
-- Ahora: vía profiles cada uno lee SOLO su propia fila (con sus datos privados).
-- Las lecturas de terceros pasan por la vista perfiles_publicos (sin datos privados).
-- El admin y las edge functions usan service_role → bypassan RLS, no se ven afectados.
--
-- Requisito: la app/web ya deben leer terceros desde perfiles_publicos (paso 1 + migración).

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to public
  using (auth.uid() = id);
