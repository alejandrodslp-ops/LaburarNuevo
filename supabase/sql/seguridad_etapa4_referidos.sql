-- SEGURIDAD — Etapa 4A: proteger campos de referido y período gratis.
-- La acreditación de referidos pasó a la edge function `acreditar-referido` (service_role).
-- El cliente ya no escribe estas columnas, así que el guardián las protege.
-- (Etapa 4B — teléfono visible sin pagar — se trata aparte: es lectura, no escritura.)

create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    -- Etapa 1 — plata
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
    -- Etapa 3 — métricas
    if new.estrellas is distinct from old.estrellas
       or new.rating is distinct from old.rating
       or new.total_calificaciones is distinct from old.total_calificaciones
       or new.total_valoraciones is distinct from old.total_valoraciones
       or new.vistas is distinct from old.vistas
       or new.contactos is distinct from old.contactos then
      raise exception 'No autorizado: las métricas (rating/vistas/contactos) solo se modifican desde el servidor';
    end if;
    -- Etapa 4 — referidos y período gratis
    if new.referido_por is distinct from old.referido_por
       or new.codigo_referido is distinct from old.codigo_referido
       or new.periodo_gratis_hasta is distinct from old.periodo_gratis_hasta then
      raise exception 'No autorizado: referidos y período gratis solo se modifican desde el servidor';
    end if;
  end if;
  return new;
end;
$$;
