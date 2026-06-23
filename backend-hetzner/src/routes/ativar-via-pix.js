const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const PIX_WEBHOOK_SECRET = process.env.PIX_WEBHOOK_SECRET;

router.post('/', async (req, res) => {
  try {
    const secret = req.headers['x-pix-secret'] ?? '';
    if (!PIX_WEBHOOK_SECRET || secret !== PIX_WEBHOOK_SECRET)
      return res.status(401).json({ error: 'No autorizado' });

    const { ref_label } = req.body ?? {};
    if (!ref_label) return res.status(400).json({ error: 'ref_label requerido' });

    // ref_label es el UUID del usuario (o prefijo sin guiones)
    const prefijo = ref_label.replace(/-/g, '').slice(0, 8).toLowerCase();
    const { data: perfil } = await db.from('profiles')
      .select('id')
      .ilike('id', `${prefijo}%`)
      .single();

    if (!perfil) return res.status(404).json({ error: 'Usuario no encontrado' });

    const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
    await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq('id', perfil.id);
    await db.from('pagos').insert({
      user_id: perfil.id, worker_id: perfil.id,
      monto: 15, moneda: 'BRL', metodo: 'pix', estado: 'aprobado',
    });

    // CUANDO MIGRES A HETZNER: cambiar a fetch('http://localhost:3000/generar-comprobante')
    fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/generar-comprobante', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employer_id: perfil.id, monto: 15, moneda: 'BRL', metodo: 'pix', worker_id: perfil.id }),
    }).catch(() => {});

    return res.json({ ok: true, user_id: perfil.id, activo_hasta: hasta });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
