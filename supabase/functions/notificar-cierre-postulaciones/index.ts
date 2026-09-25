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

// Avisa a un worker cuando un llamado al que se postuló se cierra o vence.
// El scraper borra/reinserta avisos con id nuevo cada día, así que el match
// contra concursos es por (fuente, fuente_id) — nunca por id.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { data: pendientes, error } = await supabase
      .from("concurso_seguimientos")
      .select("id, worker_id, fuente, fuente_id, titulo_snapshot, profiles(push_token, notificaciones_activas)")
      .eq("notificado", false)
      .limit(500);

    if (error) throw error;
    if (!pendientes?.length) {
      return new Response(JSON.stringify({ ok: true, revisados: 0 }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let avisados = 0;
    const yaProcesados: string[] = [];

    for (const p of pendientes) {
      const { data: actual } = await supabase
        .from("concursos")
        .select("activo, fecha_cierre")
        .eq("fuente", p.fuente)
        .eq("fuente_id", p.fuente_id)
        .maybeSingle();

      // Sin match = la fuente ya lo borró definitivamente. Vencido o inactivo = cerrado.
      const cerrado = !actual || actual.activo === false ||
        (actual.fecha_cierre && new Date(actual.fecha_cierre) < new Date());
      if (!cerrado) continue;

      yaProcesados.push(p.id);

      const profile = p.profiles as { push_token: string | null; notificaciones_activas: boolean | null } | null;
      if (!profile?.push_token) continue;

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: profile.push_token,
          title: "📋 Se cerró un llamado al que te postulaste",
          body: p.titulo_snapshot || "Uno de tus llamados seguidos ya no está disponible.",
          sound: profile.notificaciones_activas !== false ? "default" : null,
          data: { pantalla: "Concursa" },
        }),
      });
      avisados++;
    }

    if (yaProcesados.length > 0) {
      await supabase.from("concurso_seguimientos").update({ notificado: true }).in("id", yaProcesados);
    }

    return new Response(
      JSON.stringify({ ok: true, revisados: pendientes.length, cerrados: yaProcesados.length, avisados }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
