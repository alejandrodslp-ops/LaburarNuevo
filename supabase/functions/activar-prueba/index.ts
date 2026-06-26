import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DIAS_PRUEBA  = 10;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type":                 "application/json",
};

// Activa la prueba gratis del trabajador — UNA SOLA VEZ por usuario.
// Marca fecha_activacion al activar; si ya está seteada, la prueba ya se usó.
// Corre con service_role, por eso puede escribir perfil_activo (el cliente no).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: CORS });
    }

    // El perfil a activar es SIEMPRE el del token, nunca del body.
    const userId = user.id;

    const { data: perfil, error: perfErr } = await supabase
      .from("profiles")
      .select("perfil_activo, perfil_activo_hasta, fecha_activacion")
      .eq("id", userId)
      .single();
    if (perfErr || !perfil) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), { status: 404, headers: CORS });
    }

    // Ya está activo y vigente → nada que hacer.
    if (perfil.perfil_activo && perfil.perfil_activo_hasta && new Date(perfil.perfil_activo_hasta) > new Date()) {
      return new Response(JSON.stringify({ ok: true, ya_activo: true, hasta: perfil.perfil_activo_hasta }), { headers: CORS });
    }

    // REGLA "una sola vez": si ya tiene fecha_activacion, la prueba ya fue usada.
    if (perfil.fecha_activacion) {
      return new Response(JSON.stringify({ ok: false, prueba_usada: true }), { headers: CORS });
    }

    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + DIAS_PRUEBA * 24 * 60 * 60 * 1000);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        perfil_activo:       true,
        perfil_activo_hasta: hasta.toISOString(),
        fecha_activacion:    ahora.toISOString(),
      })
      .eq("id", userId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, activado: true, hasta: hasta.toISOString() }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
