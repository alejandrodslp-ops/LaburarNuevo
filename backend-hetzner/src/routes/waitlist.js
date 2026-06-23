const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    const { action, email, nombre, pais } = req.body ?? {};

    if (action === 'estado') {
      const [{ count: total }, { count: habilitados }, { count: registrados }] = await Promise.all([
        db.from('waitlist').select('*', { count: 'exact', head: true }),
        db.from('waitlist').select('*', { count: 'exact', head: true }).eq('habilitado', true),
        db.from('waitlist').select('*', { count: 'exact', head: true }).eq('registrado', true),
      ]);
      return res.json({ total, habilitados, registrados, en_espera: (total ?? 0) - (habilitados ?? 0) });
    }

    if (action === 'consultar') {
      if (!email) return res.status(400).json({ error: 'email requerido' });
      const { data } = await db.from('waitlist')
        .select('posicion, habilitado, registrado, created_at')
        .eq('email', email.toLowerCase().trim())
        .single();
      if (!data) return res.json({ encontrado: false });
      return res.json({ encontrado: true, ...data });
    }

    if (action === 'unirse') {
      if (!email) return res.status(400).json({ error: 'email requerido' });
      const em = email.toLowerCase().trim();
      const { data: existe } = await db.from('waitlist')
        .select('id, posicion, habilitado').eq('email', em).single();
      if (existe) return res.json({ ya_registrado: true, posicion: existe.posicion, habilitado: existe.habilitado });

      const { count: total } = await db.from('waitlist').select('*', { count: 'exact', head: true });
      const posicion = (total ?? 0) + 1;
      const { data, error } = await db.from('waitlist')
        .insert({ email: em, nombre, pais, posicion, habilitado: false, registrado: false })
        .select('posicion').single();
      if (error) return res.status(500).json({ error: error.message });

      // Disparar autorizador sin bloquear respuesta
      // CUANDO MIGRES A HETZNER: cambiar URL por fetch('http://localhost:3000/waitlist-autorizador')
      fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/waitlist-autorizador', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }).catch(() => {});

      return res.json({ ok: true, posicion: data.posicion });
    }

    if (action === 'registrado') {
      if (!email) return res.status(400).json({ error: 'email requerido' });
      await db.from('waitlist').update({ registrado: true }).eq('email', email.toLowerCase().trim());
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'action inválida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
