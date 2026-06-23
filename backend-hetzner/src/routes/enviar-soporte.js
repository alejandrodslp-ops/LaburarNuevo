const { Router } = require('express');
const router = Router();

router.post('/', async (req, res) => {
  const { email, nombre, mensaje, categoria } = req.body;

  if (!email || !mensaje?.trim()) {
    return res.status(400).json({ error: 'email y mensaje requeridos' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SOPORTE_EMAIL = process.env.SOPORTE_EMAIL ?? 'soporte@konexu.app';
  const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Konexu <no-reply@konexu.app>';

  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY no configurada' });

  const asunto = categoria
    ? `[Konexu Soporte] ${categoria} — ${nombre || email}`
    : `[Konexu Soporte] Mensaje de ${nombre || email}`;

  const htmlInterno = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#E8785A">📩 Nuevo mensaje de soporte</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;font-weight:bold;width:120px">Usuario</td><td style="padding:8px">${nombre || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
        ${categoria ? `<tr><td style="padding:8px;font-weight:bold">Categoría</td><td style="padding:8px">${categoria}</td></tr>` : ''}
        <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;vertical-align:top">Mensaje</td><td style="padding:8px;white-space:pre-wrap">${mensaje.trim()}</td></tr>
      </table>
      <p style="color:#999;font-size:12px;margin-top:24px">Enviado desde Konexu app · ${new Date().toISOString()}</p>
    </div>
  `;

  const htmlConfirmacion = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#E8785A">✅ Recibimos tu mensaje</h2>
      <p>Hola ${nombre || 'usuario'},</p>
      <p>Recibimos tu consulta y te responderemos a la brevedad en este mismo email.</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#666;font-size:14px;white-space:pre-wrap">${mensaje.trim()}</p>
      </div>
      <p style="color:#999;font-size:12px">Equipo Konexu</p>
    </div>
  `;

  try {
    const [resInterno, resConfirm] = await Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [SOPORTE_EMAIL], reply_to: email, subject: asunto, html: htmlInterno }),
      }),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: 'Recibimos tu mensaje — Konexu Soporte', html: htmlConfirmacion }),
      }),
    ]);

    res.json({ ok: resInterno.ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
