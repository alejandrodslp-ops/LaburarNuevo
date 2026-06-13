import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PROXY      = Deno.env.get("CF_PROXY_URL") ?? "https://www.nexu.fyi/api/proxy?url=";
const PROXY_SEC  = Deno.env.get("PROXY_SECRET") ?? "";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
};

// Países a scrapear (sin Venezuela)
const PAISES: { codigo: string; url: string }[] = [
  { codigo: "BR", url: "https://br.computrabajo.com/" },
  { codigo: "AR", url: "https://ar.computrabajo.com/" },
  { codigo: "MX", url: "https://mx.computrabajo.com/" },
  { codigo: "CL", url: "https://cl.computrabajo.com/" },
  { codigo: "ES", url: "https://es.computrabajo.com/" },
  { codigo: "UY", url: "https://uy.computrabajo.com/" },
  { codigo: "CO", url: "https://co.computrabajo.com/" },
  { codigo: "PE", url: "https://pe.computrabajo.com/" },
  { codigo: "EC", url: "https://ec.computrabajo.com/" },
  { codigo: "BO", url: "https://bo.computrabajo.com/" },
  { codigo: "PY", url: "https://py.computrabajo.com/" },
];

// Extrae el número de empleos del HTML de Computrabajo
function extraerConteo(html: string): number | null {
  const patrones = [
    /(\d[\d.,\s]{1,12})\s*ofertas?\s*de\s*trabajo/i,
    /(\d[\d.,\s]{1,12})\s*ofertas?\s*activas/i,
    /(\d[\d.,\s]{1,12})\s*empleos?\s*disponibles/i,
    /(\d[\d.,\s]{1,12})\s*vagas?\s*de\s*emprego/i,
    /(\d[\d.,\s]{1,12})\s*vagas?\s*disponíveis/i,
    /(\d[\d.,\s]{1,12})\s*empleos?/i,
    /(\d[\d.,\s]{1,12})\s*ofertas?/i,
  ];

  for (const patron of patrones) {
    const match = html.match(patron);
    if (match) {
      const raw = match[1].replace(/[\s.]/g, "").replace(",", "");
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 100) return num;
    }
  }
  return null;
}

async function fetchPais(url: string): Promise<number | null> {
  try {
    const proxyUrl = `${PROXY}${encodeURIComponent(url)}&t=${PROXY_SEC}`;
    const res = await fetch(proxyUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    return extraerConteo(html);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hoy = new Date().toISOString().split("T")[0];
  const resultados: { pais: string; total: number | null }[] = [];

  for (const { codigo, url } of PAISES) {
    const total = await fetchPais(url);
    resultados.push({ pais: codigo, total });

    if (total !== null) {
      await supabase.from("mercado_stats").upsert(
        { fecha: hoy, pais: codigo, total_empleos: total, actualizado_at: new Date().toISOString() },
        { onConflict: "fecha,pais" }
      );
    }
    // Pausa entre requests para no saturar
    await new Promise(r => setTimeout(r, 1500));
  }

  const ok    = resultados.filter(r => r.total !== null).length;
  const total = resultados.length;

  return new Response(
    JSON.stringify({ fecha: hoy, ok, total, resultados }),
    { headers: { "Content-Type": "application/json" } }
  );
});
