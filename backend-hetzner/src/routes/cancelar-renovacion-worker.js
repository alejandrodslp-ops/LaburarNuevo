const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET    = process.env.PAYPAL_SECRET;
const PAYPAL_ENV       = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_API_BASE  = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { data: perfil } = await db.from('profiles')
      .select('worker_paypal_subscription_id, worker_renovacion_automatica')
      .eq('id', user.id).single();

    if (!perfil?.worker_paypal_subscription_id) {
      return res.status(400).json({ error: 'No tenés una renovación automática activa' });
    }
    if (perfil.worker_renovacion_automatica === false) {
      return res.json({ ok: true, ya_cancelada: true });
    }

    const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('PayPal no devolvió access_token');

    const cancelRes = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${perfil.worker_paypal_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelado por el worker desde Konexu' }),
      },
    );
    // 404 = la suscripcion ya no existe del lado de PayPal (vencida o ya
    // cancelada) — se trata como exito, el efecto que importa (no volver a
    // cobrar) ya esta garantizado.
    if (!cancelRes.ok && cancelRes.status !== 404) {
      const errData = await cancelRes.json().catch(() => ({}));
      console.error('PayPal cancelar subscription error:', cancelRes.status, errData);
      return res.status(502).json({ error: 'No se pudo cancelar en PayPal' });
    }

    await db.from('profiles').update({ worker_renovacion_automatica: false }).eq('id', user.id);

    return res.json({ ok: true });
  } catch (e) {
    console.error('cancelar-renovacion-worker error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
