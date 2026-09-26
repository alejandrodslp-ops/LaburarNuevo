# Plan de corte — Paso 9 (Hetzner)

Documento vivo. Última actualización: 2026-09-25.

## Son DOS cortes distintos, no uno

1. **Web** (`konexu.app`, `www.konexu.app`) — hoy en Vercel. Cortar = cambiar DNS. Revertir = cambiar DNS de vuelta. Rápido (minutos, sujeto a TTL).
2. **App móvil** — hoy con `https://waevdcqdkovqaxkonlvj.supabase.co` escrito directo en `src/services/supabase.js`. Cortar = cambiar esa URL a `https://api.konexu.app` y publicar una actualización OTA (`eas update`). Revertir = publicar OTA con la URL vieja de nuevo. Más lento (una app ya instalada tarda en recibir la actualización, no es instantáneo como el DNS).

**No hace falta cortar los dos el mismo día.** Se pueden hacer por separado, empezando por el de menor riesgo.

## Estado actual (snapshot antes de tocar nada, 2026-09-25)

```
konexu.app       A      216.198.79.1                          (Vercel)
www.konexu.app   CNAME  9920404e47b5f28a.vercel-dns-017.com.  (Vercel)
```

Si algo sale mal, restaurar exactamente estos dos valores en Porkbun deshace el corte de web.

## Corte 1 — Web (menor riesgo, recomendado primero) — ✅ HECHO 2026-09-25

DNS cambiado en Porkbun, certificado real emitido, las 6 páginas probadas responden 200, redirect `konexu.app`→`www.konexu.app` funcionando, `api.konexu.app` sin afectar. Vercel sigue activo en paralelo como red de seguridad de corto plazo — no es la salida permanente, solo para revertir rápido si aparece algo roto en los próximos días.


**Antes de cortar:**
- [x] `web-test.konexu.app` probado a fondo (2026-09-25): `/`, `/empleos`, `/empleos/pais/uruguay`, `/empleos/pais/brasil` → 200. `/login`, `/registro` → 404 y `/api/proxy` → 401 en **ambos** (web-test y producción por igual) — no es un bug nuevo, esas rutas no existen en la web tal cual hoy.
- [ ] **Falta agregar al Caddyfile del servidor** (`/root/supabase/docker/volumes/proxy/caddy/Caddyfile`) los bloques para `konexu.app` y `www.konexu.app` — hoy solo tiene `web-test.konexu.app` y el dominio de la API. Sin esto, Caddy no sabe qué certificado pedir ni a dónde reenviar cuando el DNS apunte acá.
- [ ] **Falta decidir el redirect `konexu.app` → `www.konexu.app`** — hoy Vercel hace ese 308 automático (confirmado con curl). Caddy no lo hace solo; si no se agrega un bloque de redirect para `konexu.app`, los links que circulan sin `www` van a servir el sitio dos veces en vez de normalizar a uno solo (duplica contenido de cara a Google).

**Cortar:**
1. Agregar al Caddyfile: un bloque `www.konexu.app { reverse_proxy host.docker.internal:3001 }` y un bloque `konexu.app { redir https://www.konexu.app{uri} permanent }`, recargar Caddy.
2. En Porkbun, cambiar el registro A de `konexu.app` de `216.198.79.1` a `46.62.215.185`.
3. Cambiar el CNAME de `www.konexu.app` a un registro A igual al de arriba (Caddy en el servidor, no Vercel, sirve TLS para ambos).

**Revertir (si algo falla):**
1. Volver los 2 registros DNS a los valores del snapshot de arriba.
2. Listo — Vercel nunca se apagó, sigue funcionando en paralelo.

**Qué puede salir mal:** el sitio se ve distinto/rompe algo que `web-test` no mostró (ej. una variable de entorno que en Vercel estaba pero acá no). Por eso probar `web-test` a fondo ANTES.

## Corte 2 — App móvil (mayor riesgo, hacer por separado)

**Antes de cortar:**
- [ ] Probar `https://api.konexu.app` con la app de verdad, no solo con `curl` — instalar un build de prueba (o Expo Go) apuntando ahí, probar login, ver perfiles, mandar un mensaje.
- [ ] Confirmar que Auth (login/registro) funciona igual en el stack nuevo — hoy no se probó con un usuario real, solo con `curl`.

**Cortar:**
1. Cambiar `SUPABASE_URL` en `src/services/supabase.js` de la URL vieja a `https://api.konexu.app`.
2. Publicar con `eas update --branch production` (mismo comando ya usado hoy para las notificaciones).

**Revertir (si algo falla):**
1. Volver la línea a la URL vieja en el código.
2. Publicar OTRA actualización OTA con `eas update`.
3. **Ojo:** hasta que la app instalada baje esa segunda actualización, sigue rota — no es instantáneo. Por eso probar mucho ANTES de este corte, no confiar en poder revertir rápido.

**Qué puede salir mal:** cualquier diferencia entre el Supabase alojado y el self-hosted que no se haya notado (Auth, Realtime, Storage) rompe la app para gente real, y tarda en arreglarse aunque se revierta.

## Orden recomendado

1. Cortar la web primero (menor riesgo, reversible al instante).
2. Dejarla corriendo unos días, confirmar que no rompió nada.
3. Recién ahí probar y cortar la app — el paso que de verdad no se puede deshacer rápido.
