# Estado del Proyecto — Laburar (Nexu)
**Última actualización: 13 mayo 2026 (sesión 2)**

---

## Qué es el proyecto
App móvil de empleo para trabajadores y empleadores de Latinoamérica, construida con React Native (Expo Go). Conecta trabajadores con empleos públicos (concursos oficiales) y privados (job boards), y a empleadores con trabajadores calificados.

**Stack:** React Native + Expo · Supabase (PostgreSQL + Auth + Edge Functions) · Stripe · GitHub Actions

**Repo:** https://github.com/alejandrodslp-ops/LaburarNuevo

---

## Pantallas que existen

| Pantalla | Estado |
|---|---|
| Onboarding / Login / Registro | ✅ Completo |
| HomeScreen (trabajador) | ✅ Renovado — 3 bloques diferenciados |
| ConcursaScreen | ✅ Renovado — búsqueda real + filtros |
| ConcursaDetalleScreen | ✅ Completo |
| MensajesScreen + ChatScreen | ✅ Funcionando |
| PerfilScreen (trabajador) | ✅ Funcionando |
| EditarPerfilScreen | ✅ Funcionando |
| BuscarScreen (empleador) | ✅ Funcionando |
| PerfilTrabajadorScreen | ✅ Funcionando |
| PagoScreen / PagoActivacionScreen | ✅ Funcionando |
| HomeEmpresaScreen / BuscarEmpresaScreen | ✅ Funcionando |
| PropuestaScreen / EncuestaRechazoScreen | ✅ Funcionando |

---

## Historial de cambios

### 13 mayo 2026 — Sesión 2 (tarde)

#### ConcursaScreen — buscador con consulta real a la BD
- El buscador ahora consulta **Supabase directamente** en lugar de filtrar los 100 registros ya cargados
- Busca en `cargo`, `titulo`, `organismo` y `descripcion` con ilike
- **Normaliza acentos**: escribir `odontologo` encuentra `Odontólogo`, `dentista` encuentra `Dentista`
- Busca en paralelo la versión con y sin tilde para mayor cobertura
- Botón "Buscar" + tecla Enter del teclado disparan la consulta
- Muestra "X resultados para 'término'" con botón "Limpiar ×"
- Modo búsqueda ignora filtros Para vos/Todos y usa resultados de la BD

#### ConcursaScreen — teclado ya no tapa el campo
- Agregado `KeyboardAvoidingView` (`padding` en iOS, `height` en Android)
- `keyboardDismissMode="interactive"` para cerrar el teclado arrastrando
- El campo de búsqueda queda visible al abrir el teclado

---

### 13 mayo 2026 — Sesión 1 (mañana)

#### HomeScreen — tres bloques diferenciados
1. **Concursos públicos** 🏛️ — muestra cuántos llamados públicos coinciden con el perfil. Al tocar va directo a ConcursaScreen en "Para vos → Público"
2. **Empleos privados** 💼 — muestra cuántos empleos privados coinciden. Al tocar va a "Para vos → Privado". Muestra mini-cards de los mejores matches de cada sector
3. **Búsqueda específica** 🔍 — TextInput + chips Presencial/Teletrabajo + botón Buscar → que navega a ConcursaScreen con el término y modalidad pre-aplicados

#### ConcursaScreen — filtros desde HomeScreen + búsqueda inline
- Lee `route.params` al montar: `presetFiltro`, `presetSector`, `busqueda`, `presetModalidad`
- Filtros de sector con emoji: Todo / Público 🏛️ / Privado 💼
- Filtro de modalidad inline: Cualquiera / Presencial / Remoto

#### Scraper de ofertas privadas — reescrito
- Eliminado el scraping HTML con cheerio (devolvía 0 porque los sites usan JS rendering)
- **Remotive API** (gratis, sin clave): funciona, insertó 19 empleos remotos tech en Supabase
- Computrabajo y Bumeran: intenta endpoints API internos; si no responden, avisa claramente
- **Adzuna** (gratis con registro en developer.adzuna.com): cubre AR/BR/CL/CO — pendiente
- **Jooble** (gratis, solicitar en jooble.org/api/about): agrega LatAm — pendiente
- Al finalizar, dispara `match-concursos {todos: true}` para actualizar matches de todos los workers

#### ConcursaDetalleScreen — nuevo (sesiones anteriores)
- Detalle completo: organismo, cargo, lugar, fecha cierre, descripción, requisitos
- Score y keywords del match del perfil del usuario
- Botones "Ver bases completas" y "Postularme →" que abren el link en el navegador

---

## Estado de la base de datos (Supabase)

### Tablas principales
- `profiles` — perfiles de workers y employers
- `concursos` — llamados públicos (scraper MTSS/Uruguay Concursa) + privados (Remotive, etc.)
- `concurso_matches` — scoring de compatibilidad worker ↔ concurso
- `propuestas` — propuestas de empleo empleador → worker
- `mensajes` — chat entre worker y empleador
- `pagos` — registro de pagos

### Edge Functions desplegadas
- `match-concursos` — calcula score de compatibilidad para un worker o todos
- `notificar-matches` — envía notificaciones push de matches nuevos
- `notificar-propuesta` — notificaciones de propuestas
- `scraper-concursos` — scraper de concursos públicos (Uruguay Concursa, MTSS)
- `crear-pago-stripe` — crea sesión de pago

### GitHub Actions activos
- `scraper-privado.yml` — corre 3×/día (8am, 2pm, 8pm UY). Inserta empleos privados y dispara re-matching

---

## Cosas pendientes (prioritarias)

### 🔴 Urgente

1. **Ejecutar SQL de matching mejorado** (`supabase/fix_matching_keywords.sql`)
   - Agrega columna `keywords_norm TEXT[]` a `profiles`
   - Implementa stemming de 7 caracteres ("odontologo" ≈ "odontologia")
   - Sin esto, perfiles como "Odontólogo/a" no matchean con llamados que dicen "odontología"
   - **Cómo:** Supabase Dashboard → SQL Editor → pegar el contenido del archivo → Run

2. **Configurar Adzuna API** (gratis)
   - Registrarse en developer.adzuna.com (2 minutos)
   - Agregar `ADZUNA_APP_ID` y `ADZUNA_APP_KEY` como secrets en GitHub → Settings → Secrets → Actions
   - Con esto el scraper pasa de 19 empleos a cientos (Argentina, Brasil, Chile, Colombia)

3. **Rotar la Service Role Key de Supabase**
   - La clave fue expuesta en una sesión de chat
   - Supabase Dashboard → Settings → API → Service Role Key → Rotate

### 🟡 Importante

4. **Configurar Jooble API** (gratis, complementa Adzuna para LatAm)
   - Escribir a api@jooble.org solicitando clave gratuita
   - Agregar `JOOBLE_API_KEY` como secret en GitHub Actions

5. **Ejecutar `fix_notificaciones.sql`** — configurar push_token para notificaciones reales

6. **Ejecutar `fix_rls_completo.sql`** — RLS (Row Level Security) para profiles, ofertas, pagos

7. **Stripe en producción** — reemplazar `STRIPE_LINK_10USD` con link real de Stripe

8. **Buscar API de Computrabajo** — el job board más grande de LatAm. Usa JS rendering pero su app móvil tiene una REST API (los endpoints /api/v1/avisos de Bumeran devuelven 403 = existe pero pide auth). Requiere analizar el tráfico de red de la app móvil.

### 🟢 Mejoras deseables

9. **Resultados de búsqueda inline** en HomeScreen — que el buscador muestre previews antes de navegar

10. **Filtro por ciudad/zona** en ConcursaScreen — hoy solo filtra por país

11. **Scraper de concursos públicos mejorado** — agregar Argentina (INFOLEG), Chile (empleospublicos.cl), Colombia (empleo.gov.co)

12. **Pestaña inferior "Concursa"** — actualmente duplica funcionalidad de HomeScreen. Podría convertirse en un buscador avanzado o mapa de oportunidades

13. **Notificaciones reales** cuando aparece un nuevo match compatible

14. **Test end-to-end del flujo completo** — especialmente el matching después del SQL fix

---

## Arquitectura del scraper (cómo funciona)

```
GitHub Actions (3×/día)
    ↓
scraper-privado/index.js
    ↓ inserta en
concursos (pais='UY', tipo_vinculo='privado', activo=true)
    ↓ llama a
match-concursos {todos: true}  ← Edge Function Supabase
    ↓ calcula score y upserta en
concurso_matches (worker_id, concurso_id, score, cumple, keywords_match)
    ↓ app lee
ConcursaScreen → "Para vos" (cumple=true) / "Todos" (todos activos del país)
```

## Arquitectura del matching

```
perfil.servicios + profesiones + especialidades
    → keywords del trabajador (normalizadas)

concurso.keywords + cargo + título
    → keywords del concurso (normalizadas)

overlap = intersección de keywords
score = (overlap / total_keywords_perfil) × 80
     + 15 si mismo país
     + 5 si misma ciudad

cumple = score >= 40
```

---

## Colores de la app

| Rol | Color principal |
|---|---|
| Worker (trabajador) | Coral `#FF5F40` |
| Employer (empleador) | Coral `#E8785A` |
| Company (empresa) | Menta `#3DA882` |
| Sector público | Azul `#1565C0` |
| Sector privado | Naranja `#E65100` |
| Banner / headers | Azul pastel `#D6E4F0 → #B8D4E8` |

---

## Notas técnicas importantes

- La app usa **Expo Go** para desarrollo — no está compilada como APK/IPA todavía
- Supabase usa **nuevas claves opacas** (`sb_publishable_...`, `sb_secret_...`) en lugar de JWTs. Las Edge Functions pueden requerir formato JWT — verificar si hay problemas de auth
- El scraper guarda empleos de Remotive con `pais='UY'` (aparecen para todos los workers de UY)
- `fecha_cierre = null` en empleos privados → no se filtran por vencimiento (aparecen siempre)
- El matching se corre automáticamente al abrir ConcursaScreen (por worker específico) y después de cada ejecución del scraper (para todos los workers)
