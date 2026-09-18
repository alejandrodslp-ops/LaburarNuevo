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

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    // Paso 1: matches sin notificar + su oferta. ofertas.id <- oferta_matches.oferta_id
    // es una FK directa (Tarea 2), este embed sí resuelve.
    const { data: matches, error } = await supabase
      .from("oferta_matches")
      .select(`
        id,
        oferta_id,
        ofertas (id, empleo, titulo, employer_id)
      `)
      .eq("cumple", true)
      .eq("notificado", false)
      .order("score", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!matches?.length) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    type OfertaEmbed = { id: string; empleo: string | null; titulo: string; employer_id: string } | null;

    // Paso 2: push_token de cada empresa dueña, en una query aparte.
    // ofertas.employer_id referencia auth.users(id), NO profiles(id) directamente
    // (verificado: la FK real es ofertas_employer_id_fkey -> auth.users), asi que
    // PostgREST no puede resolver un embed ofertas->profiles en un solo select.
    const employerIds = Array.from(new Set(
      matches.map(m => (m.ofertas as unknown as OfertaEmbed)?.employer_id).filter(Boolean)
    )) as string[];

    const { data: perfiles, error: perfilesErr } = await supabase
      .from("profiles")
      .select("id, push_token")
      .in("id", employerIds);

    if (perfilesErr) throw perfilesErr;
    const tokenPorEmpresa = new Map((perfiles || []).map(p => [p.id, p.push_token as string | null]));

    const porOferta = new Map<string, {
      push_token: string;
      empleo: string;
      matchIds: string[];
    }>();

    for (const m of matches) {
      const oferta = m.ofertas as unknown as OfertaEmbed;
      const push_token = oferta ? tokenPorEmpresa.get(oferta.employer_id) : null;
      if (!oferta || !push_token) continue;

      if (!porOferta.has(m.oferta_id)) {
        porOferta.set(m.oferta_id, { push_token, empleo: oferta.empleo || oferta.titulo, matchIds: [] });
      }
      porOferta.get(m.oferta_id)!.matchIds.push(m.id);
    }

    let enviadas = 0;
    const notificados: string[] = [];

    for (const [ofertaId, data] of porOferta) {
      const cantidad = data.matchIds.length;
      const titulo = cantidad === 1
        ? `Tenés 1 candidato nuevo`
        : `Tenés ${cantidad} candidatos nuevos`;
      const cuerpo = `Para tu búsqueda de ${data.empleo}.`;

      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          to: data.push_token,
          title: titulo,
          body: cuerpo,
          sound: "default",
          badge: cantidad,
          data: { pantalla: "MisOfertasEmpresa", oferta_id: ofertaId },
        }),
      });

      const pushResult = await pushRes.json().catch(() => ({}));
      const exito = pushResult?.data?.status === "ok" || pushResult?.status === "ok";

      if (exito || pushRes.ok) {
        enviadas++;
        notificados.push(...data.matchIds);
      }
    }

    if (notificados.length > 0) {
      await supabase.from("oferta_matches").update({ notificado: true }).in("id", notificados);
    }

    return new Response(
      JSON.stringify({ ok: true, empresas_notificadas: enviadas, matches_marcados: notificados.length }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
