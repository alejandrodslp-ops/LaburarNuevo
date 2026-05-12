import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { user_id, worker_id, titulo, cuerpo, pantalla } = await req.json();
    const destinatario = user_id || worker_id;
    if (!destinatario) throw new Error("user_id requerido");

    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", destinatario)
      .single();

    if (!profile?.push_token) {
      return new Response(JSON.stringify({ ok: true, motivo: "sin_token" }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        to: profile.push_token,
        title: titulo || "Nueva notificación de Nexu 🔔",
        body: cuerpo || "",
        sound: "default",
        data: { pantalla: pantalla || "Mensajes" },
      }),
    });

    const result = await res.json();
    console.log("Push enviado:", JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.log("Error notificar-propuesta:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
