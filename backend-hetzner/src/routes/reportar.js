const { Router } = require('express');
const { requireAuth } = require('../lib/auth');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const user = req.user;
  const { reported_id, motivo, detalle } = req.body;

  if (!reported_id || !motivo) return res.status(400).json({ error: 'Datos incompletos' });
  if (reported_id === user.id) return res.status(400).json({ error: 'No podés reportarte a vos mismo' });

  const { data: existing } = await db.from('reportes')
    .select('id').eq('reporter_id', user.id).eq('reported_id', reported_id).maybeSingle();
  if (existing) return res.json({ ok: false, ya_reportado: true });

  const { error: insErr } = await db.from('reportes').insert({
    reporter_id: user.id,
    reported_id,
    motivo,
    detalle: detalle?.trim() || null,
    estado: 'pendiente',
  });
  if (insErr) return res.status(400).json({ error: insErr.message });

  const { count } = await db.from('reportes')
    .select('*', { count: 'exact', head: true })
    .eq('reported_id', reported_id)
    .eq('estado', 'pendiente');
  const total = count ?? 0;

  await db.from('profiles').update({ total_reportes: total }).eq('id', reported_id);

  if (total >= 3) {
    await db.from('profiles').update({
      suspendido: true,
      suspendido_motivo: `Auto-suspendido: ${total} denuncias`,
      suspendido_at: new Date().toISOString(),
      perfil_activo: false,
    }).eq('id', reported_id).eq('suspendido', false);
  }

  res.json({ ok: true, total_reportes: total, suspendido: total >= 3 });
});

module.exports = router;
