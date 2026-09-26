const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const MP_ACCESS_TOKEN  = process.env.MP_ACCESS_TOKEN;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET    = process.env.PAYPAL_SECRET;
const PAYPAL_ENV       = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_API_BASE  = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function obtenerTokenPaypal() {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal no devolvió access_token');
  return data.access_token;
}

// El precio (y, para creditos, la cantidad que se acredita) SIEMPRE los
// decide el servidor a partir de una tabla fija — nunca lo que mande el
// cliente en el body. Mismo criterio que supabase/functions/crear-pago
// (la version real, ya en uso) — espejado aca para que la migracion a
// Hetzner no reintroduzca la vulnerabilidad original de este archivo
// (monto/cantidad_perfiles sin validar).
const PRECIOS_SUSCRIPCION = {
  membresia_sa: 12,
  membresia_world: 24,
  membresia_premium: 50,
};
const PRECIO_ACTIVACION_WORKER = 1;
const PAQUETES_VISUALIZACIONES = [
  { monto: 3.99, cantidad: 3 },
  { monto: 7.98, cantidad: 3 },
  { monto: 1.50, cantidad: 3 },
  { monto: 9.99, cantidad: 10 },
  { monto: 19.99, cantidad: 10 },
  { monto: 4.99, cantidad: 10 },
];

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { monto, descripcion, worker_id, cantidad_perfiles, tipo, plan_id } = req.body ?? {};
    const tipoFinal = tipo || 'employer_visualizaciones';

    // PayPal — activación recurrente del worker. Aparte del resto: no crea
    // una preferencia de MercadoPago, sino una Subscription de PayPal contra
    // un plan ya creado de antemano (config.paypal_plan_id_sa). Monto plano
    // USD 1 para cualquier país — mismo criterio que PRECIO_ACTIVACION_WORKER
    // más abajo, no tiene tramo SA/Mundo como employer_visualizaciones.
    if (tipoFinal === 'worker_activacion_paypal') {
      const { data: configRows, error: configErr } = await db
        .from('config').select('clave, valor').eq('clave', 'paypal_plan_id_sa');
      const planId = configRows?.[0]?.valor;
      if (!planId) {
        console.error('Plan de PayPal no configurado:', configErr?.message);
        return res.status(500).json({ error: 'Plan de PayPal no configurado' });
      }

      const ppToken = await obtenerTokenPaypal();
      const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ppToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: user.id,
          application_context: {
            return_url: 'https://api.konexu.app/pago-resultado?status=success',
            cancel_url: 'https://api.konexu.app/pago-resultado?status=failure',
          },
        }),
      });
      if (!subRes.ok) {
        const errData = await subRes.json().catch(() => ({}));
        console.error('PayPal crear subscription error:', subRes.status, errData);
        return res.status(502).json({ error: 'Error al crear suscripción de PayPal' });
      }
      const sub = await subRes.json();
      const approveLink = (sub.links || []).find((l) => l.rel === 'approve')?.href;
      if (!approveLink) return res.status(502).json({ error: 'PayPal no devolvió link de aprobación' });
      return res.json({ init_point: approveLink, preference_id: sub.id });
    }

    let montoFinal;
    let cantidadFinal;
    if (tipoFinal === 'company_suscripcion') {
      const precio = PRECIOS_SUSCRIPCION[plan_id];
      if (!precio) return res.status(400).json({ error: 'plan_id inválido o ausente' });
      montoFinal = precio;
      cantidadFinal = 0;
    } else if (tipoFinal === 'worker_activacion') {
      montoFinal = PRECIO_ACTIVACION_WORKER;
      cantidadFinal = 0;
    } else {
      const paquete = PAQUETES_VISUALIZACIONES.find(
        (p) => p.monto === Number(monto) && p.cantidad === Number(cantidad_perfiles)
      );
      if (!paquete) return res.status(400).json({ error: 'Paquete de visualizaciones inválido' });
      montoFinal = paquete.monto;
      cantidadFinal = paquete.cantidad;
    }

    // CUANDO MIGRES A HETZNER: cambiar notification_url a https://<hetzner-ip>/webhook-pago
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: descripcion || 'Konexu - Ver perfiles completos', quantity: 1, unit_price: montoFinal, currency_id: 'USD' }],
        // external_reference debe ser el UUID crudo — webhook-pago lo usa
        // directo como id de usuario. Lo demas va en metadata (mismo
        // esquema que la version real de crear-pago).
        external_reference: user.id,
        metadata: {
          worker_id: worker_id || null,
          cantidad_perfiles: cantidadFinal,
          tipo: tipoFinal,
          plan_id: plan_id || null,
        },
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
