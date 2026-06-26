import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DIAS = 5;
const MAX_REFERIDOS = 3;
const MS_DIA = 86_400_000;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type":                 "application/json",
};

// Acredita un referido: marca referido_por en el nuevo usuario y premia al referente
// con +5 días (máximo 3 referidos). Misma lógica que el viejo acreditarReferido del cliente,
// pero en el servidor (service_role) — por eso puede escribir las columnas protegidas.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { codigo_referido, nuevo_user_id } = await req.json();
    if (!codigo_referido || !nuevo_user_id) {
      return new Response(JSON.stringify({ ok: false, motivo: "faltan datos" }), { headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Referente por su código
    const { data: referente } = await supabase
      .from("profiles")
      .select("id, perfil_activo_hasta, periodo_gratis_hasta")
      .eq("codigo_referido", codigo_referido)
      .single();
    if (!referente) return new Response(JSON.stringify({ ok: false, motivo: "codigo invalido" }), { headers: CORS });
    if (referente.id === nuevo_user_id) return new Response(JSON.stringify({ ok: false, motivo: "auto" }), { headers: CORS });

    // Idempotencia: no re-acreditar si el nuevo usuario ya tiene referente
    const { data: nuevo } = await supabase.from("profiles").select("referido_por").eq("id", nuevo_user_id).single();
    if (!nuevo) return new Response(JSON.stringify({ ok: false, motivo: "perfil inexistente" }), { headers: CORS });
    if (nuevo.referido_por) return new Response(JSON.stringify({ ok: false, motivo: "ya referido" }), { headers: CORS });

    // Registrar la relación siempre
    await supabase.from("profiles").update({ referido_por: referente.id }).eq("id", nuevo_user_id);

    // Premio solo hasta el máximo
    const { count } = await supabase.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referido_por", referente.id);
    if ((count || 0) > MAX_REFERIDOS) {
      return new Response(JSON.stringify({ ok: true, premiado: false, motivo: "limite" }), { headers: CORS });
    }

    const now = Date.now();
    const baseActivo = referente.perfil_activo_hasta
      ? Math.max(new Date(referente.perfil_activo_hasta).getTime(), now)
      : now + 10 * MS_DIA;
    const nuevaActivo = new Date(baseActivo + DIAS * MS_DIA).toISOString();
    const baseGratis = referente.periodo_gratis_hasta
      ? Math.max(new Date(referente.periodo_gratis_hasta).getTime(), now)
      : baseActivo;
    const nuevaGratis = new Date(baseGratis + DIAS * MS_DIA).toISOString();

    await supabase.from("profiles").update({
      perfil_activo_hasta:  nuevaActivo,
      periodo_gratis_hasta: nuevaGratis,
      perfil_activo:        true,
    }).eq("id", referente.id);

    return new Response(JSON.stringify({ ok: true, premiado: true, hasta: nuevaActivo }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
