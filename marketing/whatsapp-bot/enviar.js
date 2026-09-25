// Bot de captación por WhatsApp (whatsapp-web.js).
// Lee contatos.csv (numero,empresa,puesto), manda el mensaje PT personalizado,
// con pausas humanas. Usa el Chrome del sistema (no baja Chromium).
//
// Uso:  node enviar.js            -> manda a todos los de contatos.csv
//       MAX=1 node enviar.js      -> manda solo al primero (prueba)
//       DRY=1 node enviar.js      -> NO manda: solo verifica quién tiene WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const fs = require('fs')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LINK = 'https://www.konexu.app/empleador/login'
const DRY = process.env.DRY === '1'
const MIN_DELAY = 40000, MAX_DELAY = 90000 // 40-90s: ritmo humano, clave para no ser baneado

function mensaje(empresa, puesto) {
  return `Olá, equipe da ${empresa}.\n\n` +
    `Vimos que está com uma vaga aberta de ${puesto}. Escrevemos da Konexu: ` +
    `pode publicá-la gratuitamente e os candidatos entram em contato direto, ` +
    `no e-mail ou número indicado para receber as candidaturas.\n\n` +
    `Publicar leva uns 2 minutos:\n${LINK}\n\n` +
    `Se não for de seu interesse, sem problema — não escrevemos novamente.`
}

function parseCSV(path) {
  const lines = fs.readFileSync(path, 'utf8').split('\n').filter(l => l.trim())
  lines.shift()
  return lines.map(l => {
    const [numero, empresa, puesto] = l.split(',')
    return { numero: (numero || '').replace(/\D/g, ''), empresa: (empresa || '').trim(), puesto: (puesto || '').trim() }
  }).filter(c => c.numero && c.empresa)
}

const contatos = parseCSV(__dirname + '/contatos.csv')
const MAX = parseInt(process.env.MAX || String(contatos.length), 10)

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: __dirname + '/.wwebjs_auth' }),
  puppeteer: { headless: true, executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
})

client.on('qr', (qr) => {
  console.log('\n📲 Escaneá este QR con el WhatsApp DESDE EL QUE querés enviar')
  console.log('   (WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo):\n')
  qrcode.generate(qr, { small: true })
})
client.on('authenticated', () => console.log('✅ Vinculado.'))
client.on('auth_failure', (m) => { console.error('❌ Falló la vinculación:', m); process.exit(1) })

client.on('ready', async () => {
  const lote = contatos.slice(0, MAX)
  console.log(`\n🚀 Listo.${DRY ? ' [MODO PRUEBA: no envía]' : ''} Procesando ${lote.length} contacto(s)...\n`)
  let ok = 0, sinwa = 0, err = 0
  for (const c of lote) {
    try {
      const id = await client.getNumberId(c.numero)
      if (!id) { console.log(`⏭️  ${c.empresa} (${c.numero}) → NO tiene WhatsApp`); sinwa++; continue }
      if (DRY) { console.log(`✔️  ${c.empresa} (${c.numero}) → tiene WhatsApp (no envié, modo prueba)`); ok++; }
      else { await client.sendMessage(id._serialized, mensaje(c.empresa, c.puesto)); console.log(`✅ Enviado → ${c.empresa} (${c.numero})`); ok++ }
    } catch (e) { console.log(`❌ ${c.empresa} (${c.numero}): ${e.message}`); err++ }
    if (c !== lote[lote.length - 1]) {
      const d = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
      console.log(`   ...pausa ${Math.round(d / 1000)}s`)
      await new Promise(r => setTimeout(r, d))
    }
  }
  console.log(`\n🏁 Fin: ${ok} ${DRY ? 'con WhatsApp' : 'enviados'}, ${sinwa} sin WhatsApp, ${err} errores.`)
  await client.destroy()
  process.exit(0)
})

client.initialize()
