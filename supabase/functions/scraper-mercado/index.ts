import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Dominio actual SIN redirect: nexu.fyi respondía 308 y el redirect cross-origin
// borra el token del proxy (ver feedback_scraper_proxy_dominio — quema créditos).
const PROXY     = Deno.env.get("CF_PROXY_URL") ?? "https://www.konexu.app/api/proxy?url=";
const PROXY_SEC = Deno.env.get("PROXY_SECRET") ?? "";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
};

// Total de empleos por país
const PAISES: { codigo: string; url: string }[] = [
  { codigo: "BR", url: "https://br.computrabajo.com/trabalho" },
  { codigo: "AR", url: "https://ar.computrabajo.com/trabajo" },
  { codigo: "MX", url: "https://mx.computrabajo.com/trabajo" },
  { codigo: "CL", url: "https://cl.computrabajo.com/trabajo" },
  { codigo: "ES", url: "https://es.computrabajo.com/trabajo" },
  { codigo: "UY", url: "https://uy.computrabajo.com/trabajo" },
  { codigo: "CO", url: "https://co.computrabajo.com/trabajo" },
  { codigo: "PE", url: "https://pe.computrabajo.com/trabajo" },
  { codigo: "EC", url: "https://ec.computrabajo.com/trabajo" },
  { codigo: "BO", url: "https://bo.computrabajo.com/trabajo" },
  { codigo: "PY", url: "https://py.computrabajo.com/trabajo" },
  { codigo: "FR", url: "https://fr.computrabajo.com/emploi" },
  { codigo: "IT", url: "https://it.computrabajo.com/lavoro" },
  { codigo: "PT", url: "https://pt.computrabajo.com/emprego" },
  { codigo: "GB", url: "https://uk.computrabajo.com/jobs" },
];

// Rubros por país — solo donde las URLs responden sin JS
// AR confirmado. Resto se agrega cuando proxy esté estable.
const RUBROS_POR_PAIS: Record<string, { rubro: string; url: string }[]> = {
  AR: [
    { rubro: "tecnologia",    url: "https://ar.computrabajo.com/trabajo-de-informatica-telecomunicaciones" },
    { rubro: "industria",     url: "https://ar.computrabajo.com/trabajo-de-produccion-operarios-manufactura" },
    { rubro: "comercio",      url: "https://ar.computrabajo.com/trabajo-de-comercial-ventas" },
    { rubro: "admin",         url: "https://ar.computrabajo.com/trabajo-de-administracion-secretariado" },
    { rubro: "salud",         url: "https://ar.computrabajo.com/trabajo-de-salud-medicina" },
    { rubro: "construccion",  url: "https://ar.computrabajo.com/trabajo-de-construccion-inmobiliaria" },
    { rubro: "educacion",     url: "https://ar.computrabajo.com/trabajo-de-docencia-formacion" },
    { rubro: "logistica",     url: "https://ar.computrabajo.com/trabajo-de-logistica-transporte-distribucion" },
    { rubro: "gastronomia",   url: "https://ar.computrabajo.com/trabajo-de-turismo-hoteleria-gastronomia" },
    { rubro: "finanzas",      url: "https://ar.computrabajo.com/trabajo-de-contabilidad-finanzas" },
  ],
};

function parsearNumero(raw: string): number {
  return parseInt(raw.replace(/[.,]/g, ""), 10);
}

function extraerConteo(html: string): number | null {
  const m1 = html.match(/class="fwB"[^>]*>\s*([\d.,]+)\s*<\/span>\s*oferta/i);
  if (m1) { const n = parsearNumero(m1[1]); if (!isNaN(n) && n > 0) return n; }
  const m2 = html.match(/\+\s*([\d.,]+)\s*<span[^>]*>\s*(oferta|vaga)/i);
  if (m2) { const n = parsearNumero(m2[1]); if (!isNaN(n) && n > 0) return n; }
  const m3 = html.match(/más de\s*<[^>]*>([\d.,]+)<\/[^>]*>\s*oferta/i);
  if (m3) { const n = parsearNumero(m3[1]); if (!isNaN(n) && n > 0) return n; }
  return null;
}

async function fetchDirecto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function fetchViaProxy(url: string): Promise<string | null> {
  if (!PROXY_SEC) return null;
  try {
    const proxyUrl = `${PROXY}${encodeURIComponent(url)}&t=${PROXY_SEC}`;
    const res = await fetch(proxyUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function fetchHtml(url: string): Promise<string | null> {
  const html = await fetchDirecto(url);
  if (html) return html;
  return await fetchViaProxy(url);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const hoy = new Date().toISOString().split("T")[0];
  const resultados: { pais: string; total: number | null; via: string; dbError?: string }[] = [];

  // — Scrape totales por país —
  for (const { codigo, url } of PAISES) {
    const html = await fetchHtml(url);
    const total = html ? extraerConteo(html) : null;
    const via = html ? (await fetchDirecto(url) !== null ? "directo" : "proxy") : "fallo";

    let dbError: string | null = null;
    if (total !== null) {
      const { error } = await supabase.from("mercado_stats").upsert(
        { fecha: hoy, pais: codigo, total_empleos: total, actualizado_at: new Date().toISOString() },
        { onConflict: "fecha,pais" }
      );
      if (error) dbError = error.message;
    }
    resultados.push({ pais: codigo, total, via, dbError: dbError ?? undefined });
    await new Promise(r => setTimeout(r, 800));
  }

  // — Scrape rubros (por ahora solo países con URLs confirmadas) —
  const rubrosResultados: { pais: string; rubro: string; total: number | null }[] = [];

  for (const [pais, rubros] of Object.entries(RUBROS_POR_PAIS)) {
    for (const { rubro, url } of rubros) {
      const html = await fetchDirecto(url);
      const total = html ? extraerConteo(html) : null;

      if (total !== null) {
        await supabase.from("mercado_rubros").upsert(
          { fecha: hoy, pais, rubro, total_empleos: total, actualizado_at: new Date().toISOString() },
          { onConflict: "fecha,pais,rubro" }
        );
      }
      rubrosResultados.push({ pais, rubro, total });
      await new Promise(r => setTimeout(r, 600));
    }
  }

  const ok = resultados.filter(r => r.total !== null).length;
  return new Response(
    JSON.stringify({ fecha: hoy, ok, total: resultados.length, resultados, rubros: rubrosResultados }),
    { headers: { "Content-Type": "application/json" } }
  );
});
