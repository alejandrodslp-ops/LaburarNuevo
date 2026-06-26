-- FIX URGENTE (regresión): el guardián trg_proteger_profiles bloqueaba el trigger de
-- registro `activar_perfil_gratis`, que NO era SECURITY DEFINER y corría como 'authenticated'.
-- Eso hacía fallar el INSERT del perfil → el registro de usuarios nuevos quedaba roto.
--
-- Fix: el trigger pasa a SECURITY DEFINER (corre como postgres) → su UPDATE pasa el guardián.
-- Además setea fecha_activacion para que la prueba gratis sea coherente con "una sola vez"
-- (la edge function activar-prueba la respeta y no vuelve a regalar días).

create or replace function public.activar_perfil_gratis()
returns trigger
language plpgsql
security definer
as $$
begin
  update profiles set
    perfil_activo        = true,
    periodo_gratis_hasta = now() + interval '10 days',
    perfil_activo_hasta  = now() + interval '10 days',
    fecha_activacion     = now()
  where id = new.id;
  return new;
end;
$$;
