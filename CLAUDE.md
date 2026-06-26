# CLAUDE.md — Nexu / LaburarNuevo

Este archivo es leído automáticamente al inicio de cada sesión.
Mantenelo actualizado desde Obsidian. Es la memoria del proyecto.

---

## REGLAS DE TRABAJO

- Responder siempre en español
- No dar disculpas — solo resultados
- Verificar antes de proponer. No romper lo que funciona
- No hacer cambios sin autorización explícita
- El tiempo del usuario es vida — no perderlo en bucles

---

## EL PROYECTO

**Nexu** — app móvil marketplace de trabajo para LATAM
**Mercados principales:** Brasil, Argentina, México (en ese orden)
**Stack:** React Native + Expo, Supabase (PostgreSQL + Edge Functions), MercadoPago, Stripe
**Repo:** github.com/alejandrodslp-ops/LaburarNuevo
**Proyecto real:** `/Users/usuario/Desktop/Nexu/LaburarNuevo`
**IGNORAR:** `/Users/usuario/Desktop/IGNORAR_NO_USAR` — proyecto viejo, nunca usar
**NO TOCAR:** `backend-hetzner/` — carpeta de migración futura, solo activar cuando el usuario diga "migrar a Hetzner"

---

## INFRAESTRUCTURA

- **Supabase project ref:** `waevdcqdkovqaxkonlvj`
- **Deploy edge functions:** `supabase functions deploy <nombre> --project-ref waevdcqdkovqaxkonlvj`
- **Ejecutar SQL en producción:** `supabase db query --linked "<SQL>"` desde `/Users/usuario/Desktop/Nexu/LaburarNuevo`
- **Web:** Next.js en Vercel, dominio `nexu.fyi`, proyecto `ale-s-projects8/web`
- **Tunnel Expo:** `npx expo start --tunnel` (el router tiene AP isolation, no funciona LAN)
- **Script de inicio:** `/Users/usuario/Desktop/nexu_start.command`

---

## PAGOS

- **MercadoPago:** configurado y funciona. MP_ACCESS_TOKEN en Supabase Secrets
- **CONFIRMADO:** MP Uruguay acepta Visa/Mastercard de CUALQUIER país del mundo (Brasil, México, USA, etc.)
- **PIX y OXXO:** no disponibles vía MP Uruguay. Banco Rendimento Brasil en validación (no bloqueante)
- **Stripe:** configurado en Supabase Secrets, pendiente implementar PaymentSheet en app
- El beneficiario se identifica por el MP_ACCESS_TOKEN — no hay confusión posible

---

## ROLES DE USUARIO

- **worker** — trabajador, completa perfil, recibe propuestas
- **employer** — empleador, paga para desbloquear perfiles
- **company** — empresa, flujo separado

---

## ADMIN SCREEN

- **Ruta:** `src/screens/admin/AdminScreen.js`
- Edge function: `admin-data` (service role, bypasea RLS)
- Tabs: Panel, Usuarios, Pagos, Consultas, Waitlist, Reportes, Campañas, Scraper
- **Consultas → Todos los llamados:** índice `idx_concursos_activo_created` creado en producción para evitar timeout
- **Scraper tab:** usa `scraper_stats` en admin-data con `count: estimated` desde service role

---

## BASE DE DATOS CLAVE

- **concursos:** 219k+ registros activos, scraped de 33 países
- **Índices importantes en concursos:**
  - `idx_concursos_activo_created` — ON concursos(created_at DESC) WHERE activo=true
  - `idx_concursos_pais_activo` — ON concursos(pais, activo)
- **PostgREST max_rows=1000:** count:exact devuelve 1001 para tablas con >1000 filas — usar estimated desde service role o RPC que devuelva pocas filas
- **Función SQL:** `count_concursos_por_pais()` — GROUP BY pais WHERE activo=true

---

## PENDIENTES URGENTES

- [x] `fix_notificaciones.sql` — push_token en profiles ✅, realtime propuestas/mensajes ✅ (2026-06-17)
- [x] `fix_rls_completo.sql` — RLS profiles/ofertas/pagos ya estaba correcto en producción ✅ (2026-06-17)
- [x] `fix_cron_definitivo.sql` — 4 cron jobs activos y corriendo ✅ (ya estaban)
- [x] EAS Project ID — ya estaba configurado en app.json ✅
- [x] Rotar service_role key — hecho en sesión anterior ✅
- [ ] Implementar Stripe PaymentSheet en PagoActivacionScreen (requiere EAS dev build)

## PARA LANZAR — ACCIONES MANUALES PENDIENTES

- [ ] **Google Cloud:** registrar tarjeta de crédito → console.cloud.google.com/billing
- [ ] **MercadoPago:** activar credenciales de producción + actualizar MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET
- [ ] **Stripe:** configurar claves reales de producción
- [ ] **Email:** crear dominio propio (nexu.app o similar) y verificar en Resend
- [ ] **EAS Build:** generar build nativo para push notifications y deep links

---

## DISEÑO APROBADO — NO TOCAR

- **Logo:** "Nexu" + emoji 🧩 pequeño superpuesto esquina inferior derecha
- **WelcomeScreen:** gradiente navy, borde coral, tagline en Playfair Display Bold Italic
- **Sistema de referidos:** link con ?r=CODIGO oculto, nunca mostrar el código al usuario
- **Mensajes de bienvenida:** aprobados, no modificar

---

## SEGUNDO PROYECTO EN COLA

**Tecnobio Uruguay** — plataforma web de ventas para productos agropecuarios biológicos (CRM, email, WhatsApp bot, pedidos, pagos)
