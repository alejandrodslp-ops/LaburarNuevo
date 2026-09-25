const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

// Revisa si algún cron job falló en las últimas 24h y, si sí, manda un email de
// alerta vía Resend. Aditivo: solo lee. Pensado para correr 1-2 veces al día.
const RESEND_KEY  = process.env.RESEND_API_KEY || '';
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'noreply@konexu.app';
const ALERT_EMAIL = 'alejandrodslp@gmail.com';

router.post('/', async (req, res) => {
  try {
    const [{ data: fallidos, error: errFallidos }, { data: stale, error: errStale }] = await Promise.all([
      db.rpc('crons_fallidos_24h'),
      db.rpc('staleness_alertas_waitlist'),
    ]);
    if (errFallidos) throw errFallidos;
    if (errStale) throw errStale;

    const hayFallidos = fallidos && fallidos.length > 0;
    const hayStale = stale && stale.length > 0;

    if (!hayFallidos && !hayStale) {
      return res.json({ ok: true, fallos: 0, stale: 0, mensaje: 'Todos los crons OK' });
    }

    const filasFallidos = hayFallidos ? fallidos.map((f) =>
      `<tr><td style="padding:6px 12px;border:1px solid #eee"><b>${f.jobname}</b></td>
       <td style="padding:6px 12px;border:1px solid #eee;text-align:center">${f.fallos}</td>
       <td style="padding:6px 12px;border:1px solid #eee;color:#b91c1c;font-size:12px">${f.ultimo_error}</td></tr>`
    ).join('') : '';

    const filasStale = hayStale ? stale.map((s) =>
      `<tr><td style="padding:6px 12px;border:1px solid #eee"><b>${s.problema}</b></td>
       <td style="padding:6px 12px;border:1px solid #eee;color:#b91c1c;font-size:12px">${s.detalle}</td></tr>`
    ).join('') : '';

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#b91c1c">⚠️ Konexu — problemas detectados</h2>
        ${hayFallidos ? `
        <p>En las últimas 24 horas, estos cron jobs fallaron. Revisalos:</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:20px">
          <tr style="background:#f8f8f8"><th style="padding:6px 12px;border:1px solid #eee;text-align:left">Cron</th>
          <th style="padding:6px 12px;border:1px solid #eee">Fallos</th>
          <th style="padding:6px 12px;border:1px solid #eee;text-align:left">Último error</th></tr>
          ${filasFallidos}
        </table>` : ''}
        ${hayStale ? `
        <p>Estas funciones se marcan como "exitosas" pero no están haciendo su trabajo:</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr style="background:#f8f8f8"><th style="padding:6px 12px;border:1px solid #eee;text-align:left">Problema</th>
          <th style="padding:6px 12px;border:1px solid #eee;text-align:left">Detalle</th></tr>
          ${filasStale}
        </table>` : ''}
        <p style="color:#888;font-size:12px;margin-top:20px">Alerta automática de Konexu (monitor-crons).</p>
      </div>`;

    const totalProblemas = (hayFallidos ? fallidos.length : 0) + (hayStale ? stale.length : 0);

    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL, to: ALERT_EMAIL,
          subject: `⚠️ Konexu: ${totalProblemas} problema(s) detectado(s)`,
          html,
        }),
      });
    }
    return res.json({
      ok: true,
      fallos: hayFallidos ? fallidos.length : 0,
      stale: hayStale ? stale.length : 0,
      alertado: !!RESEND_KEY,
      detalle_fallidos: fallidos,
      detalle_stale: stale,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
