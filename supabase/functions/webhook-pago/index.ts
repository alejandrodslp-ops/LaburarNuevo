import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MP_ACCESS_TOKEN = "TEST-2901423997839960-050115-8f38bbd0234f1c04e6fe0520760db9c0-207844753";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    console.log("Webhook recibido:", JSON.stringify(body));

    // MercadoPago envia notificacion de pago
    if (body.type === "payment" && body.data?.id) {
      const paymentId = body.data.id;

      // Verificar el pago con MP
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });
      const payment = await res.json();
      console.log("Pago verificado:", JSON.stringify(payment));

      if (payment.status === "approved") {
        const userId = payment.external_reference;
        const cantidadPerfiles = Number(payment.metadata?.cantidad_perfiles) || 3;
        const tipo = payment.metadata?.tipo || "employer_visualizaciones";

        if (tipo === "worker_activacion") {
          // Activar perfil del trabajador por 30 días
          const hasta = new Date();
          hasta.setDate(hasta.getDate() + 60);
          await supabase.from("profiles").update({
            perfil_activo: true,
            perfil_activo_hasta: hasta.toISOString(),
          }).eq("id", userId);
        } else {
          // Sumar visualizaciones al empleador según el paquete pagado
          await supabase.rpc("sumar_visualizaciones", {
            employer_id: userId,
            cantidad: cantidadPerfiles,
          });
        }

        // Registrar pago en tabla pagos
        await supabase.from("pagos").insert({
          user_id: userId,
          monto: payment.transaction_amount,
          moneda: payment.currency_id,
          estado: "aprobado",
          metodo: "mercadopago",
          referencia_externa: String(paymentId),
        });

        console.log("Pago procesado para usuario:", userId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.log("Error webhook:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
