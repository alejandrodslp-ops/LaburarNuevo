const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendOtpEmail(to, code) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Konexu <no-reply@konexu.app>',
      to,
      subject: 'Verificación de email — Konexu',
      html: `<p>Tu código de verificación es: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
    }),
  });
}

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { action, email, code } = req.body ?? {};

    if (action === 'enviar_otp') {
      const otp    = String(Math.floor(100000 + Math.random() * 900000));
      const expiry = new Date(Date.now() + 10 * 60000).toISOString();
      await db.from('profiles').update({ email_otp: otp, email_otp_expiry: expiry }).eq('id', user.id);
      await sendOtpEmail(email ?? user.email, otp);
      return res.json({ ok: true });
    }

    if (action === 'verificar') {
      const { data: perfil } = await db.from('profiles')
        .select('email_otp, email_otp_expiry').eq('id', user.id).single();
      if (!perfil?.email_otp || perfil.email_otp !== code)
        return res.status(400).json({ error: 'Código incorrecto' });
      if (new Date(perfil.email_otp_expiry) < new Date())
        return res.status(400).json({ error: 'Código expirado' });
      await db.from('profiles')
        .update({ email_verificado: true, email_otp: null, email_otp_expiry: null })
        .eq('id', user.id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'action inválida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
