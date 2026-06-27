# Konexu — Checklist de lanzamiento

Todo lo que hay que tener listo antes de abrir al público.
Se va actualizando a medida que avanza el desarrollo.

---

## 🔴 BLOQUEANTES — sin esto la app no funciona o genera pérdidas

- [x] **SEGURIDAD — datos sensibles de profiles** ✅ COMPLETO (2026-06-26). Las 5 etapas cerradas:
  visualizaciones (plata), perfil_activo/prueba, métricas (rating/vistas/contactos), referidos, y 4B
  (lectura de datos privados). Más: verificación de email obligatoria + smoke tests (8/8). Detalle por etapa abajo.
  - [x] **Etapa 1 — `visualizaciones_disponibles` (plata)** protegida con trigger `trg_proteger_profiles` (2026-06-26).
    Un atacante ya no puede regalarse perfiles pagos. Webhook/RPC siguen acreditando. Verificado.
    SQL: `supabase/sql/seguridad_etapa1_visualizaciones.sql`
  - [x] **Etapa 2 — `perfil_activo` / prueba gratis** (2026-06-26). Prueba gratis = UNA SOLA VEZ.
    Activación movida a edge function `activar-prueba` (usa `fecha_activacion` como marca). El guardián
    bloquea que el cliente se active (false→true) o extienda `perfil_activo_hasta`; sí permite pausarse.
    Verificado. ⚠️ La app debe estar actualizada (usa la edge function) para activar la prueba.
    SQL: `supabase/sql/seguridad_etapa2_perfil_activo.sql`
  - [x] **Etapa 3 — `rating`/`estrellas`/`vistas`/`contactos`** (2026-06-26). Pasaron a triggers server-side:
    `recalcular_estrellas` ampliado (rating+total_valoraciones), `on_visualizacion_insert` (vistas),
    `on_propuesta_insert` (contactos). El cliente ya no las escribe; el guardián las protege. Verificado.
    SQL: `supabase/sql/seguridad_etapa3_metricas.sql`
  - [x] **Etapa 4A — referidos** (2026-06-26). `acreditarReferido` movido a edge function
    `acreditar-referido` (service_role). Reparó de paso el premio de referidos que Etapa 2 había
    roto sin querer. Guardián protege `referido_por`/`codigo_referido`/`periodo_gratis_hasta`. Verificado.
    SQL: `supabase/sql/seguridad_etapa4_referidos.sql`
  - [x] **Etapa 4B — datos privados expuestos por lectura** (2026-06-26). CERRADO.
    Antes, cualquier cuenta logueada leía por API directa columnas privadas de TODOS (telefono, email_otp,
    push_token, etc.). Fix con vista pública + política restrictiva (sin migrar datos, sin tocar las
    lecturas del propio perfil):
    - Vista `perfiles_publicos` (solo columnas públicas, sin datos privados) — `seguridad_etapa4b_vista_publica.sql`
    - Política `profiles_select` cerrada a `auth.uid()=id` (cada uno lee solo su fila) — `seguridad_etapa4b_politica.sql`
    - Migradas 6 lecturas de terceros a la vista: app (Buscar, Mensajes, Historial, Chat) + web (candidatos).
    - Verificado: ve_perfil_ajeno=0, ve_perfil_propio=1, vista=7. Smoke test de privacidad agregado (8/8).
    - Bug aparte corregido: la web candidatos filtraba por `activo` (columna inexistente) → `perfil_activo`.
  - [x] **(bug de plata, 2026-06-26)** El descuento de visualizaciones nunca funcionaba (el cliente
    llamaba `sumar_visualizaciones(-1)`, sin permiso y con check `<=0`) → un empleador veía perfiles
    infinitos con una sola compra. Arreglado con RPC `consumir_visualizacion(p_worker)` (auth.uid,
    atómico, idempotente, descuenta del propio saldo). SQL: `supabase/sql/fix_consumir_visualizacion.sql`
  - [x] **(bug, 2026-06-26)** Calificar insertaba `rol_calificador='empleador'` (inválido) → cambiado a
    `'employer'` en PerfilTrabajadorScreen. (CalificacionModal ya usaba el valor correcto por variable.)

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

- [ ] **Publicar OTA antes del lanzamiento** — `eas update --branch production --message "..."`
  Todos los cambios de JavaScript de la app (recuperación de contraseña, pagos por MercadoPago,
  seguridad de profiles, descuento de visualizaciones, verificación de email obligatoria, auto-salto
  de fecha, etc.) están en el código y en GitHub, pero **NO llegan a los usuarios con el build
  instalado hasta correr este comando**. El backend (triggers/edge functions) ya está activo aparte.
  - Solo empuja JavaScript, no cambios nativos. runtimeVersion debe coincidir (hoy `1.0.0` ✅).
  - No aplica a Expo Go (eso recarga de Metro). Requiere estar logueado en EAS (cuenta `nexuapp`).
  - Conviene publicar primero a `--branch preview` y probar, luego a `production`.

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

- [ ] **Refrescar el contador de concursos más seguido** (hoy va atrasado).
  El número que muestra la app sale de la tabla `stats` (key `concursos_activos`), que se recalcula desde
  `stats_por_pais`. Pero `refresh-stats-por-pais` corre **1×/día (04:00 UTC)** → el número queda atrasado
  todo el día (los concursos nuevos no se ven hasta el día siguiente). Mejora: recalcular más seguido
  (ej. después de cada corrida del scraper, o cada pocas horas). OJO: el recálculo es un COUNT por país
  sobre ~316k filas (pesado); un COUNT mal manejado ya causó una caída (ver memoria). Hacer con cuidado.

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

  **CÓMO PAGAR desde Uruguay (sin agente) — investigado 2026-06-27:**
  - 🟢 **EUIPO (Unión Europea):** vos directo en euipo.europa.eu. Tarjeta Visa/Mastercard internacional
    (método recomendado para no-residentes), en euros, dentro de 1 mes de presentar. Lo más simple.
  - 🟢 **Brasil (INPI):** vos directo. Generar la GRU en gru.inpi.gov.br/emarcas → pagar por PagTesouro
    con tarjeta Visa/Mastercard internacional. PIX y boleto NO sirven desde el exterior, pero la tarjeta sí.
  - 🔴 **Argentina (INPI):** NO acepta tarjeta extranjera. Pago solo por VEP (requiere cuenta bancaria
    ARGENTINA: Banelco/Link/Interbanking) o VP (presencial en Banco Nación). Además, obligatorio constituir
    domicilio especial en CABA. DIY solo posible si: (a) un contacto en Argentina paga el VEP desde su
    homebanking + presta dirección en CABA, o (b) viajar a Argentina. Sin eso, queda trabado.

---

## 📈 CRECIMIENTO / TRÁFICO DE LA WEB

- [x] **Google Indexing API — indexación rápida** ✅ (2026-06-27). Los concursos nuevos aparecen en
  Google for Jobs en minutos/horas en vez de días. Edge function `notificar-indexacion` + cron cada 6h
  (00/06/12/18 UTC, `notificar-indexacion-google`). Credencial en secret `GOOGLE_INDEXING_SA_KEY`
  (service account `konexu-indexing@nexu-vision.iam.gserviceaccount.com`, Owner en Search Console).
  Config documentada en `supabase/functions/notificar-indexacion/CONFIGURAR.md`. Cuota Google: 200 URLs/día.
  La web ya tiene lo demás: schema JobPosting por empleo, SEO programático por país/categoría, sitemap dinámico.

- [ ] **IndexNow — indexación rápida en Bing/Yandex/IA** (bajo esfuerzo, hacer primero).
  Es lo mismo que la Indexing API de Google pero para Bing, Yandex, DuckDuckGo, Ecosia. Bing alimenta a
  ChatGPT/Copilot → estar indexado ahí = aparecer cuando alguien le pregunta a una IA por empleos.
  Mucho más simple que Google: NO necesita service account ni Search Console, solo una clave (archivo de
  texto) en el sitio. Gratis, sin cuotas estrictas. Se engancha a la misma función `notificar-indexacion`
  (cuando avisa a Google, avisa también a IndexNow). **Prioridad 1** por relación impacto/esfuerzo.

- [ ] **Bot de Telegram (y/o WhatsApp) — tráfico directo y recurrente** (esfuerzo medio, alto impacto).
  Un bot que publica automáticamente cada concurso nuevo en canales por país ("Empleos Uruguay",
  "Concursos México", etc.) con título + link a la web. Por qué importa: en LATAM la gente busca empleo
  más en grupos de WhatsApp/Telegram que en Google (grupos con decenas de miles). Beneficios: tráfico
  directo (cada post = visitas), audiencia que vuelve (suscriptores reciben los nuevos), crecimiento
  orgánico (la gente reenvía). Complementa a Google: Telegram trae a quien NO busca activamente pero le
  interesa. Telegram es ideal para canales de difusión (WhatsApp es más restrictivo). Crear los canales =
  el usuario; el bot lo programa Claude (similar a notificar-indexacion). **Prioridad 2.**

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
