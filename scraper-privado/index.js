import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_API_KEY = process.env.JOOBLE_API_KEY;
const TEST_MODE      = process.argv.includes('--test');
const PAIS_ARG       = process.env.PAIS?.toUpperCase();

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
    'to','in','of','at','is','are','we','you','our','with','from','your','an',
    'this','that','will','job','jobs','work','hiring','apply','remote','full',
    'time','part','position','experience','team','company','role','join',
  ]);
  return [...new Set(
    normalizar(texto).split(/\s+/).filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 15);
}

async function fetchJSON(url, headers = {}, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) { console.log(`    HTTP ${res.status} → ${url.slice(0, 80)}`); return null; }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json') && !ct.includes('javascript')) { return null; }
    return await res.json();
  } catch (e) { console.log(`    Error: ${e.message}`); return null; }
}

async function fetchXML(url, timeout = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/xml,text/xml,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function extraerTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim();
}

function extraerItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

async function upsert(rows, fuente) {
  if (!rows.length) return 0;
  if (TEST_MODE) {
    console.log(`  [TEST] ${rows.length} filas:`);
    rows.slice(0, 3).forEach(r => console.log(`    - ${r.cargo} | ${r.organismo || '—'} | ${r.lugar || '—'}`));
    return rows.length;
  }
  const { error } = await supabase
    .from('concursos')
    .upsert(rows, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false });
  if (error) { console.error(`  ERROR upsert ${fuente}:`, error.message); return 0; }
  // Marcar vencidos
  const hoy = new Date().toISOString().slice(0, 10);
  await supabase.from('concursos').update({ activo: false })
    .eq('fuente', fuente).lt('fecha_cierre', hoy);
  return rows.length;
}

function buildRow(fuente, pais, id, cargo, organismo, lugar, fechaCierre, url, descripcion) {
  return {
    fuente_id:       String(id || '').replace(/\s/g, '_').slice(0, 80),
    fuente,
    pais,
    numero_llamado:  null,
    titulo:          String(cargo || '').slice(0, 300),
    cargo:           String(cargo || '').slice(0, 300),
    organismo:       organismo ? String(organismo).slice(0, 200) : null,
    descripcion:     descripcion ? String(descripcion).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) : null,
    requisitos:      null,
    tipo_tarea:      null,
    tipo_vinculo:    'privado',
    lugar:           lugar ? String(lugar).slice(0, 200) : null,
    fecha_inicio:    null,
    fecha_cierre:    fechaCierre || null,
    puestos:         1,
    url_detalle:     url || null,
    url_postulacion: url || null,
    keywords:        extraerKeywords(`${cargo} ${organismo || ''} ${descripcion || ''}`),
    activo:          true,
  };
}

// ─────────────────────────────────────────────────────────────
// REMOTIVE — empleos remotos tech globales, sin clave API
// Cubre: UY, AR, CL, CO, BR, MX, PE, ES, DE, FR, IT, GB, US, CA, AU
// ─────────────────────────────────────────────────────────────
async function scrapeRemotive() {
  console.log('💻 Remotive (remotos tech — global)...');
  const data = await fetchJSON('https://remotive.com/api/remote-jobs?limit=100');
  if (!data?.jobs?.length) { console.log('  ⚠ sin respuesta'); return 0; }

  // Mapa de palabras clave de país en el campo location → código ISO
  const PAIS_DETECT = {
    'uruguay': 'UY', 'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO',
    'peru': 'PE', 'brasil': 'BR', 'brazil': 'BR', 'mexico': 'MX', 'méxico': 'MX',
    'spain': 'ES', 'españa': 'ES', 'germany': 'DE', 'alemania': 'DE',
    'france': 'FR', 'italia': 'IT', 'italy': 'IT', 'portugal': 'PT',
    'united kingdom': 'GB', 'uk': 'GB', 'united states': 'US', 'usa': 'US',
    'canada': 'CA', 'australia': 'AU', 'venezuela': 'VE', 'ecuador': 'EC',
    'bolivia': 'BO', 'paraguay': 'PY', 'costa rica': 'CR', 'panama': 'PA',
    'guatemala': 'GT', 'el salvador': 'SV', 'honduras': 'HN',
    'nicaragua': 'NI', 'dominican': 'DO', 'cuba': 'CU',
  };

  const rowsByPais = {};
  for (const j of data.jobs) {
    const loc = (j.candidate_required_location || '').toLowerCase();
    let pais = 'UY'; // default cuando es "worldwide" o vacío → lo ponemos en UY para que aparezca
    for (const [kw, iso] of Object.entries(PAIS_DETECT)) {
      if (loc.includes(kw)) { pais = iso; break; }
    }
    if (!rowsByPais[pais]) rowsByPais[pais] = [];
    rowsByPais[pais].push(buildRow(
      'remotive', pais,
      j.id,
      j.title,
      j.company_name,
      j.candidate_required_location || 'Remoto',
      null,
      j.url,
      j.description,
    ));
  }

  let total = 0;
  for (const [pais, rows] of Object.entries(rowsByPais)) {
    const n = await upsert(rows, 'remotive');
    if (n > 0) console.log(`  ✓ ${n} empleos en ${pais}`);
    total += n;
  }
  console.log(`  ✓ Total Remotive: ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// REMOTEOK — empleos remotos globales, sin clave API
// ─────────────────────────────────────────────────────────────
async function scrapeRemoteOk() {
  console.log('🌐 RemoteOK (remotos — global)...');
  // RemoteOK requiere este User-Agent
  const data = await fetchJSON('https://remoteok.com/api?tag=&location=', {
    'User-Agent': UA,
    'Accept': 'application/json',
  });
  if (!Array.isArray(data) || data.length < 2) { console.log('  ⚠ sin respuesta'); return 0; }

  // El primer elemento es metadata, el resto son jobs
  const jobs = data.slice(1).filter(j => j.id && j.position);
  const rows = jobs.slice(0, 80).map(j => buildRow(
    'remoteok', 'UY',  // empleos remotos → disponibles para todos
    j.id,
    j.position,
    j.company,
    j.location || 'Remoto',
    j.date ? j.date.slice(0, 10) : null,
    j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    j.description,
  ));

  const n = await upsert(rows.filter(r => r.cargo.length >= 4), 'remoteok');
  console.log(`  ✓ ${n} empleos`);
  return n;
}

// ─────────────────────────────────────────────────────────────
// ARBEITNOW — job board Europa/global, sin clave API
// Muy fuerte en DE, AT, CH, NL, GB, FR, ES, IT
// ─────────────────────────────────────────────────────────────
async function scrapeArbeitnow() {
  console.log('🇩🇪 Arbeitnow (Europa — sin clave)...');

  // Mapa de keywords de país en location → código ISO
  const PAIS_MAP = {
    'germany': 'DE', 'deutschland': 'DE', 'berlin': 'DE', 'munich': 'DE',
    'hamburg': 'DE', 'frankfurt': 'DE', 'cologne': 'DE', 'köln': 'DE',
    'austria': 'AT', 'austria':'AT', 'wien': 'AT', 'vienna': 'AT',
    'switzerland': 'CH', 'zürich': 'CH', 'zurich': 'CH',
    'netherlands': 'NL', 'amsterdam': 'NL',
    'france': 'FR', 'paris': 'FR',
    'spain': 'ES', 'madrid': 'ES', 'barcelona': 'ES',
    'italy': 'IT', 'rome': 'IT', 'milan': 'IT', 'roma': 'IT', 'milano': 'IT',
    'united kingdom': 'GB', 'london': 'GB', 'manchester': 'GB',
    'portugal': 'PT', 'lisbon': 'PT', 'lisboa': 'PT',
    'poland': 'PL', 'warsaw': 'PL',
    'remote': 'DE', // remotos los ponemos en DE ya que es el foco de Arbeitnow
  };

  let total = 0;
  for (let page = 1; page <= 3; page++) {
    const data = await fetchJSON(`https://arbeitnow.com/api/job-board-api?page=${page}`);
    if (!data?.data?.length) break;

    const rowsByPais = {};
    for (const j of data.data) {
      const loc = (j.location || '').toLowerCase();
      let pais = 'DE';
      for (const [kw, iso] of Object.entries(PAIS_MAP)) {
        if (loc.includes(kw)) { pais = iso; break; }
      }
      if (!rowsByPais[pais]) rowsByPais[pais] = [];
      rowsByPais[pais].push(buildRow(
        'arbeitnow', pais,
        j.slug || j.title?.replace(/\s/g, '-').slice(0, 60),
        j.title,
        j.company_name,
        j.location,
        null,
        j.url,
        j.description,
      ));
    }

    for (const [, rows] of Object.entries(rowsByPais)) {
      total += await upsert(rows.filter(r => r.cargo.length >= 4), 'arbeitnow');
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`  ✓ ${total} empleos`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// ADZUNA — API con clave gratuita
// Registrar gratis en: developer.adzuna.com
// Agrega en GitHub Secrets: ADZUNA_APP_ID, ADZUNA_APP_KEY
// Países soportados: ar, br, cl, co, mx, gb, us, ca, au, de, fr, it, es, nl, at, pl, ru, sg, za, in
// ─────────────────────────────────────────────────────────────
async function scrapeAdzuna(paisCode, adzunaCountry) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.log(`  ℹ Adzuna ${paisCode}: agrega ADZUNA_APP_ID + ADZUNA_APP_KEY en GitHub Secrets (gratis en developer.adzuna.com)`);
    return 0;
  }
  console.log(`🌎 Adzuna ${paisCode}...`);
  let total = 0;
  for (let page = 1; page <= 3; page++) {
    const url = `https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/${page}`
      + `?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}`
      + `&results_per_page=50&sort_by=date&content-type=application/json`;
    const data = await fetchJSON(url);
    if (!data?.results?.length) break;
    const rows = data.results.map(j => buildRow(
      `adzuna_${adzunaCountry}`, paisCode,
      j.id, j.title,
      j.company?.display_name || null,
      j.location?.display_name || null,
      null, j.redirect_url, j.description,
    ));
    total += await upsert(rows, `adzuna_${adzunaCountry}`);
    await new Promise(r => setTimeout(r, 400));
  }
  console.log(`  ✓ ${total} ofertas`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// JOOBLE — agregador global, clave gratuita
// Solicitar en: https://jooble.org/api/about  (responden en 1-2 días)
// Agrega en GitHub Secrets: JOOBLE_API_KEY
// ─────────────────────────────────────────────────────────────
async function scrapeJooble(paisCode, domain, keywords = '') {
  if (!JOOBLE_API_KEY) {
    console.log(`  ℹ Jooble ${paisCode}: agrega JOOBLE_API_KEY en GitHub Secrets (gratis en jooble.org/api/about)`);
    return 0;
  }
  console.log(`🔎 Jooble ${paisCode}...`);
  try {
    const res = await fetch(`https://${domain}.jooble.org/api/${JOOBLE_API_KEY}`, {
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
      j.id || j.title?.replace(/\s/g, '_').slice(0, 60),
      j.title, j.company || null, j.location || null,
      j.updated ? j.updated.slice(0, 10) : null,
      j.link, j.snippet,
    )).filter(r => r.cargo.length >= 4);
    const n = await upsert(rows, `jooble_${paisCode.toLowerCase()}`);
    console.log(`  ✓ ${n} ofertas`);
    return n;
  } catch (e) { console.log(`  Error Jooble: ${e.message}`); return 0; }
}

// ─────────────────────────────────────────────────────────────
// COMPUTRABAJO — el mayor job board de LatAm
// Usa RSS público (sin clave) disponible en todos los subdominios
// Cubre: UY, AR, CL, CO, PE, MX, EC, BO, PY, VE, CR, GT, SV, HN, NI, PA, DO, ES
// ─────────────────────────────────────────────────────────────
async function scrapeComputrabajo(paisCode, tld) {
  console.log(`🔍 Computrabajo ${paisCode} (.${tld})...`);

  // Computrabajo tiene RSS público en todos sus subdominios
  const rssUrls = [
    `https://www.computrabajo.com.${tld}/rss/offer`,
    `https://www.computrabajo.com.${tld}/feed/jobs`,
    `https://www.computrabajo.com.${tld}/offers.rss`,
  ];

  for (const rssUrl of rssUrls) {
    const xml = await fetchXML(rssUrl);
    if (!xml || !xml.includes('<item>')) continue;

    const items = extraerItems(xml);
    if (!items.length) continue;

    const rows = items.slice(0, 50).map(item => {
      const titulo = extraerTag(item, 'title');
      const link   = extraerTag(item, 'link');
      const desc   = extraerTag(item, 'description');
      const guid   = extraerTag(item, 'guid') || link;
      if (!titulo || titulo.length < 4) return null;
      // Extraer empresa y ciudad del título o descripción si viene en formato "Cargo | Empresa | Ciudad"
      const partes = titulo.split(/\s*[|\-–]\s*/);
      const cargo  = partes[0]?.trim() || titulo;
      const org    = partes[1]?.trim() || null;
      const ciudad = partes[2]?.trim() || null;
      return buildRow(
        `computrabajo_${tld}`, paisCode,
        guid.replace(/\W/g, '').slice(-60),
        cargo, org, ciudad, null, link, desc,
      );
    }).filter(Boolean).filter(r => r.cargo.length >= 4);

    if (rows.length > 0) {
      const n = await upsert(rows, `computrabajo_${tld}`);
      console.log(`  ✓ ${n} ofertas (RSS)`);
      return n;
    }
  }

  // Si el RSS no funciona, intentar la API interna como fallback
  const base = `https://www.computrabajo.com.${tld}`;
  const intentos = [
    { url: `${base}/api/offers?page=1&limit=50`, headers: {} },
    { url: `${base}/home/getoffers?page=1&rows=50`, headers: { 'X-Requested-With': 'XMLHttpRequest' } },
  ];
  for (const { url, headers } of intentos) {
    const data = await fetchJSON(url, headers, 12000);
    if (!data) continue;
    const lista = data.offers || data.results || data.jobs || data.data || (Array.isArray(data) ? data : null);
    if (!lista?.length) continue;
    const rows = lista.map(j => buildRow(
      `computrabajo_${tld}`, paisCode,
      j.id || j.ofertaId || String(j.title || '').slice(0, 60),
      j.title || j.cargo || j.nombre || '',
      j.company || j.empresa || null,
      j.city || j.ciudad || null,
      null,
      j.url || j.link || `${base}/trabajo`,
      j.description || j.descripcion || null,
    )).filter(r => r.cargo.length >= 4);
    if (rows.length > 0) {
      const n = await upsert(rows, `computrabajo_${tld}`);
      console.log(`  ✓ ${n} ofertas (API interna)`);
      return n;
    }
  }

  console.log(`  ℹ 0 ofertas`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// BUMERAN — job board LatAm (AR, UY, CL, PE, EC, BO, VE, MX, PY)
// ─────────────────────────────────────────────────────────────
async function scrapeBumeran(paisCode, tld) {
  console.log(`🔍 Bumeran ${paisCode}...`);
  const base = `https://www.bumeran.com.${tld}`;

  // Bumeran tiene RSS en algunos subdominios
  const rssUrls = [
    `${base}/rss/empleos`,
    `${base}/feed/jobs`,
    `${base}/empleos.rss`,
  ];
  for (const rssUrl of rssUrls) {
    const xml = await fetchXML(rssUrl);
    if (!xml || !xml.includes('<item>')) continue;
    const items = extraerItems(xml);
    if (!items.length) continue;
    const rows = items.slice(0, 40).map(item => {
      const titulo = extraerTag(item, 'title');
      const link   = extraerTag(item, 'link');
      const desc   = extraerTag(item, 'description');
      const guid   = extraerTag(item, 'guid') || link;
      if (!titulo || titulo.length < 4) return null;
      return buildRow(
        `bumeran_${tld}`, paisCode,
        guid.replace(/\W/g, '').slice(-60),
        titulo, null, null, null, link, desc,
      );
    }).filter(Boolean).filter(r => r.cargo.length >= 4);
    if (rows.length > 0) {
      const n = await upsert(rows, `bumeran_${tld}`);
      console.log(`  ✓ ${n} ofertas (RSS)`);
      return n;
    }
  }

  // API interna como fallback
  const intentos = [
    { url: `https://api.bumeran.com.${tld}/aviso/list?page=1&size=50&sort_by=date` },
    { url: `${base}/api/v2/aviso/list?page=1&rows=50` },
  ];
  for (const { url } of intentos) {
    const data = await fetchJSON(url, {}, 12000);
    if (!data) continue;
    const lista = data.avisos || data.results || data.jobs || (Array.isArray(data) ? data : null);
    if (!lista?.length) continue;
    const rows = lista.map(j => buildRow(
      `bumeran_${tld}`, paisCode,
      j.id || j.avisoId || '',
      j.titulo || j.title || j.cargo || '',
      j.empresa?.nombre || j.company || null,
      j.ciudad?.nombre || j.location || null,
      null,
      j.url || `${base}/empleos-publicacion-${j.id}.html`,
      j.descripcion || j.description || null,
    )).filter(r => r.cargo.length >= 4);
    if (rows.length > 0) {
      const n = await upsert(rows, `bumeran_${tld}`);
      console.log(`  ✓ ${n} ofertas (API)`);
      return n;
    }
  }

  console.log(`  ℹ 0 ofertas`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// REED.CO.UK — RSS público, empleos UK
// ─────────────────────────────────────────────────────────────
async function scrapeReedUK() {
  console.log('🇬🇧 Reed.co.uk (UK)...');
  const rssUrls = [
    'https://www.reed.co.uk/jobs/rss?searchterm=',
    'https://www.reed.co.uk/jobs/rss?location=london&searchterm=',
    'https://www.reed.co.uk/jobs/rss?location=united+kingdom&searchterm=',
  ];
  for (const rssUrl of rssUrls) {
    const xml = await fetchXML(rssUrl);
    if (!xml || !xml.includes('<item>')) continue;
    const items = extraerItems(xml);
    if (!items.length) continue;
    const rows = items.slice(0, 50).map(item => {
      const titulo = extraerTag(item, 'title');
      const link   = extraerTag(item, 'link');
      const desc   = extraerTag(item, 'description');
      const guid   = extraerTag(item, 'guid') || link;
      if (!titulo || titulo.length < 4) return null;
      return buildRow('reed_uk', 'GB', guid.replace(/\W/g, '').slice(-60),
        titulo, null, 'United Kingdom', null, link, desc);
    }).filter(Boolean).filter(r => r.cargo.length >= 4);
    if (rows.length > 0) {
      const n = await upsert(rows, 'reed_uk');
      console.log(`  ✓ ${n} ofertas`);
      return n;
    }
  }
  console.log('  ℹ 0 ofertas');
  return 0;
}

// ─────────────────────────────────────────────────────────────
// SEEK.COM.AU — RSS público, empleos Australia
// ─────────────────────────────────────────────────────────────
async function scrapeSeekAU() {
  console.log('🇦🇺 SEEK.com.au (Australia)...');
  const rssUrls = [
    'https://www.seek.com.au/api/jobsearch/v5/jobs?page=1&pagesize=50&format=json',
  ];
  for (const url of rssUrls) {
    const data = await fetchJSON(url);
    if (!data?.data?.length) continue;
    const rows = data.data.map(j => buildRow(
      'seek_au', 'AU',
      j.id, j.title, j.advertiser?.description || null,
      j.location, null, `https://www.seek.com.au/job/${j.id}`, j.teaser,
    )).filter(r => r.cargo.length >= 4);
    const n = await upsert(rows, 'seek_au');
    console.log(`  ✓ ${n} ofertas`);
    return n;
  }
  // Fallback: scrape RSS si existe
  const xml = await fetchXML('https://www.seek.com.au/jobs?format=rss');
  if (xml && xml.includes('<item>')) {
    const items = extraerItems(xml).slice(0, 50);
    const rows = items.map(item => buildRow(
      'seek_au', 'AU',
      extraerTag(item, 'guid').replace(/\W/g, '').slice(-60),
      extraerTag(item, 'title'), null, 'Australia', null,
      extraerTag(item, 'link'), extraerTag(item, 'description'),
    )).filter(r => r.cargo.length >= 4);
    if (rows.length) {
      const n = await upsert(rows, 'seek_au');
      console.log(`  ✓ ${n} ofertas (RSS)`);
      return n;
    }
  }
  console.log('  ℹ 0 ofertas');
  return 0;
}

// ─────────────────────────────────────────────────────────────
// JOBS4EU — job board Europa, sin clave
// ─────────────────────────────────────────────────────────────
async function scrapeEuroJobs(paisCode, countrySlug) {
  console.log(`🇪🇺 EuroJobs ${paisCode}...`);
  const xml = await fetchXML(`https://www.eurojobs.com/${countrySlug}/jobs/rss`);
  if (!xml || !xml.includes('<item>')) { console.log('  ℹ 0 ofertas'); return 0; }
  const items = extraerItems(xml).slice(0, 40);
  const rows = items.map(item => buildRow(
    `eurojobs_${countrySlug}`, paisCode,
    extraerTag(item, 'guid').replace(/\W/g, '').slice(-60),
    extraerTag(item, 'title'), null, extraerTag(item, 'category') || null,
    null, extraerTag(item, 'link'), extraerTag(item, 'description'),
  )).filter(r => r.cargo.length >= 4);
  if (!rows.length) { console.log('  ℹ 0 ofertas'); return 0; }
  const n = await upsert(rows, `eurojobs_${countrySlug}`);
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─────────────────────────────────────────────────────────────
// INFOJOBS — España (RSS público)
// ─────────────────────────────────────────────────────────────
async function scrapeInfoJobs() {
  console.log('🇪🇸 InfoJobs (España)...');
  const rssUrls = [
    'https://www.infojobs.net/ofertasempleo/ofertas-trabajo.xml',
    'https://www.infojobs.net/rss/feedoferta.xhtml',
  ];
  for (const rssUrl of rssUrls) {
    const xml = await fetchXML(rssUrl);
    if (!xml || !xml.includes('<item>')) continue;
    const items = extraerItems(xml).slice(0, 50);
    const rows = items.map(item => buildRow(
      'infojobs_es', 'ES',
      extraerTag(item, 'guid').replace(/\W/g, '').slice(-60),
      extraerTag(item, 'title'), null, extraerTag(item, 'category') || 'España',
      null, extraerTag(item, 'link'), extraerTag(item, 'description'),
    )).filter(r => r.cargo.length >= 4);
    if (rows.length) {
      const n = await upsert(rows, 'infojobs_es');
      console.log(`  ✓ ${n} ofertas`);
      return n;
    }
  }
  console.log('  ℹ 0 ofertas');
  return 0;
}

// ─────────────────────────────────────────────────────────────
// MAIN — todos los países y fuentes
// ─────────────────────────────────────────────────────────────
const SCRAPERS = {
  // ── Fuentes globales (corren siempre) ────────────────────────────
  GLOBAL: [
    () => scrapeRemotive(),     // remote tech, clasifica por país automáticamente
    () => scrapeRemoteOk(),     // remote jobs, ~80 empleos en UY
    () => scrapeArbeitnow(),    // Europa/global, ~150 empleos clasificados
  ],

  // ── Sudamérica ───────────────────────────────────────────────────
  UY: [
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
    () => scrapeBumeran('CL', 'cl'),
    () => scrapeAdzuna('CL', 'cl'),
    () => scrapeJooble('CL', 'cl', ''),
  ],
  CO: [
    () => scrapeComputrabajo('CO', 'co'),
    () => scrapeBumeran('CO', 'co'),
    () => scrapeAdzuna('CO', 'co'),
    () => scrapeJooble('CO', 'co', ''),
  ],
  BR: [
    () => scrapeAdzuna('BR', 'br'),
    () => scrapeJooble('BR', 'br', ''),
  ],
  PE: [
    () => scrapeComputrabajo('PE', 'pe'),
    () => scrapeBumeran('PE', 'pe'),
    () => scrapeAdzuna('PE', 'pe'),
    () => scrapeJooble('PE', 'pe', ''),
  ],
  MX: [
    () => scrapeComputrabajo('MX', 'mx'),
    () => scrapeBumeran('MX', 'mx'),
    () => scrapeAdzuna('MX', 'mx'),
    () => scrapeJooble('MX', 'mx', ''),
  ],
  EC: [
    () => scrapeComputrabajo('EC', 'ec'),
    () => scrapeBumeran('EC', 'ec'),
    () => scrapeJooble('EC', 'ec', ''),
  ],
  BO: [
    () => scrapeComputrabajo('BO', 'bo'),
    () => scrapeBumeran('BO', 'bo'),
  ],
  PY: [
    () => scrapeComputrabajo('PY', 'py'),
    () => scrapeBumeran('PY', 'py'),
  ],
  VE: [
    () => scrapeComputrabajo('VE', 've'),
    () => scrapeBumeran('VE', 've'),
  ],

  // ── Centroamérica y Caribe ───────────────────────────────────────
  CR: [
    () => scrapeComputrabajo('CR', 'cr'),
    () => scrapeJooble('CR', 'cr', ''),
  ],
  GT: [
    () => scrapeComputrabajo('GT', 'gt'),
    () => scrapeJooble('GT', 'gt', ''),
  ],
  SV: [
    () => scrapeComputrabajo('SV', 'sv'),
    () => scrapeJooble('SV', 'sv', ''),
  ],
  HN: [
    () => scrapeComputrabajo('HN', 'hn'),
  ],
  NI: [
    () => scrapeComputrabajo('NI', 'ni'),
  ],
  PA: [
    () => scrapeComputrabajo('PA', 'pa'),
    () => scrapeJooble('PA', 'pa', ''),
  ],
  DO: [
    () => scrapeComputrabajo('DO', 'do'),
  ],
  CU: [], // Cuba: sin job boards accesibles internacionalmente

  // ── Europa ───────────────────────────────────────────────────────
  ES: [
    () => scrapeInfoJobs(),
    () => scrapeAdzuna('ES', 'es'),
    () => scrapeJooble('ES', 'es', ''),
  ],
  GB: [
    () => scrapeReedUK(),
    () => scrapeAdzuna('GB', 'gb'),
    () => scrapeJooble('GB', 'gb', ''),
  ],
  DE: [
    () => scrapeAdzuna('DE', 'de'),
    () => scrapeJooble('DE', 'de', ''),
  ],
  FR: [
    () => scrapeAdzuna('FR', 'fr'),
    () => scrapeJooble('FR', 'fr', ''),
  ],
  IT: [
    () => scrapeAdzuna('IT', 'it'),
    () => scrapeJooble('IT', 'it', ''),
  ],
  PT: [
    () => scrapeJooble('PT', 'pt', ''),
  ],

  // ── Anglosajones ─────────────────────────────────────────────────
  US: [
    () => scrapeAdzuna('US', 'us'),
    () => scrapeJooble('US', 'us', ''),
  ],
  CA: [
    () => scrapeAdzuna('CA', 'ca'),
    () => scrapeJooble('CA', 'ca', ''),
  ],
  AU: [
    () => scrapeSeekAU(),
    () => scrapeAdzuna('AU', 'au'),
    () => scrapeJooble('AU', 'au', ''),
  ],
};

// ── Correr ────────────────────────────────────────────────────────
console.log(`\n💼 Scraper Ofertas Privadas${TEST_MODE ? ' [TEST]' : ''} — ${new Date().toISOString()}\n`);

let total = 0;

// Fuentes globales (siempre corren)
if (!PAIS_ARG) {
  for (const fn of SCRAPERS.GLOBAL) {
    try { total += (await fn()) || 0; }
    catch (e) { console.error(`  ❌ global falló:`, e.message); }
    await new Promise(r => setTimeout(r, 800));
  }
}

// Fuentes por país
const paisesACorrer = PAIS_ARG
  ? [PAIS_ARG]
  : Object.keys(SCRAPERS).filter(p => p !== 'GLOBAL');

for (const pais of paisesACorrer) {
  const fns = SCRAPERS[pais];
  if (!fns?.length) continue;
  for (const fn of fns) {
    try { total += (await fn()) || 0; }
    catch (e) { console.error(`  ❌ ${pais} falló:`, e.message); }
    await new Promise(r => setTimeout(r, 800));
  }
}

console.log(`\n✅ Total: ${total} ofertas ${TEST_MODE ? 'encontradas (no guardadas)' : 'guardadas en Supabase'}\n`);

// Disparar re-matching
if (!TEST_MODE && total > 0) {
  console.log('🔄 Disparando matching...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/match-concursos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ todos: true }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`  ✓ Matching: ${data.workers ?? '?'} workers, ${data.matches_procesados ?? '?'} matches\n`);
  } catch (e) {
    console.log(`  ⚠ Matching no ejecutado: ${e.message}\n`);
  }
}
