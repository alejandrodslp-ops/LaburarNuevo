const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KONEXU_KEY    = process.env.KONEXU_SERVICE_KEY ?? '';
const RESEND_KEY  = process.env.RESEND_API_KEY ?? '';

const MINIMOS = {
  UY: 20, AR: 100, BR: 200, CL: 50,  ES: 100,
  US: 100, DE: 200, MX: 50,  FR: 200, GB: 50,
  IT: 100, CA: 50,  AU: 50,  JP: 20,  IN: 50,
  NO: 15,  SE: 15,  PT: 30,  CO: 30,  PE: 30,
  GT: 20,  HN: 20,  NI: 20,  BO: 20,  EC: 20,
  VE: 20,  CR: 15,  PY: 15,  PA: 15,  DO: 15,
  SV: 15,  CU: 10,  CH: 50,
};

const UMBRAL_PCT    = 0.20;
const UMBRAL_ABS    = 100;
const SNAPSHOT_PATH = 'vigilante/snapshot.json';
const BUCKET        = 'comprobantes';

async function leerSnapshot() {
  const { data } = await db.storage.from(BUCKET).download(SNAPSHOT_PATH);
  if (!data) return {};
  try { return JSON.parse(await data.text()); } catch { return {}; }
}

async function guardarSnapshot(conteos) {
  const json = JSON.stringify({ ...conteos, _ts: new Date().toISOString() });
  await db.storage.from(BUCKET).upload(
    SNAPSHOT_PATH,
    Buffer.from(json, 'utf-8'),
    { contentType: 'application/json', upsert: true }
  );
}

async function obtenerConteos() {
  const { data } = await db.rpc('contar_concursos_por_pais');
  const conteos = {};
  for (const r of (data ?? [])) {
    conteos[r.pais] = Number(r.total);
  }
  return conteos;
}

async function rescrape(paises) {
  const antes = await obtenerConteos();
  await Promise.allSettled(paises.map(pais =>
    // CUANDO MIGRES A HETZNER: cambiar URL por fetch('http://localhost:3000/scraper-concursos')
    fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/scraper-concursos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ pais }),
      signal: AbortSignal.timeout(90000),
    }).catch(() => {})
  ));
  await new Promise(r => setTimeout(r, 5000));
  const despues = await obtenerConteos();
  const delta = {};
  for (const p of paises) delta[p] = despues[p] ?? antes[p] ?? 0;
  return delta;
}

async function enviarAlerta(filas) {
  if (!RESEND_KEY) return;
  const rows = filas.map(f => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><b>${f.pais}</b></td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${f.ayer}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:#dc3545">${f.hoy}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">-${f.caida} (${Math.round(f.pct * 100)}%)</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${f.despues >= f.hoy + 50 ? '#28a745' : '#dc3545'};font-weight:700">${f.despues}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888">${f.motivo}</td>
    </tr>`).join('');

  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
  <h2 style="color:#E8785A">Konexu — Caída detectada en ${filas.length} país(es)</h2>
  <p style="color:#555;font-size:13px">El vigilante detectó una caída y relanzó el scraper automáticamente.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
    <thead><tr style="background:#1A1020;color:#fff">
      <th style="padding:8px 12px;text-align:left">País</th>
      <th style="padding:8px 12px">Ayer</th>
      <th style="padding:8px 12px">Hoy</th>
      <th style="padding:8px 12px">Caída</th>
      <th style="padding:8px 12px">Después re-scrape</th>
      <th style="padding:8px 12px;text-align:left">Motivo</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#bbb;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
    Konexu Vigilante — ${new Date().toISOString()}
  </p>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Konexu Scraper <noreply@konexu.app>',
      to: ['alejandrodslp@gmail.com'],
      subject: `⚠️ Konexu — Caída en ${filas.map(f => f.pais).join(', ')} (auto-relanzado)`,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    if (!auth || (auth !== SERVICE_KEY && auth !== KONEXU_KEY))
      return res.status(401).json({ error: 'No autorizado' });

    const [snapshot, conteos] = await Promise.all([leerSnapshot(), obtenerConteos()]);
    const haySnapshot = Object.keys(snapshot).some(k => k !== '_ts');

    const problematicos = [];
    for (const pais of Object.keys(MINIMOS)) {
      const hoy  = conteos[pais] ?? 0;
      const ayer = snapshot[pais] ?? 0;
      const min  = MINIMOS[pais];

      if (haySnapshot && ayer > 0) {
        const caida = ayer - hoy;
        const pct   = caida / ayer;
        if (pct >= UMBRAL_PCT && caida >= UMBRAL_ABS) {
          problematicos.push({ pais, ayer, hoy, caida, pct, motivo: `Caída ${Math.round(pct * 100)}% (${caida} llamados)` });
          continue;
        }
      }
      if (hoy < min) {
        const caida = ayer - hoy;
        problematicos.push({ pais, ayer, hoy, caida, pct: ayer > 0 ? caida / ayer : 1, motivo: `Bajo mínimo (${hoy}/${min})` });
      }
    }

    await guardarSnapshot(conteos);

    if (!problematicos.length) {
      return res.json({ ok: true, total: Object.values(conteos).reduce((a, b) => a + b, 0) });
    }

    const paisesRescrape = problematicos.map(p => p.pais);
    const despues = await rescrape(paisesRescrape);

    const detalle = problematicos.map(p => ({ ...p, despues: despues[p.pais] ?? p.hoy }));

    await guardarSnapshot({ ...conteos, ...despues });
    await enviarAlerta(detalle);

    return res.json({ ok: true, problematicos: detalle.length, detalle });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
