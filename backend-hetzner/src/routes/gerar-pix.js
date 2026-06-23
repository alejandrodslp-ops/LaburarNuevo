const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const PIX_KEY   = process.env.PIX_KEY_RENDIMENTO;
const MONTO_BRL = '15.00';

function crc16(str) {
  let crc = 0xFFFF;
  for (const c of new TextEncoder().encode(str)) {
    crc ^= c << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function pixEmv(key, amount, txid, nome, city) {
  const f = (id, v) => `${id}${String(v.length).padStart(2, '0')}${v}`;
  const mai  = f('00', 'BR.GOV.BCB.PIX') + f('01', key);
  const body =
    f('00', '01') +
    f('26', mai) +
    f('52', '0000') +
    f('53', '986') +
    f('54', amount) +
    f('58', 'BR') +
    f('59', nome.slice(0, 25)) +
    f('60', city.slice(0, 15)) +
    f('62', f('05', txid.slice(0, 25))) +
    '6304';
  return body + crc16(body);
}

router.post('/', async (req, res) => {
  try {
    if (!PIX_KEY) return res.status(503).json({ error: 'PIX no configurado' });

    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const txid = user.id.replace(/-/g, '').slice(0, 25);
    const pix  = pixEmv(PIX_KEY, MONTO_BRL, txid, 'KONEXU', 'MONTEVIDEO');
    return res.json({ pix, monto: MONTO_BRL });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
