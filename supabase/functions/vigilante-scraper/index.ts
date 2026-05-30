import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ───────────────────────────────────────────────────────────────
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Mínimos esperados por país — si está por debajo se reintenta
const MINIMOS: Record<string, number> = {
  UY: 100, AR: 200, BR: 200, CL: 50, ES: 50,
  US: 100, DE: 30,  MX: 30,  FR: 20, GB: 20,
  IT: 20,  CA: 20,  AU: 20,  JP: 20, IN: 20,
  NO: 20,  SE: 20,  PT: 20,  CO: 20, PE: 20,
  GT: 30,  HN: 30,  NI: 30,  BO: 20, EC: 20,
  VE: 20,  CR: 15,  PY: 15,  PA: 15, DO: 15,
  SV: 15,  CU: 10,
};

// ── Handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  // 1. Conteos actuales por país
  const { data: conteoData } = await supabase.rpc("contar_concursos_por_pais");
  const conteos: Record<string, number> = {};
  for (const r of (conteoData ?? []) as { pais: string; total: number }[]) {
    conteos[r.pais] = Number(r.total);
  }

  // 2. Detectar países bajo mínimo
  const bajoMinimo: string[] = [];
  for (const [pais, minimo] of Object.entries(MINIMOS)) {
    if ((conteos[pais] ?? 0) < minimo) bajoMinimo.push(pais);
  }

  if (!bajoMinimo.length) {
    console.log("✅ Todos los países sobre el mínimo. Sin acción requerida.");
    return new Response(JSON.stringify({ ok: true, accion: "ninguna", bajoMinimo: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`⚠️ ${bajoMinimo.length} países bajo mínimo: ${bajoMinimo.join(", ")} — reintentando...`);

  // 3. Reintentar en paralelo (máx 90 seg por país)
  type Resultado = { pais: string; antes: number; despues: number; recuperado: boolean };
  const resultados: Resultado[] = [];

  await Promise.allSettled(
    bajoMinimo.map(async (pais) => {
      const antes = conteos[pais] ?? 0;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/scraper-concursos`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
          body:    JSON.stringify({ pais }),
          signal:  AbortSignal.timeout(90000),
        });

        // Verificar conteo real en DB después del reintento
        const { count } = await supabase
          .from("concursos")
          .select("*", { count: "exact", head: true })
          .eq("pais", pais)
          .eq("activo", true);

        const despues = count ?? antes;
        const minimo  = MINIMOS[pais] ?? 10;
        resultados.push({ pais, antes, despues, recuperado: despues >= minimo });
        console.log(`  ${pais}: ${antes} → ${despues} ${despues >= minimo ? "✅" : "❌"}`);
      } catch (e) {
        console.error(`  ${pais}: reintento fallido — ${(e as Error).message}`);
        resultados.push({ pais, antes, despues: antes, recuperado: false });
      }
    })
  );

  const recuperados     = resultados.filter(r => r.recuperado);
  const siguesFallando  = resultados.filter(r => !r.recuperado);

  // 4. Email solo si hay países que NO se recuperaron ssolos
  if (RESEND_KEY && siguesFallando.length > 0) {
    const filas = (items: Resultado[], color: string) =>
      items.map(r => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #eee"><b>${r.pais}</b></td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${r.antes}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:${color};font-weight:bold">${r.despues}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${MINIMOS[r.pais] ?? 10}</td>
        </tr>`).join("");

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#E8785A">Nexu — Auto-recuperación del scraper</h2>

  ${recuperados.length > 0 ? `
  <div style="background:#d4edda;border-left:4px solid #28a745;padding:10px 16px;margin-bottom:16px;border-radius:4px">
    <b style="color:#155724">✅ ${recuperados.length} país(es) recuperado(s) automáticamente</b>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead><tr style="background:#28a745;color:white">
      <th style="padding:8px 12px;text-align:left">País</th>
      <th style="padding:8px 12px">Antes</th>
      <th style="padding:8px 12px">Después</th>
      <th style="padding:8px 12px">Mínimo</th>
    </tr></thead>
    <tbody>${filas(recuperados, "#28a745")}</tbody>
  </table>` : ""}

  <div style="background:#f8d7da;border-left:4px solid #dc3545;padding:10px 16px;margin-bottom:16px;border-radius:4px">
    <b style="color:#721c24">❌ ${siguesFallando.length} país(es) siguen bajo el mínimo — revisión manual necesaria</b>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#dc3545;color:white">
      <th style="padding:8px 12px;text-align:left">País</th>
      <th style="padding:8px 12px">Antes</th>
      <th style="padding:8px 12px">Después</th>
      <th style="padding:8px 12px">Mínimo</th>
    </tr></thead>
    <tbody>${filas(siguesFallando, "#dc3545")}</tbody>
  </table>

  <p style="color:#bbb;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
    El scraper principal ya intentó. El vigilante reintentó. Estos países necesitan atención manual.
  </p>
</div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    "Nexu Scraper <onboarding@resend.dev>",
        to:      ["alejandrodslp@gmail.com"],
        subject: `🔧 Nexu — ${siguesFallando.length} país(es) bajo mínimo después de auto-recuperación`,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({
    ok:            true,
    bajoMinimo,
    recuperados:   recuperados.length,
    siguesFallando: siguesFallando.length,
    detalle:       resultados,
  }), { headers: { "Content-Type": "application/json" } });
});
