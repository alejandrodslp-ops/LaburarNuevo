# ⚠️ CARPETA DE MIGRACIÓN — NO ES PRODUCCIÓN

```
NO tocar esta carpeta en sesiones de trabajo normal.
NO deployar. NO modificar sin instrucción explícita del usuario.
SOLO se activa cuando el usuario diga "migrar a Hetzner".
```

---

## Qué es esto

Equivalente en Node.js/Express de todas las Supabase Edge Functions.
**La app actual sigue usando Supabase.** Esta carpeta no afecta nada en producción.

Cuando el usuario diga "migrar", el único cambio en la app es reemplazar:
```js
// HOY (Supabase):
supabase.functions.invoke('nombre-funcion', { body: datos })

// DESPUÉS (Hetzner) — los comentarios "CUANDO MIGRES A HETZNER" ya están en el código:
fetch('https://<hetzner-ip>:3000/nombre-funcion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(datos),
})
```

---

## Estado — TODO COMPLETO ✅

| Ruta | Estado |
|------|--------|
| `/enviar-soporte` | ✅ |
| `/enviar-encuestas` | ✅ |
| `/mensaje-bienvenida` | ✅ |
| `/verificar-email` | ✅ |
| `/verificar-telefono` | ✅ |
| `/verificar-imagen` | ✅ |
| `/notificar-propuesta` | ✅ |
| `/notificar-matches` | ✅ |
| `/reportar` | ✅ |
| `/simular-visitas` | ✅ |
| `/waitlist` | ✅ |
| `/waitlist-autorizador` | ✅ |
| `/match-concursos` | ✅ |
| `/busqueda-diaria` | ✅ |
| `/cv-audio` | ✅ |
| `/admin-data` | ✅ |
| `/generar-comprobante` | ✅ |
| `/crear-pago` | ✅ |
| `/webhook-pago` | ✅ |
| `/crear-pago-stripe` | ✅ |
| `/gerar-pix` | ✅ |
| `/criar-pago-pix` | ✅ |
| `/ativar-via-pix` | ✅ |
| `/whatsapp-pix-bot` | ✅ |
| `/send-apk-link` | ✅ |
| `/scraper-concursos` | ✅ (33 países) |
| `/scraper-mercado` | ✅ |
| `/vigilante-scraper` | ✅ |

**Base de datos:** `database/schema.sql` — esquema completo exportado (23 tablas, 44 índices, 33 políticas RLS, 20 funciones)

---

## Deploy cuando el usuario lo pida

```bash
# Servidor Hetzner — elegir Ashburn (USA) si DB sigue en Supabase sa-east-1
# O elegir sa-east-1 si también se migra la DB

git clone <repo> /app/backend
cd /app/backend/backend-hetzner
cp .env.example .env   # completar con secrets reales de Supabase Secrets
npm install
pm2 start src/index.js --name konexu-backend
```

**Checklist de migración:**
- [ ] Configurar `.env` con todas las variables de Supabase Secrets
- [ ] Configurar CORS en `src/index.js` con el dominio de la web
- [ ] Verificar que ScraperAPI/Adzuna/Jooble no tienen whitelist de IP (ya verificado: no tienen)
- [ ] Cambiar `supabase.functions.invoke(...)` → `fetch('https://hetzner-ip/...')` en la app
- [ ] Los comentarios `// CUANDO MIGRES A HETZNER` marcan exactamente dónde hacer cada cambio
