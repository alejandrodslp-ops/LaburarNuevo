import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// MP_BR_ACCESS_TOKEN = token de MercadoPago Brasil (cuenta brasileña)
// Diferente del MP_ACCESS_TOKEN uruguayo/argentino
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const MP_BR_TOKEN  = Deno.env.get("MP_BR_ACCESS_TOKEN") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Verificar JWT del usuario
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Token invalido" }), { status: 401, headers: CORS });

    const { monto_brl = 15, tipo = "worker_activacion" } = await req.json().catch(() => ({}));

    // Obtener email del usuario para el pagador PIX
    const authUser = await supabase.auth.admin.getUserById(user.id);
    const email = authUser.data.user?.email ?? "pagador@nexu.app";

    if (!MP_BR_TOKEN) {
      // Modo demo: retornar instrucciones con clave PIX estática
      // Útil para probar el flujo antes de tener cuenta BR
      return new Response(JSON.stringify({
        ok:       true,
        modo:     "estatico",
        pix_key:  Deno.env.get("PIX_KEY_ESTATICA") ?? "soporte@nexu.app",
        monto:    monto_brl,
        moeda:    "BRL",
        descricao: `Nexu - ${tipo === "worker_activacion" ? "Ativacao 60 dias" : "Creditos"}`,
        referencia: user.id.slice(0, 8).toUpperCase(),
        instrucoes: `Pague R$ ${monto_brl} via PIX para a chave acima. Coloque seu ID no campo "descricao": ${user.id.slice(0, 8).toUpperCase()}`,
      }), { headers: { "Content-Type": "application/json", ...CORS } });
    }

    // Crear pago PIX via MercadoPago Brasil
    const payment = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${MP_BR_TOKEN}`,
        "X-Idempotency-Key": `nexu-pix-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: monto_brl,
        description:        `Nexu - ${tipo === "worker_activacion" ? "Ativacao perfil 60 dias" : "Creditos visualizacoes"}`,
        payment_method_id:  "pix",
        external_reference: user.id,
        metadata:           { tipo, user_id: user.id },
        notification_url:   `${SUPABASE_URL}/functions/v1/webhook-pago`,
        payer: { email },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!payment.ok) {
      const err = await payment.json();
      throw new Error(err.message ?? `MP error ${payment.status}`);
    }

    const data = await payment.json();
    const pix = data.point_of_interaction?.transaction_data ?? {};

    return new Response(JSON.stringify({
      ok:           true,
      modo:         "dinamico",
      payment_id:   data.id,
      status:       data.status,
      qr_code:      pix.qr_code,          // string para "Copia e Cola"
      qr_base64:    pix.qr_code_base64,   // imagen PNG en base64
      monto:        monto_brl,
      moeda:        "BRL",
      vence_em:     new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }), { headers: { "Content-Type": "application/json", ...CORS } });

  } catch (e) {
    console.error("criar-pago-pix error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
