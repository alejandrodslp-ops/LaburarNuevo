-- SEGURIDAD — Etapa 1: proteger la columna de "plata" (visualizaciones compradas)
-- de escrituras hechas desde la app (cliente).
--
-- Contexto: la política RLS de UPDATE en profiles es abierta (cualquier authenticated
-- puede actualizar). Eso permitía a un atacante hacer:
--    update profiles set visualizaciones_disponibles = 9999 where id = <su_id>
-- y ver perfiles pagos gratis.
--
-- Este guardián rechaza ese cambio cuando viene del cliente (current_user authenticated/anon),
-- y deja pasar al servidor:
--   - RPC sumar_visualizaciones  → corre como 'postgres' (SECURITY DEFINER)
--   - edge functions de pago     → corren como 'service_role'
--
-- Reversible al instante:  drop trigger trg_proteger_profiles on public.profiles;

create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.visualizaciones_disponibles is distinct from old.visualizaciones_disponibles then
      raise exception 'No autorizado: visualizaciones_disponibles solo se modifica desde el servidor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_profiles on public.profiles;
create trigger trg_proteger_profiles
  before update on public.profiles
  for each row execute function public.proteger_columnas_sensibles_profiles();
