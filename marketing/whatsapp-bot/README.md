# Bot de WhatsApp — captación de empresas (Konexu)

Manda el mensaje de invitación por WhatsApp, personalizado por empresa/puesto,
con pausas humanas para no ser baneado.

## ⚠️ Reglas de oro (para NO perder el número)
- Usá un **número dedicado** (no tu WhatsApp personal). Idealmente un chip aparte.
- **Lento:** ~20-40 por día como máximo, con las pausas que ya trae el bot (40-90s).
- **Personalizado** (ya lo hace: nombre + puesto). Nada de copiar-pegar idéntico masivo.
- Si WhatsApp te avisa o alguien te reporta, **pará**. Un número quemado no vuelve.
- Es un método **no oficial** (automatiza WhatsApp Web). Va contra los términos de WhatsApp:
  a bajo volumen y bien hecho funciona, pero el riesgo de baneo es tuyo.

## Instalar (una vez)
```bash
cd marketing/whatsapp-bot
PUPPETEER_SKIP_DOWNLOAD=true npm install
```
(usa el Chrome que ya tenés instalado; no baja nada extra)

## Cargar contactos
Editá `contatos.csv` (una fila por empresa):
```
numero,empresa,puesto
+55 11 91234-5678,Nombre Empresa,Puesto que busca
```
El número va con código de país (55 = Brasil).

## Probar sin enviar (recomendado la 1ª vez)
```bash
DRY=1 node enviar.js
```
Escaneás el QR con el WhatsApp del que vas a enviar, y te dice **quién tiene WhatsApp**
sin mandar nada.

## Enviar
```bash
node enviar.js            # a todos los de contatos.csv
MAX=5 node enviar.js      # solo a los primeros 5 (para ir de a poco)
```
La primera vez pide escanear un QR (WhatsApp → Dispositivos vinculados). Después queda
la sesión guardada en `.wwebjs_auth/` y ya no lo pide.
