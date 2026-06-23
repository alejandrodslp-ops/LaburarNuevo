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

    // Idempotencia — evitar procesar el mismo pago dos veces
    const { data: existing } = await db.from('pagos')
      .select('id').eq('mp_payment_id', String(paymentId)).single();
    if (existing) return res.json({ ok: true, duplicado: true });

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await mpResp.json();
    if (pago.status !== 'approved') return res.json({ ok: true, status: pago.status });

    const ext = typeof pago.external_reference === 'string'
      ? JSON.parse(pago.external_reference)
      : (pago.external_reference ?? {});
    const { user_id, worker_id, cantidad_perfiles, tipo } = ext;

    const montoNum = pago.transaction_amount ?? 0;
    const moneda   = pago.currency_id ?? 'USD';

    if (tipo === 'worker_activacion' && worker_id) {
      const hasta = new Date(Date.now() + 60 * 86400000).toISOString();
      await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq('id', worker_id);
      await db.from('pagos').insert({
        user_id, worker_id, monto: montoNum, moneda, metodo: 'mercadopago',
        estado: 'aprobado', mp_payment_id: String(paymentId),
      });
    } else {
      if (cantidad_perfiles && user_id) {
        await db.rpc('sumar_visualizaciones', { p_employer_id: user_id, p_cantidad: Number(cantidad_perfiles) });
      }
      await db.from('pagos').insert({
        user_id, worker_id, monto: montoNum, moneda, metodo: 'mercadopago',
        estado: 'aprobado', mp_payment_id: String(paymentId), cantidad_perfiles,
      });
    }

    // CUANDO MIGRES A HETZNER: cambiar URL por fetch('http://localhost:3000/generar-comprobante')
    fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/generar-comprobante', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employer_id: user_id, monto: montoNum, moneda, metodo: 'mercadopago', worker_id }),
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
