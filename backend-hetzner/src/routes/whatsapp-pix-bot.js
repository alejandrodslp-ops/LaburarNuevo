const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const TWILIO_ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM  = process.env.TWILIO_WHATSAPP_FROM;
const MP_BR_ACCESS_TOKEN    = process.env.MP_BR_ACCESS_TOKEN;
const PIX_KEY_ESTATICA      = process.env.PIX_KEY_ESTATICA;
const MONTO_BRL             = 15.0;

// Twilio envía application/x-www-form-urlencoded
router.use(require('express').urlencoded({ extended: false }));

async function enviarWA(to, body) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: to, Body: body }).toString(),
    }
  );
}

router.post('/', async (req, res) => {
  // Twilio espera siempre 200 — nunca devolver error HTTP
  try {
    const from  = req.body?.From ?? '';
    const texto = (req.body?.Body ?? '').trim().toLowerCase();

    const emailMatch = texto.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (!emailMatch) {
      await enviarWA(from, 'Hola! Para generar tu pago PIX, enviame el email que usaste para registrarte en Konexu.');
      return res.status(200).send('<Response></Response>');
    }

    const email = emailMatch[0];
    const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = (authList?.users ?? []).find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      await enviarWA(from, `No encontré ninguna cuenta con el email ${email}. Verificá que sea el correcto.`);
      return res.status(200).send('<Response></Response>');
    }

    const { data: perfil } = await db.from('profiles')
      .select('id, perfil_activo, perfil_activo_hasta').eq('id', authUser.id).single();

    if (perfil?.perfil_activo && perfil?.perfil_activo_hasta && new Date(perfil.perfil_activo_hasta) > new Date()) {
      const fecha = new Date(perfil.perfil_activo_hasta).toLocaleDateString('es-UY');
      await enviarWA(from, `Tu perfil ya está activo hasta el ${fecha}. 🎉`);
      return res.status(200).send('<Response></Response>');
    }

    // Generar PIX dinámico via MP Brasil o fallback a key estática
    if (MP_BR_ACCESS_TOKEN) {
      const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MP_BR_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `wa-${authUser.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: MONTO_BRL,
          description: 'Konexu — ativação de perfil',
          payment_method_id: 'pix',
          payer: { email, first_name: 'Usuario' },
          external_reference: authUser.id,
        }),
      });
      const mp = await mpResp.json();
      const qr = mp.point_of_interaction?.transaction_data?.qr_code;
      if (qr) {
        await enviarWA(from, `Tu código PIX (copia e cola):\n\n${qr}\n\nMonto: R$${MONTO_BRL}\nVálido 30 minutos.`);
        return res.status(200).send('<Response></Response>');
      }
    }

    // Fallback a key estática
    await enviarWA(from, `Para activar tu perfil pagá R$${MONTO_BRL} a la clave PIX:\n\n*${PIX_KEY_ESTATICA ?? '(configurar PIX_KEY_ESTATICA)'}*\n\nDescripción: tu email`);
    return res.status(200).send('<Response></Response>');
  } catch {
    return res.status(200).send('<Response></Response>');
  }
});

module.exports = router;
