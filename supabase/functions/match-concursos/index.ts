import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PAIS_ISO, calcularScore } from "../_shared/matching.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─────────────────────────────────────────────────────────────
// MATCHING PARA UN WORKER
// ─────────────────────────────────────────────────────────────
async function matchWorker(workerId: string): Promise<{ procesados: number; error?: string }> {
  // Leer perfil
  const { data: perfil, error: perfilErr } = await supabase
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, tecnicaturas, rol")
    .eq("id", workerId)
    .single();

  if (perfilErr || !perfil) return { procesados: 0, error: perfilErr?.message };
  if (perfil.rol !== "worker") return { procesados: 0 };

  const paisRaw = (perfil.pais || "uruguay").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const pais = PAIS_ISO[paisRaw] || paisRaw.slice(0, 2).toUpperCase();
  const hoy  = new Date().toISOString().slice(0, 10);

  const { data: concursos, error: concursosErr } = await supabase
    .from("concursos")
    .select("id, pais, cargo, titulo, keywords, lugar, fecha_cierre")
    .eq("activo", true)
    .eq("pais", pais)
    .or(`fecha_cierre.gte.${hoy},fecha_cierre.is.null`);

  if (concursosErr) return { procesados: 0, error: concursosErr.message };
  if (!concursos?.length) return { procesados: 0 };

  // Calcular matches y hacer upsert batch
  const batch = concursos.map((c: typeof concursos[0]) => {
    const { score, keywords_match, cumple } = calcularScore(c, perfil);
    return {
      concurso_id: c.id,
      worker_id: workerId,
      score,
      cumple,
      keywords_match,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertErr } = await supabase
    .from("concurso_matches")
    .upsert(batch, { onConflict: "concurso_id,worker_id", ignoreDuplicates: false });

  if (upsertErr) return { procesados: 0, error: upsertErr.message };
  return { procesados: batch.length };
}

// ─────────────────────────────────────────────────────────────
// HTTP HANDLER
//
// Llamadas posibles:
// POST { "worker_id": "uuid" }  — match para un worker específico
// POST { "todos": true }        — match para todos los workers activos (service_role)
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body.todos) {
      // Correr matching para todos los workers activos (llamado desde scraper)
      const { data: workers } = await supabase
        .from("profiles")
        .select("id")
        .eq("rol", "worker")
        .eq("perfil_activo", true);

      if (!workers?.length) {
        return new Response(JSON.stringify({ ok: true, workers: 0 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // Procesar en lotes paralelos de 20 — evita timeout con muchos workers
      const BATCH = 20;
      let totalProcesados = 0;
      for (let i = 0; i < workers.length; i += BATCH) {
        const lote = workers.slice(i, i + BATCH);
        const results = await Promise.allSettled(lote.map(w => matchWorker(w.id)));
        for (const r of results) {
          if (r.status === "fulfilled") totalProcesados += r.value.procesados;
        }
      }

      // Notificar workers con matches nuevos
      supabase.functions.invoke("notificar-matches", {}).catch(() => {});

      return new Response(
        JSON.stringify({ ok: true, workers: workers.length, matches_procesados: totalProcesados }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (body.worker_id) {
      const result = await matchWorker(body.worker_id);
      return new Response(
        JSON.stringify({ ok: !result.error, ...result }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(JSON.stringify({ error: "Enviar worker_id o todos:true" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
