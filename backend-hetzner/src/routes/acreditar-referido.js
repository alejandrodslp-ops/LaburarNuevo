const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

// Acredita un referido: marca referido_por en el nuevo usuario y premia al referente
// con +5 días (máximo 3 referidos). Requiere service_role para escribir columnas protegidas.
const DIAS = 5;
const MAX_REFERIDOS = 3;
const MS_DIA = 86_400_000;

router.post('/', async (req, res) => {
  try {
    const { codigo_referido, nuevo_user_id } = req.body ?? {};
    if (!codigo_referido || !nuevo_user_id) {
      return res.json({ ok: false, motivo: 'faltan datos' });
    }

    const { data: referente } = await db
      .from('profiles')
      .select('id, perfil_activo_hasta, periodo_gratis_hasta')
      .eq('codigo_referido', codigo_referido)
      .single();
    if (!referente) return res.json({ ok: false, motivo: 'codigo invalido' });
    if (referente.id === nuevo_user_id) return res.json({ ok: false, motivo: 'auto' });

    const { data: nuevo } = await db.from('profiles').select('referido_por').eq('id', nuevo_user_id).single();
    if (!nuevo) return res.json({ ok: false, motivo: 'perfil inexistente' });
    if (nuevo.referido_por) return res.json({ ok: false, motivo: 'ya referido' });

    await db.from('profiles').update({ referido_por: referente.id }).eq('id', nuevo_user_id);

    const { count } = await db.from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referido_por', referente.id);
    if ((count || 0) > MAX_REFERIDOS) {
      return res.json({ ok: true, premiado: false, motivo: 'limite' });
    }

    const now = Date.now();
    const baseActivo = referente.perfil_activo_hasta
      ? Math.max(new Date(referente.perfil_activo_hasta).getTime(), now)
      : now + 10 * MS_DIA;
    const nuevaActivo = new Date(baseActivo + DIAS * MS_DIA).toISOString();
    const baseGratis = referente.periodo_gratis_hasta
      ? Math.max(new Date(referente.periodo_gratis_hasta).getTime(), now)
      : baseActivo;
    const nuevaGratis = new Date(baseGratis + DIAS * MS_DIA).toISOString();

    await db.from('profiles').update({
      perfil_activo_hasta:  nuevaActivo,
      periodo_gratis_hasta: nuevaGratis,
      perfil_activo:        true,
    }).eq('id', referente.id);

    return res.json({ ok: true, premiado: true, hasta: nuevaActivo });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
