-- SEGURIDAD — Etapa 4B (paso 1 de 2): vista pública de perfiles.
-- Expone SOLO las columnas públicas que la app/web leen de OTROS usuarios.
-- NO incluye datos privados: telefono, email_otp, email_otp_expiry, push_token,
-- email_verificado, visualizaciones_disponibles, codigo_referido, referido_por,
-- periodo_gratis_hasta, fecha_activacion, perfil_activo_hasta, sexo, estado_civil, etc.
--
-- La vista corre como su owner (no security_invoker) → expone los perfiles públicos
-- de todos (necesario para la búsqueda), pero solo las columnas listadas acá.
-- En el paso 2, la política de `profiles` se cierra a "solo tu propia fila"; las lecturas
-- de terceros pasan por esta vista.

create or replace view public.perfiles_publicos as
select
  id, nombre, apellido1, rol, avatar_url,
  servicios, profesiones, especialidades,
  rating, estrellas, total_valoraciones, total_calificaciones,
  ciudad, barrio, pais, disponibilidad, referencias,
  fecha_nac, idiomas, tipos_empleo, bio, anios_experiencia,
  sueldo_pretension_min, sueldo_pretension_max, sueldo_moneda,
  updated_at, perfil_visible, perfil_activo, vistas, contactos
from public.profiles;

grant select on public.perfiles_publicos to authenticated, anon;
