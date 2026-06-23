const { Router } = require('express');
const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

router.post('/', async (req, res) => {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Konexu <no-reply@konexu.app>',
        to: 'alejandrodslp@gmail.com',
        subject: 'Banco Rendimento — WhatsApp',
        text: 'Contactar a Banco Rendimento via WhatsApp para continuar el proceso de cuenta.',
      }),
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
