const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

router.post('/', async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    if (auth !== SERVICE_KEY) return res.status(401).json({ error: 'No autorizado' });

    const { data: matches } = await db.from('concurso_matches')
      .select('id, worker_id')
      .eq('cumple', true)
      .eq('notificado', false);

    if (!matches?.length) return res.json({ notificados: 0 });

    // Agrupar por worker para mandar una sola push por worker
    const byWorker = {};
    for (const m of matches) {
      if (!byWorker[m.worker_id]) byWorker[m.worker_id] = [];
      byWorker[m.worker_id].push(m.id);
    }

    const workerIds = Object.keys(byWorker);
    const { data: profiles } = await db.from('profiles').select('id, push_token').in('id', workerIds);
    const tokMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.push_token]));

    const msgs = [];
    for (const [wid, matchIds] of Object.entries(byWorker)) {
      const token = tokMap[wid];
      if (!token) continue;
      const cant = matchIds.length;
      msgs.push({
        to: token,
        title: cant === 1 ? '¡Nuevo llamado para vos!' : `¡${cant} nuevos llamados para vos!`,
        body: 'Abrí Konexu para ver los concursos que coinciden con tu perfil.',
        sound: 'default',
        data: { pantalla: 'Matches' },
      });
    }

    if (msgs.length) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgs),
      });
    }

    const allIds = matches.map(m => m.id);
    await db.from('concurso_matches').update({ notificado: true }).in('id', allIds);

    return res.json({ notificados: msgs.length, matches_marcados: allIds.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
