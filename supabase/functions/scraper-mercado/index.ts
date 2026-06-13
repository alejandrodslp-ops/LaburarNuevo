import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PROXY     = Deno.env.get("CF_PROXY_URL") ?? "https://www.nexu.fyi/api/proxy?url=";
const PROXY_SEC = Deno.env.get("PROXY_SECRET") ?? "";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
};

// Cada país con su URL de resultados (home no muestra el conteo)
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
  // Quita separadores de miles (. y ,) y parsea como entero
  const limpio = raw.replace(/[.,]/g, "");
  return parseInt(limpio, 10);
}

function extraerConteo(html: string): number | null {
  // Patrón 1: <span class="fwB">16.384</span> oferta  (países hispanos en /trabajo)
  const m1 = html.match(/class="fwB"\s*>\s*([\d.,]+)\s*<\/span>\s*oferta/i);
  if (m1) {
    const n = parsearNumero(m1[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  // Patrón 2: + 513.000 <span class="infotxt">oferta  (Brasil y España)
  const m2 = html.match(/\+\s*([\d.,]+)\s*<span[^>]*>\s*oferta/i);
  if (m2) {
    const n = parsearNumero(m2[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  // Patrón 3: vaga (portugués Brasil)
  const m3 = html.match(/\+\s*([\d.,]+)\s*<span[^>]*>\s*vaga/i);
  if (m3) {
    const n = parsearNumero(m3[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  // Patrón 4: slogan con número y oferta (fallback)
  const m4 = html.match(/más de\s*<[^>]*>([\d.,]+)<\/[^>]*>\s*oferta/i);
  if (m4) {
    const n = parsearNumero(m4[1]);
    if (!isNaN(n) && n > 50) return n;
  }

  return null;
}

async function fetchPais(url: string): Promise<number | null> {
  try {
    const proxyUrl = `${PROXY}${encodeURIComponent(url)}&t=${PROXY_SEC}`;
    const res = await fetch(proxyUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
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

    await new Promise(r => setTimeout(r, 1500));
  }

  const ok    = resultados.filter(r => r.total !== null).length;
  const total = resultados.length;

  return new Response(
    JSON.stringify({ fecha: hoy, ok, total, resultados }),
    { headers: { "Content-Type": "application/json" } }
  );
});
