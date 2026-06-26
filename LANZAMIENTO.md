# Konexu — Checklist de lanzamiento

Todo lo que hay que tener listo antes de abrir al público.
Se va actualizando a medida que avanza el desarrollo.

---

## 🔴 BLOQUEANTES — sin esto la app no funciona o genera pérdidas

- [ ] **SEGURIDAD — escrituras del cliente a columnas sensibles de profiles** (por etapas)
  La política RLS de UPDATE en profiles es abierta: cualquier cuenta autenticada podía modificar
  columnas sensibles (suyas y de otros). Se cierra por etapas, moviendo cada flujo al servidor.
  - [x] **Etapa 1 — `visualizaciones_disponibles` (plata)** protegida con trigger `trg_proteger_profiles` (2026-06-26).
    Un atacante ya no puede regalarse perfiles pagos. Webhook/RPC siguen acreditando. Verificado.
    SQL: `supabase/sql/seguridad_etapa1_visualizaciones.sql`
  - [x] **Etapa 2 — `perfil_activo` / prueba gratis** (2026-06-26). Prueba gratis = UNA SOLA VEZ.
    Activación movida a edge function `activar-prueba` (usa `fecha_activacion` como marca). El guardián
    bloquea que el cliente se active (false→true) o extienda `perfil_activo_hasta`; sí permite pausarse.
    Verificado. ⚠️ La app debe estar actualizada (usa la edge function) para activar la prueba.
    SQL: `supabase/sql/seguridad_etapa2_perfil_activo.sql`
  - [ ] **Etapa 3 — `rating`/`estrellas`/`vistas`/`contactos`:** mover calificar y contadores
    (PerfilTrabajadorScreen) a edge functions/RPC; luego sumarlas al trigger.
  - [ ] **Etapa 4 — `referido_por`/`codigo_referido`** a edge function (ver migración Hetzner);
    y **lectura de teléfono** solo tras pago confirmado (hoy el SELECT de profiles es abierto).
  - [ ] **(bug aparte, no seguridad)** El RPC `sumar_visualizaciones` rechaza `cantidad <= 0`, así que el
    "restar -1" del cliente (PerfilTrabajadorScreen:266) nunca descuenta. Revisar cómo se descuenta una vista.

- [ ] **Google Cloud — registrar tarjeta de crédito**
  La Vision API key (moderación de fotos de perfil) está configurada pero sin método de pago.
  Sin tarjeta, Google bloquea la key cuando supera las 1.000 imágenes/mes gratis.
  → https://console.cloud.google.com/billing

- [x] **Supabase — SQL del schema aplicado en producción** ✅
  14/14 statements OK — índices, columnas updated_at, triggers, fecha_cierre→TIMESTAMPTZ

- [x] **MercadoPago — credenciales de producción** ✅
  Token productivo activo en Supabase Secrets. Pagos funcionando en producción. (2026-06-22)

- [x] **MercadoPago — `MP_WEBHOOK_SECRET` en producción** ✅
  Secret productivo configurado en Supabase Secrets. (2026-06-22)

- [x] **Stripe — DESCARTADO** ✅ No aplica
  Stripe no es operable desde Uruguay. Pagos por tarjeta internacional van por MercadoPago.
  PIX + saldo celular irán por Boku (requiere SAS — ver sección negocio).

- [x] **Supabase — key rotada** ✅
  Key vieja revocada. Nueva key activa en .env.local, scraper-sa/.env.local y cron jobs.

---

## 🟠 IMPORTANTES — afectan la experiencia del usuario

- [x] **Email real para notificaciones** ✅
  Dominio konexu.app verificado en Resend (sa-east-1). Emails salen desde noreply@konexu.app. (2026-06-22)

- [ ] **Deep links nativos configurados (`nexu://`)**
  Los redirects de MercadoPago y el flujo de verificación de email usan `nexu://`.
  Requieren build nativo (EAS Build) con el scheme configurado en `app.json`.
  No funciona en Expo Go.

- [ ] **Build nativo (EAS Build) para producción**
  Push notifications, deep links y Stripe PaymentSheet requieren un dev/production build.
  No funcionan en Expo Go.

- [ ] **Push notifications — APNs (iOS) y FCM (Android)**
  Configurar en el panel de EAS y en los dashboards de Apple/Google.
  Requerido para que `notificar-matches` y `notificar-propuesta` lleguen a los usuarios.

- [ ] **Saldo celular / PIX — Boku**
  `PagoActivacionScreen` muestra estos métodos pero tiran "próximamente".
  Requiere: SAS Uruguay constituida → contactar cspub@boku.com → aprobación 4-8 semanas por país.
  Países: Uruguay, Brasil (PIX + DCB), México, Argentina.

- [ ] **Email de recuperación de contraseña — SMTP propio (Resend)**
  Hoy los correos de "Olvidé mi contraseña" salen por el servidor por defecto de Supabase,
  que tiene límite de pocos envíos por hora (sirve para pruebas, no para volumen real).
  → Conectar el Resend ya verificado (konexu.app) en Supabase → Authentication → Emails → SMTP Settings.
  Beneficio: sin límite bajo, mejor llegada (menos spam), remitente konexu.app.
  ✅ Flujo de recuperación implementado y validado end-to-end el 2026-06-26 (app + web konexu.app/recuperar).

---

## 🟡 RECOMENDADOS — para una operación estable

- [x] **Configurar `RESEND_API_KEY` en Supabase Edge Functions Secrets** ✅
  Funcionando — comprobantes, alertas y reportes diarios llegan correctamente.

- [x] **Cron jobs de scraper — activos y verificados** ✅ (2026-06-17)
  Los 4 jobs están corriendo: manana(06:00 UTC), resumen(06:30), mediodia(15:00), noche(23:00)

- [ ] **Google Vision API — configurar límite de gasto mensual**
  Agregar un budget alert en Google Cloud para no recibir sorpresas.
  → console.cloud.google.com → Billing → Budgets & Alerts

- [ ] **Variables de entorno en producción del backend Node.js**
  Si se despliega `backend/server.js` en un hosting (Railway, Render, etc.), configurar
  todas las variables de `backend/.env` en el panel del hosting.

---

## 🏢 NEGOCIO — para operar formalmente y recibir pagos sin tarjeta

- [ ] **Google Play Developer account** — USD 25, pago único. Sin esto no se puede publicar en Android.
  → play.google.com/console. Solo necesitás cuenta Google + tarjeta. No requiere empresa.

- [ ] **Apple Developer account** — USD 99/año. Sin esto no hay build iOS ni publicación en App Store.
  → developer.apple.com. Podés empezar como Individual (persona física, sin empresa).
  Si querés cuenta Organization necesitás DUNS number (requiere empresa).

- [ ] **SAS Uruguay** — ~USD 60 solo (con firma electrónica avanzada en cédula).
  Necesaria para: abrir cuenta bancaria empresarial + registrarse en Boku.
  No abrir hasta estar cerca del primer cobro real — los costos corren desde el primer mes (~USD 400/mes entre BPS + DGI + contador).
  Proceso 100% online desde la Mac en gub.uy → Registro SAS.

- [ ] **Boku (PIX + saldo celular)** — contactar cspub@boku.com después de tener la SAS.
  Portal: merchants-portal.boku.com. Proceso: registro → integración SDK (1 semana) → aprobación operadoras (4-8 semanas/país).
  Documentos que van a pedir: certificado SAS, prueba de domicilio, extracto bancario empresarial, DNI del director, URL del servicio + T&C.

- [ ] **Trademark — extender a Brasil y México** — plazo límite 2026-12-22 (Convenio de París).
  No requiere empresa, se hace como persona física.
  - Brasil (INPI): R$ 880 (~USD 170) por las 2 clases (35+42). Persona física tiene 50% de descuento automático. Incluye 10 años. → inpi.gov.br
  - México (IMPI): ~$5,628 MXN (~USD 290) por las 2 clases online (10% descuento por trámite web). → impi.gob.mx
  - Argentina (INPI AR): consultar aranceles actuales → portaltramites.inpi.gob.ar/InfoPortal/Aranceles (valores en pesos argentinos cambian frecuentemente)

  **Cómo presentar — NO como primaria, sino como reivindicación de prioridad:**
  En Brasil y México NO se presenta como solicitud nueva/primaria. Se usa el mecanismo del
  Convenio de París (Art. 4): "reivindicación de prioridad unionista".
  Esto le dice a cada país que la fecha de prioridad es la de Uruguay (2026-06-22).

  Que la solicitud uruguaya esté pendiente (sin resolución aún) es normal y esperado —
  el Convenio de París no exige que el país de origen haya aprobado, solo que hayas presentado.
  No la van a rechazar por eso.

  Datos que hay que presentar en cada país:
  - País de origen: Uruguay
  - Número de solicitud uruguaya (el que se recibió al registrar)
  - Fecha: 2026-06-22
  - Copia del documento: se obtiene vía WIPO DAS (sistema electrónico entre oficinas, sin papel físico)
  - México agrega un pago extra por el estudio de reconocimiento de la prioridad extranjera

  Seleccionar la opción "reivindicación de prioridad" en el formulario online de cada oficina
  e ingresar los datos de la solicitud uruguaya. No presentar como primaria.

---

## ✅ YA LISTO

- [x] RLS completo en todas las tablas de Supabase
- [x] JWT verificado con firma real en `admin-data`
- [x] `ADMIN_SECRET` fuera del código fuente → Supabase Secrets
- [x] Google Vision API key fuera del bundle → edge function `verificar-imagen`
- [x] Vision API solo se llama cuando el usuario pagó (perfil_activo + hasta vigente)
- [x] Webhook de MercadoPago idempotente + firma HMAC verificada
- [x] `crear-pago` requiere JWT válido
- [x] `sumar_visualizaciones` solo invocable por service_role
- [x] Cron jobs configurados (3am, 3:30am, 12pm, 8pm Uruguay)
- [x] Índices críticos en pagos, profiles, reportes, concurso_matches
- [x] `fecha_cierre` migrada de DATE a TIMESTAMPTZ en concursos
- [x] Secretos de admin quitados del bundle del APK
- [x] Vigilante scraper — auto-recuperación diaria sin intervención manual
- [x] Scraper Brasil regex fix + nuevas fuentes → 8.056 llamados activos (32 países)
- [x] Búsqueda diaria personalizada para trabajadores informales (campo libre + web)
- [x] Sugerencias ortográficas + diccionario de 60+ variantes fonéticas
- [x] Code review + security review completo del código mobile, web y Supabase
- [x] `web/.env.local` — SUPABASE_SERVICE_KEY corregida (era anon key)
