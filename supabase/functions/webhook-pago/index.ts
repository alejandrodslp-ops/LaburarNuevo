import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MP_ACCESS_TOKEN    = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_WEBHOOK_SECRET  = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verifica la firma HMAC-SHA256 que MercadoPago incluye en cada notificación.
// Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
async function verificarFirmaMP(req: Request, dataId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return true; // si no hay secret configurado, se acepta (modo desarrollo)

  const signature  = req.headers.get("x-signature")   ?? "";
  const requestId  = req.headers.get("x-request-id")  ?? "";

  const parts = Object.fromEntries(signature.split(",").map(p => {
    const [k, ...v] = p.split("=");
    return [k.trim(), v.join("=").trim()];
  }));
  const ts = parts["ts"] ?? "";
  const v1 = parts["v1"] ?? "";
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig      = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return v1 === expected;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    console.log("Webhook recibido:", JSON.stringify(body));

    if (body.type === "payment" && body.data?.id) {
      const paymentId = String(body.data.id);

      // 1. Verificar firma de MercadoPago
      const firmaOk = await verificarFirmaMP(req, paymentId);
      if (!firmaOk) {
        console.error("Firma de webhook inválida — request rechazado");
        return new Response("Unauthorized", { status: 401 });
      }

      // 2. Idempotencia: ignorar si este pago ya fue procesado
      const { data: yaRegistrado } = await supabase
        .from("pagos")
        .select("id")
        .eq("referencia_externa", paymentId)
        .maybeSingle();

      if (yaRegistrado) {
        console.log("Pago ya procesado, ignorando reenvío:", paymentId);
        return new Response(JSON.stringify({ ok: true, duplicado: true }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      // 3. Verificar el pago con la API de MP
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.error("MP API error:", res.status);
        return new Response(JSON.stringify({ ok: false, error: "MP API error" }), {
          status: 502, headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      const payment = await res.json();
      console.log("Pago verificado:", payment.status, payment.id);

      if (payment.status === "approved") {
        const userId            = payment.external_reference;
        const cantidadPerfiles  = Number(payment.metadata?.cantidad_perfiles) || 3;
        const tipo              = payment.metadata?.tipo || "employer_visualizaciones";

        // 4. Registrar el pago PRIMERO — así si falla lo siguiente, el webhook
        //    puede reintentar sin riesgo de duplicado (la 2da vez lo detecta como yaRegistrado)
        const { error: pagoErr } = await supabase.from("pagos").insert({
          user_id:            userId,
          monto:              payment.transaction_amount,
          moneda:             payment.currency_id,
          estado:             "aprobado",
          metodo:             "mercadopago",
          referencia_externa: paymentId,
        });

        if (pagoErr) {
          // Si ya existe por race condition, tratar como duplicado
          if (pagoErr.code === "23505") {
            return new Response(JSON.stringify({ ok: true, duplicado: true }), {
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          throw pagoErr;
        }

        // 5. Activar o acreditar según el tipo de pago
        if (tipo === "worker_activacion") {
          const hasta = new Date();
          hasta.setDate(hasta.getDate() + 60);
          await supabase.from("profiles").update({
            perfil_activo:       true,
            perfil_activo_hasta: hasta.toISOString(),
          }).eq("id", userId);
        } else {
          await supabase.rpc("sumar_visualizaciones", {
            employer_id: userId,
            cantidad:    cantidadPerfiles,
          });
        }

        console.log("Pago procesado para usuario:", userId, "tipo:", tipo);

        // 6. Generar comprobante de pago (silencioso — no bloquea si falla)
        supabase.functions.invoke("generar-comprobante", {
          body: {
            employer_id:         userId,
            monto:               payment.transaction_amount,
            moneda:              payment.currency_id ?? "USD",
            metodo:              "mercadopago",
            referencia_externa:  String(paymentId),
            concepto:            tipo === "worker_activacion"
              ? "Activación de perfil trabajador — Konexu (60 días)"
              : `Visualizaciones de perfiles empleador — Konexu (${cantidadPerfiles} créditos)`,
          },
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });

  } catch (e) {
    console.error("Error webhook:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
