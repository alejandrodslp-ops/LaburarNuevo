const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    const { user_id, titulo, cuerpo, pantalla } = req.body ?? {};
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    const { data: perfil } = await db.from('profiles').select('push_token').eq('id', user_id).single();
    if (!perfil?.push_token) return res.json({ ok: false, reason: 'sin token' });

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: perfil.push_token,
        title: titulo,
        body: cuerpo,
        sound: 'default',
        data: { pantalla },
      }),
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
