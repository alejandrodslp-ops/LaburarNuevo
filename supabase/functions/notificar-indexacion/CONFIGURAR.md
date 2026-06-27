# Configurar la indexación rápida en Google (notificar-indexacion)

La edge function `notificar-indexacion` avisa a Google cuando hay concursos nuevos, para que
aparezcan en Google for Jobs **en minutos** en vez de días. El código ya está listo y desplegado.
Faltan estos pasos manuales (se hacen UNA vez, ~15 min). Hasta que estén, la función responde
"Falta el secret" y no pasa nada malo — el sitio sigue indexándose por sitemap como hasta ahora.

## 1) Habilitar la Indexing API
- Andá a https://console.cloud.google.com → elegí tu proyecto (el mismo de la Vision API sirve).
- APIs y servicios → Biblioteca → buscá "Indexing API" → Habilitar.

## 2) Crear una cuenta de servicio (service account)
- IAM y administración → Cuentas de servicio → Crear cuenta de servicio.
- Nombre: `konexu-indexing`. Crear y continuar (sin roles). Listo.
- Entrá a la cuenta creada → pestaña Claves → Agregar clave → Crear clave nueva → tipo **JSON** → Descargar.
- Ese archivo .json es la credencial. Anotá el `client_email` que figura adentro
  (algo como `konexu-indexing@tu-proyecto.iam.gserviceaccount.com`).

## 3) Dar permiso de Owner en Search Console (CLAVE)
- Andá a https://search.google.com/search-console → propiedad `konexu.app`.
- Configuración → Usuarios y permisos → Agregar usuario.
- Pegá el `client_email` de la cuenta de servicio → permiso **Propietario** (Owner).
- Sin este paso, Google rechaza las notificaciones.

## 4) Cargar la credencial como secret en Supabase
- Abrí el archivo .json descargado y copiá TODO su contenido.
- Supabase → Edge Functions → Secrets (o por CLI):
  `supabase secrets set GOOGLE_INDEXING_SA_KEY='<pegar aquí todo el JSON>' --project-ref waevdcqdkovqaxkonlvj`

## 5) Probar
  `curl -X POST https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/notificar-indexacion \
     -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
     -d '{"horas":24,"limite":10}'`
- Debe responder `{"ok":true,"notificados":N,...}`. Si dice "No se pudo autenticar", revisar pasos 2-3.

## 6) Automatizar (cron) — avisame cuando los pasos 1-5 estén OK
- Se crea un cron job que llama la función 1-2 veces al día con los concursos nuevos.
- Cuota de la Indexing API: 200 URLs/día por default (se puede pedir aumento a Google si hace falta).
