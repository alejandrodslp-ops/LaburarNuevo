const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { monto, descripcion, worker_id, cantidad_perfiles, tipo } = req.body ?? {};
    if (!monto || !descripcion) return res.status(400).json({ error: 'monto y descripcion requeridos' });

    // CUANDO MIGRES A HETZNER: cambiar notification_url a https://<hetzner-ip>/webhook-pago
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: descripcion, quantity: 1, unit_price: Number(monto), currency_id: 'USD' }],
        external_reference: JSON.stringify({ user_id: user.id, worker_id, cantidad_perfiles, tipo }),
        back_urls: {
          success: 'konexu://pago-ok',
          failure: 'konexu://pago-error',
          pending: 'konexu://pago-pendiente',
        },
        auto_return: 'approved',
        notification_url: 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/webhook-pago',
      }),
    });
    const mp = await resp.json();
    if (!mp.init_point) return res.status(500).json({ error: 'MercadoPago no devolvió init_point', mp });
    return res.json({ init_point: mp.init_point, preference_id: mp.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
