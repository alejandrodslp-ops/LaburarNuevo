import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PAIS_ISO, calcularScore } from "../_shared/matching.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function matchOferta(ofertaId: string): Promise<{ procesados: number; error?: string }> {
  const { data: oferta, error: ofertaErr } = await supabase
    .from("ofertas")
    .select("id, pais, empleo, titulo, keywords, ciudad, estado, activa")
    .eq("id", ofertaId)
    .single();

  if (ofertaErr || !oferta) return { procesados: 0, error: ofertaErr?.message };
  if (oferta.estado !== "aprobada" || !oferta.activa) return { procesados: 0 };

  const pais = PAIS_ISO[(oferta.pais || "").toLowerCase()] || (oferta.pais || "").slice(0, 2).toUpperCase();

  const { data: workers, error: workersErr } = await supabase
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, tecnicaturas, rol")
    .eq("rol", "worker")
    .eq("perfil_activo", true);

  if (workersErr) return { procesados: 0, error: workersErr.message };
  if (!workers?.length) return { procesados: 0 };

  const batch = workers.map((w: typeof workers[0]) => {
    const { score, keywords_match, cumple } = calcularScore(
      { keywords: oferta.keywords, cargo: oferta.empleo, titulo: oferta.titulo, lugar: oferta.ciudad, pais },
      w
    );
    return {
      oferta_id: ofertaId,
      worker_id: w.id,
      score,
      cumple,
      keywords_match,
      updated_at: new Date().toISOString(),
    };
  }).filter((m: { cumple: boolean }) => m.cumple);

  if (!batch.length) return { procesados: 0 };

  const { error: upsertErr } = await supabase
    .from("oferta_matches")
    .upsert(batch, { onConflict: "oferta_id,worker_id", ignoreDuplicates: false });

  if (upsertErr) return { procesados: 0, error: upsertErr.message };
  return { procesados: batch.length };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body.todos) {
      const { data: ofertas } = await supabase
        .from("ofertas")
        .select("id")
        .eq("estado", "aprobada")
        .eq("activa", true);

      if (!ofertas?.length) {
        return new Response(JSON.stringify({ ok: true, ofertas: 0 }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      let totalProcesados = 0;
      for (const o of ofertas) {
        const r = await matchOferta(o.id);
        totalProcesados += r.procesados;
      }

      supabase.functions.invoke("notificar-matches-ofertas", {}).catch(() => {});

      return new Response(
        JSON.stringify({ ok: true, ofertas: ofertas.length, matches_procesados: totalProcesados }),
        { headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    if (body.oferta_id) {
      const result = await matchOferta(body.oferta_id);
      if (result.procesados > 0) {
        supabase.functions.invoke("notificar-matches-ofertas", {}).catch(() => {});
      }
      return new Response(JSON.stringify({ ok: !result.error, ...result }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return new Response(JSON.stringify({ error: "Enviar oferta_id o todos:true" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
