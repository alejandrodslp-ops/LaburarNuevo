import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Proxy como fallback si acceso directo falla
const PROXY     = "https://www.nexu.fyi/api/proxy?url=";
const PROXY_SEC = Deno.env.get("PROXY_SECRET") ?? "";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
};

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
];

function parsearNumero(raw: string): number {
  return parseInt(raw.replace(/[.,]/g, ""), 10);
}

function extraerConteo(html: string): number | null {
  // Patrón 1: <span class="fwB">16.384</span> oferta  (países hispanos)
  const m1 = html.match(/class="fwB"[^>]*>\s*([\d.,]+)\s*<\/span>\s*oferta/i);
  if (m1) {
    const n = parsearNumero(m1[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  // Patrón 2: + 513.000 <span class="infotxt">oferta  (Brasil / España)
  const m2 = html.match(/\+\s*([\d.,]+)\s*<span[^>]*>\s*(oferta|vaga)/i);
  if (m2) {
    const n = parsearNumero(m2[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  // Patrón 3: más de NUMBER ofertas (slogan genérico)
  const m3 = html.match(/más de\s*<[^>]*>([\d.,]+)<\/[^>]*>\s*oferta/i);
  if (m3) {
    const n = parsearNumero(m3[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  return null;
}

async function fetchDirecto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchViaProxy(url: string): Promise<string | null> {
  if (!PROXY_SEC) return null;
  try {
    const proxyUrl = `${PROXY}${encodeURIComponent(url)}&t=${PROXY_SEC}`;
    const res = await fetch(proxyUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchPais(url: string): Promise<{ total: number | null; via: string }> {
  // Intento 1: acceso directo
  let html = await fetchDirecto(url);
  if (html) {
    const total = extraerConteo(html);
    if (total !== null) return { total, via: "directo" };
  }

  // Intento 2: vía proxy
  html = await fetchViaProxy(url);
  if (html) {
    const total = extraerConteo(html);
    if (total !== null) return { total, via: "proxy" };
  }

  return { total: null, via: "fallo" };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hoy = new Date().toISOString().split("T")[0];
  const resultados: { pais: string; total: number | null; via: string; dbError?: string }[] = [];

  for (const { codigo, url } of PAISES) {
    const { total, via } = await fetchPais(url);

    let dbError: string | null = null;
    if (total !== null) {
      const { error } = await supabase.from("mercado_stats").upsert(
        { fecha: hoy, pais: codigo, total_empleos: total, actualizado_at: new Date().toISOString() },
        { onConflict: "fecha,pais" }
      );
      if (error) dbError = error.message;
    }

    resultados.push({ pais: codigo, total, via, dbError: dbError ?? undefined });
    await new Promise(r => setTimeout(r, 1200));
  }

  const ok    = resultados.filter(r => r.total !== null).length;
  const total = resultados.length;

  return new Response(
    JSON.stringify({ fecha: hoy, ok, total, resultados }),
    { headers: { "Content-Type": "application/json" } }
  );
});
