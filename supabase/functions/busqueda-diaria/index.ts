import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scrapeGoogleNews, extraerKeywords } from "../_shared/scraper.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase      = createClient(SUPABASE_URL, SERVICE_KEY);

// Mapa de país (nombre o código) → código ISO para Google News
const PAIS_ISO: Record<string, string> = {
  "uruguay":"UY","argentina":"AR","chile":"CL","colombia":"CO",
  "peru":"PE","perú":"PE","brasil":"BR","brazil":"BR","paraguay":"PY",
  "bolivia":"BO","ecuador":"EC","venezuela":"VE","mexico":"MX","méxico":"MX",
  "cuba":"CU","costa rica":"CR","panama":"PA","panamá":"PA","guatemala":"GT",
  "el salvador":"SV","honduras":"HN","nicaragua":"NI",
  "republica dominicana":"DO","república dominicana":"DO",
  "espana":"ES","españa":"ES","spain":"ES","portugal":"PT",
  "italia":"IT","italy":"IT","francia":"FR","france":"FR",
  "alemania":"DE","germany":"DE","reino unido":"GB","united kingdom":"GB",
  "estados unidos":"US","united states":"US","usa":"US",
  "canada":"CA","canadá":"CA","australia":"AU",
  "suecia":"SE","sweden":"SE","noruega":"NO","norway":"NO",
  "japon":"JP","japón":"JP","japan":"JP","india":"IN",
};

function paisISO(pais: string | null): string {
  if (!pais) return "UY";
  const norm = pais.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return PAIS_ISO[norm] || pais.slice(0, 2).toUpperCase();
}

// Idioma por país ISO
const LANG: Record<string, string> = {
  BR:"pt", PT:"pt", DE:"de", FR:"fr", IT:"it",
  GB:"en", US:"en", CA:"en", AU:"en", SE:"en", NO:"en", JP:"ja", IN:"en",
};

serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  // 1. Cargar workers con búsqueda diaria activa
  const MAX_POR_EJECUCION = 200;

  const { data: workers, error } = await supabase
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, descripcion_libre")
    .eq("busqueda_diaria_on", true)
    .eq("perfil_activo", true)
    .not("descripcion_libre", "is", null)
    .limit(MAX_POR_EJECUCION);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!workers?.length) return new Response(JSON.stringify({ ok: true, procesados: 0 }), {
    headers: { "Content-Type": "application/json" },
  });

  console.log(`🔍 busqueda-diaria: ${workers.length} workers a procesar`);

  let totalNuevos = 0;
  const LOTE = 5; // procesar en lotes para no sobrecargar Google News

  for (let i = 0; i < workers.length; i += LOTE) {
    const lote = workers.slice(i, i + LOTE);
    await Promise.allSettled(lote.map(async (w) => {
      try {
        // 2. Extraer keywords del texto libre + servicios/profesiones
        const kwsLibre  = extraerKeywords((w.descripcion_libre || "").slice(0, 500));
        const kwsServ   = (w.servicios   || []).flatMap((s: string) => extraerKeywords(s)).slice(0, 4);
        const kwsProf   = (w.profesiones || []).flatMap((p: string) => extraerKeywords(p)).slice(0, 4);
        const keywords  = [...new Set([...kwsLibre, ...kwsServ, ...kwsProf])].slice(0, 6);

        if (!keywords.length) return; // nada para buscar

        const iso    = paisISO(w.pais);
        const lang   = LANG[iso] || "es";
        const lugar  = w.ciudad ? `${w.ciudad} ${w.pais || ""}`.trim() : (w.pais || "");
        const query  = `${keywords.join(" ")} ${lugar} empleo trabajo llamado convocatoria`;

        // 3. Buscar en Google News
        const { rows } = await scrapeGoogleNews(iso, query, "busqueda_diaria_gnews", lang, 15);
        if (!rows.length) return;

        // 4. Upsert en concursos (UNIQUE fuente+fuente_id previene duplicados)
        const { error: upsertErr } = await supabase
          .from("concursos")
          .upsert(rows as never[], { onConflict: "fuente,fuente_id", ignoreDuplicates: true });
        if (upsertErr) { console.error(`upsert concursos worker ${w.id}:`, upsertErr.message); return; }

        // 5. Obtener IDs reales de los concursos recién insertados
        const fuente_ids = rows.map(r => r.fuente_id as string);
        const { data: concursosDB } = await supabase
          .from("concursos")
          .select("id, fuente_id")
          .in("fuente_id", fuente_ids)
          .eq("fuente", "busqueda_diaria_gnews");

        if (!concursosDB?.length) return;

        // 6. Crear matches solo para los que NO existen ya (evita notificar lo ya visto)
        const matches = concursosDB.map(c => ({
          concurso_id:     c.id,
          worker_id:       w.id,
          score:           60,
          cumple:          true,
          keywords_match:  keywords,
          notificado:      false,
        }));

        // Solo insertar los que NO existen ya — ignoreDuplicates descarta los viejos
        const { count: insertados } = await supabase
          .from("concurso_matches")
          .upsert(matches, { onConflict: "concurso_id,worker_id", ignoreDuplicates: true })
          .select("id", { count: "exact", head: true });

        const nuevos = insertados ?? 0;
        totalNuevos += nuevos;
        if (nuevos > 0) console.log(`  ✓ Worker ${w.id}: ${nuevos} resultados nuevos`);
      } catch (e) {
        console.error(`  ❌ Worker ${w.id}:`, (e as Error).message);
      }
    }));

    // Pausa entre lotes para no saturar Google News
    if (i + LOTE < workers.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 7. Disparar notificaciones push para los nuevos matches
  if (totalNuevos > 0) {
    await supabase.functions.invoke("notificar-matches", {}).catch(() => {});
  }

  return new Response(JSON.stringify({
    ok: true,
    workers_procesados: workers.length,
    nuevos_resultados:  totalNuevos,
  }), { headers: { "Content-Type": "application/json" } });
});
