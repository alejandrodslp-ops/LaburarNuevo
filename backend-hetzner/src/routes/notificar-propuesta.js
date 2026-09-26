const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    // Verificar quién llama de verdad — antes cualquiera con la anon key
    // podía mandar una push "de Konexu" con cualquier texto a cualquier
    // user_id, sin ninguna relación real de por medio. Se exige el JWT
    // del caller y una fila reciente en mensajes/propuestas que conecte
    // a ese caller con el destinatario (mismo fix que la función real,
    // 2026-09-26).
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    if (!auth) return res.status(401).json({ error: 'No autorizado' });
    const { data: { user: caller }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !caller) return res.status(401).json({ error: 'Token inválido' });

    const { user_id, worker_id, titulo, cuerpo, pantalla } = req.body ?? {};
    const destinatario = user_id || worker_id;
    if (!destinatario) return res.status(400).json({ error: 'user_id requerido' });

    const hace5min = new Date(Date.now() - 5 * 60000).toISOString();
    const [{ data: msg }, { data: prop }] = await Promise.all([
      db.from('mensajes').select('id')
        .or(`and(sender_id.eq.${caller.id},receiver_id.eq.${destinatario}),and(sender_id.eq.${destinatario},receiver_id.eq.${caller.id})`)
        .gte('created_at', hace5min).limit(1).maybeSingle(),
      db.from('propuestas').select('id')
        .or(`and(employer_id.eq.${caller.id},worker_id.eq.${destinatario}),and(employer_id.eq.${destinatario},worker_id.eq.${caller.id})`)
        .gte('created_at', hace5min).limit(1).maybeSingle(),
    ]);
    if (!msg && !prop) {
      return res.status(403).json({ error: 'Sin relación reciente con el destinatario' });
    }

    const { data: perfil } = await db.from('profiles')
      .select('push_token, notificaciones_activas').eq('id', destinatario).single();
    if (!perfil?.push_token) return res.json({ ok: true, motivo: 'sin_token' });

    const conSonido = perfil.notificaciones_activas !== false;

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: perfil.push_token,
        title: titulo || 'Nueva notificación de Konexu 🔔',
        body: cuerpo || '',
        sound: conSonido ? 'default' : null,
        data: { pantalla: pantalla || 'Mensajes' },
      }),
    });
    const result = await pushRes.json().catch(() => ({}));

    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
