const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

router.post('/', async (req, res) => {
  try {
    // Paso 1: matches sin notificar + su oferta. ofertas.id <- oferta_matches.oferta_id
    // es una FK directa, este embed sí resuelve.
    const { data: matches, error } = await db
      .from("oferta_matches")
      .select(`
        id,
        oferta_id,
        ofertas (id, empleo, titulo, employer_id)
      `)
      .eq("cumple", true)
      .eq("notificado", false)
      .order("score", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!matches?.length) {
      return res.json({ ok: true, enviadas: 0 });
    }

    // Paso 2: push_token de cada empresa dueña, en una query aparte.
    // ofertas.employer_id referencia auth.users(id), NO profiles(id) directamente,
    // asi que PostgREST no puede resolver un embed ofertas->profiles en un solo select.
    const employerIds = Array.from(new Set(
      matches.map(m => m.ofertas?.employer_id).filter(Boolean)
    ));

    const { data: perfiles, error: perfilesErr } = await db
      .from("profiles")
      .select("id, push_token")
      .in("id", employerIds);

    if (perfilesErr) throw perfilesErr;
    const tokenPorEmpresa = new Map((perfiles || []).map(p => [p.id, p.push_token]));

    const porOferta = new Map();

    for (const m of matches) {
      const oferta = m.ofertas;
      const push_token = oferta ? tokenPorEmpresa.get(oferta.employer_id) : null;
      if (!oferta || !push_token) continue;

      if (!porOferta.has(m.oferta_id)) {
        porOferta.set(m.oferta_id, { push_token, empleo: oferta.empleo || oferta.titulo, matchIds: [] });
      }
      porOferta.get(m.oferta_id).matchIds.push(m.id);
    }

    let enviadas = 0;
    const notificados = [];

    for (const [ofertaId, data] of porOferta) {
      const cantidad = data.matchIds.length;
      const titulo = cantidad === 1
        ? `Tenés 1 candidato nuevo`
        : `Tenés ${cantidad} candidatos nuevos`;
      const cuerpo = `Para tu búsqueda de ${data.empleo}.`;

      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          to: data.push_token,
          title: titulo,
          body: cuerpo,
          sound: "default",
          data: { pantalla: "MisOfertasEmpresa", oferta_id: ofertaId },
        }),
      });

      const pushResult = await pushRes.json().catch(() => ({}));
      const exito = pushResult?.data?.status === "ok" || pushResult?.status === "ok";

      // Solo `exito` (status real del ticket de Expo) cuenta como entrega — Expo
      // devuelve HTTP 200 incluso cuando el ticket individual es un error (token
      // invalido/expirado, DeviceNotRegistered, etc.). Si falla, el match queda
      // notificado=false y se reintenta en la proxima corrida del cron.
      if (exito) {
        enviadas++;
        notificados.push(...data.matchIds);
      }
    }

    if (notificados.length > 0) {
      await db.from("oferta_matches").update({ notificado: true }).in("id", notificados);
    }

    res.json({ ok: true, empresas_notificadas: enviadas, matches_marcados: notificados.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
