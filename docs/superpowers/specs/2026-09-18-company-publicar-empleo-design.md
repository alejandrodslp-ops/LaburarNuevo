# Company puede publicar empleos + matching automático — diseño

**Fecha:** 2026-09-18
**Alcance:** rol `company`. Se apoya en la infraestructura de cupo ya construida en esta misma rama (`cupo_empresa_restante`, `consumir_visualizacion_empresa`, planes de `BienvenidaEmpresaScreen`) — no la duplica.
**Dispara este trabajo:** el correo/WhatsApp de captación ya redactado en `marketing/email_empresas_es_generico.html` / `email_empresas_pt.html` / `whatsapp_empresas.md` promete "publicar sus búsquedas de empleo sin costo" a empresas — hoy `company` no tiene ninguna pantalla para hacerlo.

## Contexto (verificado en el código, no supuesto)

- `CompanyTabs` (`App.js`) tiene solo 3 pestañas: Inicio, Explorar, Cuenta. No existe ninguna forma de publicar un empleo desde el rol `company`.
- La tabla `ofertas` (`employer_id uuid references auth.users(id)`, sin columna `company_id`) y su RLS (`auth.uid() = employer_id`, sin chequeo de `profiles.rol`) **ya son genéricas** — cualquier usuario autenticado puede insertar ahí. El único motivo por el que `company` no publica hoy es la falta de pantalla, no un bloqueo de datos.
- `CrearOfertaScreen.js` (bajo `employer/`) ya arma el insert completo a `ofertas`; es reutilizable para `company` sin cambios de esquema.
- Patrón de matching que ya existe y funciona, para **concursos públicos**: tabla `concurso_matches` (`score`, `keywords_match`, `cumple`, `notificado`) + función `match-concursos` (cron, matchea keywords/país/rubro del concurso contra `profiles`) + función `notificar-matches` (cron, agrupa por `worker_id` y le hace push al **trabajador**). Esta función notifica al trabajador, no a quien publicó — dirección inversa a lo que necesita esta feature.
- No existe ninguna columna ni pantalla de moderación/revisión sobre `ofertas` hoy (verificado: sin columnas `estado`/`aprobada`/`revision` en la tabla, sin cola de moderación en `AdminScreen.js`). Publicar hoy es instantáneo y sin chequeo.
- `cupo_empresa_restante()` (ya en producción, de la Tarea 1 de esta rama) devuelve `suscripcion_activa` como booleano simple; hoy solo distingue gratis (3/día·9/semana) vs. suscripta (ilimitado, `999999`). `profiles.suscripcion_plan` ya existe como columna (para guardar qué plan compró) — se puede usar para diferenciar niveles sin agregar columnas nuevas.
- `PerfilTrabajadorScreen.js` es compartida entre `employer` y `company`; ya está planeada (Tarea 2 de esta rama) para llamar `consumir_visualizacion_empresa(p_worker)` cuando el modo activo es `company`. Cualquier perfil que la empresa abra desde acá gasta cupo — **incluidos los candidatos que vengan de un match**, sin trabajo adicional.

## Reglas del negocio (confirmadas con el usuario)

1. **Publicar:** `company` puede cargar una búsqueda de empleo con el mismo formulario/tabla que usa `employer` (`CrearOfertaScreen`).
2. **Revisión, no publicación instantánea:** al enviar, la oferta queda en estado `pendiente` — no visible, no matchea todavía. La empresa ve un cartel de confirmación (texto abajo). A las 24 horas de creada, un chequeo automático de contenido la aprueba o la rechaza (ver más abajo). No hay cola de revisión manual en esta versión.
3. **Matching:** una vez `aprobada`, se compara contra perfiles de `worker` con el mismo criterio de keywords/país/rubro que ya usa `match-concursos` (reutilizar la lógica, no reinventarla), guardando resultados en una tabla nueva análoga a `concurso_matches`.
4. **Aviso — a la empresa, no al trabajador:** cuando una oferta tiene candidatos nuevos sin notificar, se le hace push a la empresa (`profiles.push_token` de su `employer_id`), agrupado por oferta. Dirección inversa a `notificar-matches`.
5. **Ver un candidato = mismo cupo que ya existe:** tocar un match abre `PerfilTrabajadorScreen` (ya compartida), que ya gasta cupo vía `consumir_visualizacion_empresa`. La búsqueda manual (`BuscarEmpresaScreen`) y los matches de una oferta publicada comparten la misma bolsa diaria/semanal — confirmado explícitamente con el usuario, no hay dos contadores separados.
6. **Reestructura de los 3 niveles de cupo** (cambia lo ya commiteado en `92e35b9`, que decía "ilimitado" para ambos planes pagos):
   - **Gratis:** 3 perfiles nuevos por día, tope 9/semana — sin cambio.
   - **Suscripción Sudamérica (U$12/mes) y Mundial (U$24/mes):** pasan de "ilimitado" a **10 perfiles nuevos por día**. Mismo número para ambas — la diferencia entre ellas sigue siendo el alcance geográfico de candidatos, no la cantidad.
   - **Nuevo plan Premium (U$50/mes):** verdaderamente ilimitado, pensado para empresas grandes.
   - Requiere que `cupo_empresa_restante()` diferencie por `profiles.suscripcion_plan` (`'membresia_sa' | 'membresia_world'` → tope 10/día; `'membresia_premium'` → ilimitado), no solo por el booleano `suscripcion_activa`.

## Cambios de base de datos

### `ofertas` — columna de estado
```sql
alter table public.ofertas
  add column if not exists estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada'));
alter table public.ofertas
  add column if not exists motivo_rechazo text;
```
La visibilidad pública (`ofertas_visibles`, `activa=true`) y el matching deben exigir `estado='aprobada'` además de `activa=true` — no alcanza con `activa` sola.

### `oferta_matches` — nueva tabla (mismo esquema que `concurso_matches`)
```sql
create table public.oferta_matches (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.ofertas(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  score numeric,
  keywords_match text[],
  cumple boolean not null default true,
  notificado boolean not null default false,
  created_at timestamptz not null default now(),
  unique(oferta_id, worker_id)
);
-- RLS: la empresa dueña de la oferta puede leer sus propios matches; nadie más.
alter table public.oferta_matches enable row level security;
create policy oferta_matches_select on public.oferta_matches for select
  using (exists (select 1 from public.ofertas o where o.id = oferta_id and o.employer_id = auth.uid()));
```

### `cupo_empresa_restante()` — reescribir para 3 niveles
Reemplaza el `case when v_sub then 999999 else ...` actual por una rama según `profiles.suscripcion_plan`:
- `'membresia_premium'` (y vigente) → `999999`
- `'membresia_sa'` / `'membresia_world'` (y vigente) → tope `10` por día, sin tope semanal aparte (a diferencia del gratis, que sí tiene tope semanal de 9)
- cualquier otro caso (incluye `null`, plan vencido) → gratis, `3`/día · `9`/semana como hoy

## Funciones edge nuevas

### `moderar-ofertas` (cron, cada hora)
- Selecciona `ofertas` con `estado='pendiente'` y `created_at <= now() - interval '24 hours'`.
- Chequeo automático determinístico (V1, sin IA): `titulo`/`descripcion` con longitud mínima razonable, sin URLs sueltas, sin lista negra de términos de spam/discriminatorios. Sin ojo humano en esta versión — si hace falta reforzarlo más adelante, se suma sin cambiar el flujo.
- Si pasa → `estado='aprobada'`; dispara (o deja que el próximo tick de) `match-ofertas` la procese.
- Si no pasa → `estado='rechazada'`, `motivo_rechazo` con el motivo puntual; push a la empresa avisando (texto abajo).

### `match-ofertas` (cron)
- Mismo criterio que `match-concursos` (keywords/país/rubro), adaptado: compara `ofertas` (`estado='aprobada'`, `activa=true`) contra `profiles` de `worker`, inserta en `oferta_matches`.

### `notificar-matches-ofertas` (cron)
- Selecciona `oferta_matches` con `notificado=false`, agrupa por `oferta_id` → `employer_id`, push al `push_token` de esa empresa. Marca `notificado=true` tras enviar. Espejo de `notificar-matches`, pero destinatario invertido (empresa, no trabajador).

## Cambios de UI

- **`CompanyTabs`**: agregar acceso para publicar (pestaña o entrada desde Inicio) reutilizando `CrearOfertaScreen`.
- **Pantalla "Mis búsquedas publicadas"** (para `company`, mismo patrón que `OfertasEmpleadorScreen`): lista con estado visible (`Pendiente de revisión` / `Activa` / `No aprobada` + motivo).
- **Cartel post-publicación** (banner o modal, texto exacto):
  > "Tu búsqueda fue recibida correctamente. La estamos revisando para mantener la calidad de las publicaciones en Konexu — se activa en un plazo de 24 horas."
- **Push / texto si se rechaza:**
  > "Tu búsqueda de {puesto} no pudo activarse: {motivo}. Podés editarla y volver a enviarla."
- **Push de candidatos nuevos** (agrupado por oferta):
  > "Tenés {N} candidatos nuevos para tu búsqueda de {puesto}."
- **`BienvenidaEmpresaScreen.js`**: actualizar `perfiles` de `membresia_sa`/`membresia_world` de "Perfiles ilimitados" a "Hasta 10 perfiles nuevos por día"; agregar tarjeta del nuevo plan Premium U$50 ("Perfiles ilimitados").

## Fuera de alcance (explícito)

- Cola de moderación manual en `AdminScreen` — se puede sumar después si el chequeo automático no alcanza.
- Pagos recurrentes automáticos para el plan Premium — mismo modelo que los otros dos (pago manual por período, ya definido en el spec de cupo).
- Cambios al flujo de `employer` (créditos pagos) — no se toca.
