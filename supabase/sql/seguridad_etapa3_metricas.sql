-- SEGURIDAD — Etapa 3: métricas de reputación/actividad (rating, vistas, contactos).
-- El cliente ya no las escribe; las mantienen triggers server-side.
-- Todos los triggers son SECURITY DEFINER (owner postgres) => sus UPDATE a profiles
-- pasan el guardián trg_proteger_profiles.

-- 1) Rating: ampliar el trigger existente para mantener también rating y total_valoraciones
create or replace function public.recalcular_estrellas()
returns trigger language plpgsql security definer as $$
declare v_avg numeric; v_n int;
begin
  select round(avg(promedio)::numeric, 2), count(*)
    into v_avg, v_n
    from calificaciones where calificado_id = new.calificado_id;
  update profiles set
    estrellas            = v_avg,
    rating               = v_avg,
    total_calificaciones = v_n,
    total_valoraciones   = v_n
  where id = new.calificado_id;
  return new;
end; $$;

-- 2) Vistas: al registrar una visualización, +1 a vistas del trabajador
create or replace function public.incrementar_vistas()
returns trigger language plpgsql security definer as $$
begin
  update profiles set vistas = coalesce(vistas, 0) + 1 where id = new.worker_id;
  return new;
end; $$;
drop trigger if exists on_visualizacion_insert on public.visualizaciones;
create trigger on_visualizacion_insert after insert on public.visualizaciones
  for each row execute function public.incrementar_vistas();

-- 3) Contactos: al crear una propuesta, +1 a contactos del trabajador
create or replace function public.incrementar_contactos()
returns trigger language plpgsql security definer as $$
begin
  update profiles set contactos = coalesce(contactos, 0) + 1 where id = new.worker_id;
  return new;
end; $$;
drop trigger if exists on_propuesta_insert on public.propuestas;
create trigger on_propuesta_insert after insert on public.propuestas
  for each row execute function public.incrementar_contactos();

-- 4) Guardián: el cliente no puede tocar las métricas
create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.visualizaciones_disponibles is distinct from old.visualizaciones_disponibles then
      raise exception 'No autorizado: visualizaciones_disponibles solo se modifica desde el servidor';
    end if;
    if new.perfil_activo = true and coalesce(old.perfil_activo, false) = false then
      raise exception 'No autorizado: la activación del perfil se hace desde el servidor';
    end if;
    if new.perfil_activo_hasta is distinct from old.perfil_activo_hasta then
      raise exception 'No autorizado: perfil_activo_hasta solo se modifica desde el servidor';
    end if;
    if new.estrellas is distinct from old.estrellas
       or new.rating is distinct from old.rating
       or new.total_calificaciones is distinct from old.total_calificaciones
       or new.total_valoraciones is distinct from old.total_valoraciones
       or new.vistas is distinct from old.vistas
       or new.contactos is distinct from old.contactos then
      raise exception 'No autorizado: las métricas (rating/vistas/contactos) solo se modifican desde el servidor';
    end if;
  end if;
  return new;
end; $$;
