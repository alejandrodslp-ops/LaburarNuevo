# Activación recurrente del worker (PayPal Subscriptions) — diseño

## ✅ IMPLEMENTADO 2026-09-25 (en sandbox, falta credenciales live antes de lanzar)

Todo lo de este documento está programado y probado de punta a punta contra el sandbox de PayPal:
- `supabase/functions/crear-pago/index.ts` — rama `worker_activacion_paypal` agregada. Probada con un usuario real de prueba: devuelve un `init_point` de PayPal válido.
- `supabase/functions/webhook-paypal/index.ts` — nueva, con verificación de firma real de PayPal (`PAYPAL_WEBHOOK_ID` configurado, webhook registrado vía API en la cuenta de PayPal).
- `supabase/functions/cancelar-renovacion-worker/index.ts` — nueva. Probada de punta a punta: cancela y pone `worker_renovacion_automatica=false`.
- Mismo trío portado a `backend-hetzner/src/routes/` (`crear-pago.js`, `webhook-paypal.js`, `cancelar-renovacion-worker.js`), registrado en `index.js`, sincronizado al servidor y verificado que el proceso PM2 arranca sin errores.
- `src/screens/worker/PagoActivacionScreen.js` — botón de PayPal agregado, leyenda vieja eliminada.
- `src/screens/PerfilScreen.js` — fila de "renovación automática" con botón de cancelar, en la sección de perfil del worker.
- `profiles.worker_paypal_subscription_id/worker_renovacion_automatica/worker_intentos_cobro_fallido` y `config.paypal_plan_id_sa` creados en ambas bases (hosted y self-hosted).

**2 bugs pre-existentes encontrados y corregidos de paso** (estaban en el camino de lo que tocaba, no expandí más allá):
1. `backend-hetzner/webhook-pago.js` parseaba `external_reference` como JSON y usaba columnas de `pagos` que no existen (`mp_payment_id`, `worker_id`) — reescrito para igualar la lógica real de la versión Deno (metadata, `referencia_externa`, rama `company_suscripcion` que faltaba enteramente).
2. `backend-hetzner/generar-comprobante.js` esperaba campos (`descripcion`, `worker_id`) que no existen ni en la función real ni en la tabla `comprobantes` — corregido a `referencia_externa`/`concepto`.
3. Grant faltante: `service_role` no tenía SELECT sobre `config` en la base real — corregido (bloqueaba la lectura del `plan_id` de PayPal).

## ✅ Credenciales LIVE preparadas 2026-09-25 (creadas, NO activadas todavía)

Mismo patrón que el corte de DNS de Hetzner: preparar todo primero, cambiar el interruptor después con confirmación explícita aparte. Ya existe y está probado que las credenciales funcionan (`/v1/oauth2/token` real respondió con scopes válidos):

- App live creada en developer.paypal.com (la de sandbox NO la genera sola — son apps separadas).
- `PAYPAL_CLIENT_ID_LIVE` / `PAYPAL_SECRET_LIVE` guardados en `backend-hetzner/.env` del servidor (nunca pasaron por el chat).
- Producto + Plan reales creados en la cuenta live: `paypal_plan_id_sa_live = P-2D648079YR6208811NK3RDJY` (USD $1/60 días), guardado en `config` en ambas bases.
- Webhook live registrado: `PAYPAL_WEBHOOK_ID_LIVE = 1EV82076RX105122F`, mismo set de 4 eventos que sandbox.

**El código sigue usando las credenciales de sandbox (`PAYPAL_ENV=sandbox`) — nada de esto está activo todavía.** Pasar a producción real es UN solo cambio deliberado, cuando el usuario lo autorice explícitamente (mismo criterio que el corte de DNS):
1. En `backend-hetzner/.env`: renombrar `PAYPAL_CLIENT_ID_LIVE`→`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_LIVE`→`PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID_LIVE`→`PAYPAL_WEBHOOK_ID`, y `PAYPAL_ENV=live`. Mismo cambio en los secrets de la función Deno real.
2. En `config`: actualizar `paypal_plan_id_sa` al valor de `paypal_plan_id_sa_live`.
3. Probar UN pago real chico antes de anunciar nada.

**Pendiente antes de ese cambio (no antes de programar):**
- Probar con una tarjeta de un país distinto a Uruguay que la autorización de PayPal completa sin fricción real (no solo la creación del objeto) — recomendado hacerlo todavía en sandbox antes de pasar a live.
- Limpiar residuos de prueba: 1 usuario de auth (`test-verificacion-paypal-borrar@konexu.app`, no se pudo borrar sin `service_role` admin key a mano) y 2 suscripciones de sandbox sin autorizar (quedan huérfanas, sin costo, se pueden ignorar).


**Fecha:** 2026-09-25
**Alcance:** cobro recurrente de la activación del `worker` (tipo `worker_activacion`) vía **PayPal Subscriptions**. SMS y PIX quedan exactamente como están — pago único, sin recurrencia. MercadoPago sigue existiendo para todo lo demás (`company_suscripcion`, `employer_visualizaciones`) — no se toca.
**Por qué PayPal y no MercadoPago:** verificado en vivo (sandbox, ambos proveedores) el 2026-09-25 — MercadoPago Preapproval solo puede cobrar en la moneda del país de la cuenta (pesos uruguayos), visible sin excepción en la propia pantalla de autorización de MP para cualquier worker de cualquier país, no configurable. PayPal Subscriptions sí cobra siempre en USD, sin importar el país del pagador — confirmado creando de punta a punta un producto + plan (USD $1/60 días) + suscripción real en sandbox. Stripe quedó descartado — Uruguay no está en su lista de países soportados para cuenta de negocio.
**Cuenta PayPal:** creada 2026-09-25, persona física (sole proprietor, sin empresa/RUT/SAS), nombre comercial "Konexu", moneda principal USD, categoría "Agencias de empleo y servicios de ayuda temporal". Credenciales de **sandbox** (prueba) ya cargadas en `backend-hetzner/.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV=sandbox`) — faltan las de **live** (producción) antes de lanzar de verdad, se generan igual en developer.paypal.com con el toggle "View live credentials".
**Dispara este trabajo:** pedido explícito del usuario — que la activación del worker (hoy pago único de USD $1 SA / $2 mundo por 60 días) quede en modo recurrente por defecto, cobrando automáticamente cada 60 días salvo que el usuario lo desactive desde un menú.

## Contexto (verificado en el código, no supuesto)

- El pago de activación vive en `src/screens/worker/PagoActivacionScreen.js`. Hoy usa `checkout/preferences` de MercadoPago (pago único) vía la función `crear-pago`, para 4 métodos: MercadoPago, "Tarjeta" (mismo botón de MP por dentro, solo cambia el label), SMS, PIX. Esta feature agrega un 5to método (PayPal) y lo hace recurrente; los otros 4 no cambian.
- **Existía una promesa pública contraria** en `PagoActivacionScreen.js:226`: *"Pago único de USD $1 por 60 días. No se renueva automáticamente."* Se elimina, sin reemplazo — decisión explícita del usuario, ver sección Copy.
- **Dos copias del código de pago, hay que tocar las dos:** la real en Deno (`supabase/functions/crear-pago/index.ts`, `webhook-pago/index.ts` — la que usa la app HOY) y la portada a Node (`backend-hetzner/src/routes/crear-pago.js`, `webhook-pago.js` — para cuando pase el Corte 2 de la migración a Hetzner). Todo cambio se aplica en ambas copias en la misma tanda de trabajo.
- `profiles.suscripcion_activa` / `suscripcion_plan` **son del modelo de `company`** (spec hermana `2026-09-18-company-publicar-empleo-design.md`) — no se reutilizan acá. Esta feature usa columnas nuevas con prefijo `worker_`.
- `profiles.perfil_activo` / `perfil_activo_hasta` ya existen — `perfil_activo_hasta` pasa a doblar como "fecha del próximo cobro automático".
- `src/services/notifications.js:112` (`scheduleRenovacionReminder`) se reutiliza sin cambios para el aviso previo al cobro.
- No hay ningún worker activo hoy (app todavía no publicada) — no hace falta migrar usuarios existentes.

## Reglas del negocio (confirmadas con el usuario)

1. **Por defecto, recurrente:** al activarse vía PayPal, el worker autoriza una suscripción que cobra USD $1 (SA) / $2 (mundo) automáticamente cada 60 días.
2. **Cancelable en cualquier momento** desde un menú en su perfil. El perfil sigue activo hasta `perfil_activo_hasta`; solo no se lo vuelve a cobrar.
3. **Cobro fallido:** reintentar durante una ventana corta (~5 días) avisando por push en cada intento; si se agota sin éxito, `perfil_activo=false`.
4. **SMS y PIX no cambian** — pago único, como hoy.
5. **MercadoPago y "Tarjeta" (mismo botón) siguen existiendo tal cual hoy** — pago único de siempre, sin recurrencia. PayPal es la ÚNICA opción recurrente. El worker elige: pago único de siempre (MP/Tarjeta/SMS/PIX) o activación recurrente (PayPal).

## ✅ Verificación técnica (ya hecha, con resultados reales — no pendiente)

Probado en sandbox de PayPal el 2026-09-25, de punta a punta, sin dejar nada real activo:
1. `POST /v1/catalogs/products` → producto creado (`PROD-...`).
2. `POST /v1/billing/plans` con `billing_cycles: [{frequency:{interval_unit:"DAY",interval_count:60}, pricing_scheme:{fixed_price:{value:"1",currency_code:"USD"}}}]` → plan creado, `status:"ACTIVE"`.
3. `POST /v1/billing/subscriptions` con ese `plan_id` → suscripción creada, `status:"APPROVAL_PENDING"`, con un link `rel:"approve"` (URL de PayPal para que el pagador autorice).

**Conclusión:** el monto queda fijo en USD sin ninguna conversión a moneda local en ningún paso — exactamente lo que pedía el usuario. El link de aprobación es una URL normal, se abre igual que hoy el `init_point` de MercadoPago (`Linking.openURL`) — no hace falta WebView ni SDK nativo de PayPal.

**Diseño de objetos (evitar recrear Producto/Plan por cada worker):** el Producto y el Plan se crean **una sola vez** (monto plano USD $1, sin tramo SA/mundo — ver más abajo) y su ID se guarda en `config` (`paypal_plan_id_sa`) — igual que hoy `precio_sa`/`precio_mundo`. Cada activación nueva solo crea una **Subscription** (`POST /v1/billing/subscriptions`) contra el `plan_id` ya existente — no un producto/plan nuevo por usuario.

**Pendiente de probar (no bloqueante para diseñar, sí antes de lanzar):** que una tarjeta de un país distinto a Uruguay complete la autorización sin fricción — la creación de objetos ya está confirmada, falta el intento real de autorización con una tarjeta extranjera (o cuenta PayPal de otro país) al momento de implementar.

## Cambios de base de datos

### `profiles` — columnas nuevas (prefijo `worker_`)

```sql
alter table public.profiles
  add column if not exists worker_paypal_subscription_id text,
  add column if not exists worker_renovacion_automatica boolean not null default true,
  add column if not exists worker_intentos_cobro_fallido integer not null default 0;
```

- `worker_paypal_subscription_id`: id de la suscripción (`I-...`) que devuelve PayPal — necesario para poder cancelarla.
- `worker_renovacion_automatica`: `false` cuando el worker cancela desde el menú.
- `worker_intentos_cobro_fallido`: contador de reintentos tras un cobro fallido; se resetea a `0` en cada cobro exitoso.

### `config` — 2 filas nuevas

`paypal_plan_id_sa` — el `plan_id` reutilizable creado una sola vez (ver arriba). No hay `_world` — la activación del worker es monto plano para cualquier país.

### `pagos` — sin cambios de esquema

Se sigue usando `referencia_externa` (ya existe) — corrigiendo de paso el bug encontrado en `backend-hetzner/webhook-pago.js`, que hoy inserta con columnas (`mp_payment_id`, `worker_id`, `cantidad_perfiles`) que no existen en el esquema real (`backend-hetzner/database/schema.sql:1444`: solo `id, user_id, monto, moneda, estado, metodo, referencia_externa, created_at`). La versión Deno real ya usa `referencia_externa` correctamente.

## Flujo de pago (nuevo, solo para el botón PayPal de `worker_activacion`)

1. `PagoActivacionScreen` suma un 5to botón "PayPal — activación recurrente". Llama a `crear-pago` con `tipo:'worker_activacion_paypal'` (tipo nuevo y distinto de `worker_activacion`, para no tocar la rama existente que arma el `checkout/preferences` de MP).
2. La función obtiene un token OAuth (`POST /v1/oauth2/token`, Basic Auth con `PAYPAL_CLIENT_ID`/`PAYPAL_SECRET`), crea la Subscription contra el `plan_id` de `config` según el país del worker (`paypal_plan_id_sa` o `_world`, mismo criterio que `getPrecio()`), y devuelve el link `rel:"approve"`.
3. La app abre ese link con `Linking.openURL` (mismo patrón que ya usa para MP) — el worker autoriza en la página de PayPal.
4. PayPal notifica por webhook cuando la suscripción se activa.

## Webhook nuevo (`webhook-paypal`, archivo separado — no mezclar con `webhook-pago` que es 100% MercadoPago/HMAC)

PayPal manda eventos por su propio webhook, con verificación de firma propia (`POST /v1/notifications/verify-webhook-signature`, distinta al HMAC de MP). Eventos relevantes, configurados en la app de PayPal (developer.paypal.com → esta app → Webhooks):

- **`BILLING.SUBSCRIPTION.ACTIVATED`** (primera autorización): guarda `worker_paypal_subscription_id`, `perfil_activo=true`, `perfil_activo_hasta = now() + 60 días`.
- **`PAYMENT.SALE.COMPLETED`** (cada cobro recurrente exitoso): extiende `perfil_activo_hasta` otros 60 días, resetea `worker_intentos_cobro_fallido=0`, inserta en `pagos`.
- **`BILLING.SUBSCRIPTION.PAYMENT.FAILED`** (cobro fallido): incrementa `worker_intentos_cobro_fallido`, dispara push. Si supera el máximo dentro de ~5 días → `perfil_activo=false`.
- **`BILLING.SUBSCRIPTION.CANCELLED`**: `worker_renovacion_automatica=false` (por si se cancela directo desde la cuenta de PayPal del worker, no solo desde el menú de Konexu).

## Menú de cancelación (pantalla/sección nueva, worker)

Junto a `EditarPerfilScreen.js`:
- Texto: "Tu activación se renueva el **{perfil_activo_hasta formateado}**."
- Botón "Cancelar renovación automática" → función nueva (`cancelar-renovacion-worker`) que llama `POST /v1/billing/subscriptions/{worker_paypal_subscription_id}/cancel` y pone `worker_renovacion_automatica=false`.
- Si ya está cancelada, el botón pasa a "Reactivar" → crea una Subscription nueva (no se puede reactivar un id ya cancelado en PayPal).

## Notificaciones (reutiliza lo que ya existe)

- `scheduleRenovacionReminder` (`src/services/notifications.js:112`) sin cambios.
- Push nuevo en cada intento de cobro fallido.
- Push nuevo si se agota la ventana de reintentos y se desactiva el perfil.

## Copy legal — decisión final: se elimina, sin reemplazo

Se saca la línea 226 de `PagoActivacionScreen.js` — no se agrega ninguna leyenda nueva sobre la recurrencia en la pantalla de Konexu.

**Riesgo señalado y aceptado explícitamente por el usuario:** PayPal igual muestra monto y frecuencia en su propia pantalla de aprobación (eso no se puede quitar, es de PayPal, no de Konexu). Decisión del usuario: la pantalla de Konexu no agrega ningún aviso propio. Mitigación elegida: ante un reclamo por cobro no reconocido, se devuelve el monto directamente. No reabrir este punto sin que el usuario lo traiga de nuevo.

## Aplicar en 2 lugares (obligatorio)

Todo esto se implementa en `supabase/functions/crear-pago/index.ts` + un nuevo `supabase/functions/webhook-paypal/index.ts` (versión real, en producción hoy) Y en `backend-hetzner/src/routes/crear-pago.js` + `webhook-paypal.js` (para cuando pase el Corte 2). En la misma tanda de trabajo, nunca solo una de las dos.

## Fuera de alcance (explícito)

- Cambiar el botón MercadoPago/Tarjeta existente — sigue siendo pago único, tal cual hoy.
- SMS y PIX — sin cambios.
- Migración de usuarios ya activos — no aplica, no hay ninguno todavía.
- Credenciales **live** de PayPal — hoy solo hay sandbox cargado; generar y cargar las de producción es un paso aparte, antes de lanzar (no antes de programar).
- Corrección general de la migración a Hetzner del resto de columnas de `pagos` fuera de esta feature puntual.
