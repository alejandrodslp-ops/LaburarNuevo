const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

router.post('/', async (req, res) => {
  try {
    // Ruta interna, servidor-a-servidor — solo la llaman webhook-pago y
    // ativar-via-pix. Sin esto, cualquiera con la URL podia generar un
    // comprobante de pago falso a nombre de cualquier usuario (mismo fix
    // que se hizo en la funcion real Deno, 2026-09-26).
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${SERVICE_KEY}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    // referencia_externa/concepto son los nombres reales (comprobantes tiene
    // esas columnas, no descripcion/worker_id — corregido junto con el mismo
    // bug en webhook-pago.js, 2026-09-25, esta ruta nunca estuvo en vivo).
    const { employer_id, monto, moneda, metodo, referencia_externa, concepto } = req.body ?? {};
    if (!employer_id || !monto || !metodo) return res.status(400).json({ error: 'Faltan datos requeridos' });

    const [{ data: emp }, { data: authUser }] = await Promise.all([
      db.from('profiles').select('nombre, apellido1').eq('id', employer_id).single(),
      db.auth.admin.getUserById(employer_id),
    ]);

    const email          = authUser?.user?.email ?? null;
    const numeroComp     = `KONEXU-${Date.now()}`;
    const conceptoFinal  = concepto || 'Suscripción Konexu — Visualizaciones de perfiles';
    const fecha          = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Comprobante Konexu</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#1a1a2e">konexu</h1>
  <h2>Comprobante de Pago</h2>
  <p><strong>N°:</strong> ${numeroComp}</p>
  <p><strong>Fecha:</strong> ${fecha}</p>
  <p><strong>Cliente:</strong> ${emp?.nombre ?? ''} ${emp?.apellido1 ?? ''}</p>
  <p><strong>Monto:</strong> ${moneda ?? 'USD'} ${monto}</p>
  <p><strong>Método:</strong> ${metodo ?? '—'}</p>
  <p><strong>Descripción:</strong> ${conceptoFinal}</p>
  <hr>
  <p style="color:#888;font-size:12px">Konexu — plataforma de trabajo para LATAM</p>
</body>
</html>`;

    // Supabase Storage funciona igual en Node.js con @supabase/supabase-js
    await db.storage.from('comprobantes').upload(
      `${employer_id}/${numeroComp}.html`,
      Buffer.from(html, 'utf-8'),
      { contentType: 'text/html', upsert: true }
    );

    await db.from('comprobantes').insert({
      employer_id, numero: numeroComp, monto, moneda, metodo,
      referencia_externa, concepto: conceptoFinal,
    });

    if (email) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Konexu <no-reply@konexu.app>',
          to: email,
          subject: `Comprobante ${numeroComp} — Konexu`,
          html,
        }),
      }).catch(() => {});
    }

    return res.json({ ok: true, numero: numeroComp });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
