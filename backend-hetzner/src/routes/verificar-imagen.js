const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const GOOGLE_VISION_KEY = process.env.GOOGLE_VISION_KEY;

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    const { image_url } = req.body ?? {};
    if (!image_url) return res.status(400).json({ error: 'image_url requerida' });

    const { data: perfil } = await db.from('profiles')
      .select('perfil_activo, perfil_activo_hasta').eq('id', user.id).single();

    // Solo verificar si el perfil es realmente público (pagó y sigue vigente)
    const esPublico = perfil?.perfil_activo &&
      perfil?.perfil_activo_hasta &&
      new Date(perfil.perfil_activo_hasta) > new Date();
    if (!esPublico) return res.json({ segura: true });

    if (!GOOGLE_VISION_KEY) return res.status(503).json({ error: 'Vision API no configurada' });

    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: image_url } },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          }],
        }),
      }
    );
    const result = await resp.json();
    const safe = result?.responses?.[0]?.safeSearchAnnotation;
    const isSafe = !['LIKELY', 'VERY_LIKELY'].some(
      l => [safe?.adult, safe?.violence, safe?.racy].includes(l)
    );
    return res.json({ segura: isSafe, safe });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
