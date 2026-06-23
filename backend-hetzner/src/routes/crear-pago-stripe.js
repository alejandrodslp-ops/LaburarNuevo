const { Router } = require('express');
const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

router.post('/', async (req, res) => {
  try {
    const { user_id, monto, descripcion, cantidad_perfiles, worker_id } = req.body ?? {};

    const params = new URLSearchParams({
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': descripcion ?? 'Konexu — activación de perfil',
      'line_items[0][price_data][unit_amount]': String(Math.round(Number(monto) * 100)),
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url: 'konexu://pago-ok',
      cancel_url: 'konexu://pago-error',
      'metadata[user_id]': user_id ?? '',
      'metadata[worker_id]': worker_id ?? '',
      'metadata[cantidad_perfiles]': String(cantidad_perfiles ?? 0),
    });

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await resp.json();
    if (!session.url) return res.status(500).json({ error: 'Stripe no devolvió URL', session });
    return res.json({ checkout_url: session.url, session_id: session.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
