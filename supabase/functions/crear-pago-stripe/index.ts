import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_SUCCESS_URL   = "konexu://pago-exitoso";
const APP_CANCEL_URL    = "konexu://pago-cancelado";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { user_id, monto, descripcion, cantidad_perfiles, worker_id } = await req.json();

    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY no configurado");

    const params = new URLSearchParams();
    params.append("mode",                               "payment");
    params.append("success_url",                        APP_SUCCESS_URL);
    params.append("cancel_url",                         APP_CANCEL_URL);
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round((monto || 2) * 100)));
    params.append("line_items[0][price_data][product_data][name]", descripcion || "Konexu — Ver perfiles");
    params.append("line_items[0][quantity]",            "1");
    params.append("metadata[user_id]",                  user_id    ?? "");
    params.append("metadata[worker_id]",                worker_id  ?? "");
    params.append("metadata[cantidad_perfiles]",        String(cantidad_perfiles ?? 1));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization":  `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type":   "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return new Response(JSON.stringify({
      checkout_url:  data.url,
      session_id:    data.id,
    }), { headers: { "Content-Type": "application/json", ...CORS } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
