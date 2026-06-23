const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

router.post('/', async (req, res) => {
  try {
    const { employer_id, monto, moneda, metodo, descripcion, worker_id, numero } = req.body ?? {};
    if (!employer_id) return res.status(400).json({ error: 'employer_id requerido' });

    const [{ data: emp }, { data: authUser }] = await Promise.all([
      db.from('profiles').select('nombre, apellido1').eq('id', employer_id).single(),
      db.auth.admin.getUserById(employer_id),
    ]);

    const email      = authUser?.user?.email ?? null;
    const numeroComp = numero ?? `KONEXU-${Date.now()}`;
    const fecha      = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Comprobante Konexu</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#1a1a2e">Konexu 🧩</h1>
  <h2>Comprobante de Pago</h2>
  <p><strong>N°:</strong> ${numeroComp}</p>
  <p><strong>Fecha:</strong> ${fecha}</p>
  <p><strong>Cliente:</strong> ${emp?.nombre ?? ''} ${emp?.apellido1 ?? ''}</p>
  <p><strong>Monto:</strong> ${moneda ?? 'USD'} ${monto}</p>
  <p><strong>Método:</strong> ${metodo ?? '—'}</p>
  <p><strong>Descripción:</strong> ${descripcion ?? '—'}</p>
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
      employer_id, worker_id, numero: numeroComp, monto, moneda, metodo, descripcion,
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
