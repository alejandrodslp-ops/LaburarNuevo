const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const PIX_WEBHOOK_SECRET = process.env.PIX_WEBHOOK_SECRET;

router.post('/', async (req, res) => {
  try {
    // Polaridad correcta (antes rechazaba si el secreto NO estaba
    // configurado — al revés de todos los demás webhooks del proyecto,
    // que aceptan en "modo desarrollo" cuando falta el secret).
    const secret = req.headers['x-pix-secret'] ?? '';
    if (PIX_WEBHOOK_SECRET && secret !== PIX_WEBHOOK_SECRET)
      return res.status(401).json({ error: 'No autorizado' });

    const { ref_label } = req.body ?? {};
    if (!ref_label || ref_label.length < 8) return res.status(400).json({ error: 'ref_label inválido' });

    const prefijo = ref_label.replace(/-/g, '').slice(0, 8).toLowerCase();
    const { data: profiles } = await db.from('profiles')
      .select('id, perfil_activo')
      .ilike('id', `${prefijo}%`)
      .limit(5);

    if (!profiles || profiles.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (profiles.length > 1) {
      console.error('ref_label ambiguo, varios usuarios con el mismo prefijo:', ref_label, profiles.map(p => p.id));
      return res.status(409).json({ error: 'ref_label ambiguo — requiere revisión manual' });
    }
    const perfil = profiles[0];

    if (perfil.perfil_activo) return res.json({ ok: true, ya_activo: true });

    // Registrar el pago PRIMERO — pagos.referencia_externa tiene un UNIQUE
    // real, un reintento del mismo ref_label cae en el catch de 23505.
    const { error: pagoErr } = await db.from('pagos').insert({
      user_id: perfil.id, monto: 15, moneda: 'BRL', metodo: 'pix_rendimento',
      estado: 'aprobado', referencia_externa: ref_label,
    });
    if (pagoErr) {
      if (pagoErr.code === '23505') return res.json({ ok: true, duplicado: true });
      console.error('Error al registrar pago PIX:', pagoErr.message, 'ref:', ref_label);
      return res.status(500).json({ error: 'No se pudo registrar el pago' });
    }

    const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
    await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq('id', perfil.id);

    fetch(`http://localhost:${process.env.PORT || 3000}/generar-comprobante`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employer_id: perfil.id, monto: 15, moneda: 'BRL', metodo: 'pix', referencia_externa: ref_label }),
    }).catch(() => {});

    return res.json({ ok: true, user_id: perfil.id, activo_hasta: hasta });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
