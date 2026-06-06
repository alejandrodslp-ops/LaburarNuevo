import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurar en Supabase Secrets:
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
// MP_BR_ACCESS_TOKEN
// PIX_KEY_ESTATICA (clave PIX de respaldo: email, CPF, o telefono)

const CORS = { "Access-Control-Allow-Origin": "*" };

// ── Enviar mensaje WhatsApp via Twilio ──────────────────────────────────────
async function enviarWhatsApp(para: string, mensaje: string): Promise<void> {
  const sid   = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const from  = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "whatsapp:+14155238886"; // sandbox Twilio

  if (!sid || !token) { console.warn("Twilio no configurado"); return; }

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${sid}:${token}`)}`,
    },
    body: new URLSearchParams({ From: from, To: `whatsapp:${para}`, Body: mensaje }).toString(),
    signal: AbortSignal.timeout(10000),
  }).catch(e => console.error("Twilio error:", e.message));
}

// ── Generar PIX via MercadoPago Brasil ─────────────────────────────────────
async function generarPIX(email: string, userId: string, monto: number): Promise<{
  qr_code: string; payment_id: number | null; modo: string;
}> {
  const MP_BR_TOKEN = Deno.env.get("MP_BR_ACCESS_TOKEN") ?? "";
  const PIX_KEY     = Deno.env.get("PIX_KEY_ESTATICA") ?? "soporte@nexu.app";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  if (!MP_BR_TOKEN) {
    // Modo estático: clave PIX fija con instrucción de descripción
    return {
      qr_code:    PIX_KEY,
      payment_id: null,
      modo:       "estatico",
    };
  }

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "Authorization":     `Bearer ${MP_BR_TOKEN}`,
      "X-Idempotency-Key": `nexu-whatsapp-${userId}-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: monto,
      description:        "Nexu - Ativacao perfil trabalhador 60 dias",
      payment_method_id:  "pix",
      external_reference: userId,
      metadata:           { tipo: "worker_activacion", user_id: userId, canal: "whatsapp" },
      notification_url:   `${SUPABASE_URL}/functions/v1/webhook-pago`,
      payer:              { email },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MP error ${res.status}: ${err.message ?? ""}`);
  }

  const data = await res.json();
  const qr = data.point_of_interaction?.transaction_data?.qr_code ?? PIX_KEY;
  return { qr_code: qr, payment_id: data.id, modo: "dinamico" };
}

// ── Construir mensaje de respuesta ─────────────────────────────────────────
function mensagemResposta(estado: "bienvenida" | "pix" | "activo" | "no_encontrado", dados?: Record<string, string>): string {
  switch (estado) {
    case "bienvenida":
      return `Oi! Bem-vindo ao *Nexu* 👋\n\nSomos a plataforma que conecta trabalhadores e empregadores na America Latina.\n\nPara ativar seu perfil por 60 dias, envie seu *e-mail cadastrado* no Nexu.`;

    case "pix":
      return `✅ *Pagamento via PIX*\n\nOla, *${dados?.nome ?? "trabalhador"}*!\n\nPara ativar seu perfil Nexu por 60 dias:\n\n💰 Valor: *R$ ${dados?.monto ?? "15"}*\n\n📋 *Chave PIX (Copia e Cola):*\n\`${dados?.qr_code}\`\n\nCopie a chave acima, abra seu banco e realize o pagamento pelo PIX.\n\n⏱️ Seu perfil sera ativado *automaticamente* em instantes apos o pagamento.\n\n_Qualquer duvida: soporte@nexu.app_`;

    case "activo":
      return `🎉 Seu perfil ja esta *ativo*!\n\nVoce aparece nos resultados de busca para empregadores. Boa sorte! 💪`;

    case "no_encontrado":
      return `Nao encontrei esse e-mail no Nexu. Verifique o e-mail cadastrado ou baixe o app:\n\n📱 *nexu.app*`;

    default:
      return "Oi! Como posso ajudar?";
  }
}

// ── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Twilio envía form-data
    const form     = await req.formData().catch(() => null);
    const body     = form ? Object.fromEntries(form.entries()) : await req.json().catch(() => ({}));

    const telefono = String(body.From ?? "").replace("whatsapp:", "").trim();
    const mensaje  = String(body.Body ?? "").trim().toLowerCase();

    console.log(`WhatsApp de ${telefono}: "${mensaje}"`);

    if (!telefono) {
      return new Response("ok", { headers: CORS });
    }

    // Detectar intención
    const esEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const esEmail = esEmailRegex.test(mensaje);
    const esSaludo = /^(oi|ola|ola|hi|hello|hola|nexu|ativar|activar|pagar|pix)/.test(mensaje);

    if (esSaludo && !esEmail) {
      await enviarWhatsApp(telefono, mensagemResposta("bienvenida"));
      return new Response("ok", { headers: CORS });
    }

    if (esEmail) {
      // Buscar usuario por email en auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === mensaje);

      if (!authUser) {
        await enviarWhatsApp(telefono, mensagemResposta("no_encontrado"));
        return new Response("ok", { headers: CORS });
      }

      // Verificar si ya está activo
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nombre, perfil_activo, perfil_activo_hasta")
        .eq("id", authUser.id)
        .single();

      if (perfil?.perfil_activo) {
        const hasta = perfil.perfil_activo_hasta
          ? new Date(perfil.perfil_activo_hasta).toLocaleDateString("pt-BR")
          : "";
        await enviarWhatsApp(telefono, mensagemResposta("activo") + (hasta ? `\nValido ate ${hasta}.` : ""));
        return new Response("ok", { headers: CORS });
      }

      // Generar PIX
      const MONTO_BRL = 15;
      const { qr_code, payment_id } = await generarPIX(authUser.email!, authUser.id, MONTO_BRL);

      // Guardar el telefono en el perfil para futuros mensajes
      await supabase.from("profiles").update({ telefono_whatsapp: telefono }).eq("id", authUser.id).catch(() => {});

      const nome = perfil?.nombre ?? authUser.email?.split("@")[0] ?? "trabalhador";
      await enviarWhatsApp(telefono, mensagemResposta("pix", {
        nome,
        monto: String(MONTO_BRL),
        qr_code,
        payment_id: payment_id ? String(payment_id) : "",
      }));

      console.log(`PIX gerado para ${authUser.email} - payment_id: ${payment_id}`);
      return new Response("ok", { headers: CORS });
    }

    // Mensaje no reconocido
    await enviarWhatsApp(telefono, mensagemResposta("bienvenida"));
    return new Response("ok", { headers: CORS });

  } catch (e) {
    console.error("whatsapp-pix-bot error:", (e as Error).message);
    return new Response("ok", { headers: CORS }); // Siempre 200 para Twilio
  }
});
