# Cupo gratis + suscripción para empresas (`company`) — diseño

**Fecha:** 2026-09-13
**Alcance:** rol `company` únicamente. `employer` (créditos pagos desde la primera vista) queda intacto — no se toca ningún archivo ni tabla de su flujo.

## Contexto (verificado en el código, no supuesto)

- **Hoy**, `BuscarEmpresaScreen.js` usa `FREE_LIMIT = 3` **estático**: solo los primeros 3 resultados de cada búsqueda se ven; el resto queda bloqueado para siempre hasta `suscripcionActiva`.
- `suscripcionActiva` (`profiles.suscripcion_activa`, boolean) **no está conectado a ningún pago** — no aparece en `webhook-pago`. Se lee en `AppContext.js`, `HomeEmpresaScreen.js`, `BuscarEmpresaScreen.js`.
- `BienvenidaEmpresaScreen.js` (pantalla de planes) es **maqueta sin cobro real**: los 4 botones de plan solo muestran `Alert.alert("Proximamente", ...)`.
- Al abrir el detalle de un perfil, `company` navega a la **misma** `PerfilTrabajadorScreen.js` que usa `employer`. Esa pantalla llama a `consumir_visualizacion` (RPC de `employer`, descuenta `profiles.visualizaciones_disponibles`) — para `company` esto siempre falla en silencio (`sin_saldo`, ya que ese contador también arranca en 0) sin bloquear nada, porque el resultado del RPC no se usa para gatear la UI. El gate real de hoy es únicamente el de la lista (`BuscarEmpresaScreen`).
- El gate de "contacto mutuo" (perfil público = contacto visible directo; privado = se revela cuando el trabajador acepta la `propuesta`) vive en `PerfilTrabajadorScreen.js` vía la tabla `propuestas` y es **compartido** por `employer`/`company`. No se modifica.
- `crear-pago` / `webhook-pago` ya soportan pagos con MercadoPago: `crear-pago` crea la preferencia con `external_reference = userId` (del JWT verificado, nunca del body) y `metadata.tipo`; `webhook-pago` verifica el pago, inserta en `pagos` (idempotente por `referencia_externa`, código `23505`), y ramifica por `tipo` (`worker_activacion` → activa perfil trabajador 60 días; si no, hoy cae a un `else` que sube `visualizaciones_disponibles` vía `sumar_visualizaciones`).
- `visualizaciones` (tabla): columnas `id, employer_id, worker_id, fecha, created_at` (ambas fecha con default `now()`, tabla vacía hoy). Se usa `created_at` como canónica en este diseño.
- `profiles.rol` (`'worker' | 'employer' | 'company'`) determina el modo; `AppContext.js` expone `modoActivo`.

## Reglas del negocio (confirmadas con el usuario)

1. Gratis: **3 perfiles nuevos por día**, tope real de **9 por semana** (lunes a domingo, huso `America/Montevideo`) — lo que se alcance primero bloquea. Ver un perfil ya visto antes **nunca** vuelve a costar cupo (igual que hoy con `employer`).
2. Pasado el cupo gratis: suscripción de pago, **ilimitada** mientras esté vigente. Precio/plazo: **U$12 (Sudamérica) o U$24 (Mundial) por 30 días** — mismos montos que ya figuraban en la maqueta de `BienvenidaEmpresaScreen`. La elección Sudamérica/Mundial es la misma UI de hoy (dos secciones, la empresa elige cuál planes tocar) — no hay detección geográfica automática.
3. Pago único por período (no recurrente automático) — la empresa vuelve a pagar manualmente cuando vence. No se construye integración de suscripciones recurrentes de MercadoPago/Stripe en este alcance.
4. Los planes "Pago por perfil" de la maqueta (`pago_sa`, `pago_world`) **quedan fuera de este alcance** — no se conectan, siguen mostrando el mismo `Alert` de "Próximamente".

## Cambios de base de datos

### Columna nueva
```sql
alter table public.profiles
  add column if not exists suscripcion_vence_at timestamptz;
```
`suscripcion_activa` (ya existe) se sigue leyendo igual en todo el código existente; pasa a mantenerse por el cron nuevo (ver abajo) en vez de nunca actualizarse.

### Función: cupo restante
```sql
create or replace function public.cupo_empresa_restante()
returns table(
  suscripcion_activa boolean,
  vistas_hoy int,
  vistas_semana int,
  restante_hoy int,
  restante_semana int,
  restante_efectivo int
)
language plpgsql
security definer
as $$
declare
  v_company uuid := auth.uid();
  v_sub boolean;
  v_hoy int;
  v_sem int;
  v_inicio_semana date;
begin
  select coalesce(p.suscripcion_activa,false) and coalesce(p.suscripcion_vence_at, 'epoch') > now()
    into v_sub from profiles p where p.id = v_company;

  -- Semana ISO: lunes a domingo, huso Montevideo
  v_inicio_semana := (date_trunc('week', (now() at time zone 'America/Montevideo')))::date;

  select count(distinct worker_id) into v_hoy
    from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date = (now() at time zone 'America/Montevideo')::date;

  select count(distinct worker_id) into v_sem
    from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date >= v_inicio_semana;

  return query select
    v_sub,
    v_hoy,
    v_sem,
    greatest(3 - v_hoy, 0),
    greatest(9 - v_sem, 0),
    case when v_sub then 999999 /* bandera "sin límite" — no es un tope real, hay suscripción activa */
         else least(greatest(3 - v_hoy, 0), greatest(9 - v_sem, 0)) end;
end;
$$;
```

### Función: consumir cupo (gate real, server-side)
```sql
create or replace function public.consumir_visualizacion_empresa(p_worker uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_company uuid := auth.uid();
  v_sub boolean;
  v_hoy int;
  v_sem int;
  v_inicio_semana date;
begin
  if v_company is null then return 'no_auth'; end if;
  if p_worker is null then return 'sin_worker'; end if;

  -- Ya visto antes → gratis, no cuenta de nuevo
  if exists (select 1 from visualizaciones where employer_id = v_company and worker_id = p_worker) then
    return 'ya_vista';
  end if;

  select coalesce(p.suscripcion_activa,false) and coalesce(p.suscripcion_vence_at, 'epoch') > now()
    into v_sub from profiles p where p.id = v_company;

  if not v_sub then
    v_inicio_semana := (date_trunc('week', (now() at time zone 'America/Montevideo')))::date;

    select count(distinct worker_id) into v_hoy from visualizaciones
      where employer_id = v_company
        and (created_at at time zone 'America/Montevideo')::date = (now() at time zone 'America/Montevideo')::date;
    select count(distinct worker_id) into v_sem from visualizaciones
      where employer_id = v_company
        and (created_at at time zone 'America/Montevideo')::date >= v_inicio_semana;

    if v_hoy >= 3 then return 'sin_cupo_diario'; end if;
    if v_sem >= 9 then return 'sin_cupo_semanal'; end if;
  end if;

  insert into visualizaciones (employer_id, worker_id) values (v_company, p_worker);
  return 'ok';
end;
$$;
```

### Cron nuevo (mismo patrón que `desactivar-concursos-vencidos`)
```sql
-- cada 30 min, igual cadencia que el cron de concursos vencidos
UPDATE profiles SET suscripcion_activa = false
WHERE suscripcion_activa = true AND suscripcion_vence_at < now();
```
Registrar como job `desactivar-suscripciones-vencidas` vía `cron.schedule`.

## Cambios de código

### `src/screens/company/BuscarEmpresaScreen.js`
- Al cargar (o cuando cambian los resultados de búsqueda), llamar `supabase.rpc('cupo_empresa_restante')`.
- Reemplazar `todos.slice(0, FREE_LIMIT)` por: perfiles que ya están en `visualizaciones` de esta empresa (siempre visibles) **+** hasta `restante_efectivo` perfiles nuevos de la lista.
- `LockedCard`: mantener el mismo componente/estilo; ajustar el texto para reflejar cupo diario/semanal en vez de "activá tu suscripción" genérico cuando el bloqueo es por cupo (no por falta de suscripción) — ej. *"Volvé mañana o activá tu suscripción para ver más"*.
- Quitar la constante `FREE_LIMIT` (ya no aplica).

### `src/screens/employer/PerfilTrabajadorScreen.js`
- En `registrarVisualizacion()`: si `modoActivo === 'company'` (de `useApp()`), llamar `consumir_visualizacion_empresa` en vez de `consumir_visualizacion`. Sin otro cambio — el resto de la pantalla (público/privado, propuestas, calificación) sigue igual para ambos roles.

### `src/screens/company/BienvenidaEmpresaScreen.js`
- Botones de los planes `membresia_sa` y `membresia_world`: en vez de `Alert.alert("Proximamente"...)`, llamar `crear-pago` con `{ monto: 12 | 24, descripcion: 'Konexu — Suscripción empresa (30 días)', tipo: 'company_suscripcion' }` y abrir `init_point` (mismo patrón de checkout que ya use `employer`/`worker` en su pantalla de pago — replicar, no reinventar). Moneda: USD — `crear-pago` ya fija `currency_id: "USD"` para toda preferencia, coincide con la notación "U$" de la maqueta.
- Botones `pago_sa` / `pago_world`: **sin cambios**, siguen con el `Alert` de "Próximamente" (fuera de alcance).

### `supabase/functions/webhook-pago/index.ts`
- Cambiar el `else` genérico actual por `else if (tipo === "employer_visualizaciones")` (comportamiento idéntico, solo explícito) y agregar:
```ts
} else if (tipo === "company_suscripcion") {
  const vence = new Date();
  vence.setDate(vence.getDate() + 30);
  await supabase.from("profiles").update({
    suscripcion_activa: true,
    suscripcion_vence_at: vence.toISOString(),
  }).eq("id", userId);
}
```
- Concepto del comprobante (`generar-comprobante`): agregar caso `"Suscripción empresa — Konexu (30 días)"` para este `tipo`.
- No se toca la rama `worker_activacion` ni el registro en `pagos` (ya es común a todos los tipos, va primero).

### `supabase/functions/crear-pago/index.ts`
- Sin cambios de código — ya es genérico (`tipo` es un string libre que el caller define). Solo lo usa `BienvenidaEmpresaScreen` con el nuevo valor.

## Casos borde

- **Suscripción vence a mitad de semana**: los perfiles ya vistos (insertados en `visualizaciones`) siguen siendo gratis para siempre (dedup permanente, igual que `employer` hoy). Los perfiles nuevos vuelven a contar contra el cupo gratis normal apenas el cron apaga `suscripcion_activa`.
- **Pago duplicado (reintento del webhook de MP)**: cubierto por el `insert` en `pagos` con `referencia_externa` único (código `23505`) — mismo mecanismo que ya protege a `worker_activacion`/`employer_visualizaciones`, nada nuevo que romper.
- **Empresa sin país configurado**: no aplica — la elección Sudamérica/Mundial es manual (tocar el botón de esa sección), no depende de `profiles.pais`.

## Pruebas antes de dar por cerrado

1. `cupo_empresa_restante()` y `consumir_visualizacion_empresa()` probadas a mano contra la base (una empresa de prueba) verificando: cupo diario baja de 3→0, cupo semanal capea en 9 aunque el día resetee, un perfil ya visto no descuenta de nuevo.
2. Reset de día/semana: verificar el cálculo de `date_trunc('week', ...)` en huso Montevideo con fechas de borde (domingo 23:59 → lunes 00:01).
3. Flujo de pago en sandbox de MercadoPago: `crear-pago` → aprobar en sandbox → `webhook-pago` deja `suscripcion_activa=true` y `suscripcion_vence_at` correcto.
4. Cron de expiración: forzar `suscripcion_vence_at` en el pasado y confirmar que el cron la apaga.
5. Confirmar que `employer` no cambia ningún comportamiento (créditos, `consumir_visualizacion` sin tocar).
