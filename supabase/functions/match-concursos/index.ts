import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─────────────────────────────────────────────────────────────
// NORMALIZACIÓN
// ─────────────────────────────────────────────────────────────
function normalizar(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// SCORING — perfil vs concurso
//
// Estrategia multicapa:
// 1. Keyword match: palabras del perfil (servicios/profesiones/especialidades)
//    contra keywords del concurso → hasta 80 pts
// 2. País bonus: perfil.pais == concurso.pais → +15 pts
// 3. Ciudad bonus: el lugar del concurso menciona la ciudad del perfil → +5 pts
// ─────────────────────────────────────────────────────────────
function calcularScore(
  concurso: {
    keywords: string[] | null;
    cargo: string | null;
    titulo: string;
    lugar: string | null;
    pais: string;
  },
  perfil: {
    pais: string | null;
    ciudad: string | null;
    servicios: string[] | null;
    profesiones: string[] | null;
    especialidades: string[] | null;
  }
): { score: number; keywords_match: string[]; cumple: boolean } {
  // Palabras del perfil del trabajador
  const perfilKws = [
    ...(perfil.servicios || []),
    ...(perfil.profesiones || []),
    ...(perfil.especialidades || []),
  ].map(normalizar).filter(Boolean);

  // Palabras del concurso (del campo keywords precalculado + cargo normalizado)
  const concursoKws = new Set([
    ...(concurso.keywords || []),
    ...normalizar(concurso.cargo || concurso.titulo)
      .split(/\s+/).filter(w => w.length > 3),
  ]);

  if (perfilKws.length === 0 || concursoKws.size === 0) {
    return { score: 0, keywords_match: [], cumple: false };
  }

  const matched: string[] = [];

  for (const kp of perfilKws) {
    // Match exacto o substring en ambas direcciones
    for (const kc of concursoKws) {
      if (kc === kp || kc.includes(kp) || kp.includes(kc)) {
        if (!matched.includes(kp)) matched.push(kp);
        break;
      }
    }
  }

  // Score base: proporción del perfil que coincide (0-80)
  let score = Math.round((matched.length / perfilKws.length) * 80);

  // Bonus país — normalizar nombre completo a código ISO
  const PAIS_ISO: Record<string, string> = {
    "uruguay": "UY", "argentina": "AR", "chile": "CL", "colombia": "CO",
    "peru": "PE", "perú": "PE", "brasil": "BR", "brazil": "BR",
    "paraguay": "PY", "bolivia": "BO", "ecuador": "EC", "venezuela": "VE",
  };
  const perfilPaisRaw = normalizar(perfil.pais || "uruguay");
  const perfilPaisISO = PAIS_ISO[perfilPaisRaw] || perfilPaisRaw.slice(0, 2).toUpperCase();
  if (perfilPaisISO === concurso.pais.toUpperCase()) score += 15;

  // Bonus ciudad
  if (perfil.ciudad && concurso.lugar) {
    const ciudadNorm = normalizar(perfil.ciudad);
    const lugarNorm  = normalizar(concurso.lugar);
    if (lugarNorm.includes(ciudadNorm) || ciudadNorm.includes(lugarNorm)) {
      score += 5;
    }
  }

  score = Math.min(score, 100);
  const cumple = score >= 40;

  return { score, keywords_match: matched, cumple };
}

// ─────────────────────────────────────────────────────────────
// MATCHING PARA UN WORKER
// ─────────────────────────────────────────────────────────────
async function matchWorker(workerId: string): Promise<{ procesados: number; error?: string }> {
  // Leer perfil
  const { data: perfil, error: perfilErr } = await supabase
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, rol")
    .eq("id", workerId)
    .single();

  if (perfilErr || !perfil) return { procesados: 0, error: perfilErr?.message };
  if (perfil.rol !== "worker") return { procesados: 0 };

  // Normalizar nombre de país a código ISO
  const PAIS_ISO: Record<string, string> = {
    "uruguay": "UY", "argentina": "AR", "chile": "CL", "colombia": "CO",
    "peru": "PE", "perú": "PE", "brasil": "BR", "brazil": "BR",
    "paraguay": "PY", "bolivia": "BO", "ecuador": "EC", "venezuela": "VE",
  };
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

      let totalProcesados = 0;
      for (const w of workers) {
        const r = await matchWorker(w.id);
        totalProcesados += r.procesados;
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
