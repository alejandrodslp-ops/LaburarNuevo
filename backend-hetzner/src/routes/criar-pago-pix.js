const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const MP_BR_ACCESS_TOKEN = process.env.MP_BR_ACCESS_TOKEN;
const PIX_KEY_ESTATICA   = process.env.PIX_KEY_ESTATICA;
const MONTO_BRL          = 15.0;

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    // Sin MP Brasil configurado → devolver PIX key estática
    if (!MP_BR_ACCESS_TOKEN) {
      return res.json({ modo: 'estatico', pix_key: PIX_KEY_ESTATICA ?? null, monto: MONTO_BRL });
    }

    const { data: perfil } = await db.from('profiles')
      .select('nome_completo, cpf, email').eq('id', user.id).single();

    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_BR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: MONTO_BRL,
        description: 'Konexu — ativação de perfil 60 dias',
        payment_method_id: 'pix',
        payer: {
          email: perfil?.email ?? user.email,
          first_name: (perfil?.nome_completo ?? 'Usuario').split(' ')[0],
          identification: { type: 'CPF', number: perfil?.cpf ?? '00000000000' },
        },
        external_reference: user.id,
        // CUANDO MIGRES A HETZNER: cambiar a https://<hetzner-ip>/ativar-via-pix
        notification_url: 'https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/ativar-via-pix',
      }),
    });
    const mp = await resp.json();
    if (mp.error) return res.status(500).json({ error: mp.message ?? 'Error MP', mp });

    const txInfo = mp.point_of_interaction?.transaction_data;
    return res.json({
      qr_code:    txInfo?.qr_code        ?? null,
      qr_base64:  txInfo?.qr_code_base64 ?? null,
      payment_id: mp.id,
      monto:      MONTO_BRL,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
