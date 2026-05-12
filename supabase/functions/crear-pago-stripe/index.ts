import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

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
    console.log("Body recibido:", JSON.stringify(body));

    const { user_id, monto, descripcion } = body;

    const params = new URLSearchParams();
    params.append("amount", String(Math.round((monto || 2) * 100)));
    params.append("currency", "usd");
    params.append("description", descripcion || "Nexu - Ver perfiles completos");

    console.log("Llamando a Stripe con params:", params.toString());

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    console.log("Respuesta Stripe:", JSON.stringify(data));

    if(data.error){
      throw new Error(data.error.message);
    }

    return new Response(JSON.stringify({
      client_secret: data.client_secret,
      payment_intent_id: data.id,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.log("ERROR:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
