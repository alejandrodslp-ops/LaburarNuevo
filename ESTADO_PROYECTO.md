# Estado del Proyecto — Laburar (Nexu)
**Última actualización: 03 junio 2026 (sesión actual)**

---

## Qué es el proyecto
App móvil de empleo para trabajadores y empleadores de Latinoamérica, construida con React Native (Expo Go). Conecta trabajadores con empleos públicos (concursos oficiales) y privados (job boards), y a empleadores con trabajadores calificados.

**Stack:** React Native + Expo · Supabase (PostgreSQL + Auth + Edge Functions) · Stripe · GitHub Actions

---

## Pantallas que existen

| Pantalla | Estado |
|---|---|
| Onboarding / Login / Registro | ✅ Completo |
| HomeScreen (trabajador) | ✅ Renovado |
| ConcursaScreen | ✅ Renovado |
| ConcursaDetalleScreen | ✅ Completo |
| MensajesScreen + ChatScreen | ✅ Funcionando |
| PerfilScreen (trabajador) | ✅ Funcionando |
| EditarPerfilScreen | ✅ Funcionando |
| BuscarScreen (empleador) | ✅ Funcionando |
| PerfilTrabajadorScreen | ✅ Funcionando |
| PagoScreen / PagoActivacionScreen | ✅ Funcionando |
| HomeEmpresaScreen / BuscarEmpresaScreen | ✅ Funcionando |
| PropuestaScreen / EncuestaRechazoScreen | ✅ Funcionando |
| AdminScreen | ✅ Completo — ver detalle abajo |
| WaitlistScreen | ✅ Nuevo — lista de espera |
| VerificarTelefonoScreen | ✅ Nuevo — verificación de teléfono vía email OTP |

---

## Funcionalidades creadas y pendientes de activación

### 🟡 PIX Inteligente — sistema de cobro automático para Brasil

**Contexto:** El mercado principal de Nexu es Brasil. Los trabajadores brasileños pagan via PIX (sistema de pago instantáneo del Banco Central de Brasil). El desafío era cómo recibir PIX desde Uruguay sin entidad legal brasileña y activar automáticamente el perfil del usuario sin intervención manual.

**Solución diseñada:** Un sistema en tres partes que usa el estándar EMVCo de PIX para embeber el ID del usuario dentro del código de pago, un monitor de Gmail gratuito (Google Apps Script) que detecta la notificación de pago de Banco Rendimento, y un webhook de Nexu que activa el perfil automáticamente.

**Estado:** Código creado y listo. Pendiente de activar cuando Banco Rendimento apruebe la cuenta CNR (Conta de Não Residente) — solicitud enviada el 03/06/2026, aprobación esperada en 2-3 días hábiles.

**Archivos creados (NO deployados):**
- `supabase/functions/gerar-pix/index.ts` — genera código PIX único por usuario con su ID embebido en el campo `referenceLabel` del estándar EMVCo
- `supabase/functions/ativar-via-pix/index.ts` — recibe la señal del monitor y activa el perfil del usuario
- `scripts/monitor-pix-rendimento.gs` — Google Apps Script (gratis) que monitorea Gmail cada 60 segundos buscando notificaciones de pago de Rendimento, extrae el ID del usuario y llama al webhook

**Para activar:**
1. Esperar aprobación de Banco Rendimento
2. Obtener clave PIX de Rendimento
3. Agregar `PIX_KEY_RENDIMENTO` y `PIX_WEBHOOK_SECRET` en Supabase Secrets
4. Deployar `gerar-pix` y `ativar-via-pix`
5. Crear cuenta Google dedicada (pagos-nexu@gmail.com)
6. Pegar `monitor-pix-rendimento.gs` en script.google.com y activar trigger cada 1 minuto
7. Abrir MercadoPago Brasil con la cuenta de Rendimento para PIX dinámico con confirmación directa (sin Gmail)

---

### 🟡 iOS Live Activities — confirmación de pago en Dynamic Island

**Contexto:** Cuando un usuario paga PIX, abandona Nexu para ir a su banco. El problema es hacer que sepa que el pago fue confirmado sin necesidad de volver manualmente a la app. En iOS, las notificaciones push requieren permiso del usuario — que algunos niegan.

**Solución diseñada:** iOS Live Activities (introducido en iOS 16.1) permite mostrar información en tiempo real en la Dynamic Island (la pastilla negra del iPhone) y en la pantalla de bloqueo, sin necesitar permiso de notificaciones. El usuario ve en la pastilla: "Pago PIX pendiente → ✓ Confirmado" mientras está en su banco, sin tocar nada.

**Estado:** Código Swift creado, listo para integrar al build nativo. Pendiente de conectar al `app.json` y al `PagoActivacionScreen` cuando se autorice.

**Archivos creados (NO activados):**
- `ios/NexuLiveActivity/NexuLiveActivity.swift` — vista Swift de la Dynamic Island y Lock Screen con tres estados: esperando (teal), confirmado (verde), error (coral)
- `ios/NexuLiveActivity/NexuLiveActivity-Info.plist` — configuración del Widget Extension para Xcode
- `src/services/liveActivity.js` — servicio JS que controla el Live Activity desde la app React Native

**Para activar:**
1. Autorizar modificación de `app.json` para agregar el plugin del Widget Extension
2. Autorizar modificación de `PagoActivacionScreen.js` para llamar a `iniciarLiveActivityPIX()` cuando el usuario toca "Pagar PIX" y `atualizarLiveActivityPIX()` cuando se confirma el pago
3. Hacer nuevo EAS Build para compilar el código nativo Swift
4. Solo funciona en iOS 16.1+ con build nativo (no Expo Go)

---

## Historial de cambios

### 17 mayo 2026 — Sesión 9

#### Scraper y matching — reescritura completa

**Problema raíz resuelto**: el total de llamados en el admin no aumentaba porque:
1. GitHub Actions corre `scraper-sa/index.js` (Node.js), NO el Edge Function `scraper-concursos`
2. El viejo `scraper-sa` solo tenía 5 países y todos fallaban porque apuntaban a SPAs renderizadas por JS que no servían datos estáticos
3. Google News RSS (la fuente usada en el Edge Function) está bloqueado desde servidores de Supabase sa-east-1 (Brasil)
4. Indeed RSS devuelve HTTP 403 desde GitHub Actions IPs (siempre)

**Solución aplicada:**
- `scraper-sa/index.js`: reescritura total, cubre 28 países con fuentes adecuadas
  - UY: RSS oficial uruguayconcursa.gub.uy ✓
  - BR: HTML pciconcursos.com.br ✓
  - CO: HTML cnsc.gov.co ✓
  - PY: HTML sfp.gov.py con bypass SSL ✓ (cert inválido → `insecure: true`)
  - AR/CL/PE/etc: portales gubernamentales accesibles, CSS selectors actualizados
  - DE: API Bundesagentur para Arbeit (`X-API-Key: jobboerse-jobsuche`)
  - IT: RSS tuttoconcorsi.it + HTML InPA
  - FR: RSS choisirleservicepublic.gouv.fr
  - GB: RSS Civil Service Jobs
  - US: API USAJobs (`data.usajobs.gov`)
  - CA: RSS GC Jobs
  - AU: API APSJobs
  - Eliminado Indeed de todos los scrapers (siempre 403 desde GitHub Actions)
  - Deduplicación por `fuente_id` en el `upsert` antes de enviar a Supabase (corrige error de Colombia)
  - Logs de error detallados (HTTP status + mensaje) para diagnóstico

- `match-concursos` Edge Function: matching multilingüe
  - `PAIS_LANG`: mapea código de país → idioma (DE→de, FR→fr, IT→it, PT→pt, GB→en, etc.)
  - `TR`: mapa de ~150 términos canónicos español → de/pt/en/fr/it
  - `expandirKeyword()`: para cada keyword del perfil genera `[español, traducción]`
  - El score ahora matchea perfiles en español contra llamados en alemán, inglés, etc.

- `scraper-concursos` Edge Function: same fix (no corre automático, solo manual)
  - Reemplazó Google News RSS por Indeed RSS + APIs oficiales por país

- `src/data/oficios.js`: agregadas traducciones al alemán (`de:`) en todos los mapas

**Resultado actual (por run):**
| País | Llamados | Fuente |
|------|----------|--------|
| 🇺🇾 Uruguay | 368 | RSS oficial |
| 🇧🇷 Brasil | 466 | pciconcursos.com.br |
| 🇨🇴 Colombia | 40 | cnsc.gov.co |
| 🇵🇾 Paraguay | 2 | sfp.gov.py |
| **Total** | **876** | |

El resto de países retornan 0 porque sus portales gubernamentales bloquean IPs de GitHub Actions (Azure) o han cambiado de URL. Los logs ahora muestran el error exacto para poder hacer diagnóstico futuro.

**Correcciones técnicas:**
- `ws` package agregado a `scraper-sa/package.json` — Supabase JS necesita WebSocket en Node < 22
- `realtime: { transport: ws }` en `createClient()` del scraper

---

### 16 mayo 2026 — Sesión 8

#### App móvil — OnboardingScreen rediseñado
- **Fuente**: Playfair Display Bold Italic instalada (`@expo-google-fonts/playfair-display`) para el eslogan
- **Eslogan principal** (slide 1): "Haz que las oportunidades te encuentren" — fontSize:26, Playfair Display italic, parte del flujo centrado
- **Descripción** slide 1: "Deja de buscar. Tu próximo trabajo ya está en tu bolsillo. Oportunidades que se adaptan a ti, no al revés." (español neutro)
- **"Descarga Nexu"** label + **"Gratis"** (fontSize:26) posicionados en la parte inferior del slide 1
- **Colores intercambiados**: slide 1 ahora usa teal/índigo (#2DD4BF → #4E6098), slide 2 usa coral (#C17A5E → #A86448)

#### Web — rediseño completo
- **globals.css**: paleta profesional — hero fondo #0D1117 (casi negro), sin azules institucionales, coral y teal como acentos
- **Homepage**: eslogan "Haz que las oportunidades te encuentren" en hero con Georgia italic, "oportunidades" resaltado en coral, estadísticas, países por slug, CTA de descarga
- **Páginas de país**: eslogan como primer impacto en el hero antes de los empleos. BR en portugués.
- **AppCta.js**: componente reutilizable con traducciones ES/PT — eslogan, descripción, 3 props de valor, "Descarga Nexu" + "Gratis" grande, botón de descarga
- **Tiempo real (WebSocket)**: 
  - `web/src/lib/supabase-browser.js` — cliente Supabase para el browser (anon key)
  - `web/src/app/JobsRealtime.js` — componente cliente que suscribe a INSERT en tabla `concursos` y actualiza la lista en vivo con banner "X nuevos empleos"
  - Integrado en `/empleos` y `/empleos/pais/[pais]` — el servidor pasa los datos iniciales, el cliente toma el control para las actualizaciones en tiempo real
  - Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Pendiente para Vercel (producción)
- Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel → Settings → Environment Variables (con la anon key pública)
- Hacer redeploy para que el tiempo real funcione en producción

---

### 15–16 mayo 2026 — Sesiones 6 y 7

#### Scraper de concursos — todos los países operativos
- **Problema resuelto**: solo UY y BR daban resultados. Los otros países apuntaban a SPAs de job boards que devuelven HTML vacío o tienen anti-bot.
- **Solución**: todos los países (excepto UY y BR que ya funcionaban) ahora usan **Google News RSS** como fuente de datos. Es accesible desde Supabase sa-east-1, siempre devuelve XML válido con noticias reales de convocatorias.
- **Países agregados**: MX (México) y VE (Venezuela) — la app ahora cubre **11 países**.
- **Resultado final del scraper**: 426 registros insertados — AR:35, BO:32, BR:135, CL:35, CO:35, EC:35, PE:35, PY:24, UY:60, MX:~35, VE:~20
- **Paraguay y Venezuela**: usan `locale="US"` con `paisRow` ya que no tienen ceid válido en Google News
- **Argentina**: intenta primero Boletín Oficial RSS, fallback a Google News

#### Límite de 500 registros en admin — corregido
- `todos_llamados` aumentado de `.limit(500)` a `.limit(2000)`
- Agregado COUNT real independiente del límite — `total` ahora muestra el número exacto de registros en DB, `cargados` muestra cuántos se trajeron en la llamada

#### Ofertas de empleadores — sección nueva en admin
- **SQL creado** (`supabase/ofertas_table.sql`): tabla `ofertas` con campos completos (titulo, cargo, descripcion, pais, ciudad, modalidad, tipo_contrato, salario_min/max, moneda, activa, vistas, postulaciones, fecha_cierre). RLS habilitado.
- **`admin-data`** actualizado: función `getOfertasEmpleadores()` con filtros por país, ciudad y cargo. Registrada en `consultas()` switch y en el handler principal.
- **`AdminScreen.js`**: nueva consulta "📣 Ofertas de empleadores" en el grid. `OfertaCard` component, filtros por país (chips morados), ciudad y cargo. Breakdown por país al cargar.

#### ConcursaScreen y AdminScreen — MX y VE agregados
- `BANDERAS` en ConcursaScreen: agregado `MX: '🇲🇽'`
- `PAIS_ISO` en ConcursaScreen: agregado `'mexico':'MX'` y `'méxico':'MX'`
- `BANDERAS` en AdminScreen: agregado `MX: '🇲🇽'`
- Chips de filtro en AdminScreen (llamados y ofertas): agregados México y Venezuela

#### Sitio web Next.js — creado y deployado en Vercel
- **Stack**: Next.js 14 App Router, SSR/ISR, Supabase server-side
- **Deployado en**: `web-green-eight-56.vercel.app` (proyecto Vercel: `ale-s-projects8/web`)
- **Dominio final pendiente**: `nexu.app` (comprar mañana)
- **Variables de entorno configuradas en Vercel**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SITE_URL`

**Páginas del sitio:**

| Ruta | Descripción |
|------|-------------|
| `/` | Homepage con stats en vivo, CTA de descarga |
| `/empleos` | Listado con búsqueda por cargo y país |
| `/empleos/[slug]` | Detalle de cada concurso con JSON-LD JobPosting |
| `/empleos/pais/[pais]` | 11 páginas estáticas por país (SEO) |
| `/sitemap.xml` | Auto-generado con hasta 5.000+ URLs |
| `/robots.txt` | Auto-generado |

**SEO implementado:**
- JSON-LD `JobPosting` en cada empleo → aparece en carrusel de Google for Jobs
- JSON-LD `BreadcrumbList` en empleos y páginas de país
- JSON-LD `WebSite + SearchAction` en layout → habilita Sitelinks Searchbox
- JSON-LD `FAQPage` en homepage → rich results expandibles
- `generateMetadata` dinámico en todas las páginas
- `twitter:card summary_large_image` en layout
- Sitemap incluye las 11 páginas de país (priority 0.85)

**Web SearchForm**: agregados BR (Brasil) y VE (Venezuela) — ahora lista los 11 países

#### Carpeta reorganizada
- Creada carpeta `/Users/usuario/Desktop/Nexu/`
- `LaburarNuevo` movido a `Nexu/LaburarNuevo`
- Creada `Nexu/estrategia de posicionamiento/` con:
  - `ESTRATEGIA_SEO.md` — estrategia completa, por qué funciona cada pieza, roadmap
  - `CHECKLIST_LANZAMIENTO.md` — paso a paso para lanzar + tareas pendientes
  - `ARCHIVOS_IMPLEMENTADOS.md` — qué archivos se tocaron y por qué

---

### 14 mayo 2026 — Sesión 5

#### Sistema de denuncias y moderación + acciones admin + campañas

- **Edge Function `reportar`** (nueva, deployada): usuarios denuncian perfiles. Auto-suspende al llegar a 3 denuncias activas. Evita denuncias duplicadas del mismo usuario.
- **`PerfilTrabajadorScreen.js`**: botón discreto "Reportar este perfil" al pie + modal con selección de motivo (spam, información falsa, ofensivo, acoso, duplicado, otro) + campo de detalle opcional.
- **`AdminScreen.js` — Tab Reportes** (nueva, emoji 🚨): lista todos los perfiles denunciados agrupados por usuario, con todos los motivos. Acciones directas: **Ignorar** (limpia denuncias, perfil sigue activo) o **Suspender** (suspende definitivamente). Los auto-suspendidos aparecen marcados.
- **`AdminScreen.js` — Tab Campañas** (nueva, emoji 📣): envío masivo de mensajes internos. Selección de segmento: Todos / Activos / Inactivos / Sin actividad 30d / Por país. Vista previa del conteo antes de enviar.
- **`AdminScreen.js` — DetalleModal**: nuevos botones de acción directa: +7 días, +30 días, Activar perfil (10 días), Suspender/Restaurar. Sin salir del modal.
- **Tab bar del admin ahora es scrollable** (7 tabs: Panel / Usuarios / Pagos / Consultas / Waitlist / Reportes / Campañas).
- **`admin-data`** actualizado con 4 nuevas acciones: `reportes_pendientes`, `accion_usuario`, `resolver_reporte`, `ids_segmento`.
- **SQL necesario** (ejecutar en Supabase → SQL Editor):
  ```sql
  CREATE TABLE IF NOT EXISTS reportes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id uuid NOT NULL,
    reported_id uuid NOT NULL,
    motivo text NOT NULL,
    detalle text,
    estado text DEFAULT 'pendiente',
    created_at timestamptz DEFAULT now(),
    UNIQUE(reporter_id, reported_id)
  );
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspendido BOOLEAN DEFAULT FALSE;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspendido_motivo TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspendido_at TIMESTAMPTZ;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_reportes INTEGER DEFAULT 0;
  ```

---

#### Verificación de teléfono
- **Edge Function `verificar-telefono`** (nueva, deployada): genera OTP de 6 dígitos, lo guarda en `profiles.telefono_otp` con 10 min de expiración, envía por email vía Resend API. Si no hay `RESEND_API_KEY` configurada devuelve el OTP directo en la respuesta (modo dev/prueba).
- **`VerificarTelefonoScreen.js`** (nueva): flujo 2 pasos — ver teléfono + botón "Enviar código" → ingresar código de 6 dígitos + "Verificar". Si está sin Resend, muestra el código en pantalla para pruebas.
- **`EditarPerfilScreen.js`**: campo de teléfono ahora tiene badge "✓ Verificado" (verde) o botón "Verificar" (coral). Si el usuario cambia el número, se resetea la verificación automáticamente. Recarga el estado de verificación al volver de VerificarTelefonoScreen.
- **`PerfilTrabajadorScreen.js`**: badge "✓ Tel. verificado" visible en el hero del perfil cuando `telefono_verificado = true`.
- **`PerfilScreen.js`**: fila "Teléfono" en sección Mi Cuenta muestra `✅ Verificado` o `⚠️ Sin verificar`.
- **`App.js`**: `VerificarTelefonoScreen` registrada en `PerfilStack`.
- **SQL necesario** (ejecutar en Supabase → SQL Editor):
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_verificado BOOLEAN DEFAULT FALSE;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_otp TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_otp_expiry TIMESTAMPTZ;
  ```
- **Para activar emails reales** (opcional, gratis hasta 3.000/mes):
  1. Crear cuenta gratis en resend.com → API Keys → New Key
  2. `npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref waevdcqdkovqaxkonlvj`
  3. Opcional: `npx supabase secrets set RESEND_FROM_EMAIL=verificacion@tudominio.com --project-ref waevdcqdkovqaxkonlvj`

---

### 14 mayo 2026 — Sesión 3

#### AdminScreen — panel completo de administración
- **Tab bar inferior oculta** cuando se está en el admin (no se ven los íconos de Inicio/Buscar/etc.)
- **Tab Panel:** stats de usuarios, ingresos, gráficos por país y ciudad, auto-refresh cada 60s
- **Tab Usuarios:** búsqueda por nombre/email/oficio, filtros activo/inactivo/con saldo, paginación, modal de detalle completo
- **Tab Pagos:** resumen por período (hoy/semana/mes/año/total), desglose por método de pago con barra proporcional y porcentaje (Stripe, MercadoPago, Transferencia, Efectivo, PayPal)
- **Tab Consultas:** 12 consultas rápidas con layout grid → chip strip al seleccionar una. Incluye:
  - Todos los llamados (públicos + privados) con filtros Todos/Públicos/Privados + País + Cargo
  - Mensajes entre usuarios con filtro por país y sector
  - Sin actividad con selector de período (30/15/10/5 días)
  - Selección múltiple de usuarios → envío de mensaje masivo (motivacional/propuesta/incentivo/libre)
- **Tab Waitlist:** control completo de la lista de espera (ver abajo)

#### Sistema de Waitlist — control de flujo de usuarios
- **WaitlistScreen.js:** pantalla donde el usuario se anota, ve su posición y recibe notificación push cuando es habilitado
- **RegisterScreen.js:** antes de registrarse verifica si la waitlist está activa y si el email está habilitado. Si no → redirige a WaitlistScreen
- **App.js:** WaitlistScreen agregada al AuthStack

#### Edge Functions deployadas (sesión 3)
- **`waitlist`** (nueva, pública): unirse a la lista, consultar posición, marcar como registrado
- **`waitlist-autorizador`** (nueva): lógica de auto-scaling — mide carga, habilita lotes, manda push notifications, crece el batch size automáticamente
- **`admin-data`** actualizada con:
  - `todos_llamados` — todos los concursos activos con filtros
  - `mensajes_resumen` — estadísticas de mensajes entre usuarios
  - `enviar_mensajes` — mensajes masivos desde el admin
  - `waitlist_stats` — estadísticas de la waitlist
  - `waitlist_config` — actualizar configuración del autorizador
  - `waitlist_habilitar` — habilitar lote manual con push notification

#### Infraestructura de escalado configurada
- **Tablas SQL ejecutadas en Supabase:** `waitlist`, `waitlist_config`, `waitlist_lotes` + índices en todas las tablas principales
- **Cron externo configurado** en cron-job.org: llama al autorizador cada hora automáticamente
- **ESCALADO.md** creado: plan paso a paso para migrar según cantidad de usuarios (ver ese archivo)

---

### 13 mayo 2026 — Sesión 2
- ConcursaScreen: buscador con consulta real a BD, normalización de acentos, KeyboardAvoidingView
- HomeScreen: tres bloques diferenciados (concursos públicos, privados, búsqueda)
- Scraper privado: Remotive API funcionando (19 empleos insertados)

### 13 mayo 2026 — Sesión 1
- HomeScreen renovado con 3 bloques
- ConcursaScreen con filtros desde HomeScreen
- Scraper reescrito

---

## Estado de la base de datos (Supabase)

### Tablas principales
- `profiles` — perfiles de workers y employers
- `concursos` — llamados públicos + privados
- `concurso_matches` — scoring worker ↔ concurso
- `propuestas` — propuestas de empleo
- `mensajes` — chat entre users
- `pagos` — registro de pagos
- `waitlist` — lista de espera de nuevos usuarios ✅ nueva
- `waitlist_config` — configuración del autorizador ✅ nueva
- `waitlist_lotes` — log de lotes habilitados ✅ nueva

### Edge Functions desplegadas
- `admin-data` — panel admin completo ✅ actualizada (ofertas, limit 2000, count real)
- `waitlist` — registro y consulta de waitlist
- `waitlist-autorizador` — auto-scaling de habilitaciones
- `match-concursos` — scoring de compatibilidad
- `notificar-matches` — notificaciones push de matches
- `notificar-propuesta` — notificaciones de propuestas
- `scraper-concursos` — 11 países (UY AR BR CL CO PE PY BO EC MX VE) ✅ actualizada
- `crear-pago-stripe` — sesión de pago
- `verificar-telefono` — OTP de 6 dígitos enviado por email
- `reportar` — sistema de denuncias con auto-suspensión

### GitHub Actions activos
- `scraper-privado.yml` — 3×/día (8am, 2pm, 8pm UY)

---

## Cosas pendientes

### 🔴 Urgente — antes de publicar

0. **Ejecutar SQL de verificación de teléfono** en Supabase → SQL Editor:
   ```sql
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_verificado BOOLEAN DEFAULT FALSE;
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_otp TEXT;
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono_otp_expiry TIMESTAMPTZ;
   ```

1. **Subir Supabase a Pro + Small ($35/mes)**
   - Supabase Dashboard → Settings → Billing → Upgrade to Pro
   - Luego agregar Compute Add-on "Small" ($10/mes)
   - Esto aguanta hasta 200.000 usuarios activos
   - **Sin esto la app puede trancar con muchos usuarios simultáneos**

2. **Rotar la Service Role Key de Supabase**
   - La clave fue expuesta en sesiones de chat
   - Supabase Dashboard → Settings → API → Service Role Key → Rotate

3. **Ejecutar SQL de matching mejorado** (`supabase/fix_matching_keywords.sql`)
   - Agrega columna `keywords_norm TEXT[]` a `profiles`
   - Sin esto perfiles como "Odontólogo/a" no matchean con "odontología"

4. **Stripe en producción**
   - Reemplazar claves de test por claves reales de Stripe

### 🟡 Importante

5. **Activar la waitlist cuando sea necesario**
   - Admin → tab Waitlist → toggle ON
   - Hoy está en OFF (registro libre)
   - Activar cuando los usuarios se acerquen a 150.000 activos

6. **Implementar alerta automática de carga**
   - Que el panel admin avise cuando usuarios activos superen 150.000
   - Para recordar subir el plan de Supabase antes de que tranche

7. **Configurar Adzuna API** (gratis, developer.adzuna.com)
   - Agrega cientos de empleos de AR/BR/CL/CO
   - Agregar secrets en GitHub Actions: `ADZUNA_APP_ID` y `ADZUNA_APP_KEY`

8. **Configurar Jooble API** (gratis, escribir a api@jooble.org)
   - Complementa Adzuna para toda LatAm

9. **Ejecutar `fix_notificaciones.sql`** — push_token para notificaciones reales

10. **Ejecutar `fix_rls_completo.sql`** — Row Level Security completo

### 🔵 Web / SEO

11. **Comprar dominio `nexu.app`** (mañana) — Porkbun ~$14/año o Cloudflare ~$15/año. Luego agregar en Vercel Settings → Domains.
12. **Verificar sitio en Google Search Console** — después de conectar el dominio. Enviar sitemap.xml.
13. Crear imagen OG `og:image` 1200×630px para redes sociales

### 🟢 Mejoras deseables

14. Filtro por ciudad/zona en ConcursaScreen
15. Resultados de búsqueda inline en HomeScreen
16. Test end-to-end del flujo completo de matching
17. Notificaciones push reales de nuevos matches
18. Páginas de cargo en web: `/empleos/cargo/docente`, `/empleos/cargo/enfermero`, etc.
19. **Ejecutar `supabase/ofertas_table.sql`** en Supabase SQL Editor (tabla de ofertas de empleadores)

---

## Arquitectura de escalado (resumen)

```
Hoy (gratis):        hasta ~5.000 usuarios activos
$35/mes (Pro+Small): hasta ~200.000 usuarios activos
$100/mes:            hasta ~500.000 usuarios activos
$200/mes:            hasta ~1.000.000 usuarios activos
$599/mes (Team):     1M+ con soporte dedicado
```

Ver ESCALADO.md para instrucciones paso a paso de cada migración.

---

## Cómo funciona el autorizador de waitlist

```
Cada hora (cron-job.org):
    → llama a waitlist-autorizador
    → mide usuarios activos en la última hora
    → si carga < umbral Y cola < máximo Y pasó el intervalo:
        → habilita el siguiente lote
        → manda push notification a habilitados
        → crece el batch_size para el próximo lote
    → si carga alta: espera sin habilitar
```

Configuración actual (ajustable desde Admin → Waitlist):
- Batch inicial: 100 usuarios por lote
- Intervalo mínimo: 60 minutos entre lotes
- Umbral de carga: 500 activos/hora
- Cola máxima: 300 habilitados sin registrar

---

## Colores de la app

| Rol | Color principal |
|---|---|
| Worker (trabajador) | Coral `#E8785A` |
| Employer (empleador) | Coral `#E8785A` |
| Company (empresa) | Menta `#3DA882` |
| Sector público | Azul oscuro `#1A3A5C` |
| Sector privado | Coral `#E8785A` |

---

## Notas técnicas importantes

- La app usa **Expo Go** para desarrollo — no está compilada como APK/IPA todavía
- La waitlist está en **OFF** por defecto — registro libre hasta que se active manualmente
- El cron de waitlist corre en cron-job.org cada hora (configurado el 14/05/2026)
- `fecha_cierre = null` en empleos privados → aparecen siempre sin vencer
- El matching se corre al abrir ConcursaScreen y después de cada scraper
