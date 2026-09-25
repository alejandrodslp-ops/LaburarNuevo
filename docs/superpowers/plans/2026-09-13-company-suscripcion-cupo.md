# Cupo gratis + suscripción empresas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el cupo estático de 3 perfiles (para siempre) del rol `company` por un cupo real de 3/día-9/semana, y conectar el botón de suscripción (hoy un `Alert` de "Próximamente") a un cobro real de 30 días vía MercadoPago.

**Architecture:** Dos funciones SQL nuevas en Postgres (`cupo_empresa_restante`, `consumir_visualizacion_empresa`) reemplazan la constante `FREE_LIMIT`. Se reutiliza la tabla `visualizaciones` existente (sin tabla nueva) para el conteo y el dedupe. El pago reutiliza `crear-pago`/`webhook-pago` (ya en producción para `employer`/`worker`) con un `tipo` nuevo. Ningún archivo ni tabla del flujo `employer` se modifica.

**Tech Stack:** React Native/Expo (frontend), Supabase Postgres (SQL functions + cron), Supabase Edge Functions Deno (`webhook-pago`), MercadoPago Checkout Pro (ya integrado).

**Spec:** `docs/superpowers/specs/2026-09-13-company-suscripcion-cupo-design.md`

## Global Constraints

- Rol `company` únicamente. No modificar `visualizaciones_disponibles`, `consumir_visualizacion` (el RPC de `employer`), ni ninguna pantalla bajo `src/screens/employer/` salvo el único branch señalado en la Tarea 2.
- Semana = lunes a domingo, huso horario `America/Montevideo`.
- Suscripción: **ilimitada** durante 30 días. Precio: US$12 (Sudamérica) o US$24 (Mundial). Pago único, no recurrente — se vuelve a pagar manualmente al vencer.
- Los planes `pago_sa`/`pago_world` de `BienvenidaEmpresaScreen.js` quedan sin conectar (fuera de alcance) — no tocarlos.
- No hay Jest en este proyecto (`package.json` confirmado sin test runner). La verificación de cada tarea usa SQL directo (`supabase db query --linked`), `node --check` para sintaxis, o curl — nunca inventar una suite de tests que no existe.
- Cualquier consulta SQL de prueba se corre con `supabase db query --linked --file <archivo.sql>` desde `/Users/usuario/Desktop/Nexu/LaburarNuevo` (evita el problema de comillas anidadas de pasar el SQL inline).
- Todo cambio se comitea a la rama actual (`upgrade-sdk-57`), sin push, salvo que el usuario pida lo contrario.

---

## Task 1: Funciones SQL + columna + cron

**Files:**
- Ejecutar directo contra la base (sin archivo de migración versionado en este repo — el proyecto no usa carpeta `migrations/`, los cambios de schema se aplican vía `supabase db query --linked`, igual que el resto del historial de este proyecto).

**Interfaces:**
- Produce: `public.cupo_empresa_restante()` — sin argumentos, usa `auth.uid()`. Devuelve una fila `(suscripcion_activa boolean, vistas_hoy int, vistas_semana int, restante_hoy int, restante_semana int, restante_efectivo int)`.
- Produce: `public.consumir_visualizacion_empresa(p_worker uuid)` — devuelve `text`: `'ok' | 'ya_vista' | 'sin_cupo_diario' | 'sin_cupo_semanal' | 'no_auth' | 'sin_worker'`.
- Produce: columna `profiles.suscripcion_vence_at timestamptz`.
- Produce: cron job `desactivar-suscripciones-vencidas`.

- [ ] **Step 1: Agregar la columna**

Archivo temporal `/tmp/task1_columna.sql`:
```sql
alter table public.profiles
  add column if not exists suscripcion_vence_at timestamptz;
```
Ejecutar:
```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
supabase db query --linked --file /tmp/task1_columna.sql
```

- [ ] **Step 2: Verificar que la columna existe**

Archivo `/tmp/verif1.sql`:
```sql
select column_name, data_type from information_schema.columns
where table_name='profiles' and column_name='suscripcion_vence_at';
```
```bash
supabase db query --linked --file /tmp/verif1.sql -o json
```
Esperado: una fila, `data_type = "timestamp with time zone"`.

- [ ] **Step 3: Crear `cupo_empresa_restante()`**

Archivo `/tmp/task1_cupo.sql`:
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
    case when v_sub then 999999
         else least(greatest(3 - v_hoy, 0), greatest(9 - v_sem, 0)) end;
end;
$$;
```
```bash
supabase db query --linked --file /tmp/task1_cupo.sql
```

- [ ] **Step 4: Crear `consumir_visualizacion_empresa(p_worker uuid)`**

Archivo `/tmp/task1_consumir.sql`:
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
```bash
supabase db query --linked --file /tmp/task1_consumir.sql
```

- [ ] **Step 5: Crear el cron de expiración**

Archivo `/tmp/task1_cron.sql`:
```sql
select cron.schedule(
  'desactivar-suscripciones-vencidas',
  '*/30 * * * *',
  $$UPDATE profiles SET suscripcion_activa = false
    WHERE suscripcion_activa = true AND suscripcion_vence_at < now();$$
);
```
```bash
supabase db query --linked --file /tmp/task1_cron.sql
```
Verificar que quedó activo:
```bash
cat > /tmp/verif_cron.sql << 'EOF'
select jobname, schedule, active from cron.job where jobname='desactivar-suscripciones-vencidas';
EOF
supabase db query --linked --file /tmp/verif_cron.sql -o json
```
Esperado: `active: true`, `schedule: "*/30 * * * *"`.

- [ ] **Step 6: Prueba funcional end-to-end contra un `worker` real ya existente**

Buscar un `id` real de `profiles` con `rol='company'` y otro con `rol='worker'` para probar (no inventar UUIDs):
```bash
cat > /tmp/pick_ids.sql << 'EOF'
select id from profiles where rol='company' limit 1;
EOF
supabase db query --linked --file /tmp/pick_ids.sql -o json
cat > /tmp/pick_worker.sql << 'EOF'
select id from profiles where rol='worker' limit 1;
EOF
supabase db query --linked --file /tmp/pick_worker.sql -o json
```
No es posible invocar el RPC como esa empresa sin su JWT (las funciones usan `auth.uid()`). Verificar la LÓGICA con una llamada directa vía `SET request.jwt.claims` no es viable desde el CLI de solo-lectura que venimos usando — en su lugar, verificar por INSPECCIÓN: correr la query interna de conteo a mano con el `id` de una company real y confirmar que el resultado es coherente con las filas que ya tenga en `visualizaciones` (probablemente 0 si la tabla está vacía, como se confirmó en el spec). Documentar en el commit que la prueba de integración real (con JWT) se hace en el Step 4 de la Tarea 2 (desde la app).

- [ ] **Step 7: Commit**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
git add docs/superpowers/plans/2026-09-13-company-suscripcion-cupo.md
git commit -m "$(cat <<'EOF'
db: cupo_empresa_restante + consumir_visualizacion_empresa + cron expiracion

Funciones SQL para el cupo 3/dia-9/semana de company (spec
2026-09-13-company-suscripcion-cupo-design.md). No toca visualizaciones_disponibles
ni consumir_visualizacion (flujo employer intacto).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
(Nota: las funciones SQL en sí no tienen archivo versionado en este repo — solo se comitea el plan/spec. Si el proyecto adopta una carpeta de migraciones más adelante, portar estas 2 funciones + la columna ahí.)

---

## Task 2: `PerfilTrabajadorScreen.js` — usar el RPC de company

**Files:**
- Modify: `src/screens/employer/PerfilTrabajadorScreen.js:1-5` (imports), `:246-256` (`registrarVisualizacion`)

**Interfaces:**
- Consumes: `consumir_visualizacion_empresa(p_worker uuid)` de la Tarea 1, y `useApp()` de `src/services/AppContext.js` (ya existente, expone `modoActivo`).
- No produce nada que otras tareas consuman.

- [ ] **Step 1: Agregar el import de `useApp`**

En `src/screens/employer/PerfilTrabajadorScreen.js`, la línea 5 hoy es:
```js
import{supabase}from '../../services/supabase';
```
Agregar debajo:
```js
import{supabase}from '../../services/supabase';
import{useApp}from '../../services/AppContext';
```

- [ ] **Step 2: Leer `modoActivo` dentro del componente**

Dentro de `export default function PerfilTrabajadorScreen({navigation,route}){`, junto a las otras líneas de `useState` (alrededor de la línea 214), agregar:
```js
const{modoActivo}=useApp();
```

- [ ] **Step 3: Ramificar `registrarVisualizacion()`**

El código actual (líneas ~246-256):
```js
  async function registrarVisualizacion(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user||!perfil?.id)return;

      // El servidor verifica saldo, registra la visualización (idempotente: no cobra dos veces
      // el mismo perfil) y descuenta 1. 'vistas' lo incrementa el trigger on_visualizacion_insert.
      await supabase.rpc('consumir_visualizacion',{p_worker:perfil.id});
    }catch(e){}
  }
```
Reemplazar por:
```js
  async function registrarVisualizacion(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user||!perfil?.id)return;

      // El servidor verifica saldo, registra la visualización (idempotente: no cobra dos veces
      // el mismo perfil) y descuenta 1. 'vistas' lo incrementa el trigger on_visualizacion_insert.
      // company usa su propio cupo (3/dia, 9/semana, o ilimitado con suscripcion) — NO el
      // sistema de creditos de employer, que para company siempre estaria en 0.
      if(modoActivo==='company'){
        await supabase.rpc('consumir_visualizacion_empresa',{p_worker:perfil.id});
      }else{
        await supabase.rpc('consumir_visualizacion',{p_worker:perfil.id});
      }
    }catch(e){}
  }
```

- [ ] **Step 4: Verificar sintaxis**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
node --check src/screens/employer/PerfilTrabajadorScreen.js
```
Esperado: sin salida (válido). Nota: este archivo usa JSX, por lo que `node --check` puede fallar por el JSX mismo (no por el cambio) — si falla, confirmar que falla EXACTAMENTE igual en la versión sin tocar (`git stash` temporal) antes de asumir que el cambio introdujo el error.

- [ ] **Step 5: Prueba manual (requiere la app corriendo)**

Con una cuenta `company` de prueba logueada en la app: abrir el perfil de un trabajador nunca visto por esa cuenta. Confirmar en la base que se insertó una fila en `visualizaciones`:
```bash
cat > /tmp/verif_task2.sql << 'EOF'
select employer_id, worker_id, created_at from visualizaciones order by created_at desc limit 3;
EOF
supabase db query --linked --file /tmp/verif_task2.sql -o json
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/employer/PerfilTrabajadorScreen.js
git commit -m "$(cat <<'EOF'
feat: company usa consumir_visualizacion_empresa en vez del RPC de employer

registrarVisualizacion() ahora rama por modoActivo. employer sigue
llamando exactamente al mismo RPC que antes, sin cambios de comportamiento.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `BuscarEmpresaScreen.js` — cupo dinámico en vez de `FREE_LIMIT`

**Files:**
- Modify: `src/screens/company/BuscarEmpresaScreen.js:25` (constante), `:83-146` (componente, estado y cálculo de `visibles`/`bloqueados`)

**Interfaces:**
- Consumes: `cupo_empresa_restante()` de la Tarea 1 (devuelve `restante_efectivo`, `suscripcion_activa`).
- No produce nada que otras tareas consuman.

- [ ] **Step 1: Quitar la constante estática**

Borrar la línea 25:
```js
const FREE_LIMIT = 3;
```

- [ ] **Step 2: Agregar estado para el cupo**

En el cuerpo de `BuscarEmpresaScreen` (después de `const [loading, setLoading] = useState(false);`, línea ~87), agregar:
```js
  const [cupo, setCupo] = useState({ restante_efectivo: 0, suscripcion_activa: false });
```

- [ ] **Step 3: Cargar el cupo al montar**

Después del `useEffect` existente (`useEffect(() => { buscar('', catActiva); }, [catActiva]);`, línea ~89), agregar:
```js
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('cupo_empresa_restante');
      if (data && data[0]) setCupo(data[0]);
    })();
  }, []);
```

- [ ] **Step 4: Reemplazar el cálculo de `visibles`/`bloqueados`**

El código actual (líneas 144-146):
```js
  const visibles  = suscripcionActiva ? todos : todos.slice(0, FREE_LIMIT);
  const bloqueados = (!suscripcionActiva && todos.length > FREE_LIMIT)
    ? todos.length - FREE_LIMIT : 0;
```
Reemplazar por:
```js
  // Perfiles que la empresa ya vio antes (gratis para siempre, dedupe server-side) +
  // hasta el cupo que le quede hoy/esta semana. La suscripcion activa desbloquea todo.
  // Se usa cupo.suscripcion_activa (recien calculado por el RPC, chequea vencimiento) en vez de
  // suscripcionActiva de useApp() — ese valor de contexto solo se refresca al abrir la app y
  // puede quedar desactualizado si la suscripcion vence mientras la sesion sigue abierta.
  const yaVistosIds = new Set(vistosIds); // ver Step 5 — set de worker_id ya vistos
  const nuevosDisponibles = cupo.suscripcion_activa ? Infinity : cupo.restante_efectivo;
  let nuevosUsados = 0;
  const visibles = todos.filter((item) => {
    if (cupo.suscripcion_activa) return true;
    if (yaVistosIds.has(item.id)) return true;
    if (nuevosUsados < nuevosDisponibles) { nuevosUsados++; return true; }
    return false;
  });
  const bloqueados = todos.length - visibles.length;
```

- [ ] **Step 5: Cargar los `worker_id` ya vistos por esta empresa**

El `nuevosDisponibles`/`visibles` de arriba depende de `vistosIds`. Junto al `useEffect` del Step 3, agregar el estado y la carga:
```js
  const [vistosIds, setVistosIds] = useState([]);
```
Y dentro del mismo `useEffect` del Step 3, junto a la llamada de `cupo_empresa_restante`:
```js
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: cupoData }, { data: vistos }] = await Promise.all([
        supabase.rpc('cupo_empresa_restante'),
        supabase.from('visualizaciones').select('worker_id').eq('employer_id', user.id),
      ]);
      if (cupoData && cupoData[0]) setCupo(cupoData[0]);
      if (vistos) setVistosIds(vistos.map((v) => v.worker_id));
    })();
  }, []);
```
(Esto reemplaza por completo el `useEffect` agregado en el Step 3 — un solo `useEffect`, no dos.)

- [ ] **Step 6: Actualizar el texto del banner de bloqueo**

El código actual (líneas ~205-211):
```js
        {bloqueados > 0 && (
          <TouchableOpacity style={ss.gateBanner} onPress={verPlanes} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={ss.gateTitle}>+{bloqueados} perfiles más disponibles</Text>
              <Text style={ss.gateSub}>Activá tu plan para contactar sin límite</Text>
            </View>
            <View style={ss.gateBtn}><Text style={ss.gateBtnTxt}>Ver planes →</Text></View>
          </TouchableOpacity>
        )}
```
Reemplazar el `Text` de `gateSub` para reflejar si el bloqueo es por cupo temporal o por falta de suscripción:
```js
        {bloqueados > 0 && (
          <TouchableOpacity style={ss.gateBanner} onPress={verPlanes} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={ss.gateTitle}>+{bloqueados} perfiles más disponibles</Text>
              <Text style={ss.gateSub}>
                {cupo.restante_semana === 0 && !cupo.suscripcion_activa
                  ? 'Volvé la próxima semana o activá tu suscripción'
                  : 'Activá tu suscripción para ver sin límite'}
              </Text>
            </View>
            <View style={ss.gateBtn}><Text style={ss.gateBtnTxt}>Ver planes →</Text></View>
          </TouchableOpacity>
        )}
```

- [ ] **Step 7: Verificar sintaxis**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
node --check src/screens/company/BuscarEmpresaScreen.js
```
(Misma nota que Task 2 Step 4 sobre JSX y `node --check`.)

- [ ] **Step 8: Prueba manual (requiere la app corriendo)**

Con la cuenta `company` de prueba de la Tarea 2 (que ya vio 1 perfil): recargar `BuscarEmpresaScreen` y confirmar que ese perfil ya visto aparece SIN candado, y que además hasta 2 perfiles nuevos más (cupo diario 3 − 1 ya usado) aparecen desbloqueados.

- [ ] **Step 9: Commit**

```bash
git add src/screens/company/BuscarEmpresaScreen.js
git commit -m "$(cat <<'EOF'
feat: cupo dinamico 3/dia-9/semana reemplaza el FREE_LIMIT=3 estatico

BuscarEmpresaScreen ahora consulta cupo_empresa_restante() y desbloquea
perfiles ya vistos (gratis para siempre) + hasta el cupo restante.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `webhook-pago` — rama `company_suscripcion`

**Files:**
- Modify: `supabase/functions/webhook-pago/index.ts:116-142`

**Interfaces:**
- Consumes: columna `profiles.suscripcion_vence_at` de la Tarea 1.
- Produce: comportamiento activado por `payment.metadata.tipo === "company_suscripcion"` — lo consume la Tarea 5 (que crea pagos con ese `tipo`).

- [ ] **Step 1: Modificar el branch de tipos de pago**

El código actual (líneas ~116-131):
```ts
        // 5. Activar o acreditar según el tipo de pago
        if (tipo === "worker_activacion") {
          const hasta = new Date();
          hasta.setDate(hasta.getDate() + 60);
          await supabase.from("profiles").update({
            perfil_activo:       true,
            perfil_activo_hasta: hasta.toISOString(),
          }).eq("id", userId);
        } else {
          await supabase.rpc("sumar_visualizaciones", {
            employer_id: userId,
            cantidad:    cantidadPerfiles,
          });
        }

        console.log("Pago procesado para usuario:", userId, "tipo:", tipo);
```
Reemplazar por:
```ts
        // 5. Activar o acreditar según el tipo de pago
        if (tipo === "worker_activacion") {
          const hasta = new Date();
          hasta.setDate(hasta.getDate() + 60);
          await supabase.from("profiles").update({
            perfil_activo:       true,
            perfil_activo_hasta: hasta.toISOString(),
          }).eq("id", userId);
        } else if (tipo === "company_suscripcion") {
          const vence = new Date();
          vence.setDate(vence.getDate() + 30);
          await supabase.from("profiles").update({
            suscripcion_activa:    true,
            suscripcion_vence_at:  vence.toISOString(),
          }).eq("id", userId);
        } else {
          await supabase.rpc("sumar_visualizaciones", {
            employer_id: userId,
            cantidad:    cantidadPerfiles,
          });
        }

        console.log("Pago procesado para usuario:", userId, "tipo:", tipo);
```

- [ ] **Step 2: Actualizar el concepto del comprobante**

El código actual (líneas ~137-142):
```ts
            concepto:            tipo === "worker_activacion"
              ? "Activación de perfil trabajador — Konexu (60 días)"
              : `Visualizaciones de perfiles empleador — Konexu (${cantidadPerfiles} créditos)`,
```
Reemplazar por:
```ts
            concepto:            tipo === "worker_activacion"
              ? "Activación de perfil trabajador — Konexu (60 días)"
              : tipo === "company_suscripcion"
              ? "Suscripción empresa — Konexu (30 días)"
              : `Visualizaciones de perfiles empleador — Konexu (${cantidadPerfiles} créditos)`,
```

- [ ] **Step 3: Verificar sintaxis**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
node --check supabase/functions/webhook-pago/index.ts
```
Nota: este archivo es Deno/TypeScript (usa `Deno.env.get`, tipos). `node --check` va a fallar por eso — NO por el cambio de esta tarea. Verificar en su lugar que las llaves/paréntesis están balanceadas:
```bash
python3 -c "
s = open('supabase/functions/webhook-pago/index.ts', encoding='utf-8').read()
print('llaves:', s.count('{'), s.count('}'))
print('parentesis:', s.count('('), s.count(')'))
"
```
Ambos pares deben coincidir en cantidad (verificar también contra el archivo antes del cambio con `git show HEAD:supabase/functions/webhook-pago/index.ts` para comparar el delta, no el total absoluto — el archivo puede legítimamente no tener el mismo número por strings/comentarios con llaves sueltas).

- [ ] **Step 4: NO deployar todavía**

Esta función se deploya recién en la Tarea 5 (junto con la verificación end-to-end del pago), para probar el flujo completo de una sola vez con MercadoPago sandbox. Dejar el archivo modificado sin `supabase functions deploy` en este paso.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/webhook-pago/index.ts
git commit -m "$(cat <<'EOF'
feat: webhook-pago reconoce tipo company_suscripcion

Nueva rama (else if) que activa suscripcion_activa + suscripcion_vence_at
(+30 dias) sin tocar las ramas worker_activacion ni employer_visualizaciones.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `BienvenidaEmpresaScreen.js` — conectar el pago real

**Files:**
- Modify: `src/screens/company/BienvenidaEmpresaScreen.js` (imports, componente completo)

**Interfaces:**
- Consumes: `crear-pago` (edge function, sin cambios — ya genérica), `webhook-pago` con `tipo:"company_suscripcion"` (Tarea 4), `useApp()` (`setSuscripcionActiva`, ya importado hoy pero sin usar).
- Deploy final de `webhook-pago` ocurre en este task (Step 6).

- [ ] **Step 1: Agregar los imports que faltan**

El archivo hoy importa:
```js
import React from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
```
Agregar (mismo patrón que `PagoActivacionScreen.js`):
```js
import React,{useState,useEffect,useRef}from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert,ActivityIndicator,Linking,AppState}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";
```

- [ ] **Step 2: Agregar estado y refs de pago (mismo patrón que `PagoActivacionScreen.js`)**

Reemplazar:
```js
export default function BienvenidaEmpresaScreen({navigation}){
  const{setSuscripcionActiva}=useApp();
```
por:
```js
export default function BienvenidaEmpresaScreen({navigation}){
  const{setSuscripcionActiva}=useApp();
  const[pagando,setPagando]=useState(null); // id del plan que está procesando, o null
  const[esperando,setEsperando]=useState(false);
  const appStateRef=useRef(AppState.currentState);
  const intervaloRef=useRef(null);
  const prevVenceRef=useRef(null);
```

- [ ] **Step 3: Agregar el `useEffect` de polling (idéntico al patrón de `PagoActivacionScreen.js`)**

Agregar dentro del componente, después de las declaraciones de estado del Step 2:
```js
  useEffect(()=>{
    if(!esperando)return;
    intervaloRef.current=setInterval(verificar,3000);
    const sub=AppState.addEventListener('change',async(next)=>{
      if(appStateRef.current.match(/inactive|background/)&&next==='active'){
        await verificar();
      }
      appStateRef.current=next;
    });
    return()=>{
      clearInterval(intervaloRef.current);
      sub.remove();
    };
  },[esperando]);

  async function verificar(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return false;
      const{data}=await supabase.from('profiles').select('suscripcion_activa,suscripcion_vence_at').eq('id',user.id).single();
      const prevTs=prevVenceRef.current?new Date(prevVenceRef.current).getTime():0;
      const newTs=data?.suscripcion_vence_at?new Date(data.suscripcion_vence_at).getTime():0;
      if(data?.suscripcion_activa && newTs>prevTs){
        clearInterval(intervaloRef.current);
        setEsperando(false);
        setPagando(null);
        setSuscripcionActiva(true);
        Alert.alert('¡Suscripción activada!','Ya podés ver perfiles sin límite durante 30 días.',[{text:'Buscar trabajadores',onPress:()=>navigation.goBack()}]);
        return true;
      }
    }catch(e){}
    return false;
  }
```

- [ ] **Step 4: Función para iniciar el pago**

Agregar, junto a `verificar()`:
```js
  async function suscribirse(plan){
    if(pagando)return;
    setPagando(plan.id);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}
      const{data:perfil}=await supabase.from('profiles').select('suscripcion_vence_at').eq('id',user.id).single();
      prevVenceRef.current=perfil?.suscripcion_vence_at||null;
      const monto=plan.zona==='Sudamerica'?12:24;
      const{data,error}=await supabase.functions.invoke('crear-pago',{
        body:{monto,descripcion:'Konexu — Suscripción empresa (30 días)',tipo:'company_suscripcion'},
      });
      if(error)throw error;
      await Linking.openURL(data.init_point);
      setEsperando(true);
    }catch(e){
      Alert.alert('Error',e?.message||'No se pudo iniciar el pago');
      setPagando(null);
    }
  }
```

- [ ] **Step 5: Conectar los botones de `membresia_sa` y `membresia_world`**

Hay DOS `TouchableOpacity` con el mismo `onPress` genérico hoy (uno en el bloque `zona==="Sudamerica"`, otro en `zona==="Mundial"`), ambos así:
```js
                <TouchableOpacity style={[ss.planBtn,{backgroundColor:p.color}]} onPress={()=>Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}>
                  <Text style={ss.planBtnTxt}>Suscribirme</Text>
                </TouchableOpacity>
```
Reemplazar AMBAS ocurrencias (una por cada bloque `.map`) por:
```js
                <TouchableOpacity
                  style={[ss.planBtn,{backgroundColor:p.color},pagando===p.id&&{opacity:0.6}]}
                  disabled={pagando===p.id}
                  onPress={()=>p.id.startsWith('membresia_')?suscribirse(p):Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}
                >
                  <Text style={ss.planBtnTxt}>{pagando===p.id?'Procesando...':'Suscribirme'}</Text>
                </TouchableOpacity>
```
(Los planes `pago_sa`/`pago_world` siguen mostrando el `Alert` de siempre porque su `id` no empieza con `"membresia_"` — fuera de alcance, sin tocar.)

- [ ] **Step 6: Verificar sintaxis**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
node --check src/screens/company/BienvenidaEmpresaScreen.js
```
(Misma nota sobre JSX que en Task 2/3 — comparar contra el comportamiento pre-cambio si falla.)

- [ ] **Step 7: Deployar `webhook-pago` (de la Tarea 4) — recién ahora, junto con esta prueba**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo
supabase functions deploy webhook-pago --project-ref waevdcqdkovqaxkonlvj
```
**Antes de correr esto, confirmar con el usuario explícitamente** — es un deploy a producción de una función que ya procesa pagos reales de `worker`/`employer`. Verificar post-deploy con el mismo método usado en el resto de esta sesión (`supabase functions download webhook-pago --workdir <tmp aislado>` y comparar contra el archivo local) antes de dar la tarea por terminada.

- [ ] **Step 8: Prueba end-to-end en sandbox de MercadoPago**

Con una cuenta `company` de prueba: tocar "Suscribirme" en el plan Sudamérica ($12). Confirmar que abre el checkout de MercadoPago. Completar el pago con las credenciales de prueba de MP (sandbox). Confirmar que al volver a la app aparece el Alert "¡Suscripción activada!" y que en la base:
```bash
cat > /tmp/verif_task5.sql << 'EOF'
select suscripcion_activa, suscripcion_vence_at from profiles where id='<id de la company de prueba>';
EOF
supabase db query --linked --file /tmp/verif_task5.sql -o json
```
`suscripcion_activa=true`, `suscripcion_vence_at` ≈ hoy + 30 días.

- [ ] **Step 9: Commit**

```bash
git add src/screens/company/BienvenidaEmpresaScreen.js
git commit -m "$(cat <<'EOF'
feat: conectar pago real de suscripcion empresa (membresia_sa/membresia_world)

Mismo patron de Linking.openURL + polling por AppState que ya usa
PagoActivacionScreen (worker). pago_sa/pago_world quedan sin conectar
(fuera de alcance).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (completado al escribir este plan)

**Cobertura del spec:** las 5 secciones de "Cambios de código" + "Cambios de base de datos" + "Cron nuevo" del spec están cada una cubierta por una tarea (DB→Task 1, `PerfilTrabajadorScreen`→Task 2, `BuscarEmpresaScreen`→Task 3, `webhook-pago`→Task 4, `BienvenidaEmpresaScreen`→Task 5). Los "Casos borde" del spec (suscripción vence a mitad de semana, pago duplicado) están cubiertos por el diseño mismo de las funciones (dedupe permanente, `pagos.referencia_externa` único) — no requieren tarea aparte.

**Placeholders:** ninguno — todo el código de cada step es el código real a escribir, no descripciones.

**Consistencia de tipos:** `consumir_visualizacion_empresa` (Task 1) devuelve los mismos strings que consume la lógica de Task 2 (`'ok'`, etc. — aunque Task 2 no inspecciona el valor de retorno, igual que el RPC de `employer` hoy). `cupo_empresa_restante` (Task 1) devuelve `restante_efectivo` y `suscripcion_activa`/`restante_semana`, que Task 3 consume exactamente con esos nombres. `tipo:'company_suscripcion'` es el mismo string literal en Task 4 (webhook) y Task 5 (crear-pago) — verificado coincide.
