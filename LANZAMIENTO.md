# Nexu — Checklist de lanzamiento

Todo lo que hay que tener listo antes de abrir al público.
Se va actualizando a medida que avanza el desarrollo.

---

## 🔴 BLOQUEANTES — sin esto la app no funciona o genera pérdidas

- [ ] **Google Cloud — registrar tarjeta de crédito**
  La Vision API key (moderación de fotos de perfil) está configurada pero sin método de pago.
  Sin tarjeta, Google bloquea la key cuando supera las 1.000 imágenes/mes gratis.
  → https://console.cloud.google.com/billing

- [x] **Supabase — `backend/.env`** ✅ No aplica
  El `backend/server.js` no se usa — la app conecta directo a Supabase Edge Functions.

- [x] **Supabase — SQL del schema aplicado en producción** ✅
  14/14 statements OK — índices, columnas updated_at, triggers, fecha_cierre→TIMESTAMPTZ

- [ ] **MercadoPago — credenciales de producción**
  Actualmente la app usa credenciales de prueba (`TEST-...`). Antes de lanzar:
  1. Completar evaluación de integración en el panel de MP
  2. Activar credenciales productivas
  3. Actualizar `MP_ACCESS_TOKEN` en Supabase Edge Functions Secrets
  → https://www.mercadopago.com.ar/developers/panel

- [ ] **MercadoPago — `MP_WEBHOOK_SECRET` en producción**
  El secret configurado es del entorno de prueba. Al activar producción, MP genera un nuevo
  secret para el webhook productivo. Actualizar en Supabase Secrets.

- [ ] **Stripe — configurar claves reales**
  `backend/.env` tiene placeholders para `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
  Reemplazar con las claves productivas desde https://dashboard.stripe.com

- [x] **App móvil — `HASH_SALT`** ✅ No aplica
  No se referencia en ningún archivo del código móvil.

- [x] **Supabase — key rotada** ✅
  Key vieja revocada. Nueva key activa en .env.local, scraper-sa/.env.local y cron jobs.

---

## 🟠 IMPORTANTES — afectan la experiencia del usuario

- [ ] **Email real para notificaciones**
  Actualmente se usa `onboarding@resend.dev` (dominio de prueba de Resend).
  Crear dominio propio (ej: nexu.app) y verificarlo en Resend para usar `noreply@nexu.app`.

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

- [ ] **Stripe — integrar `PaymentSheet` en mobile**
  El backend ya tiene `/payments/stripe-intent`. La pantalla `PagoActivacionScreen`
  obtiene el `client_secret` pero falta integrar `@stripe/stripe-react-native` con
  el `PaymentSheet`. Requiere dev build de Expo.

- [ ] **Abitab / Saldo celular — integrar proveedores locales**
  `PagoActivacionScreen` muestra estos métodos pero tiran error "próximamente".
  Integrar cuando haya acuerdo con los proveedores.

---

## 🟡 RECOMENDADOS — para una operación estable

- [x] **Configurar `RESEND_API_KEY` en Supabase Edge Functions Secrets** ✅
  Funcionando — comprobantes, alertas y reportes diarios llegan correctamente.

- [ ] **Cron jobs de scraper — verificar que estén activos**
  Los 4 jobs (`scraper-concursos-manana`, `-resumen`, `-mediodia`, `-noche`) se crearon
  via edge function. Confirmar en:
  → https://supabase.com/dashboard/project/waevdcqdkovqaxkonlvj/integrations/cron

- [ ] **Google Vision API — configurar límite de gasto mensual**
  Agregar un budget alert en Google Cloud para no recibir sorpresas.
  → console.cloud.google.com → Billing → Budgets & Alerts

- [ ] **Variables de entorno en producción del backend Node.js**
  Si se despliega `backend/server.js` en un hosting (Railway, Render, etc.), configurar
  todas las variables de `backend/.env` en el panel del hosting.

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
