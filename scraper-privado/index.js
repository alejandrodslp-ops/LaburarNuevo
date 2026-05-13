import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY= process.env.ADZUNA_APP_KEY;
const TEST_MODE     = process.argv.includes('--test');
const PAIS_ARG      = process.env.PAIS?.toUpperCase();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── HELPERS ──────────────────────────────────────────────────────
function normalizar(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extraerKeywords(texto = '') {
  const stop = new Set([
    'de','del','la','el','las','los','en','un','una','y','o','a','con','por',
    'para','al','se','no','es','que','sus','esta','este','lo','como','mas',
    'su','ser','tiene','han','sido','son','fue','hay','pero','the','and','for',
  ]);
  return [...new Set(
    normalizar(texto).split(/\s+/).filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 15);
}

async function fetchJSON(url, headers = {}, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'es-UY,es;q=0.9', ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) { console.log(`    HTTP ${res.status} → ${url}`); return null; }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json') && !ct.includes('javascript')) {
      console.log(`    Content-Type no JSON: ${ct.slice(0, 50)}`);
      return null;
    }
    return await res.json();
  } catch (e) { console.log(`    Error fetch: ${e.message}`); return null; }
}

async function upsert(rows, fuente) {
  if (!rows.length) return 0;
  if (TEST_MODE) {
    console.log(`  [TEST] ${rows.length} filas — muestra:`);
    rows.slice(0, 3).forEach(r => console.log(`    - ${r.cargo} | ${r.organismo || '—'} | ${r.lugar || '—'}`));
    return rows.length;
  }
  const { error } = await supabase
    .from('concursos')
    .upsert(rows, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false });
  if (error) { console.error(`  ERROR upsert ${fuente}:`, error.message); return 0; }
  const hoy = new Date().toISOString().slice(0, 10);
  await supabase.from('concursos').update({ activo: false })
    .eq('fuente', fuente).lt('fecha_cierre', hoy);
  return rows.length;
}

function buildRow(fuente, pais, id, cargo, organismo, lugar, fechaCierre, url, descripcion) {
  return {
    fuente_id:      String(id).slice(0, 80),
    fuente,
    pais,
    numero_llamado: null,
    titulo:         cargo,
    cargo,
    organismo:      organismo || null,
    descripcion:    descripcion ? String(descripcion).replace(/<[^>]+>/g, ' ').trim().slice(0, 2000) : null,
    requisitos:     null,
    tipo_tarea:     null,
    tipo_vinculo:   'privado',
    lugar:          lugar || null,
    fecha_inicio:   null,
    fecha_cierre:   fechaCierre || null,
    puestos:        1,
    url_detalle:    url || null,
    url_postulacion:url || null,
    keywords:       extraerKeywords(`${cargo} ${organismo || ''} ${descripcion || ''}`),
    activo:         true,
  };
}

// ─── REMOTIVE — empleos remotos tech, sin clave ───────────────────
async function scrapeRemotive() {
  console.log('💻 Remotive (remotos tech)...');
  const data = await fetchJSON('https://remotive.com/api/remote-jobs?limit=100');
  if (!data?.jobs?.length) { console.log('  ⚠ sin respuesta'); return 0; }

  const rows = data.jobs.map(j => buildRow(
    'remotive', 'UY',
    j.id,
    j.title,
    j.company_name,
    j.candidate_required_location || 'Remoto',
    null,
    j.url,
    j.description,
  ));

  const n = await upsert(rows, 'remotive');
  console.log(`  ✓ ${n} empleos`);
  return n;
}

// ─── ADZUNA — Argentina, Brasil, Chile, Colombia ──────────────────
// Registro gratuito en: https://developer.adzuna.com/signup
// Luego agregar ADZUNA_APP_ID y ADZUNA_APP_KEY como secrets en GitHub Actions.
async function scrapeAdzuna(paisCode, adzunaCountry) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.log(`  ℹ Adzuna ${paisCode}: configura ADZUNA_APP_ID + ADZUNA_APP_KEY (gratis en developer.adzuna.com)`);
    return 0;
  }
  console.log(`🌎 Adzuna ${paisCode}...`);

  let total = 0;
  for (let page = 1; page <= 2; page++) {
    const url = `https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/${page}`
      + `?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}`
      + `&results_per_page=50&sort_by=date&content-type=application/json`;
    const data = await fetchJSON(url);
    if (!data?.results?.length) break;

    const rows = data.results.map(j => buildRow(
      `adzuna_${adzunaCountry}`, paisCode,
      j.id,
      j.title,
      j.company?.display_name || null,
      j.location?.display_name || null,
      null,
      j.redirect_url,
      j.description,
    ));
    total += await upsert(rows, `adzuna_${adzunaCountry}`);
    await new Promise(r => setTimeout(r, 600));
  }
  console.log(`  ✓ ${total} ofertas`);
  return total;
}

// ─── COMPUTRABAJO — intenta API interna ───────────────────────────
// Computrabajo usa JavaScript rendering en su web, pero su app móvil
// accede a una API REST. Probamos los endpoints más comunes.
async function scrapeComputrabajo(paisCode, tld) {
  console.log(`🔍 Computrabajo ${paisCode}...`);
  const base = `https://www.computrabajo.com.${tld}`;

  const intentos = [
    // Algunos países sirven datos como JSON en endpoints /api/
    { url: `${base}/api/offers?page=1&limit=50&order=date`, headers: {} },
    { url: `${base}/home/getoffers?page=1&rows=50`,          headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    { url: `${base}/trabajo/get?page=1&rows=50`,             headers: { 'X-Requested-With': 'XMLHttpRequest' } },
  ];

  for (const { url, headers } of intentos) {
    const data = await fetchJSON(url, headers, 15000);
    if (!data) continue;

    const lista = data.offers || data.results || data.jobs || data.data || (Array.isArray(data) ? data : null);
    if (!lista?.length) continue;

    const rows = lista.map(j => buildRow(
      `computrabajo_${paisCode.toLowerCase()}`, paisCode,
      j.id || j.ofertaId || encodeURIComponent(j.title || j.cargo || '').slice(0, 60),
      j.title || j.cargo || j.nombre || '',
      j.company || j.empresa || null,
      j.city || j.ciudad || null,
      null,
      j.url || j.link || `${base}/trabajo`,
      j.description || j.descripcion || null,
    )).filter(r => r.cargo.length >= 4);

    const n = await upsert(rows, `computrabajo_${paisCode.toLowerCase()}`);
    console.log(`  ✓ ${n} ofertas (vía API)`);
    return n;
  }

  console.log(`  ℹ 0 ofertas — Computrabajo usa JavaScript rendering (sin API pública conocida)`);
  return 0;
}

// ─── BUMERAN — intenta API interna ────────────────────────────────
async function scrapeBumeran(paisCode, tld) {
  console.log(`🔍 Bumeran ${paisCode}...`);
  const base = `https://www.bumeran.com.${tld}`;

  const intentos = [
    { url: `https://api.bumeran.com.${tld}/aviso/list?page=1&size=50&sort_by=date`, headers: {} },
    { url: `${base}/api/v1/avisos?page=1&pageSize=50&orden=fecha`,                   headers: {} },
    { url: `${base}/api/v2/aviso/list?page=1&rows=50`,                               headers: { 'X-Requested-With': 'XMLHttpRequest' } },
  ];

  for (const { url, headers } of intentos) {
    const data = await fetchJSON(url, headers, 15000);
    if (!data) continue;

    const lista = data.avisos || data.results || data.jobs || (Array.isArray(data) ? data : null);
    if (!lista?.length) continue;

    const rows = lista.map(j => buildRow(
      `bumeran_${paisCode.toLowerCase()}`, paisCode,
      j.id || j.avisoId || '',
      j.titulo || j.title || j.cargo || '',
      j.empresa?.nombre || j.company || null,
      j.ciudad?.nombre || j.location || null,
      null,
      j.url || `${base}/empleos-publicacion-${j.id}.html`,
      j.descripcion || j.description || null,
    )).filter(r => r.cargo.length >= 4);

    const n = await upsert(rows, `bumeran_${paisCode.toLowerCase()}`);
    console.log(`  ✓ ${n} ofertas (vía API)`);
    return n;
  }

  console.log(`  ℹ 0 ofertas — Bumeran usa JavaScript rendering (sin API pública conocida)`);
  return 0;
}

// ─── JOOBLE — agregador LatAm (requiere clave gratuita) ───────────
// Solicitar en: https://jooble.org/api/about  (responden en 1-2 días)
async function scrapeJooble(paisCode, domain, keywords = '') {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) {
    console.log(`  ℹ Jooble ${paisCode}: configura JOOBLE_API_KEY (gratis en jooble.org/api/about)`);
    return 0;
  }
  console.log(`🔎 Jooble ${paisCode}...`);

  try {
    const res = await fetch(`https://${domain}.jooble.org/api/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ keywords, location: '', page: '1' }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return 0; }
    const data = await res.json();
    const lista = data.jobs || [];
    if (!lista.length) { console.log('  ⚠ sin resultados'); return 0; }

    const rows = lista.map(j => buildRow(
      `jooble_${paisCode.toLowerCase()}`, paisCode,
      j.id || encodeURIComponent(j.title).slice(0, 60),
      j.title,
      j.company || null,
      j.location || null,
      j.updated ? j.updated.slice(0, 10) : null,
      j.link,
      j.snippet,
    )).filter(r => r.cargo.length >= 4);

    const n = await upsert(rows, `jooble_${paisCode.toLowerCase()}`);
    console.log(`  ✓ ${n} ofertas`);
    return n;
  } catch (e) {
    console.log(`  Error Jooble: ${e.message}`);
    return 0;
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────
const SCRAPERS = {
  UY: [
    () => scrapeRemotive(),
    () => scrapeComputrabajo('UY', 'uy'),
    () => scrapeBumeran('UY', 'uy'),
    () => scrapeJooble('UY', 'uy', ''),
  ],
  AR: [
    () => scrapeComputrabajo('AR', 'ar'),
    () => scrapeBumeran('AR', 'ar'),
    () => scrapeAdzuna('AR', 'ar'),
    () => scrapeJooble('AR', 'ar', ''),
  ],
  CL: [
    () => scrapeComputrabajo('CL', 'cl'),
    () => scrapeAdzuna('CL', 'cl'),
    () => scrapeJooble('CL', 'cl', ''),
  ],
  CO: [
    () => scrapeComputrabajo('CO', 'co'),
    () => scrapeAdzuna('CO', 'co'),
    () => scrapeJooble('CO', 'co', ''),
  ],
  BR: [
    () => scrapeAdzuna('BR', 'br'),
  ],
};

const aCorrer = PAIS_ARG && SCRAPERS[PAIS_ARG]
  ? { [PAIS_ARG]: SCRAPERS[PAIS_ARG] }
  : SCRAPERS;

console.log(`\n💼 Scraper Ofertas Privadas${TEST_MODE ? ' [TEST]' : ''} — ${new Date().toISOString()}\n`);

let total = 0;
for (const [, fns] of Object.entries(aCorrer)) {
  for (const fn of fns) {
    try { total += (await fn()) || 0; }
    catch (e) { console.error(`  ❌ falló:`, e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

console.log(`\n✅ Total: ${total} ofertas ${TEST_MODE ? 'encontradas (no guardadas)' : 'guardadas en Supabase'}\n`);
