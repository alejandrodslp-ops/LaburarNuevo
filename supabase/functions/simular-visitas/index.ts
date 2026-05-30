import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Solo el cron interno (service_role) puede llamar esta función
  if (req.headers.get("Authorization") !== `Bearer ${KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const db = createClient(URL, KEY, { auth: { persistSession: false } });

  const { error, data } = await db.rpc("incrementar_vistas_simuladas");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, ejecutado: new Date().toISOString(), resultado: data }),
    { headers: { "Content-Type": "application/json", ...CORS } }
  );
});
