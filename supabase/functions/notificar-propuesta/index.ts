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
    // Verificar quién llama de verdad — antes cualquiera con la anon key
    // podía mandar una push "de Konexu" con cualquier texto a cualquier
    // user_id, sin ninguna relación real de por medio. Ahora se exige el
    // JWT del caller y una fila reciente en mensajes/propuestas que
    // conecte a ese caller con el destinatario — la misma relación que
    // la app ya crea (con RLS) antes de llamar a esta función.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: CORS });

    const { user_id, worker_id, titulo, cuerpo, pantalla } = await req.json();
    const destinatario = user_id || worker_id;
    if (!destinatario) throw new Error("user_id requerido");

    const hace5min = new Date(Date.now() - 5 * 60000).toISOString();
    const [{ data: msg }, { data: prop }] = await Promise.all([
      supabase.from("mensajes").select("id")
        .or(`and(sender_id.eq.${caller.id},receiver_id.eq.${destinatario}),and(sender_id.eq.${destinatario},receiver_id.eq.${caller.id})`)
        .gte("created_at", hace5min).limit(1).maybeSingle(),
      supabase.from("propuestas").select("id")
        .or(`and(employer_id.eq.${caller.id},worker_id.eq.${destinatario}),and(employer_id.eq.${destinatario},worker_id.eq.${caller.id})`)
        .gte("created_at", hace5min).limit(1).maybeSingle(),
    ]);
    if (!msg && !prop) {
      return new Response(JSON.stringify({ error: "Sin relación reciente con el destinatario" }), { status: 403, headers: CORS });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token, notificaciones_activas")
      .eq("id", destinatario)
      .single();

    if (!profile?.push_token) {
      return new Response(JSON.stringify({ ok: true, motivo: "sin_token" }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Silenciado = igual se manda (se ve, actualiza badge), pero sin sonido.
    const conSonido = profile.notificaciones_activas !== false;

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        to: profile.push_token,
        title: titulo || "Nueva notificación de Konexu 🔔",
        body: cuerpo || "",
        sound: conSonido ? "default" : null,
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
