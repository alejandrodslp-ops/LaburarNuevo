-- FIX (plata): descuento de visualizaciones del empleador.
-- Bug: el cliente llamaba sumar_visualizaciones(-1), que falla por permisos (no ejecutable
-- por authenticated) y por el check (cantidad<=0). Resultado: el saldo nunca bajaba y un
-- empleador veía perfiles infinitos con una sola compra.
--
-- Solución: RPC seguro que consume 1 del PROPIO saldo (employer = auth.uid(), no falsificable),
-- de forma atómica e idempotente (no cobra dos veces el mismo trabajador).
-- SECURITY DEFINER (owner postgres) => su UPDATE pasa el guardián trg_proteger_profiles.

create or replace function public.consumir_visualizacion(p_worker uuid)
returns text language plpgsql security definer as $$
declare
  v_employer uuid := auth.uid();
  v_saldo    int;
begin
  if v_employer is null then return 'no_auth'; end if;
  if p_worker is null then return 'sin_worker'; end if;

  -- Ya vio este perfil → no cobrar de nuevo
  if exists (select 1 from visualizaciones where employer_id = v_employer and worker_id = p_worker) then
    return 'ya_vista';
  end if;

  select coalesce(visualizaciones_disponibles, 0) into v_saldo from profiles where id = v_employer;
  if v_saldo <= 0 then return 'sin_saldo'; end if;

  -- Atómico: registrar la visualización (dispara on_visualizacion_insert → +1 vistas) y descontar 1
  insert into visualizaciones (employer_id, worker_id) values (v_employer, p_worker);
  update profiles set visualizaciones_disponibles = v_saldo - 1 where id = v_employer;

  return 'ok';
end;
$$;

revoke all on function public.consumir_visualizacion(uuid) from public, anon;
grant execute on function public.consumir_visualizacion(uuid) to authenticated;
