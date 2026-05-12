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

// Envía notificaciones push a workers que tienen matches nuevos sin notificar
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Traer todos los matches que cumplen y no fueron notificados todavía
    // junto con el push_token del worker y los datos del concurso
    const { data: matches, error } = await supabase
      .from("concurso_matches")
      .select(`
        id,
        score,
        keywords_match,
        worker_id,
        concursos (cargo, organismo, pais, fecha_cierre, url_detalle),
        profiles!concurso_matches_worker_id_fkey (push_token, nombre)
      `)
      .eq("cumple", true)
      .eq("notificado", false)
      .order("score", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!matches?.length) {
      return new Response(
        JSON.stringify({ ok: true, enviadas: 0, motivo: "sin matches nuevos" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Agrupar por worker para enviar una sola notificación con el resumen
    const porWorker = new Map<string, {
      push_token: string;
      nombre: string;
      matches: typeof matches;
    }>();

    for (const m of matches) {
      const profile = m.profiles as { push_token: string; nombre: string } | null;
      if (!profile?.push_token) continue;
      if (!porWorker.has(m.worker_id)) {
        porWorker.set(m.worker_id, {
          push_token: profile.push_token,
          nombre: profile.nombre || "Hola",
          matches: [],
        });
      }
      porWorker.get(m.worker_id)!.matches.push(m);
    }

    let enviadas = 0;
    const notificados: string[] = [];

    for (const [workerId, data] of porWorker) {
      const cantidad = data.matches.length;
      const concurso = data.matches[0].concursos as {
        cargo: string; organismo: string; pais: string; fecha_cierre: string;
      } | null;

      const titulo = cantidad === 1
        ? `📋 Nuevo llamado compatible con tu perfil`
        : `📋 ${cantidad} llamados compatibles con tu perfil`;

      const cuerpo = cantidad === 1 && concurso
        ? `${concurso.cargo || "Cargo público"} — ${concurso.organismo || concurso.pais}`
        : `Encontramos ${cantidad} llamados que coinciden con tu experiencia`;

      // Enviar push notification via Expo
      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify({
          to: data.push_token,
          title: titulo,
          body: cuerpo,
          sound: "default",
          badge: cantidad,
          data: { pantalla: "Concursa" },
        }),
      });

      const pushResult = await pushRes.json();
      const exito = pushResult?.data?.status === "ok" || pushResult?.status === "ok";

      if (exito || pushRes.ok) {
        enviadas++;
        notificados.push(...data.matches.map((m) => m.id));
      }
    }

    // Marcar como notificados los matches que se enviaron
    if (notificados.length > 0) {
      await supabase
        .from("concurso_matches")
        .update({ notificado: true })
        .in("id", notificados);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        workers_notificados: enviadas,
        matches_marcados: notificados.length,
        total_matches_pendientes: matches.length,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("notificar-matches error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
