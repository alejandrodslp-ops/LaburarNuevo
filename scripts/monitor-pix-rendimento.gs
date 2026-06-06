// ═══════════════════════════════════════════════════════════════════════════
// NEXU — Monitor PIX Rendimento
// Google Apps Script — ejecutar en: script.google.com
//
// SETUP (solo una vez, cuando Rendimento esté aprobado):
// 1. Pegar este código en script.google.com
// 2. Completar las constantes de configuración abajo
// 3. Ejecutar → monitorarPagamentosRendimento() una vez manualmente para probar
// 4. Agregar trigger: Editar → Activadores → monitorarPagamentosRendimento → cada 1 minuto
// ═══════════════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN — completar cuando Rendimento apruebe ────────────────────
const NEXU_WEBHOOK_URL    = "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/ativar-via-pix";
const NEXU_WEBHOOK_SECRET = "";   // ← pegar el valor de PIX_WEBHOOK_SECRET de Supabase Secrets
const LABEL_PROCESADO     = "Nexu-PIX-Procesado";
const MONTO_ESPERADO_BRL  = "15,00"; // formato brasileño
// ──────────────────────────────────────────────────────────────────────────

function monitorarPagamentosRendimento() {
  // Obtener o crear label para marcar emails ya procesados
  let label = GmailApp.getUserLabelByName(LABEL_PROCESADO);
  if (!label) label = GmailApp.createLabel(LABEL_PROCESADO);

  // Buscar emails no leídos de Rendimento sobre recebimento PIX
  const queries = [
    "from:rendimento is:unread PIX recebido",
    "from:rendimento is:unread transferencia recebida",
    "from:rendimento is:unread credito",
    "from:naoresponda@rendimento.com.br is:unread",
  ];

  const processados = new Set();

  for (const query of queries) {
    const threads = GmailApp.search(query);

    for (const thread of threads) {
      if (processados.has(thread.getId())) continue;

      const messages = thread.getMessages();
      for (const msg of messages) {
        if (!msg.isUnread()) continue;

        const body    = msg.getPlainBody() + " " + msg.getBody();
        const subject = msg.getSubject();

        Logger.log("Email encontrado: " + subject);

        // Verificar que es un pago del monto correcto
        const tieneMontoCorreto = body.includes(MONTO_ESPERADO_BRL)
          || body.includes("15.00")
          || body.includes("R$ 15");

        if (!tieneMontoCorreto) {
          msg.markRead();
          continue;
        }

        // Intentar extraer el referenceLabel (ID del usuario)
        // Rendimento puede mostrarlo como: Referência, txid, Descrição, Identificador
        const padroesRef = [
          /[Rr]efer[eê]n?ci[ao][:\s]+([A-Fa-f0-9]{8,32})/,
          /txid[:\s]+([A-Fa-f0-9]{8,32})/i,
          /descri[çc][ãa]o[:\s]+([A-Fa-f0-9]{8,25})/i,
          /identificador[:\s]+([A-Fa-f0-9]{8,32})/i,
          /endToEnd[:\s]+([A-Za-z0-9]{8,35})/i,
        ];

        let refLabel = null;
        for (const padrao of padroesRef) {
          const match = body.match(padrao);
          if (match) { refLabel = match[1]; break; }
        }

        if (refLabel) {
          Logger.log("Ref label encontrado: " + refLabel);
          ativarUsuarioNexu(refLabel);
        } else {
          // Loguear para análisis manual del formato del email
          Logger.log("AVISO: Pago de R$15 recibido pero sin ref_label. Asunto: " + subject);
          Logger.log("Primeros 500 chars del body: " + body.slice(0, 500));
        }

        msg.markRead();
        thread.addLabel(label);
        processados.add(thread.getId());
      }
    }
  }
}

function ativarUsuarioNexu(refLabel) {
  try {
    const options = {
      method:             "POST",
      headers:            {
        "Content-Type": "application/json",
        "x-pix-secret":  NEXU_WEBHOOK_SECRET,
      },
      payload:            JSON.stringify({
        ref_label: refLabel,
        monto_brl: "15.00",
        canal:     "pix_rendimento",
      }),
      muteHttpExceptions: true,
    };

    const res  = UrlFetchApp.fetch(NEXU_WEBHOOK_URL, options);
    const body = JSON.parse(res.getContentText());

    Logger.log("Respuesta Nexu: " + JSON.stringify(body));

    if (body.ok) {
      Logger.log("✅ Usuario activado: " + (body.usuario || refLabel));
    } else {
      Logger.log("⚠️ Error al activar: " + JSON.stringify(body));
    }
  } catch (e) {
    Logger.log("❌ Error llamando webhook: " + e.toString());
  }
}

// Función de prueba — ejecutar manualmente para verificar conectividad
function testConectividad() {
  Logger.log("Testing conexión con Nexu...");
  try {
    const res = UrlFetchApp.fetch(
      "https://waevdcqdkovqaxkonlvj.supabase.co/",
      { muteHttpExceptions: true }
    );
    Logger.log("Supabase responde: " + res.getResponseCode());
  } catch (e) {
    Logger.log("Error: " + e);
  }
}
