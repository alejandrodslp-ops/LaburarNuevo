import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type":                 "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Verificar JWT — el user_id viene del token, no del body
    const authHeader = req.headers.get("Authorization") ?? "";
    const token      = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: CORS });
    }

    const body = await req.json();
    const { monto, descripcion, worker_id, cantidad_perfiles, tipo } = body;

    // user_id siempre del token verificado — nunca del body
    const userId = user.id;

    const preference = {
      items: [{
        title:      descripcion || "Nexu - Ver perfiles completos",
        quantity:   1,
        unit_price: monto || 1,
        currency_id: "USD",
      }],
      external_reference: userId,
      metadata: {
        worker_id:          worker_id          || null,
        cantidad_perfiles:  cantidad_perfiles  || 3,
        tipo:               tipo               || "employer_visualizaciones",
      },
      notification_url: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/webhook-pago",
      back_urls: {
        success: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=success",
        failure: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=failure",
        pending: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=pending",
      },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      body:    JSON.stringify(preference),
      signal:  AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("MP crear preferencia error:", res.status, errData);
      return new Response(JSON.stringify({ error: "Error al crear preferencia de pago" }), {
        status: 502, headers: CORS,
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({
      init_point:   data.init_point,
      preference_id: data.id,
    }), { headers: CORS });

  } catch (e) {
    console.error("crear-pago error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
