const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const KONEXU_ID      = '43a7baf9-f88e-463b-8e4c-385bd3fb8151';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const BIENVENIDA = `¡Bienvenido a Konexu! 🧩
Somos una plataforma de trabajo para toda Latinoamérica.
Completá tu perfil para que los empleadores te encuentren.`;

router.post('/', async (req, res) => {
  try {
    const { modo, user_id } = req.body ?? {};
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();

    if (modo === 'masivo') {
      if (!ADMIN_SECRET || auth !== ADMIN_SECRET)
        return res.status(403).json({ error: 'No autorizado' });
      const { data: users } = await db.from('profiles').select('id');
      if (!users?.length) return res.json({ enviados: 0 });
      const rows = users.map(u => ({ sender_id: KONEXU_ID, receiver_id: u.id, texto: BIENVENIDA, leido: false }));
      let enviados = 0;
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await db.from('mensajes').insert(rows.slice(i, i + CHUNK));
        if (!error) enviados += Math.min(CHUNK, rows.length - i);
      }
      return res.json({ enviados });
    }

    if (modo === 'admin') {
      if (!ADMIN_SECRET || auth !== ADMIN_SECRET)
        return res.status(403).json({ error: 'No autorizado' });
      if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
      const { error } = await db.from('mensajes').insert({
        sender_id: KONEXU_ID, receiver_id: user_id, texto: BIENVENIDA, leido: false,
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // modo usuario — requiere JWT
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { error } = await db.from('mensajes').insert({
      sender_id: KONEXU_ID, receiver_id: user.id, texto: BIENVENIDA, leido: false,
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
