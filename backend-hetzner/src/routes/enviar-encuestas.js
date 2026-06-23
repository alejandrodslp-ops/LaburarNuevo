const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const hace7  = new Date(now.getTime() -  7 * 86400000).toISOString();
    const hace14 = new Date(now.getTime() - 14 * 86400000).toISOString();

    const { data: propuestas, error } = await db.from('propuestas')
      .select('id, worker_id, employer_id')
      .eq('estado', 'aceptada')
      .eq('encuesta_worker_sent', false)
      .gte('aceptada_at', hace14)
      .lte('aceptada_at', hace7);

    if (error) return res.status(500).json({ error: error.message });
    if (!propuestas?.length) return res.json({ enviadas: 0 });

    const ids = [...new Set(propuestas.flatMap(p => [p.worker_id, p.employer_id]).filter(Boolean))];
    const { data: profiles } = await db.from('profiles').select('id, push_token').in('id', ids);
    const tokMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.push_token]));

    const msgs = [];
    for (const p of propuestas) {
      const wToken = tokMap[p.worker_id];
      const eToken = tokMap[p.employer_id];
      if (wToken) msgs.push({
        to: wToken,
        title: '¿Cómo fue la experiencia?',
        body: 'Contanos cómo resultó la propuesta de trabajo.',
        sound: 'default',
        data: { pantalla: 'EncuestaWorker', propuesta_id: p.id },
      });
      if (eToken) msgs.push({
        to: eToken,
        title: '¿Encontraste lo que buscabas?',
        body: 'Valorá tu experiencia con el trabajador.',
        sound: 'default',
        data: { pantalla: 'EncuestaEmployer', propuesta_id: p.id },
      });
    }

    if (msgs.length) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgs),
      });
    }

    const propIds = propuestas.map(p => p.id);
    await db.from('propuestas').update({ encuesta_worker_sent: true }).in('id', propIds);

    return res.json({ enviadas: propIds.length, notificaciones: msgs.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
