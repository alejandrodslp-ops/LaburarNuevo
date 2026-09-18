# Company publica empleos + matching automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El rol `company` puede publicar una búsqueda de empleo, que pasa por una revisión automática de 24hs, luego matchea contra perfiles de `worker` y avisa a la empresa por push cuando hay candidatos — reusando el cupo diario/semanal que ya existe para la búsqueda manual.

**Architecture:** Se extiende el patrón ya existente de `concurso_matches` + `match-concursos` + `notificar-matches` (matching de concursos públicos contra workers), pero invertido: acá la empresa publica (`ofertas`) y es la EMPRESA quien recibe el aviso, no el trabajador. Se extrae la lógica de scoring/normalización de `match-concursos` a un módulo compartido (`_shared/matching.ts`) para no duplicar ~250 líneas de diccionario de traducciones y reglas de scoring.

**Tech Stack:** React Native/Expo (pantallas), Supabase Postgres + pg_cron (SQL, cron), Supabase Edge Functions en Deno/TypeScript, push vía Expo Push API (`https://exp.host/--/api/v2/push/send`).

**Spec:** `docs/superpowers/specs/2026-09-18-company-publicar-empleo-design.md`

## Global Constraints

- No tocar el flujo de `employer` (créditos pagos por vista) — solo se lee/reusa, no se modifica su lógica de cupo.
- SQL se ejecuta directo contra producción vía `supabase db query --linked --file <archivo>` (no hay carpeta `migrations/` versionada en este repo) — mismo estilo que `docs/superpowers/plans/2026-09-13-company-suscripcion-cupo.md`.
- Edge functions se despliegan con `supabase functions deploy <nombre> --project-ref waevdcqdkovqaxkonlvj`.
- Todo texto visible para la empresa va en español, tono profesional, sin promesas absolutas ("nunca", "siempre", "100%") fuera de documento legal.
- `oferta_matches.worker_id` referencia `profiles(id)` (no `auth.users(id)`) — así es como ya está hecho `concurso_matches.worker_id`; el spec decía `auth.users(id)`, se corrige acá para seguir la convención real del código existente.
- Trabajar en el worktree `/Users/usuario/Desktop/Nexu/LaburarNuevo/.worktrees/company-suscripcion-cupo`, rama `sdd/company-suscripcion-cupo` (ya existe, no crear otra).

---

## Task 1: Arreglar el bug real de `CrearOfertaScreen.js` / `OfertasEmpleadorScreen.js`

Bug preexistente, no relacionado a esta feature pero bloqueante: estas pantallas usan nombres de campo (`cargo`, `salario_min`, `salario_max`, `updated_at`) que no existen en la tabla `ofertas` real (que tiene `empleo`, `sueldo_min`, `sueldo_max`, sin `updated_at`). Hoy, cualquier `employer` que intente publicar una oferta recibe un error de Postgres al guardar.

**Files:**
- Modify: `src/screens/employer/CrearOfertaScreen.js:67-108` (estado y payload)
- Modify: `src/screens/employer/OfertasEmpleadorScreen.js:23` (lectura de campo)

**Interfaces:**
- Produce: `CrearOfertaScreen` insertando/actualizando con los nombres de columna reales de `ofertas`. Las tareas 9-10 (pantallas de `company`) reusan este mismo componente ya arreglado.

- [ ] **Step 1: Corregir el estado y el payload en `CrearOfertaScreen.js`**

Reemplazar (líneas 67-71):
```js
  const[cargo,setCargo]=useState(editando?.cargo||'');
  const[descripcion,setDescripcion]=useState(editando?.descripcion||'');
  const[requisitos,setRequisitos]=useState(editando?.requisitos||'');
  const[ciudad,setCiudad]=useState(editando?.ciudad||'');
  const[modalidad,setModalidad]=useState(editando?.modalidad||null);
  const[tipoContrato,setTipoContrato]=useState(editando?.tipo_contrato||null);
  const[salarioMin,setSalarioMin]=useState(editando?.salario_min?.toString()||'');
  const[salarioMax,setSalarioMax]=useState(editando?.salario_max?.toString()||'');
```
por:
```js
  const[cargo,setCargo]=useState(editando?.empleo||'');
  const[descripcion,setDescripcion]=useState(editando?.descripcion||'');
  const[requisitos,setRequisitos]=useState(editando?.requisitos||'');
  const[ciudad,setCiudad]=useState(editando?.ciudad||'');
  const[modalidad,setModalidad]=useState(editando?.modalidad||null);
  const[tipoContrato,setTipoContrato]=useState(editando?.tipo_contrato||null);
  const[salarioMin,setSalarioMin]=useState(editando?.sueldo_min?.toString()||'');
  const[salarioMax,setSalarioMax]=useState(editando?.sueldo_max?.toString()||'');
```

Reemplazar el payload (líneas 92-104):
```js
      const payload={
        employer_id:user.id,
        titulo:titulo.trim(),
        cargo:cargo.trim()||null,
        descripcion:descripcion.trim()||null,
        requisitos:requisitos.trim()||null,
        ciudad:ciudad.trim()||null,
        modalidad:modalidad||null,
        tipo_contrato:tipoContrato||null,
        salario_min:salarioMin?parseFloat(salarioMin):null,
        salario_max:salarioMax?parseFloat(salarioMax):null,
        moneda,
        fecha_cierre:fechaCierre||null,
        updated_at:new Date().toISOString(),
      };
```
por:
```js
      const payload={
        employer_id:user.id,
        titulo:titulo.trim(),
        empleo:cargo.trim()||null,
        descripcion:descripcion.trim()||null,
        requisitos:requisitos.trim()||null,
        ciudad:ciudad.trim()||null,
        modalidad:modalidad||null,
        tipo_contrato:tipoContrato||null,
        sueldo_min:salarioMin?parseFloat(salarioMin):null,
        sueldo_max:salarioMax?parseFloat(salarioMax):null,
        moneda,
        fecha_cierre:fechaCierre||null,
      };
```

- [ ] **Step 2: Corregir la lectura en `OfertasEmpleadorScreen.js`**

Línea 23, reemplazar:
```js
          {oferta.cargo?<Text style={ss.cardCargo}>{oferta.cargo}</Text>:null}
```
por:
```js
          {oferta.empleo?<Text style={ss.cardCargo}>{oferta.empleo}</Text>:null}
```

- [ ] **Step 3: Prueba funcional real contra producción**

Con una cuenta `employer` de prueba logueada en la app (o revisando en el simulador): crear una oferta nueva con título y cargo, guardar. Confirmar en la base:
```bash
cat > /tmp/verif_oferta.sql << 'EOF'
select id, titulo, empleo, sueldo_min, created_at from ofertas order by created_at desc limit 1;
EOF
supabase db query --linked --file /tmp/verif_oferta.sql -o json
```
Esperado: una fila con el `titulo`/`empleo` recién cargados, sin error de columna inexistente.

- [ ] **Step 4: Commit**

```bash
git add src/screens/employer/CrearOfertaScreen.js src/screens/employer/OfertasEmpleadorScreen.js
git commit -m "$(cat <<'EOF'
fix: CrearOfertaScreen usaba nombres de columna que no existen en ofertas

cargo/salario_min/salario_max/updated_at no existen en la tabla real
(empleo/sueldo_min/sueldo_max, sin updated_at) — cualquier insert de
oferta fallaba con error de Postgres. Bug preexistente, encontrado al
revisar esta pantalla para reusarla desde el rol company.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: SQL — estado de revisión, tabla de matches, cupo de 3 niveles

**Files:**
- Ejecutar directo contra la base vía `supabase db query --linked --file` (sin carpeta `migrations/`, mismo estilo que la Tarea 1 del plan hermano).

**Interfaces:**
- Produce: columnas `ofertas.estado` (`'pendiente'|'aprobada'|'rechazada'`, default `'pendiente'`) y `ofertas.motivo_rechazo`.
- Produce: tabla `public.oferta_matches(id, oferta_id, worker_id, score int, cumple boolean, keywords_match text[], notificado boolean, created_at, updated_at)`.
- Produce: `public.cupo_empresa_restante()` reescrita — misma firma `returns table(suscripcion_activa boolean, vistas_hoy int, vistas_semana int, restante_hoy int, restante_semana int, restante_efectivo int)`, ahora diferenciando por `profiles.suscripcion_plan`.
- Consume: `profiles.suscripcion_plan`, `profiles.suscripcion_activa`, `profiles.suscripcion_vence_at` (ya existen, de la Tarea 1 del plan hermano `2026-09-13-company-suscripcion-cupo.md`).

- [ ] **Step 1: Columnas de estado en `ofertas`**

`/tmp/task2_estado.sql`:
```sql
alter table public.ofertas
  add column if not exists estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada'));
alter table public.ofertas
  add column if not exists motivo_rechazo text;
```
```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo/.worktrees/company-suscripcion-cupo
supabase db query --linked --file /tmp/task2_estado.sql
```

- [ ] **Step 2: Verificar**

```bash
cat > /tmp/verif2_estado.sql << 'EOF'
select column_name, data_type, column_default from information_schema.columns
where table_name='ofertas' and column_name in ('estado','motivo_rechazo');
EOF
supabase db query --linked --file /tmp/verif2_estado.sql -o json
```
Esperado: 2 filas, `estado` con default `'pendiente'::text`.

- [ ] **Step 3: Tabla `oferta_matches`**

`/tmp/task2_tabla.sql`:
```sql
create table if not exists public.oferta_matches (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.ofertas(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  score integer,
  cumple boolean not null default true,
  keywords_match text[],
  notificado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(oferta_id, worker_id)
);

alter table public.oferta_matches enable row level security;

create policy oferta_matches_select_empresa on public.oferta_matches for select
  using (exists (
    select 1 from public.ofertas o
    where o.id = oferta_matches.oferta_id and o.employer_id = auth.uid()
  ));
```
```bash
supabase db query --linked --file /tmp/task2_tabla.sql
```

- [ ] **Step 4: Verificar tabla + RLS**

```bash
cat > /tmp/verif2_tabla.sql << 'EOF'
select relrowsecurity from pg_class where relname='oferta_matches';
select polname, cmd from pg_policies where tablename='oferta_matches';
EOF
supabase db query --linked --file /tmp/verif2_tabla.sql -o json
```
Esperado: `relrowsecurity=true`, una policy `oferta_matches_select_empresa` con `cmd='SELECT'` (o `r`).

- [ ] **Step 5: Reescribir `cupo_empresa_restante()` para 3 niveles**

`/tmp/task2_cupo.sql`:
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
  v_plan text;
  v_vigente boolean;
  v_hoy int;
  v_sem int;
  v_inicio_semana date;
begin
  select p.suscripcion_plan,
         coalesce(p.suscripcion_activa,false) and coalesce(p.suscripcion_vence_at, 'epoch') > now()
    into v_plan, v_vigente
    from profiles p where p.id = v_company;

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
    coalesce(v_vigente, false),
    v_hoy,
    v_sem,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente and v_plan in ('membresia_sa','membresia_world') then greatest(10 - v_hoy, 0)
      else greatest(3 - v_hoy, 0)
    end,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente and v_plan in ('membresia_sa','membresia_world') then 999999
      else greatest(9 - v_sem, 0)
    end,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente and v_plan in ('membresia_sa','membresia_world') then greatest(10 - v_hoy, 0)
      else least(greatest(3 - v_hoy, 0), greatest(9 - v_sem, 0))
    end;
end;
$$;
```
```bash
supabase db query --linked --file /tmp/task2_cupo.sql
```

Nota: los planes `membresia_sa`/`membresia_world` no tienen tope semanal propio (`restante_semana` queda en `999999` para ellos) — solo el tope diario de 10 los limita. El nivel gratis sigue con doble tope (3/día Y 9/semana, lo que se alcance primero).

- [ ] **Step 6: Verificar por inspección**

No es posible invocar el RPC con el JWT real de una company desde este CLI (usa `auth.uid()`). Verificar por inspección: confirmar que la función se creó sin error de sintaxis y que el `case` cubre los 3 planes:
```bash
cat > /tmp/verif2_cupo.sql << 'EOF'
select prosrc from pg_proc where proname='cupo_empresa_restante';
EOF
supabase db query --linked --file /tmp/verif2_cupo.sql -o json
```
Esperado: el texto de la función contiene `membresia_premium`, `membresia_sa`, `membresia_world`. La prueba de integración real (con JWT) queda documentada para hacerse desde la app en la Tarea 8 (pantalla de planes), igual que se hizo en el plan hermano.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-09-18-company-publicar-empleo.md
git commit -m "$(cat <<'EOF'
db: estado de ofertas + oferta_matches + cupo_empresa_restante 3 niveles

estado pendiente/aprobada/rechazada en ofertas (revision automatica),
tabla oferta_matches espejo de concurso_matches, y cupo_empresa_restante
ahora diferencia gratis (3/dia-9/semana) / sa-world (10/dia) / premium
(ilimitado) via profiles.suscripcion_plan en vez de un booleano simple.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
(Nota: igual que en el plan hermano, las funciones/tabla SQL no tienen archivo versionado propio — solo se comitea el plan. Si el proyecto suma una carpeta de migraciones, portar esto ahí.)

---

## Task 3: Extraer `_shared/matching.ts` desde `match-concursos`

**Files:**
- Create: `supabase/functions/_shared/matching.ts`
- Modify: `supabase/functions/match-concursos/index.ts:1-419` (usar el import, borrar el código movido)

**Interfaces:**
- Produce: desde `_shared/matching.ts` — `normalizar(s: string): string`, `expandirKeyword(kw: string, lang: string, pais?: string): string[]`, `PAIS_ISO: Record<string,string>`, `PAIS_LANG: Record<string,string>`, `PAIS_LANGS_EXTRA: Record<string,string[]>`, y `calcularScore(oferta: {keywords: string[]|null; cargo: string|null; titulo: string; lugar: string|null; pais: string}, perfil: {pais: string|null; ciudad: string|null; servicios: string[]|null; profesiones: string[]|null; especialidades: string[]|null; tecnicaturas: string[]|null}): {score: number; keywords_match: string[]; cumple: boolean}`.
- Consumes (Tarea 4): `match-ofertas` importa exactamente estas mismas funciones.

- [ ] **Step 1: Crear el módulo compartido**

Copiar tal cual a `supabase/functions/_shared/matching.ts` los bloques de `match-concursos/index.ts` que van desde la constante `PAIS_ISO` (línea 11) hasta el cierre de `calcularScore` (línea ~355), es decir: `PAIS_ISO`, `PAIS_LANG`, `PAIS_LANGS_EXTRA`, `TR`, `expandirKeyword`, `normalizar`, `ROLES_GENERICOS`, `calcularScore`. Al final del archivo agregar:
```ts
export {
  PAIS_ISO, PAIS_LANG, PAIS_LANGS_EXTRA,
  expandirKeyword, normalizar, calcularScore,
};
```
El parámetro de `calcularScore` que hoy se llama `concurso` queda igual de nombre (es genérico: título, cargo, lugar, país, keywords — le sirve tanto a un concurso como a una oferta).

- [ ] **Step 2: Reemplazar en `match-concursos/index.ts`**

Borrar de `match-concursos/index.ts` todo el bloque que acaba de moverse (`PAIS_ISO` hasta el cierre de `calcularScore`), y en su lugar, justo debajo del import de `createClient` (línea 2), agregar:
```ts
import {
  PAIS_ISO, PAIS_LANG, PAIS_LANGS_EXTRA,
  expandirKeyword, normalizar, calcularScore,
} from "../_shared/matching.ts";
```
`PAIS_LANG`/`PAIS_LANGS_EXTRA`/`expandirKeyword` quedan usados indirectamente dentro de `calcularScore` (ya movido), así que `match-concursos/index.ts` solo necesita re-exportar/usar `PAIS_ISO` (para el cálculo de `pais` en `matchWorker`) y `calcularScore`. Ajustar el import si el linter marca variables no usadas.

- [ ] **Step 3: Verificar que sigue compilando y comportándose igual**

```bash
cd /Users/usuario/Desktop/Nexu/LaburarNuevo/.worktrees/company-suscripcion-cupo
deno check supabase/functions/match-concursos/index.ts
deno check supabase/functions/_shared/matching.ts
```
Esperado: sin errores de tipos.

- [ ] **Step 4: Desplegar y probar contra un worker real existente**

```bash
supabase functions deploy match-concursos --project-ref waevdcqdkovqaxkonlvj
cat > /tmp/pick_worker.sql << 'EOF'
select id from profiles where rol='worker' and perfil_activo=true limit 1;
EOF
supabase db query --linked --file /tmp/pick_worker.sql -o json
```
Con el `id` real obtenido, invocar la función (reemplazar `<WORKER_ID>`):
```bash
curl -s -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/match-concursos" \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"<WORKER_ID>"}'
```
Esperado: `{"ok":true,"procesados":N}` con `N >= 0`, sin error 500. Confirma que el refactor no rompió el comportamiento existente.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/matching.ts supabase/functions/match-concursos/index.ts
git commit -m "$(cat <<'EOF'
refactor: extraer scoring de match-concursos a _shared/matching.ts

Necesario para match-ofertas (Tarea 4), que reusa exactamente la misma
logica de normalizacion/traduccion/scoring en vez de duplicar el
diccionario de ~250 lineas. match-concursos se comporta igual
(verificado con una llamada real contra un worker existente).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Edge function `match-ofertas`

**Files:**
- Create: `supabase/functions/match-ofertas/index.ts`

**Interfaces:**
- Consumes: `_shared/matching.ts` (Tarea 3) — `PAIS_ISO`, `calcularScore`.
- Consumes: `ofertas.estado='aprobada'` (Tarea 2) — solo matchea ofertas ya aprobadas.
- Produce: filas en `oferta_matches` (Tarea 2). Body soportado: `{"oferta_id":"uuid"}` (matchea una oferta contra todos los workers) o `{"todos":true}` (re-matchea todas las ofertas aprobadas+activas contra todos los workers, para tomar workers nuevos).
- Consumido por: Tarea 5 (`moderar-ofertas` invoca `match-ofertas` con `{oferta_id}` al aprobar) y el cron diario de la Tarea 7 (`{todos:true}`).

- [ ] **Step 1: Escribir la función**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PAIS_ISO, calcularScore } from "../_shared/matching.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function matchOferta(ofertaId: string): Promise<{ procesados: number; error?: string }> {
  const { data: oferta, error: ofertaErr } = await supabase
    .from("ofertas")
    .select("id, pais, empleo, titulo, keywords, ciudad, estado, activa")
    .eq("id", ofertaId)
    .single();

  if (ofertaErr || !oferta) return { procesados: 0, error: ofertaErr?.message };
  if (oferta.estado !== "aprobada" || !oferta.activa) return { procesados: 0 };

  const pais = PAIS_ISO[(oferta.pais || "").toLowerCase()] || (oferta.pais || "").slice(0, 2).toUpperCase();

  const { data: workers, error: workersErr } = await supabase
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, tecnicaturas, rol")
    .eq("rol", "worker")
    .eq("perfil_activo", true);

  if (workersErr) return { procesados: 0, error: workersErr.message };
  if (!workers?.length) return { procesados: 0 };

  const batch = workers.map((w: typeof workers[0]) => {
    const { score, keywords_match, cumple } = calcularScore(
      { keywords: oferta.keywords, cargo: oferta.empleo, titulo: oferta.titulo, lugar: oferta.ciudad, pais },
      w
    );
    return {
      oferta_id: ofertaId,
      worker_id: w.id,
      score,
      cumple,
      keywords_match,
      updated_at: new Date().toISOString(),
    };
  }).filter((m: { cumple: boolean }) => m.cumple);

  if (!batch.length) return { procesados: 0 };

  const { error: upsertErr } = await supabase
    .from("oferta_matches")
    .upsert(batch, { onConflict: "oferta_id,worker_id", ignoreDuplicates: false });

  if (upsertErr) return { procesados: 0, error: upsertErr.message };
  return { procesados: batch.length };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));

    if (body.todos) {
      const { data: ofertas } = await supabase
        .from("ofertas")
        .select("id")
        .eq("estado", "aprobada")
        .eq("activa", true);

      if (!ofertas?.length) {
        return new Response(JSON.stringify({ ok: true, ofertas: 0 }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      let totalProcesados = 0;
      for (const o of ofertas) {
        const r = await matchOferta(o.id);
        totalProcesados += r.procesados;
      }

      supabase.functions.invoke("notificar-matches-ofertas", {}).catch(() => {});

      return new Response(
        JSON.stringify({ ok: true, ofertas: ofertas.length, matches_procesados: totalProcesados }),
        { headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    if (body.oferta_id) {
      const result = await matchOferta(body.oferta_id);
      if (result.procesados > 0) {
        supabase.functions.invoke("notificar-matches-ofertas", {}).catch(() => {});
      }
      return new Response(JSON.stringify({ ok: !result.error, ...result }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return new Response(JSON.stringify({ error: "Enviar oferta_id o todos:true" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
```

- [ ] **Step 2: Verificar tipos**

```bash
deno check supabase/functions/match-ofertas/index.ts
```

- [ ] **Step 3: Desplegar y probar con una oferta real de prueba**

```bash
supabase functions deploy match-ofertas --project-ref waevdcqdkovqaxkonlvj
```
Crear una oferta de prueba directo en la base con `estado='aprobada'` y `activa=true` (usar un `employer_id` real existente):
```bash
cat > /tmp/pick_employer.sql << 'EOF'
select id from profiles where rol in ('employer','company') limit 1;
EOF
supabase db query --linked --file /tmp/pick_employer.sql -o json
```
```bash
cat > /tmp/task4_oferta_prueba.sql << 'EOF'
insert into ofertas (employer_id, titulo, empleo, pais, ciudad, activa, estado)
values ('<EMPLOYER_ID>', 'Prueba matching', 'Electricista', 'uruguay', 'Montevideo', true, 'aprobada')
returning id;
EOF
supabase db query --linked --file /tmp/task4_oferta_prueba.sql -o json
```
Invocar con el `id` devuelto:
```bash
curl -s -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/match-ofertas" \
  -H "Content-Type: application/json" \
  -d '{"oferta_id":"<OFERTA_ID>"}'
```
Esperado: `{"ok":true,"procesados":N}`. Confirmar en la base:
```bash
cat > /tmp/verif4.sql << 'EOF'
select count(*) from oferta_matches where oferta_id='<OFERTA_ID>';
EOF
supabase db query --linked --file /tmp/verif4.sql -o json
```
Borrar la oferta de prueba al terminar:
```bash
cat > /tmp/task4_limpiar.sql << 'EOF'
delete from ofertas where id='<OFERTA_ID>';
EOF
supabase db query --linked --file /tmp/task4_limpiar.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/match-ofertas/
git commit -m "$(cat <<'EOF'
feat: match-ofertas — matchea ofertas aprobadas contra perfiles worker

Reusa el scoring de _shared/matching.ts (mismo criterio que
match-concursos: keywords/pais/ciudad). Soporta oferta_id (una oferta)
o todos:true (re-matchea todas las aprobadas, para tomar workers
nuevos). Al terminar invoca notificar-matches-ofertas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Edge function `moderar-ofertas` (revisión automática de 24hs)

**Files:**
- Create: `supabase/functions/moderar-ofertas/index.ts`

**Interfaces:**
- Consumes: `ofertas.estado='pendiente'` (Tarea 2).
- Produce: `ofertas.estado` pasa a `'aprobada'` o `'rechazada'` (+ `motivo_rechazo`); invoca `match-ofertas` (Tarea 4) con `{oferta_id}` al aprobar; push a la empresa al rechazar.
- Consumido por: cron de la Tarea 7.

- [ ] **Step 1: Escribir la función**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Chequeo determinístico V1 — sin IA. Longitud mínima, sin URLs sueltas,
// sin términos de spam/discriminatorios. Se puede reforzar después sin
// cambiar el flujo (queda todo en esta única función).
const PALABRAS_PROHIBIDAS = [
  "gratis dinero", "bitcoin", "cripto invers", "pirámide", "esquema piramidal",
  "solo hombres", "solo mujeres", "no discapacitados", "no mayores de",
];
const URL_REGEX = /https?:\/\/|www\./i;

function revisarContenido(oferta: { titulo: string; descripcion: string | null; empleo: string | null }): { ok: true } | { ok: false; motivo: string } {
  const texto = `${oferta.titulo} ${oferta.descripcion || ""} ${oferta.empleo || ""}`.toLowerCase();

  if (oferta.titulo.trim().length < 5) {
    return { ok: false, motivo: "El título es demasiado corto para describir la búsqueda." };
  }
  if (URL_REGEX.test(texto)) {
    return { ok: false, motivo: "No se permiten links externos en la publicación." };
  }
  for (const p of PALABRAS_PROHIBIDAS) {
    if (texto.includes(p)) {
      return { ok: false, motivo: "El contenido de la publicación no cumple con las normas de Konexu." };
    }
  }
  return { ok: true };
}

async function pushEmpresa(employerId: string, titulo: string, body: string, data: Record<string, unknown>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", employerId)
    .single();
  if (!profile?.push_token) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ to: profile.push_token, title: titulo, body, sound: "default", data }),
  }).catch(() => {});
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const { data: pendientes, error } = await supabase
      .from("ofertas")
      .select("id, employer_id, titulo, descripcion, empleo, created_at")
      .eq("estado", "pendiente")
      .lte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;
    if (!pendientes?.length) {
      return new Response(JSON.stringify({ ok: true, revisadas: 0 }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let aprobadas = 0, rechazadas = 0;

    for (const o of pendientes) {
      const resultado = revisarContenido(o);

      if (resultado.ok) {
        await supabase.from("ofertas").update({ estado: "aprobada" }).eq("id", o.id);
        aprobadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda ya está activa",
          `Tu búsqueda de ${o.empleo || o.titulo} ya está activa en Konexu.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
        supabase.functions.invoke("match-ofertas", { body: { oferta_id: o.id } }).catch(() => {});
      } else {
        await supabase.from("ofertas").update({ estado: "rechazada", motivo_rechazo: resultado.motivo }).eq("id", o.id);
        rechazadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda no pudo activarse",
          `Tu búsqueda de ${o.empleo || o.titulo} no pudo activarse: ${resultado.motivo} Podés editarla y volver a enviarla.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, revisadas: pendientes.length, aprobadas, rechazadas }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
```

- [ ] **Step 2: Verificar tipos**

```bash
deno check supabase/functions/moderar-ofertas/index.ts
```

- [ ] **Step 3: Desplegar y probar con una oferta de prueba vencida**

```bash
supabase functions deploy moderar-ofertas --project-ref waevdcqdkovqaxkonlvj
```
Insertar una oferta ya "vieja" (para saltar la espera de 24hs en la prueba) y una que debería rechazarse:
```bash
cat > /tmp/task5_prueba.sql << 'EOF'
insert into ofertas (employer_id, titulo, empleo, pais, ciudad, activa, estado, created_at)
values
  ('<EMPLOYER_ID>', 'Buscamos electricista con experiencia', 'Electricista', 'uruguay', 'Montevideo', true, 'pendiente', now() - interval '25 hours'),
  ('<EMPLOYER_ID>', 'x', null, 'uruguay', 'Montevideo', true, 'pendiente', now() - interval '25 hours')
returning id, titulo;
EOF
supabase db query --linked --file /tmp/task5_prueba.sql -o json
```
Llamar la función con el header de service role (obtener el valor real desde Supabase Dashboard → Settings → API, no hardcodear en el repo):
```bash
curl -s -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/moderar-ofertas" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```
Esperado: `{"ok":true,"revisadas":2,"aprobadas":1,"rechazadas":1}`. Verificar:
```bash
cat > /tmp/verif5.sql << 'EOF'
select titulo, estado, motivo_rechazo from ofertas where titulo in ('Buscamos electricista con experiencia','x');
EOF
supabase db query --linked --file /tmp/verif5.sql -o json
```
Esperado: la primera `estado='aprobada'`, la segunda (título de 1 letra) `estado='rechazada'` con motivo. Limpiar:
```bash
cat > /tmp/task5_limpiar.sql << 'EOF'
delete from ofertas where titulo in ('Buscamos electricista con experiencia','x');
EOF
supabase db query --linked --file /tmp/task5_limpiar.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/moderar-ofertas/
git commit -m "$(cat <<'EOF'
feat: moderar-ofertas — revision automatica 24hs antes de activar

Chequeo deterministico (longitud minima, sin URLs, sin lista negra) V1
sin IA. Aprueba -> dispara match-ofertas; rechaza -> guarda motivo y
avisa a la empresa. Sin cola de revision manual en esta version.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Edge function `notificar-matches-ofertas`

**Files:**
- Create: `supabase/functions/notificar-matches-ofertas/index.ts`

**Interfaces:**
- Consumes: `oferta_matches` (Tarea 2), `ofertas.employer_id`/`empleo`/`titulo`, `profiles.push_token`.
- Produce: marca `oferta_matches.notificado=true` tras enviar.

- [ ] **Step 1: Escribir la función**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    // Paso 1: matches sin notificar + su oferta. ofertas.id <- oferta_matches.oferta_id
    // es una FK directa (Tarea 2), este embed sí resuelve.
    const { data: matches, error } = await supabase
      .from("oferta_matches")
      .select(`
        id,
        oferta_id,
        ofertas (id, empleo, titulo, employer_id)
      `)
      .eq("cumple", true)
      .eq("notificado", false)
      .order("score", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!matches?.length) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    type OfertaEmbed = { id: string; empleo: string | null; titulo: string; employer_id: string } | null;

    // Paso 2: push_token de cada empresa dueña, en una query aparte.
    // ofertas.employer_id referencia auth.users(id), NO profiles(id) directamente
    // (verificado: la FK real es ofertas_employer_id_fkey -> auth.users), asi que
    // PostgREST no puede resolver un embed ofertas->profiles en un solo select.
    const employerIds = Array.from(new Set(
      matches.map(m => (m.ofertas as unknown as OfertaEmbed)?.employer_id).filter(Boolean)
    )) as string[];

    const { data: perfiles, error: perfilesErr } = await supabase
      .from("profiles")
      .select("id, push_token")
      .in("id", employerIds);

    if (perfilesErr) throw perfilesErr;
    const tokenPorEmpresa = new Map((perfiles || []).map(p => [p.id, p.push_token as string | null]));

    const porOferta = new Map<string, {
      push_token: string;
      empleo: string;
      matchIds: string[];
    }>();

    for (const m of matches) {
      const oferta = m.ofertas as unknown as OfertaEmbed;
      const push_token = oferta ? tokenPorEmpresa.get(oferta.employer_id) : null;
      if (!oferta || !push_token) continue;

      if (!porOferta.has(m.oferta_id)) {
        porOferta.set(m.oferta_id, { push_token, empleo: oferta.empleo || oferta.titulo, matchIds: [] });
      }
      porOferta.get(m.oferta_id)!.matchIds.push(m.id);
    }

    let enviadas = 0;
    const notificados: string[] = [];

    for (const [ofertaId, data] of porOferta) {
      const cantidad = data.matchIds.length;
      const titulo = cantidad === 1
        ? `Tenés 1 candidato nuevo`
        : `Tenés ${cantidad} candidatos nuevos`;
      const cuerpo = `Para tu búsqueda de ${data.empleo}.`;

      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          to: data.push_token,
          title: titulo,
          body: cuerpo,
          sound: "default",
          badge: cantidad,
          data: { pantalla: "MisOfertasEmpresa", oferta_id: ofertaId },
        }),
      });

      const pushResult = await pushRes.json().catch(() => ({}));
      const exito = pushResult?.data?.status === "ok" || pushResult?.status === "ok";

      if (exito || pushRes.ok) {
        enviadas++;
        notificados.push(...data.matchIds);
      }
    }

    if (notificados.length > 0) {
      await supabase.from("oferta_matches").update({ notificado: true }).in("id", notificados);
    }

    return new Response(
      JSON.stringify({ ok: true, empresas_notificadas: enviadas, matches_marcados: notificados.length }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
```

- [ ] **Step 2: Verificar tipos y desplegar**

```bash
deno check supabase/functions/notificar-matches-ofertas/index.ts
supabase functions deploy notificar-matches-ofertas --project-ref waevdcqdkovqaxkonlvj
```

- [ ] **Step 3: Probar con los matches de prueba de la Tarea 4**

Repetir el insert de oferta + `match-ofertas` de la Tarea 4 Step 3 (con `push_token` real de una cuenta de prueba en `profiles`), luego:
```bash
curl -s -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/notificar-matches-ofertas" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```
Esperado: `{"ok":true,"empresas_notificadas":1,...}` y el push llega al dispositivo de prueba. Limpiar la oferta de prueba al terminar.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notificar-matches-ofertas/
git commit -m "$(cat <<'EOF'
feat: notificar-matches-ofertas — avisa a la empresa, no al trabajador

Espejo de notificar-matches pero direccion invertida: agrupa matches
nuevos por oferta -> employer_id, push a la empresa con la cantidad de
candidatos nuevos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Crons — moderar-ofertas y re-match diario

**Files:**
- Ejecutar directo contra la base vía `supabase db query --linked --file`.

**Interfaces:**
- Produce: cron jobs `moderar-ofertas-horario` y `match-ofertas-diario`.

- [ ] **Step 1: Obtener el service role key real**

```bash
supabase secrets list --project-ref waevdcqdkovqaxkonlvj 2>/dev/null | grep -i service
```
Si no lo devuelve por acá, tomarlo de Supabase Dashboard → Settings → API → `service_role` (no pegarlo en ningún archivo del repo, solo en el SQL que se ejecuta directo).

- [ ] **Step 2: Cron `moderar-ofertas` cada hora**

`/tmp/task7_cron_moderar.sql` (reemplazar `<SERVICE_ROLE_KEY>`):
```sql
select cron.schedule(
  'moderar-ofertas-horario',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/moderar-ofertas',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    timeout_milliseconds:=30000
  );$$
);
```
```bash
supabase db query --linked --file /tmp/task7_cron_moderar.sql
```

- [ ] **Step 3: Cron `match-ofertas` diario (re-match contra workers nuevos)**

`/tmp/task7_cron_match.sql` (reemplazar `<SERVICE_ROLE_KEY>`):
```sql
select cron.schedule(
  'match-ofertas-diario',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/match-ofertas',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body:='{"todos":true}'::jsonb,
    timeout_milliseconds:=60000
  );$$
);
```
```bash
supabase db query --linked --file /tmp/task7_cron_match.sql
```
Nota: se elige `0 8 * * *` (una hora después de `busqueda-diaria-workers`, que corre `0 7 * * *`) para no competir por recursos con el matching de concursos.

- [ ] **Step 4: Verificar ambos activos**

```bash
cat > /tmp/verif7.sql << 'EOF'
select jobname, schedule, active from cron.job where jobname in ('moderar-ofertas-horario','match-ofertas-diario');
EOF
supabase db query --linked --file /tmp/verif7.sql -o json
```
Esperado: 2 filas, ambas `active=true`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-09-18-company-publicar-empleo.md
git commit -m "$(cat <<'EOF'
chore: cron de revision automatica horaria + re-match diario de ofertas

moderar-ofertas-horario (cada hora, aprueba/rechaza pendientes de 24hs)
y match-ofertas-diario (0 8 * * *, todos:true, toma workers nuevos).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `BienvenidaEmpresaScreen.js` — 3 niveles reales

**Files:**
- Modify: `src/screens/company/BienvenidaEmpresaScreen.js:8-9` (array de planes)

**Interfaces:**
- Consumes: `cupo_empresa_restante()` (Tarea 2) — el copy debe reflejar los mismos números que devuelve la función.

- [ ] **Step 1: Reemplazar el array de planes**

Reemplazar (líneas 8-9):
```js
  {id:"membresia_sa",nombre:"Suscripcion",zona:"Sudamerica",precio:"U$12",periodo:"/mes",perfiles:"Perfiles ilimitados",color:"#E8785A",bg:"#FFF0ED",items:["Ver perfiles sin limite durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
  {id:"membresia_world",nombre:"Suscripcion",zona:"Mundial",precio:"U$24",periodo:"/mes",perfiles:"Perfiles ilimitados",color:"#3DA882",bg:"#E6FBF5",items:["Ver perfiles sin limite durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
```
por:
```js
  {id:"membresia_sa",nombre:"Suscripcion",zona:"Sudamerica",precio:"U$12",periodo:"/mes",perfiles:"Hasta 10 perfiles nuevos por dia",color:"#E8785A",bg:"#FFF0ED",items:["Hasta 10 perfiles nuevos por dia durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
  {id:"membresia_world",nombre:"Suscripcion",zona:"Mundial",precio:"U$24",periodo:"/mes",perfiles:"Hasta 10 perfiles nuevos por dia",color:"#3DA882",bg:"#E6FBF5",items:["Hasta 10 perfiles nuevos por dia durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
  {id:"membresia_premium",nombre:"Suscripcion",zona:"Premium",precio:"U$50",periodo:"/mes",perfiles:"Perfiles ilimitados",color:"#7C3AED",bg:"#F3E8FF",items:["Perfiles ilimitados durante 30 dias","Pensado para empresas con alto volumen de busqueda","Soporte prioritario"]},
```

- [ ] **Step 2: Prueba visual**

Abrir `BienvenidaEmpresaScreen` en el simulador/Expo Go logueado como `company`. Confirmar que se ven 3 tarjetas de plan, la tercera ("Premium", U$50) con el color distinto (`#7C3AED`, violeta) y el texto "Perfiles ilimitados".

- [ ] **Step 3: Commit**

```bash
git add src/screens/company/BienvenidaEmpresaScreen.js
git commit -m "$(cat <<'EOF'
feat: 3 niveles reales en BienvenidaEmpresaScreen (SA/World 10 x dia, Premium ilimitado)

Antes SA y World decian "ilimitado" sin serlo. Ahora reflejan el tope
real de cupo_empresa_restante() y se agrega el plan Premium U$50.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Pantalla "Mis búsquedas publicadas" (`MisOfertasEmpresaScreen.js`)

**Files:**
- Create: `src/screens/company/MisOfertasEmpresaScreen.js` (adaptado de `src/screens/employer/OfertasEmpleadorScreen.js`)

**Interfaces:**
- Produce: componente `MisOfertasEmpresaScreen` — consumido por `App.js` (Tarea 10).
- Consumes: tabla `ofertas` (columna `estado`, Tarea 2). El botón "+ Nueva búsqueda" navega a la ruta `CrearOferta`, que la Tarea 10 registra en `App.js` — este componente puede escribir `navigation.navigate('CrearOferta')` ya ahora, la ruta va a existir quien lo consuma.

- [ ] **Step 1: Leer `OfertasEmpleadorScreen.js` completo antes de adaptar**

```bash
cat src/screens/employer/OfertasEmpleadorScreen.js
```
Usar exactamente su mismo patrón de fetch/lista/estilos — la única diferencia real es: (a) mostrar un badge de `estado` por card, y (b) el `select` de Supabase debe pedir también `estado, motivo_rechazo`.

- [ ] **Step 2: Escribir `MisOfertasEmpresaScreen.js`**

Partir de una copia literal de `OfertasEmpleadorScreen.js`, y aplicar estos cambios:
- En el `supabase.from('ofertas').select(...)`, agregar `estado, motivo_rechazo` a la lista de columnas pedidas.
- Debajo de `{oferta.empleo?<Text style={ss.cardCargo}>{oferta.empleo}</Text>:null}` (ya corregido en la Tarea 1), agregar un badge de estado:
```jsx
          {oferta.estado==='pendiente'&&<View style={ss.badgePendiente}><Text style={ss.badgeTxt}>Pendiente de revisión</Text></View>}
          {oferta.estado==='aprobada'&&<View style={ss.badgeAprobada}><Text style={ss.badgeTxt}>Activa</Text></View>}
          {oferta.estado==='rechazada'&&(
            <View style={ss.badgeRechazada}>
              <Text style={ss.badgeTxt}>No aprobada</Text>
              {oferta.motivo_rechazo?<Text style={ss.motivoTxt}>{oferta.motivo_rechazo}</Text>:null}
            </View>
          )}
```
- Agregar a los estilos (`StyleSheet.create`):
```js
  badgePendiente:{backgroundColor:'#FEF3C7',borderRadius:8,paddingHorizontal:8,paddingVertical:4,alignSelf:'flex-start',marginTop:6},
  badgeAprobada:{backgroundColor:'#D1FAE5',borderRadius:8,paddingHorizontal:8,paddingVertical:4,alignSelf:'flex-start',marginTop:6},
  badgeRechazada:{backgroundColor:'#FEE2E2',borderRadius:8,paddingHorizontal:8,paddingVertical:4,alignSelf:'flex-start',marginTop:6},
  badgeTxt:{fontSize:11,fontWeight:'700',color:'#1A1020'},
  motivoTxt:{fontSize:11,color:'#5A4E6A',marginTop:2},
```
- El botón "+ Nueva búsqueda" (ya existente en `OfertasEmpleadorScreen.js` como algo equivalente a "+ Nueva oferta") debe navegar a `navigation.navigate('CrearOferta')` en vez de a la ruta que use `OfertasEmpleadorScreen` original — confirmar el nombre exacto del botón/handler al leer el archivo en el Step 1 y ajustar el texto a "+ Nueva búsqueda" (copy de `company`, no "oferta").
- Renombrar el componente exportado a `MisOfertasEmpresaScreen`.

- [ ] **Step 3: Prueba visual**

Con una cuenta `company` de prueba logueada (una vez completada también la Tarea 10, que registra la ruta en `App.js`): abrir la pestaña "Publicar". Confirmar que lista las búsquedas ya creadas con su badge de estado correcto, y que "+ Nueva búsqueda" navega a `CrearOferta`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/company/MisOfertasEmpresaScreen.js
git commit -m "$(cat <<'EOF'
feat: pantalla Mis busquedas publicadas para company

Adaptada de OfertasEmpleadorScreen.js, agrega el badge de estado
(pendiente/activa/no aprobada + motivo) que no existia en el original
porque employer no tiene revision automatica en su flujo actual.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `CompanyTabs` — acceso para publicar + cartel de confirmación

**Files:**
- Modify: `App.js:222-247` (`CompanyTabs`, `CompanyStack`)
- Modify: `src/screens/employer/CrearOfertaScreen.js` (mensaje de confirmación condicional por rol)

**Interfaces:**
- Consumes: `CrearOfertaScreen` (Tarea 1, ya arreglada), `MisOfertasEmpresaScreen` (Tarea 9, ya creada), `useApp()` de `src/services/AppContext.js` (expone `modoActivo`, ya usado en el plan hermano).
- Produce: ruta `Stack.Screen name="CrearOferta"` navegable desde `CompanyTabs`.

- [ ] **Step 1: Agregar rutas al `CompanyStack`**

En `App.js`, reemplazar (líneas 239-247):
```js
function CompanyStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="CompanyTabsMain" component={CompanyTabs}/>
      <Stack.Screen name="BienvenidaEmpresa" component={BienvenidaEmpresaScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
    </Stack.Navigator>
  );
}
```
por:
```js
function CompanyStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="CompanyTabsMain" component={CompanyTabs}/>
      <Stack.Screen name="BienvenidaEmpresa" component={BienvenidaEmpresaScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
      <Stack.Screen name="CrearOferta" component={CrearOfertaScreen}/>
      <Stack.Screen name="MisOfertasEmpresa" component={MisOfertasEmpresaScreen}/>
    </Stack.Navigator>
  );
}
```
(`MisOfertasEmpresaScreen` ya existe, creada en la Tarea 9 — agregar su import: `import MisOfertasEmpresaScreen from './src/screens/company/MisOfertasEmpresaScreen';`. Si `CrearOfertaScreen` no está importado todavía en `App.js`, agregar también `import CrearOfertaScreen from './src/screens/employer/CrearOfertaScreen';` junto a los demás imports de pantallas de empleador.)

- [ ] **Step 2: Agregar la pestaña "Publicar" a `CompanyTabs`**

Reemplazar (líneas 222-237):
```js
function CompanyTabs(){
  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#3DA882",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeEmpresaScreen}/>
      <Tab.Screen name="Explorar" component={BuscarEmpresaScreen}/>
      <Tab.Screen name="Cuenta" component={PerfilEmpresaScreen}/>
    </Tab.Navigator>
  );
}
```
por:
```js
function CompanyTabs(){
  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#3DA882",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeEmpresaScreen}/>
      <Tab.Screen name="Explorar" component={BuscarEmpresaScreen}/>
      <Tab.Screen name="Publicar" component={MisOfertasEmpresaScreen}/>
      <Tab.Screen name="Cuenta" component={PerfilEmpresaScreen}/>
    </Tab.Navigator>
  );
}
```
(La pestaña "Publicar" abre la lista de "Mis búsquedas publicadas" de la Tarea 9, que a su vez tiene el botón "+ Nueva búsqueda" que navega a `CrearOferta`. No se pone `CrearOfertaScreen` directo en el tab para no perder el listado de publicaciones existentes al volver.)

Confirmar que `TabIcon` (buscar su definición en `App.js`) tiene un caso para `"Publicar"` — si no lo tiene, agregar un ícono (ej. `📣`) siguiendo el mismo patrón que los demás casos del `switch`/objeto de íconos.

- [ ] **Step 2: Cartel de confirmación en `CrearOfertaScreen.js`**

Reemplazar el bloque de éxito (dentro de `guardar()`, ya arreglado en la Tarea 1):
```js
      Alert.alert(editando?'Oferta actualizada':'Oferta publicada',editando?'Los cambios fueron guardados.':'Tu oferta ya es visible para los trabajadores.',[{text:'OK',onPress:()=>navigation.goBack()}]);
```
por (usa `useApp` para saber si quien publica es `company`, y en ese caso muestra el mensaje de revisión en vez del de publicación instantánea — la revisión de 24hs aplica solo a esta feature nueva, no cambia nada para `employer`):
```js
      const esCompany = modoActivo === 'company';
      const tituloAlert = editando ? 'Oferta actualizada' : (esCompany ? 'Búsqueda recibida' : 'Oferta publicada');
      const mensajeAlert = editando
        ? 'Los cambios fueron guardados.'
        : (esCompany
            ? 'Tu búsqueda fue recibida correctamente. La estamos revisando para mantener la calidad de las publicaciones en Konexu — se activa en un plazo de 24 horas.'
            : 'Tu oferta ya es visible para los trabajadores.');
      Alert.alert(tituloAlert, mensajeAlert, [{text:'OK',onPress:()=>navigation.goBack()}]);
```
Agregar el import y el hook al inicio del componente (mismo patrón que la Tarea 2 del plan hermano):
```js
import{useApp}from '../../services/AppContext';
```
y dentro de `export default function CrearOfertaScreen({navigation,route}){`:
```js
  const{modoActivo}=useApp();
```
También ajustar el insert (Tarea 1) para que, cuando `modoActivo==='company'` y no es edición, no se sobreescriba `estado` (queda en el default `'pendiente'` de la columna — no agregar `estado` al payload en ningún caso, dejar que la base lo maneje).

- [ ] **Step 3: Prueba funcional**

Con una cuenta `company` de prueba: ir a la pestaña "Publicar" → "+ Nueva búsqueda" (Tarea 9) → usar el título literal "Prueba tarea 10" → Guardar. Confirmar que aparece el alert "Búsqueda recibida" con el texto de revisión, y que la fila en `ofertas` quedó con `estado='pendiente'` (usar ese título literal para poder limpiarla junto con el resto en la Tarea 11).

- [ ] **Step 4: Commit**

```bash
git add App.js src/screens/employer/CrearOfertaScreen.js
git commit -m "$(cat <<'EOF'
feat: company puede publicar una busqueda de empleo

Nueva pestana Publicar en CompanyTabs, reusa CrearOfertaScreen (ya
arreglada en la Tarea 1). Cartel de confirmacion distinto para company
(explica la revision de 24hs) vs employer (publicacion instantanea,
sin cambios).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Prueba end-to-end completa

**Files:** ninguno (solo verificación manual).

- [ ] **Step 1: Recorrido completo con una cuenta `company` de prueba**

1. Publicar una búsqueda desde la pestaña "Publicar" usando el título literal "Prueba end-to-end tarea 11" → confirmar el cartel "Búsqueda recibida... 24 horas".
2. Forzar el paso del tiempo editando `created_at` de esa oferta a `now() - interval '25 hours'` directo en la base (para no esperar de verdad):
   ```bash
   cat > /tmp/task11_forzar.sql << 'EOF'
   update ofertas set created_at = now() - interval '25 hours' where titulo = 'Prueba end-to-end tarea 11';
   EOF
   supabase db query --linked --file /tmp/task11_forzar.sql
   ```
3. Invocar manualmente `moderar-ofertas` (o esperar al cron):
   ```bash
   curl -s -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/moderar-ofertas" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
   ```
4. Confirmar en la app (pestaña "Publicar") que el badge pasó a "Activa" y llegó el push "Tu búsqueda ya está activa".
5. Confirmar que llegó (o llega poco después, al correr `notificar-matches-ofertas`) el push de candidatos, si hay algún `worker` de prueba con perfil compatible.
6. Tocar el aviso de candidatos → abrir un perfil → confirmar que `cupo_empresa_restante()` bajó en 1 (misma bolsa que la búsqueda manual en "Explorar").

- [ ] **Step 2: Limpiar todos los datos de prueba usados en las Tareas 4, 5, 10 y 11**

```bash
cat > /tmp/task11_limpiar.sql << 'EOF'
delete from oferta_matches where oferta_id in (select id from ofertas where titulo ilike '%prueba%');
delete from ofertas where titulo ilike '%prueba%';
EOF
supabase db query --linked --file /tmp/task11_limpiar.sql
```

Esta tarea no genera commit — es solo verificación de que todo el recorrido funciona junto.
