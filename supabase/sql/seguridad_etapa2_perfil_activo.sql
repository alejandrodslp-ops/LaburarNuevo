-- SEGURIDAD — Etapa 2: proteger el ESTADO del perfil del trabajador.
-- Amplía la función guardián (misma del trigger trg_proteger_profiles).
--
-- Regla: desde la app (authenticated/anon) el trabajador PUEDE desactivarse
-- (perfil_activo true->false), pero NO puede:
--   - activarse solo (false->true)        → eso lo hace la edge function activar-prueba o el webhook de pago
--   - cambiar su fecha de vencimiento      → perfil_activo_hasta solo lo fija el servidor
--
-- El servidor pasa libre: edge functions (service_role) y RPC/admin (postgres).
-- Reversible: volver a la versión de Etapa 1 con CREATE OR REPLACE.

create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    -- Etapa 1 — plata (visualizaciones compradas)
    if new.visualizaciones_disponibles is distinct from old.visualizaciones_disponibles then
      raise exception 'No autorizado: visualizaciones_disponibles solo se modifica desde el servidor';
    end if;
    -- Etapa 2 — estado del perfil
    if new.perfil_activo = true and coalesce(old.perfil_activo, false) = false then
      raise exception 'No autorizado: la activación del perfil se hace desde el servidor';
    end if;
    if new.perfil_activo_hasta is distinct from old.perfil_activo_hasta then
      raise exception 'No autorizado: perfil_activo_hasta solo se modifica desde el servidor';
    end if;
  end if;
  return new;
end;
$$;
