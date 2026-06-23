const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    if (auth !== SERVICE_KEY) return res.status(401).json({ error: 'No autorizado' });

    const { error } = await db.rpc('incrementar_vistas_simuladas');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
