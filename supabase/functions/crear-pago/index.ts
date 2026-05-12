import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { user_id, monto, descripcion, worker_id, cantidad_perfiles } = body;

    const preference = {
      items: [
        {
          title: descripcion || "Nexu - Ver perfiles completos",
          quantity: 1,
          unit_price: monto || 1,
          currency_id: "USD",
        },
      ],
      external_reference: user_id,
      metadata: {
        worker_id: worker_id || null,
        cantidad_perfiles: cantidad_perfiles || 3,
      },
      notification_url: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/webhook-pago",
      back_urls: {
        success: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=success",
        failure: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=failure",
        pending: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=pending",
      },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    return new Response(JSON.stringify({
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id: data.id,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
