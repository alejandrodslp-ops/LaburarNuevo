const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const PAYPAL_CLIENT_ID  = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET     = process.env.PAYPAL_SECRET;
const PAYPAL_ENV        = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_API_BASE   = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const MAX_INTENTOS_COBRO_FALLIDO = 3;

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

async function verificarFirmaPaypal(req) {
  if (!PAYPAL_WEBHOOK_ID) return true; // sin webhook_id configurado, se acepta (modo desarrollo)
  const token = await obtenerTokenPaypal();
  const verifyRes = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transmission_id:   req.headers['paypal-transmission-id'],
      transmission_time: req.headers['paypal-transmission-time'],
      cert_url:          req.headers['paypal-cert-url'],
      auth_algo:         req.headers['paypal-auth-algo'],
      transmission_sig:  req.headers['paypal-transmission-sig'],
      webhook_id:        PAYPAL_WEBHOOK_ID,
      webhook_event:     req.body,
    }),
  });
  const result = await verifyRes.json().catch(() => ({}));
  return result.verification_status === 'SUCCESS';
}

async function enviarPush(pushToken, silencioso, titulo, cuerpo) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: pushToken, title: titulo, body: cuerpo,
        sound: silencioso ? null : 'default',
        data: { pantalla: 'PagoActivacion' },
      }),
    });
  } catch (_e) {
    // best-effort — un push fallido no debe frenar el procesamiento del webhook
  }
}

router.post('/', async (req, res) => {
  try {
    const firmaOk = await verificarFirmaPaypal(req);
    if (!firmaOk) {
      console.error('Firma de webhook PayPal inválida — request rechazado');
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const event = req.body || {};
    const eventType = event.event_type;
    const resource = event.resource || {};

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const workerId = resource.custom_id;
      const subscriptionId = resource.id;
      if (!workerId || !subscriptionId) return res.json({ ok: true, ignorado: 'sin custom_id/id' });

      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await db.from('profiles').update({
        perfil_activo: true,
        perfil_activo_hasta: hasta,
        worker_paypal_subscription_id: subscriptionId,
        worker_renovacion_automatica: true,
        worker_intentos_cobro_fallido: 0,
      }).eq('id', workerId);

    } else if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = resource.billing_agreement_id;
      if (!subscriptionId) return res.json({ ok: true, ignorado: 'sin billing_agreement_id' });

      const { data: perfil } = await db.from('profiles')
        .select('id').eq('worker_paypal_subscription_id', subscriptionId).maybeSingle();
      if (!perfil) return res.json({ ok: true, ignorado: 'worker no encontrado' });

      const saleId = resource.id;
      const { data: yaRegistrado } = await db.from('pagos')
        .select('id').eq('referencia_externa', saleId).maybeSingle();
      if (yaRegistrado) return res.json({ ok: true, duplicado: true });

      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await db.from('profiles').update({
        perfil_activo: true, perfil_activo_hasta: hasta, worker_intentos_cobro_fallido: 0,
      }).eq('id', perfil.id);

      await db.from('pagos').insert({
        user_id: perfil.id,
        monto: parseFloat(resource.amount?.total ?? '0'),
        moneda: resource.amount?.currency ?? 'USD',
        estado: 'aprobado',
        metodo: 'paypal',
        referencia_externa: saleId,
      });

    } else if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const subscriptionId = resource.id;
      const { data: perfil } = await db.from('profiles')
        .select('id, push_token, notificaciones_activas, worker_intentos_cobro_fallido')
        .eq('worker_paypal_subscription_id', subscriptionId).maybeSingle();
      if (!perfil) return res.json({ ok: true, ignorado: 'worker no encontrado' });

      const silencioso = perfil.notificaciones_activas === false;
      const intentos = (perfil.worker_intentos_cobro_fallido || 0) + 1;
      if (intentos >= MAX_INTENTOS_COBRO_FALLIDO) {
        await db.from('profiles').update({ perfil_activo: false, worker_intentos_cobro_fallido: intentos }).eq('id', perfil.id);
        if (perfil.push_token) {
          await enviarPush(perfil.push_token, silencioso, 'Se desactivó tu perfil',
            'No pudimos procesar tu renovación automática después de varios intentos. Reactivá cuando quieras desde Konexu.');
        }
      } else {
        await db.from('profiles').update({ worker_intentos_cobro_fallido: intentos }).eq('id', perfil.id);
        if (perfil.push_token) {
          await enviarPush(perfil.push_token, silencioso, 'No pudimos procesar tu renovación',
            `Intento ${intentos} de ${MAX_INTENTOS_COBRO_FALLIDO} — revisá tu método de pago en PayPal o cancelá desde el menú de tu perfil.`);
        }
      }

    } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const subscriptionId = resource.id;
      await db.from('profiles').update({ worker_renovacion_automatica: false }).eq('worker_paypal_subscription_id', subscriptionId);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('webhook-paypal error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
