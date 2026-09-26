const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

// MP envía JSON (no raw) — el express.json() global del index.js es suficiente
async function verificarFirma(req) {
  const xSig       = req.headers['x-signature'] ?? '';
  const xRequestId = req.headers['x-request-id'] ?? '';
  const dataId     = req.query?.['data.id'] ?? req.body?.data?.id ?? '';
  const parts      = Object.fromEntries(xSig.split(',').map(p => p.trim().split('=')));
  const ts         = parts['ts']   ?? '';
  const hash       = parts['v1']   ?? '';
  const manifest   = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // crypto.subtle disponible en Node 18+ (Dockerfile usa Node 20)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const expected = Buffer.from(sig).toString('hex');
  return expected === hash;
}

router.post('/', async (req, res) => {
  try {
    const topic = req.body?.type ?? req.query?.topic ?? '';
    if (topic !== 'payment') return res.json({ ok: true });

    if (MP_WEBHOOK_SECRET) {
      const valida = await verificarFirma(req);
      if (!valida) return res.status(400).json({ error: 'Firma inválida' });
    }

    const paymentId = req.body?.data?.id ?? req.query?.id;
    if (!paymentId) return res.json({ ok: true });

    // Idempotencia — evitar procesar el mismo pago dos veces. Usa
    // referencia_externa (columna real de `pagos`) — mp_payment_id/worker_id
    // no existen en el esquema, eran un bug de esta copia portada (nunca
    // estuvo en vivo, corregido 2026-09-25 junto con la feature de PayPal).
    const { data: existing } = await db.from('pagos')
      .select('id').eq('referencia_externa', String(paymentId)).maybeSingle();
    if (existing) return res.json({ ok: true, duplicado: true });

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await mpResp.json();
    if (pago.status !== 'approved') return res.json({ ok: true, status: pago.status });

    // external_reference es un UUID crudo (el user_id), no JSON — el resto
    // de los datos viaja en metadata. Mismo esquema que la version real
    // (supabase/functions/webhook-pago/index.ts), espejado aca.
    const userId           = pago.external_reference;
    const cantidadPerfiles = Number(pago.metadata?.cantidad_perfiles) || 3;
    const tipo             = pago.metadata?.tipo || 'employer_visualizaciones';
    const montoNum         = pago.transaction_amount ?? 0;
    const moneda           = pago.currency_id ?? 'USD';

    // Registrar el pago PRIMERO — si falla lo siguiente, el reintento del
    // webhook lo detecta como ya-registrado en vez de duplicarlo.
    const { error: pagoErr } = await db.from('pagos').insert({
      user_id: userId, monto: montoNum, moneda, estado: 'aprobado',
      metodo: 'mercadopago', referencia_externa: String(paymentId),
    });
    if (pagoErr) {
      if (pagoErr.code === '23505') return res.json({ ok: true, duplicado: true });
      throw pagoErr;
    }

    if (tipo === 'worker_activacion') {
      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq('id', userId);
    } else if (tipo === 'company_suscripcion') {
      const vence = new Date(Date.now() + 30 * 86400000).toISOString();
      const planesValidos = ['membresia_sa', 'membresia_world', 'membresia_premium'];
      let planId = String(pago.metadata?.plan_id || '');
      if (!planesValidos.includes(planId)) {
        const monto = Number(pago.transaction_amount);
        planId = monto === 12 ? 'membresia_sa' : monto === 24 ? 'membresia_world' : monto === 50 ? 'membresia_premium' : '';
        if (!planId) console.error('company_suscripcion sin plan_id reconocible, monto:', monto, 'userId:', userId);
      }
      const update = { suscripcion_activa: true, suscripcion_vence_at: vence };
      if (planesValidos.includes(planId)) update.suscripcion_plan = planId;
      await db.from('profiles').update(update).eq('id', userId);
    } else {
      await db.rpc('sumar_visualizaciones', { employer_id: userId, cantidad: cantidadPerfiles });
    }

    // Comprobante — silencioso, no bloquea si falla
    fetch(`http://localhost:${process.env.PORT || 3000}/generar-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employer_id: userId, monto: montoNum, moneda, metodo: 'mercadopago',
        referencia_externa: String(paymentId),
        concepto: tipo === 'worker_activacion'
          ? 'Activación de perfil trabajador — Konexu (60 días)'
          : tipo === 'company_suscripcion'
          ? 'Suscripción empresa — Konexu (30 días)'
          : `Visualizaciones de perfiles empleador — Konexu (${cantidadPerfiles} créditos)`,
      }),
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
