const { Router } = require('express');
const { db } = require('../lib/supabase');
const { PAIS_ISO, calcularScore } = require('../lib/matching');
const router = Router();

async function matchOferta(ofertaId) {
  const { data: oferta, error: ofertaErr } = await db
    .from("ofertas")
    .select("id, pais, empleo, titulo, keywords, ciudad, estado, activa")
    .eq("id", ofertaId)
    .single();

  if (ofertaErr || !oferta) return { procesados: 0, error: ofertaErr?.message };
  if (oferta.estado !== "aprobada" || !oferta.activa) return { procesados: 0 };

  const pais = PAIS_ISO[(oferta.pais || "").toLowerCase()] || (oferta.pais || "").slice(0, 2).toUpperCase();

  const { data: workers, error: workersErr } = await db
    .from("profiles")
    .select("id, pais, ciudad, servicios, profesiones, especialidades, tecnicaturas, rol")
    .eq("rol", "worker")
    .eq("perfil_activo", true);

  if (workersErr) return { procesados: 0, error: workersErr.message };
  if (!workers?.length) return { procesados: 0 };

  const batch = workers.map((w) => {
    const { score, keywords_match, cumple } = calcularScore(
      { keywords: oferta.keywords, cargo: oferta.empleo, titulo: oferta.titulo, lugar: oferta.ciudad, pais },
      w
    );
    return {
      oferta_id: ofertaId,
      worker_id: w.id,
      score,
      cumple,
      keywords_match,
      updated_at: new Date().toISOString(),
    };
  }).filter((m) => m.cumple);

  if (!batch.length) return { procesados: 0 };

  const { error: upsertErr } = await db
    .from("oferta_matches")
    .upsert(batch, { onConflict: "oferta_id,worker_id", ignoreDuplicates: false });

  if (upsertErr) return { procesados: 0, error: upsertErr.message };
  return { procesados: batch.length };
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};

    if (body.todos) {
      const { data: ofertas } = await db
        .from("ofertas")
        .select("id")
        .eq("estado", "aprobada")
        .eq("activa", true);

      if (!ofertas?.length) {
        return res.json({ ok: true, ofertas: 0 });
      }

      let totalProcesados = 0;
      for (const o of ofertas) {
        const r = await matchOferta(o.id);
        totalProcesados += r.procesados;
      }

      fetch(`http://localhost:${process.env.PORT || 3000}/notificar-matches-ofertas`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).catch(() => {});

      return res.json({ ok: true, ofertas: ofertas.length, matches_procesados: totalProcesados });
    }

    if (body.oferta_id) {
      const result = await matchOferta(body.oferta_id);
      if (result.procesados > 0) {
        fetch(`http://localhost:${process.env.PORT || 3000}/notificar-matches-ofertas`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        }).catch(() => {});
      }
      return res.json({ ok: !result.error, ...result });
    }

    return res.status(400).json({ error: "Enviar oferta_id o todos:true" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
