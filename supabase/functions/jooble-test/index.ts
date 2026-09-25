// Diagnóstico aislado: prueba la API de Jooble con la key de runtime.
// NO toca el scraper. Confirma si Jooble devuelve avisos privados de un país.
const GUARD = "kx-capt-9f3a2b";
const US_LOC = /,\s*(AL|AK|AZ|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b|United States|USA|Estados Unidos/i;

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({} as any));
  if (b.guard !== GUARD) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  const KEY = Deno.env.get("JOOBLE_API_KEY") ?? "";
  if (!KEY) return new Response(JSON.stringify({ error: "sin JOOBLE_API_KEY en secrets" }), { status: 500 });

  const keywords = b.keywords || "cajero vendedor operario mozo";
  const location = b.location || "Buenos Aires Argentina";
  try {
    const res = await fetch(`https://jooble.org/api/${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location, resultsOnPage: 20 }),
      signal: AbortSignal.timeout(20000),
    });
    const http = res.status;
    let json: any = null, raw = "";
    try { json = await res.clone().json(); } catch { raw = (await res.text().catch(() => "")).slice(0, 200); }
    const jobs = json?.jobs ?? [];
    const us = jobs.filter((j: any) => US_LOC.test(String(j.location ?? ""))).length;
    const sample = jobs.slice(0, 8).map((j: any) => ({ t: String(j.title ?? "").slice(0, 40), c: String(j.company ?? "").slice(0, 20), l: String(j.location ?? "").slice(0, 30) }));
    return new Response(JSON.stringify({
      http, keyLen: KEY.length, totalCount: json?.totalCount, devueltos: jobs.length,
      us_filtrados: us, privados_reales: jobs.length - us, raw_si_error: raw, sample,
      campos_que_devuelve: jobs.length ? Object.keys(jobs[0]) : [],
      aviso_completo_ejemplo: jobs[0] ?? null,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), keyLen: KEY.length }), { status: 500 });
  }
});
