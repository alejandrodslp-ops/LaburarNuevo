const { Router } = require('express');
const { db } = require('../lib/supabase');
const { scrapeGoogleNews, extraerKeywords } = require('../lib/scraper');
const router = Router();

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAIS_ISO = {
  "uruguay":"UY","argentina":"AR","chile":"CL","colombia":"CO",
  "peru":"PE","perú":"PE","brasil":"BR","brazil":"BR","paraguay":"PY",
  "bolivia":"BO","ecuador":"EC","venezuela":"VE","mexico":"MX","méxico":"MX",
  "cuba":"CU","costa rica":"CR","panama":"PA","panamá":"PA","guatemala":"GT",
  "el salvador":"SV","honduras":"HN","nicaragua":"NI",
  "republica dominicana":"DO","república dominicana":"DO",
  "espana":"ES","españa":"ES","spain":"ES","portugal":"PT",
  "italia":"IT","italy":"IT","francia":"FR","france":"FR",
  "alemania":"DE","germany":"DE","reino unido":"GB","united kingdom":"GB",
  "estados unidos":"US","united states":"US","usa":"US",
  "canada":"CA","canadá":"CA","australia":"AU",
  "suecia":"SE","sweden":"SE","noruega":"NO","norway":"NO",
  "japon":"JP","japón":"JP","japan":"JP","india":"IN",
};

const LANG = {
  BR:"pt", PT:"pt", DE:"de", FR:"fr", IT:"it",
  GB:"en", US:"en", CA:"en", AU:"en", SE:"en", NO:"en", JP:"ja", IN:"en",
};

function paisISO(pais) {
  if (!pais) return "UY";
  const norm = pais.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return PAIS_ISO[norm] || pais.slice(0, 2).toUpperCase();
}

router.post('/', async (req, res) => {
  const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
  if (auth !== SERVICE_KEY) return res.status(401).json({ error: 'No autorizado' });

  const MAX_POR_EJECUCION = 200;

  const { data: workers, error } = await db.from('profiles')
    .select('id, pais, ciudad, servicios, profesiones, descripcion_libre')
    .eq('busqueda_diaria_on', true)
    .eq('perfil_activo', true)
    .not('descripcion_libre', 'is', null)
    .limit(MAX_POR_EJECUCION);

  if (error) return res.status(500).json({ error: error.message });
  if (!workers?.length) return res.json({ ok: true, procesados: 0 });

  let totalNuevos = 0;
  const LOTE = 5;

  for (let i = 0; i < workers.length; i += LOTE) {
    const lote = workers.slice(i, i + LOTE);
    await Promise.allSettled(lote.map(async (w) => {
      try {
        const kwsLibre = extraerKeywords((w.descripcion_libre || '').slice(0, 500));
        const kwsServ  = (w.servicios   || []).flatMap(s => extraerKeywords(s)).slice(0, 4);
        const kwsProf  = (w.profesiones || []).flatMap(p => extraerKeywords(p)).slice(0, 4);
        const keywords = [...new Set([...kwsLibre, ...kwsServ, ...kwsProf])].slice(0, 6);
        if (!keywords.length) return;

        const iso   = paisISO(w.pais);
        const lang  = LANG[iso] || 'es';
        const lugar = w.ciudad ? `${w.ciudad} ${w.pais || ''}`.trim() : (w.pais || '');
        const query = `${keywords.join(' ')} ${lugar} empleo trabajo llamado convocatoria`;

        const { rows } = await scrapeGoogleNews(iso, query, 'busqueda_diaria_gnews', lang, 15);
        if (!rows.length) return;

        const { error: upsertErr } = await db.from('concursos')
          .upsert(rows, { onConflict: 'fuente,fuente_id', ignoreDuplicates: true });
        if (upsertErr) return;

        const fuente_ids = rows.map(r => r.fuente_id);
        const { data: concursosDB } = await db.from('concursos')
          .select('id, fuente_id')
          .in('fuente_id', fuente_ids)
          .eq('fuente', 'busqueda_diaria_gnews');
        if (!concursosDB?.length) return;

        const matches = concursosDB.map(c => ({
          concurso_id:    c.id,
          worker_id:      w.id,
          score:          60,
          cumple:         true,
          keywords_match: keywords,
          notificado:     false,
        }));

        const { count: insertados } = await db.from('concurso_matches')
          .upsert(matches, { onConflict: 'concurso_id,worker_id', ignoreDuplicates: true })
          .select('id', { count: 'exact', head: true });

        totalNuevos += insertados ?? 0;
      } catch { /* worker individual falla sin detener el lote */ }
    }));

    if (i + LOTE < workers.length) await new Promise(r => setTimeout(r, 1000));
  }

  if (totalNuevos > 0) {
    // CUANDO MIGRES A HETZNER: cambiar URL por fetch('http://localhost:3000/notificar-matches')
    fetch('https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/notificar-matches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  return res.json({ ok: true, workers_procesados: workers.length, nuevos_resultados: totalNuevos });
});

module.exports = router;
