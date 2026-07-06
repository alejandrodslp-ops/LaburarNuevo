# Configurar el bot de Telegram (telegram-concursos)

La edge function `telegram-concursos` publica cada concurso público NUEVO de Uruguay en un
canal de Telegram, con link a konexu.app (con UTM para medir el tráfico que trae). El código
está listo. Faltan estos pasos, en este orden. Los pasos 1-2 los hacés vos (5-10 min);
del 3 en adelante los hace Claude cuando le pases el token y el nombre del canal.

## 1) Crear el bot (vos, en Telegram — 3 min)
- Abrí Telegram y buscá **@BotFather** (el verificado, con tilde azul).
- Mandale `/newbot`.
- Nombre visible: `Konexu Concursos` (o el que quieras).
- Username: algo terminado en "bot", ej: `konexu_concursos_bot`.
- BotFather te devuelve un **token** tipo `1234567890:AAF...xyz`. **Copialo y no lo compartas**
  — es la clave del bot. Pasáselo a Claude por el chat de Claude Code (queda solo en
  Supabase Secrets, nunca en el código ni en git).

## 2) Crear el canal y agregar el bot como admin (vos — 3 min)
- En Telegram: Nueva → **Canal**. Nombre sugerido: `Concursos Públicos Uruguay 🇺🇾`
  (descubrible en búsquedas: que diga "concursos", "Uruguay", "empleo público").
- Tipo: **Público**, con un link tipo `t.me/concursos_uruguay` (elegí el username disponible).
- Descripción sugerida: "Todos los llamados públicos de Uruguay (ONSC, intendencias, ANEP,
  ASSE, UdelaR) apenas se publican. Con requisitos, plazos y link para postularse."
- Configuración del canal → Administradores → Agregar administrador → buscá tu bot por su
  username → dale permiso de **Publicar mensajes** (el resto no hace falta).

## 3) Cargar los secrets (Claude, cuando tenga token + canal)
```
supabase secrets set TELEGRAM_BOT_TOKEN='<token de BotFather>' --project-ref waevdcqdkovqaxkonlvj
supabase secrets set TELEGRAM_CHAT_UY='@concursos_uruguay' --project-ref waevdcqdkovqaxkonlvj
```
(`TELEGRAM_CHAT_UY` es el @username público del canal.)

## 4) Crear la tabla de dedupe (Claude)
Ejecutar el PASO 1 de `supabase/telegram_bot.sql`:
```
supabase db query --linked "<contenido del paso 1>"
```

## 5) Deployar la función (Claude)
```
supabase functions deploy telegram-concursos --project-ref waevdcqdkovqaxkonlvj --no-verify-jwt
```
`--no-verify-jwt` porque el cron la llama sin token (mismo esquema que notificar-indexacion).
Es seguro: la función es idempotente (dedupe) y solo publica en el canal propio.
⚠️ Deployar por CLI, NO por push a main (el push redeploya scraper-concursos — verificar
versión del scraper antes de commitear estos archivos).

## 6) SEED — crítico, UNA sola vez, ANTES del cron (Claude)
Marca los ~440 concursos UY existentes como "ya publicados" sin postearlos.
Sin esto, el día 1 el canal se inunda con cientos de mensajes.
```
curl -X POST https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/telegram-concursos \
  -H "Content-Type: application/json" -d '{"pais":"UY","seed":true}'
```
Debe responder `{"ok":true,"seeded":<número ~440>}`.

## 7) Prueba real (Claude + vos mirando el canal)
```
curl -X POST https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/telegram-concursos \
  -H "Content-Type: application/json" -d '{"pais":"UY","max":2,"horas":720}'
```
Con el seed hecho responde `publicados: 0` (correcto: no hay nada nuevo). Para ver un
mensaje de verdad en el canal: borrar UNA fila de `telegram_publicados` y repetir el curl —
debe aparecer ese concurso en el canal con formato y link correctos.

## 8) Activar el cron (Claude, recién cuando 6 y 7 estén OK)
Ejecutar el PASO 2 (comentado) de `supabase/telegram_bot.sql`. Corre cada hora y publica
solo lo nuevo. Apagarlo: `SELECT cron.unschedule('telegram-concursos-uy');`

## 9) Crecimiento del canal (vos, continuo — esto es lo que hace despegar)
- Poné el link del canal en la web (banner/footer) y en las publicaciones de Facebook.
- Compartí el link en los grupos de Facebook de empleo de Uruguay 2-3 veces por semana
  (Claude redacta los textos).
- El canal crece solo si el contenido es diario — y lo es: el scraper ya corre 3 veces al día.

## Cómo medir si funciona
- Suscriptores del canal (lo ves en Telegram).
- Visitas con `utm_source=telegram` en Vercel Analytics — ese es el tráfico que trae el bot.

## Multi-país (después, si UY funciona)
La función ya está preparada: agregar secret `TELEGRAM_CHAT_<PAIS>`, canal nuevo, y un cron
con `{"pais":"<XX>"}`. No hace falta tocar el código para UY→AR; solo mapear el canal.
