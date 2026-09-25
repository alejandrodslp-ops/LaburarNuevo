# Self-host de Supabase — la pieza que faltaba en la migración

⚠️ **NO ACTIVAR. Preparación únicamente.** No hay servidor Hetzner creado todavía
(al 2026-09-09). Nada de esta carpeta se ejecuta hasta que el usuario diga
"migrar a Hetzner" Y haya un servidor real con IP.

---

## Por qué existe esta carpeta

La auditoría del 2026-09-09 encontró que `backend-hetzner/` (las rutas Express)
**solo migra las ~28 Edge Functions**. La app y la web dependen de mucho más
que eso, y nada de lo siguiente tiene equivalente propio hoy:

- **Auth** (login, sesión, signup, reset de password) — 8 métodos usados por la app
- **Realtime** (canales en vivo — `postgres_changes`)
- **Storage** (subida de fotos de perfil, comprobantes — 3 buckets, ~1,5 MB)
- **PostgREST** (las 13 tablas que la app consulta directo con `.from()`, protegidas por RLS)

Migrar solo `backend-hetzner/` no saca a Konexu de Supabase — seguiría 100%
dependiente de su Auth/PostgREST/Realtime/Storage alojados. La única forma de
"no depender de límites de ningún tipo" es correr **el stack completo de
Supabase self-hosted** en el servidor propio. Eso es lo que preparan estos
archivos.

## Qué hay en esta carpeta

- `docker-compose.yml.oficial` — snapshot verificado del compose oficial de
  Supabase, bajado el 2026-09-09 de `github.com/supabase/supabase/docker/`.
- `.env.example.oficial` — snapshot del `.env.example` oficial (389 líneas,
  todos los secrets que este stack necesita).

**Por qué son snapshots y no el árbol completo:** el compose oficial referencia
más archivos de soporte (config de Envoy, scripts de init SQL para Auth/Storage,
config de Supavisor) que Supabase actualiza seguido. Vendorizarlos a mano acá
se desactualizaría al toque. En el server real, el paso correcto es clonar el
repo oficial fresco (paso 2 abajo) — ahí vienen todos esos archivos de soporte
completos y al día. Estos dos snapshots son para **revisar y decidir la config
ahora**, no para copiar y pegar en producción sin mirar.

**Dato importante de esta versión (2026-09-09):** el gateway de la API ya NO es
Kong — pasó a ser **Envoy** (`api-gw`, imagen `envoyproxy/envoy`). Si en algún
momento se leyó o recordó documentación vieja de Supabase self-host mencionando
Kong, está desactualizada. Kong queda como *override* opcional
(`sh run.sh config add kong`), no como el default.

---

## Plan completo, paso a paso

### Paso 0 — Crear el servidor (no hecho todavía)
Server Hetzner con Docker instalado (Ubuntu 24.04 + `curl -fsSL
https://get.docker.com | sh`). Dimensionamiento: ver conversación — arrancar
con CX42 (8 vCPU / 16GB / 160GB, ~€16/mes) alcanza sobrado para la carga actual.

### Paso 1 — Clonar el repo oficial de Supabase EN EL SERVIDOR
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```
Esto traiga todos los archivos de soporte reales y al día (Envoy, SQL de init,
Supavisor) — no hace falta copiarlos desde acá.

### Paso 2 — Generar los secrets
El propio repo trae los scripts:
```bash
sh utils/generate-keys.sh      # POSTGRES_PASSWORD, JWT_SECRET, SECRET_KEY_BASE, etc.
sh utils/add-new-auth-keys.sh  # ANON_KEY / SERVICE_ROLE_KEY (JWTs firmados)
```
Comparar contra `.env.example.oficial` de esta carpeta para no perderse ninguna
variable. **Nunca reusar los valores de ejemplo** ("your-super-secret...") —
son públicos, están en el repo de Supabase.

### Paso 3 — Configurar `.env`
Mínimo a ajustar respecto al ejemplo:
- `SITE_URL` → `https://www.konexu.app`
- `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` → el dominio/subdominio real de la
  API (ej. `https://api.konexu.app`)
- `SMTP_*` → el mismo Resend que ya usa Konexu (o dejar para más adelante si
  Auth por email no es crítico el día 1)
- `DASHBOARD_PASSWORD` → cambiar del default

### Paso 4 — Levantar el stack
```bash
docker compose up -d
# TLS automático con el dominio real:
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```
Verificar Studio (`https://api.konexu.app` con las credenciales de
`DASHBOARD_USERNAME`/`PASSWORD`) antes de tocar datos.

### Paso 5 — Migrar los datos reales (Supabase hosted → Postgres propio)
Con Docker YA disponible en el server (a diferencia de esta Mac, donde no lo
hay), ahí sí funciona el dump nativo:
```bash
supabase db dump --linked -f schema_completo.sql   # estructura, con Docker real
supabase db dump --linked --data-only -f datos.sql # los datos
```
Restaurar en el Postgres nuevo (`docker compose exec db psql ...` o vía el
`POSTGRES_PORT` expuesto por Supavisor). **Ventana de corte necesaria**: el
scraper y las alertas siguen escribiendo en la base vieja hasta el instante del
dump — coordinar una pausa corta de los crons antes de dumpear para no perder
escrituras hechas durante la migración.

Ver `backend-hetzner/database/schema.sql` (reconstruido el 2026-09-09) como
referencia de qué tablas/políticas/funciones tiene que llevar el dump — pero
usar el `pg_dump` real de este paso como la fuente de verdad, no ese archivo
(que está reconstruido vía SQL de solo lectura, no es un pg_dump literal).

### Paso 6 — Apuntar `backend-hetzner` al stack nuevo
En su `.env`:
```
SUPABASE_URL=https://api.konexu.app          # el SUPABASE_PUBLIC_URL del paso 3
SUPABASE_SERVICE_ROLE_KEY=<el SERVICE_ROLE_KEY generado en el paso 2>
```
Nada más cambia en el código — `src/lib/supabase.js` ya usa esas dos variables.

### Paso 7 — Apuntar la WEB (Next.js) al stack nuevo
`web/.env.local` (o las env vars de Vercel/donde corra):
```
NEXT_PUBLIC_SUPABASE_URL=https://api.konexu.app
NEXT_PUBLIC_SUPABASE_ANON_KEY=<el ANON_KEY generado en el paso 2>
```

### Paso 8 — Activar el cron interno
Recién en este punto, en `backend-hetzner/.env`:
```
ACTIVAR_CRON_INTERNO=true
```
Y **desactivar los pg_cron viejos en el Supabase hosted** (o borrar el proyecto
hosted directamente) — dejarlos prendidos junto con el cron interno nuevo
DUPLICA cada tarea. Ver `backend-hetzner/src/cron.js` — trae los 22 jobs
mapeados con el mismo horario y body que hoy corren en Supabase.

### Paso 9 — Cutover de DNS
Recién cuando los pasos 1-8 estén verificados funcionando en paralelo (sin
tráfico real), cambiar el DNS de `konexu.app` / `api.konexu.app` al server
nuevo. Tener plan de rollback (volver el DNS a Vercel/Supabase) listo antes de
cortar.

---

## Lo que este plan NO resuelve todavía (para la próxima sesión)

- **RLS/policies del `schema.sql` reconstruido no son 100% verbatim** — antes
  de restaurar en serio, correr el `pg_dump` real (paso 5) y diffear contra el
  reconstruido para pescar cualquier diferencia.
- **SMTP para Auth por email** — self-hosted GoTrue necesita un SMTP propio
  configurado (hoy Supabase hosted lo tiene resuelto de fábrica).
- **OAuth/SSO** si algún día se usa login social — no está configurado en el
  `.env.example`, hay que sumarlo explícitamente.
