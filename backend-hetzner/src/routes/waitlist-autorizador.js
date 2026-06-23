const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    const { data: cfg } = await db.from('waitlist_config').select('*').eq('id', 1).single();
    if (!cfg?.activo) return res.json({ ok: false, razon: 'desactivado' });

    const ahora    = Date.now();
    const ultimo   = cfg.ultimo_lote_at ? new Date(cfg.ultimo_lote_at).getTime() : 0;
    const intervMs = (cfg.intervalo_minutos ?? 60) * 60000;
    if (ahora - ultimo < intervMs) return res.json({ ok: false, razon: 'demasiado pronto' });

    // Medir carga: perfiles actualizados en la última hora
    const haceUnaHora = new Date(ahora - 3600000).toISOString();
    const { count: cargaActual } = await db.from('profiles')
      .select('*', { count: 'exact', head: true }).gte('updated_at', haceUnaHora);
    const umbral = cfg.umbral_activos_hora ?? 10;

    // Factor del lote según carga actual vs umbral
    let factorLote;
    if (cargaActual <= umbral * 0.3)      factorLote = 1.0;
    else if (cargaActual <= umbral * 0.6) factorLote = 0.6;
    else                                   factorLote = 0.3;

    const tamLote = Math.max(1, Math.round(cfg.batch_size * factorLote));

    const { data: proximos } = await db.from('waitlist')
      .select('id, push_token')
      .eq('habilitado', false)
      .order('posicion', { ascending: true })
      .limit(tamLote);

    if (!proximos?.length) return res.json({ ok: true, habilitados: 0 });

    const ids = proximos.map(u => u.id);
    await db.from('waitlist').update({ habilitado: true, habilitado_at: new Date().toISOString() }).in('id', ids);

    const tokens = proximos.map(u => u.push_token).filter(Boolean);
    if (tokens.length) {
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens.map(to => ({
          to,
          title: '¡Tu lugar en Konexu está listo!',
          body: 'Ya podés registrarte. Abrí la app y completá tu perfil.',
          sound: 'default',
          data: { pantalla: 'Register' },
        }))),
      }).catch(() => {});
    }

    const nuevoTam = Math.min(5000, Math.round(cfg.batch_size * 1.5));
    await db.from('waitlist_config').update({ ultimo_lote_at: new Date().toISOString(), batch_size: nuevoTam }).eq('id', 1);
    await db.from('waitlist_lotes').insert({
      habilitados: ids.length, notificados: tokens.length, batch_size: tamLote, carga_hora: cargaActual,
    });

    return res.json({ ok: true, habilitados: ids.length, notificados: tokens.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
