const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

// Activa la prueba gratis del trabajador — UNA SOLA VEZ por usuario.
// El perfil a activar es SIEMPRE el del token (nunca del body).
const DIAS_PRUEBA = 10;

router.post('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

    const userId = user.id;

    const { data: perfil, error: perfErr } = await db
      .from('profiles')
      .select('perfil_activo, perfil_activo_hasta, fecha_activacion')
      .eq('id', userId)
      .single();
    if (perfErr || !perfil) return res.status(404).json({ error: 'Perfil no encontrado' });

    if (perfil.perfil_activo && perfil.perfil_activo_hasta && new Date(perfil.perfil_activo_hasta) > new Date()) {
      return res.json({ ok: true, ya_activo: true, hasta: perfil.perfil_activo_hasta });
    }

    if (perfil.fecha_activacion) {
      return res.json({ ok: false, prueba_usada: true });
    }

    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + DIAS_PRUEBA * 24 * 60 * 60 * 1000);
    const { error: updErr } = await db
      .from('profiles')
      .update({
        perfil_activo:       true,
        perfil_activo_hasta: hasta.toISOString(),
        fecha_activacion:    ahora.toISOString(),
      })
      .eq('id', userId);
    if (updErr) throw updErr;

    return res.json({ ok: true, activado: true, hasta: hasta.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
