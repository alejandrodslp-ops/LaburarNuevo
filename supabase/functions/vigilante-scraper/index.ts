import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Mínimos absolutos de seguridad por país
const MINIMOS: Record<string, number> = {
  UY: 20,  AR: 100, BR: 200, CL: 50,  ES: 100,
  US: 100, DE: 200, MX: 50,  FR: 200, GB: 50,
  IT: 100, CA: 50,  AU: 50,  JP: 20,  IN: 50,
  NO: 15,  SE: 15,  PT: 30,  CO: 30,  PE: 30,
  GT: 20,  HN: 20,  NI: 20,  BO: 20,  EC: 20,
  VE: 20,  CR: 15,  PY: 15,  PA: 15,  DO: 15,
  SV: 15,  CU: 10,  CH: 50,
};

const UMBRAL_PCT    = 0.20;   // caída relativa mínima para re-scrape
const UMBRAL_ABS    = 100;    // caída absoluta mínima para re-scrape
const SNAPSHOT_PATH = "vigilante/snapshot.json";
const BUCKET        = "comprobantes";

type Sb = ReturnType<typeof createClient>;

// ── Helpers — reciben supabase como parámetro ───────────────────────────────

async function leerSnapshot(sb: Sb): Promise<Record<string, number>> {
  const { data } = await sb.storage.from(BUCKET).download(SNAPSHOT_PATH);
  if (!data) return {};
  try { return JSON.parse(await data.text()); } catch { return {}; }
}

async function guardarSnapshot(sb: Sb, conteos: Record<string, number>): Promise<void> {
  const json = JSON.stringify({ ...conteos, _ts: new Date().toISOString() });
  await sb.storage.from(BUCKET).upload(
    SNAPSHOT_PATH,
    new Blob([new TextEncoder().encode(json)], { type: "application/json" }),
    { upsert: true }
  );
}

async function obtenerConteos(sb: Sb): Promise<Record<string, number>> {
  const { data } = await sb.rpc("contar_concursos_por_pais");
  const conteos: Record<string, number> = {};
  for (const r of (data ?? []) as { pais: string; total: number }[]) {
    conteos[r.pais] = Number(r.total);
  }
  return conteos;
}

async function rescrape(
  sb: Sb,
  supabaseUrl: string,
  serviceKey: string,
  paises: string[]
): Promise<Record<string, number>> {
  const antes = await obtenerConteos(sb);
  await Promise.allSettled(paises.map(pais =>
    fetch(`${supabaseUrl}/functions/v1/scraper-concursos`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body:    JSON.stringify({ pais }),
      signal:  AbortSignal.timeout(90000),
    }).catch(() => {})
  ));
  await new Promise(r => setTimeout(r, 5000));
  const despues = await obtenerConteos(sb);
  const delta: Record<string, number> = {};
  for (const p of paises) delta[p] = despues[p] ?? antes[p] ?? 0;
  return delta;
}

async function enviarAlerta(
  resendKey: string,
  filas: { pais: string; ayer: number; hoy: number; caida: number; pct: number; despues: number; motivo: string }[]
): Promise<void> {
  if (!resendKey) return;
  const rows = filas.map(f => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><b>${f.pais}</b></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${f.ayer}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:#dc3545">${f.hoy}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">-${f.caida} (${Math.round(f.pct*100)}%)</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${f.despues >= f.hoy + 50 ? '#28a745':'#dc3545'};font-weight:700">${f.despues}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888">${f.motivo}</td>
    </tr>`).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
  <h2 style="color:#E8785A">Nexu — Caida detectada en ${filas.length} pais(es)</h2>
  <p style="color:#555;font-size:13px">El vigilante detecto una caida sustancial y relanzó el scraper automaticamente.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
    <thead><tr style="background:#1A1020;color:#fff">
      <th style="padding:8px 12px;text-align:left">Pais</th>
      <th style="padding:8px 12px">Ayer</th>
      <th style="padding:8px 12px">Hoy</th>
      <th style="padding:8px 12px">Caida</th>
      <th style="padding:8px 12px">Despues re-scrape</th>
      <th style="padding:8px 12px;text-align:left">Motivo</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#bbb;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
    Nexu Vigilante - ${new Date().toISOString()}
  </p>
</div>`;

  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      from:    "Nexu Scraper <onboarding@resend.dev>",
      to:      ["alejandrodslp@gmail.com"],
      subject: `⚠️ Nexu — Caida en ${filas.map(f => f.pais).join(", ")} (auto-relanzado)`,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// ── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  // Todas las variables de entorno dentro del handler
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const NEXU_KEY     = Deno.env.get("NEXU_SERVICE_KEY") ?? "";
  const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

  // Aceptar cualquiera de las dos claves válidas
  const auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!auth || (auth !== SERVICE_KEY && auth !== NEXU_KEY)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const [snapshot, conteos] = await Promise.all([
    leerSnapshot(supabase),
    obtenerConteos(supabase),
  ]);
  const haySnapshot = Object.keys(snapshot).some(k => k !== "_ts");

  const problemáticos: { pais: string; ayer: number; hoy: number; caida: number; pct: number; motivo: string }[] = [];

  for (const pais of Object.keys(MINIMOS)) {
    const hoy  = conteos[pais] ?? 0;
    const ayer = (snapshot[pais] as number | undefined) ?? 0;
    const min  = MINIMOS[pais];

    if (haySnapshot && ayer > 0) {
      const caida = ayer - hoy;
      const pct   = caida / ayer;
      if (pct >= UMBRAL_PCT && caida >= UMBRAL_ABS) {
        problemáticos.push({ pais, ayer, hoy, caida, pct, motivo: `Caida ${Math.round(pct*100)}% (${caida} llamados)` });
        continue;
      }
    }

    if (hoy < min) {
      const caida = ayer - hoy;
      problemáticos.push({ pais, ayer, hoy, caida, pct: ayer > 0 ? caida/ayer : 1, motivo: `Bajo minimo (${hoy}/${min})` });
    }
  }

  await guardarSnapshot(supabase, conteos);

  if (!problemáticos.length) {
    console.log("✅ Todos los países OK. Snapshot guardado.");
    return new Response(JSON.stringify({ ok: true, total: Object.values(conteos).reduce((a,b)=>a+b,0) }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`⚠️ ${problemáticos.length} países problemáticos: ${problemáticos.map(p=>p.pais).join(", ")}`);

  const paisesRescrape = problemáticos.map(p => p.pais);
  const despues = await rescrape(supabase, SUPABASE_URL, SERVICE_KEY, paisesRescrape);

  const detalle = problemáticos.map(p => ({
    ...p,
    despues: despues[p.pais] ?? p.hoy,
  }));

  await guardarSnapshot(supabase, { ...conteos, ...despues });
  await enviarAlerta(RESEND_KEY, detalle);

  return new Response(JSON.stringify({ ok: true, problemáticos: detalle.length, detalle }), {
    headers: { "Content-Type": "application/json" },
  });
});
