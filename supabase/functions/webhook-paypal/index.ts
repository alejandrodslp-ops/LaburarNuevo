import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID   = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const PAYPAL_SECRET      = Deno.env.get("PAYPAL_SECRET") ?? "";
const PAYPAL_ENV         = Deno.env.get("PAYPAL_ENV") ?? "sandbox";
const PAYPAL_WEBHOOK_ID  = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
const PAYPAL_API_BASE    = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Ventana de reintento de cobro fallido antes de desactivar el perfil —
// mismo criterio acordado con el usuario (~5 dias, avisando en cada intento).
const MAX_INTENTOS_COBRO_FALLIDO = 3;

// Mismo patron que notificar-matches: exp.host directo, exito real medido por
// el status del ticket de Expo (no por pushRes.ok, que solo dice "llego la
// request"). Respeta notificaciones_activas=false con sonido apagado en vez
// de no mandar nada — mismo criterio que notificar-cierre-postulaciones.
async function enviarPush(pushToken: string, silencioso: boolean, titulo: string, cuerpo: string) {
  try {
    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title: titulo,
        body: cuerpo,
        sound: silencioso ? null : "default",
        data: { pantalla: "PagoActivacion" },
      }),
    });
    await pushRes.json().catch(() => ({}));
  } catch (_e) {
    // best-effort — un push fallido no debe frenar el procesamiento del webhook
  }
}

async function obtenerTokenPaypal(): Promise<string> {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal no devolvió access_token");
  return data.access_token;
}

// Verificacion de firma real de PayPal — equivalente al HMAC de MercadoPago
// en webhook-pago, pero PayPal delega la verificacion a su propia API en vez
// de que la calculemos nosotros. Requiere PAYPAL_WEBHOOK_ID (se obtiene al
// configurar el webhook en developer.paypal.com -> esta app -> Webhooks).
async function verificarFirmaPaypal(req: Request, body: string): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID) return true; // sin webhook_id configurado, se acepta (modo desarrollo)

  const token = await obtenerTokenPaypal();
  const verifyRes = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transmission_id:   req.headers.get("paypal-transmission-id"),
      transmission_time: req.headers.get("paypal-transmission-time"),
      cert_url:          req.headers.get("paypal-cert-url"),
      auth_algo:         req.headers.get("paypal-auth-algo"),
      transmission_sig:  req.headers.get("paypal-transmission-sig"),
      webhook_id:        PAYPAL_WEBHOOK_ID,
      webhook_event:     JSON.parse(body),
    }),
  });
  const result = await verifyRes.json().catch(() => ({}));
  return result.verification_status === "SUCCESS";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const rawBody = await req.text();
    const firmaOk = await verificarFirmaPaypal(req, rawBody);
    if (!firmaOk) {
      console.error("Firma de webhook PayPal inválida — request rechazado");
      return new Response(JSON.stringify({ error: "Firma inválida" }), { status: 401, headers: CORS });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const resource = event.resource ?? {};

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const workerId = resource.custom_id;
      const subscriptionId = resource.id;
      if (!workerId || !subscriptionId) {
        return new Response(JSON.stringify({ ok: true, ignorado: "sin custom_id/id" }), { headers: CORS });
      }
      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await supabase.from("profiles").update({
        perfil_activo: true,
        perfil_activo_hasta: hasta,
        worker_paypal_subscription_id: subscriptionId,
        worker_renovacion_automatica: true,
        worker_intentos_cobro_fallido: 0,
      }).eq("id", workerId);

    } else if (eventType === "PAYMENT.SALE.COMPLETED") {
      const subscriptionId = resource.billing_agreement_id;
      if (!subscriptionId) {
        return new Response(JSON.stringify({ ok: true, ignorado: "sin billing_agreement_id" }), { headers: CORS });
      }
      const { data: perfil } = await supabase.from("profiles")
        .select("id").eq("worker_paypal_subscription_id", subscriptionId).maybeSingle();
      if (!perfil) {
        return new Response(JSON.stringify({ ok: true, ignorado: "worker no encontrado" }), { headers: CORS });
      }

      // Idempotencia — mismo criterio que webhook-pago (referencia_externa unica)
      const saleId = resource.id;
      const { data: yaRegistrado } = await supabase.from("pagos")
        .select("id").eq("referencia_externa", saleId).maybeSingle();
      if (yaRegistrado) {
        return new Response(JSON.stringify({ ok: true, duplicado: true }), { headers: CORS });
      }

      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await supabase.from("profiles").update({
        perfil_activo: true,
        perfil_activo_hasta: hasta,
        worker_intentos_cobro_fallido: 0,
      }).eq("id", perfil.id);

      await supabase.from("pagos").insert({
        user_id: perfil.id,
        monto: parseFloat(resource.amount?.total ?? "0"),
        moneda: resource.amount?.currency ?? "USD",
        estado: "aprobado",
        metodo: "paypal",
        referencia_externa: saleId,
      });

    } else if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
      const subscriptionId = resource.id;
      const { data: perfil } = await supabase.from("profiles")
        .select("id, push_token, notificaciones_activas, worker_intentos_cobro_fallido")
        .eq("worker_paypal_subscription_id", subscriptionId).maybeSingle();
      if (!perfil) {
        return new Response(JSON.stringify({ ok: true, ignorado: "worker no encontrado" }), { headers: CORS });
      }
      const silencioso = perfil.notificaciones_activas === false;
      const intentos = (perfil.worker_intentos_cobro_fallido ?? 0) + 1;
      if (intentos >= MAX_INTENTOS_COBRO_FALLIDO) {
        await supabase.from("profiles").update({
          perfil_activo: false,
          worker_intentos_cobro_fallido: intentos,
        }).eq("id", perfil.id);
        if (perfil.push_token) {
          await enviarPush(perfil.push_token, silencioso,
            "Se desactivó tu perfil",
            "No pudimos procesar tu renovación automática después de varios intentos. Reactivá cuando quieras desde Konexu.");
        }
      } else {
        await supabase.from("profiles").update({
          worker_intentos_cobro_fallido: intentos,
        }).eq("id", perfil.id);
        if (perfil.push_token) {
          await enviarPush(perfil.push_token, silencioso,
            "No pudimos procesar tu renovación",
            `Intento ${intentos} de ${MAX_INTENTOS_COBRO_FALLIDO} — revisá tu método de pago en PayPal o cancelá desde el menú de tu perfil.`);
        }
      }

    } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
      const subscriptionId = resource.id;
      await supabase.from("profiles")
        .update({ worker_renovacion_automatica: false })
        .eq("worker_paypal_subscription_id", subscriptionId);
    }
    // Cualquier otro evento no listado: se ignora silenciosamente (mismo
    // criterio que webhook-pago con type !== 'payment').

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (e) {
    console.error("webhook-paypal error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
