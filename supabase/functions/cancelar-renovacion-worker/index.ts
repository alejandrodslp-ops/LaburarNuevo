import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const PAYPAL_SECRET    = Deno.env.get("PAYPAL_SECRET") ?? "";
const PAYPAL_ENV       = Deno.env.get("PAYPAL_ENV") ?? "sandbox";
const PAYPAL_API_BASE  = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type":                 "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: CORS });

    const { data: perfil } = await supabase.from("profiles")
      .select("worker_paypal_subscription_id, worker_renovacion_automatica")
      .eq("id", user.id).single();

    if (!perfil?.worker_paypal_subscription_id) {
      return new Response(JSON.stringify({ error: "No tenés una renovación automática activa" }), {
        status: 400, headers: CORS,
      });
    }
    if (perfil.worker_renovacion_automatica === false) {
      return new Response(JSON.stringify({ ok: true, ya_cancelada: true }), { headers: CORS });
    }

    const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("PayPal no devolvió access_token");

    const cancelRes = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${perfil.worker_paypal_subscription_id}/cancel`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelado por el worker desde Konexu" }),
        signal: AbortSignal.timeout(15000),
      },
    );
    // PayPal devuelve 204 sin body en un cancel exitoso. Un 404 significa que
    // la suscripción ya no existe del lado de PayPal (ej. ya estaba cancelada
    // o vencida) — se trata igual como éxito, porque el efecto que importa
    // (no volver a cobrar) ya está garantizado en cualquiera de los 2 casos.
    if (!cancelRes.ok && cancelRes.status !== 404) {
      const errData = await cancelRes.json().catch(() => ({}));
      console.error("PayPal cancelar subscription error:", cancelRes.status, errData);
      return new Response(JSON.stringify({ error: "No se pudo cancelar en PayPal" }), {
        status: 502, headers: CORS,
      });
    }

    await supabase.from("profiles").update({ worker_renovacion_automatica: false }).eq("id", user.id);

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (e) {
    console.error("cancelar-renovacion-worker error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
