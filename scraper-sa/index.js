/**
 * Scraper Nexu — todos los países (28)
 * Corre en GitHub Actions 1x/día.
 * Fuentes: RSS oficiales, APIs públicas (Bundesagentur, InPA), Indeed RSS, HTML scraping.
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import https from 'https';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);
const TEST_MODE  = process.argv.includes('--test');
const SOLO_PAIS  = process.env.PAIS?.toUpperCase() || null;

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (compatible; Nexu/1.0; concursos@nexu.uy)',
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es,en;q=0.5',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function fetchUrl(url, { timeout = 14000, headers = {}, insecure = false } = {}) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      agent: insecure ? insecureAgent : undefined,
    });
    if (!res.ok) { console.log(`    ⚠ HTTP ${res.status} → ${url}`); return null; }
    return await res.text();
  } catch (e) { console.log(`    ⚠ fetch error → ${url}: ${e.message}`); return null; }
}

async function fetchJSON(url, { timeout = 14000, headers = {} } = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': HEADERS['User-Agent'], ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) { console.log(`    ⚠ HTTP ${res.status} → ${url}`); return null; }
    return await res.json();
  } catch (e) { console.log(`    ⚠ fetch error → ${url}: ${e.message}`); return null; }
}

function normalizar(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extraerKeywords(texto = '') {
  const stop = new Set(['de','del','la','el','las','los','en','un','una','y','o','a',
    'con','por','para','al','se','no','es','que','sus','esta','este','lo','como',
    'mas','su','ser','tiene','han','sido','son','fue','hay','pero','the','and','for',
    'with','from','this','that','are','have','will','job','jobs']);
  return [...new Set(
    normalizar(texto).split(/\s+/).filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 15);
}

function parseFecha(str = '') {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // RFC date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return null;
}

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

// Parsea RSS/Atom con Cheerio en modo XML
function parseRSS(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item').each((_, el) => {
    items.push({
      title:   stripHtml($('title', el).first().text()),
      link:    $('link', el).first().text() || $('guid', el).first().text(),
      guid:    $('guid', el).first().text(),
      desc:    stripHtml($('description', el).first().text()),
      pubDate: $('pubDate', el).first().text(),
    });
  });
  return items;
}

function makeRow(fields) {
  return {
    fuente_id: null, fuente: null, pais: null,
    numero_llamado: null, titulo: null, cargo: null, organismo: null,
    descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
    lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
    url_detalle: null, url_postulacion: null,
    keywords: [], activo: true,
    ...fields,
  };
}

async function upsert(rows, fuente) {
  if (!rows.length) return 0;
  // Deduplicar por fuente_id dentro del batch (previene ON CONFLICT errors)
  const seen = new Set();
  const unique = rows.filter(r => {
    if (!r.fuente_id || seen.has(r.fuente_id)) return false;
    seen.add(r.fuente_id); return true;
  });
  if (TEST_MODE) {
    console.log(`  [TEST] ${unique.length} rows en ${fuente}`);
    unique.slice(0, 2).forEach(r => console.log(`    • ${r.cargo} | ${r.pais} | ${r.lugar || '—'}`));
    return unique.length;
  }
  const { error } = await supabase
    .from('concursos')
    .upsert(unique, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false });
  if (error) { console.error(`  ❌ upsert ${fuente}:`, error.message); return 0; }
  // Marcar vencidos
  const hoy = new Date().toISOString().slice(0, 10);
  await supabase.from('concursos').update({ activo: false })
    .eq('fuente', fuente).lt('fecha_cierre', hoy).not('fecha_cierre', 'is', null);
  return rows.length;
}

// Helper para RSS genérico → filas
function rssToRows(items, pais, fuente, opts = {}) {
  const rows = [];
  for (const item of items.slice(0, 50)) {
    const titulo = item.title;
    if (!titulo || titulo.length < 5) continue;
    const href = item.link || item.guid || null;
    const id   = (item.guid || href || titulo).replace(/[^a-zA-Z0-9]/g, '').slice(-48);
    if (rows.some(r => r.fuente_id === id)) continue;
    rows.push(makeRow({
      fuente_id: id, fuente, pais,
      titulo, cargo: titulo, organismo: opts.organismo || null,
      descripcion: item.desc?.slice(0, 600) || null,
      fecha_cierre: parseFecha(item.pubDate),
      lugar: opts.lugar || null,
      url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo + ' ' + (item.desc || '')),
    }));
  }
  return rows;
}

// Helper genérico para RSS → rows
async function fetchRSS(url, pais, fuente, opts = {}) {
  const xml = await fetchUrl(url, { timeout: opts.timeout || 12000 });
  if (!xml || !xml.includes('<item>')) return [];
  return rssToRows(parseRSS(xml), pais, fuente, opts);
}

// ─── ADZUNA API ───────────────────────────────────────────────────────────────
// Cobertura: gb,us,au,ca,de,fr,it,nl,br,mx,ar,cl,co,pl,at,be,nz,sg,za,in
// Registro gratis en: https://developer.adzuna.com
// GitHub Secrets: ADZUNA_APP_ID + ADZUNA_APP_KEY
const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;

async function adzunaSearch(cc, pais, fuente, query = 'government public sector') {
  if (!ADZUNA_ID || !ADZUNA_KEY) return [];
  const q   = encodeURIComponent(query);
  const url = `https://api.adzuna.com/v1/api/jobs/${cc}/search/1?app_id=${ADZUNA_ID}&app_key=${ADZUNA_KEY}&results_per_page=50&what=${q}&sort_by=date&content-type=application/json`;
  const data = await fetchJSON(url, { timeout: 14000 });
  if (!data?.results?.length) return [];
  const rows = [];
  for (const j of data.results.slice(0, 50)) {
    const titulo  = j.title || '';
    const empresa = j.company?.display_name || '';
    const lugar   = j.location?.display_name || pais;
    const id      = String(j.id || '').replace(/\W/g,'').slice(0,48) || titulo.replace(/\W/g,'').slice(0,48);
    const fecha   = j.created ? j.created.slice(0, 10) : null;
    if (!titulo || titulo.length < 4 || rows.some(r => r.fuente_id === id)) continue;
    rows.push(makeRow({
      fuente_id: id, fuente, pais,
      titulo: empresa ? `${titulo} — ${empresa}` : titulo,
      cargo: titulo, organismo: empresa || null,
      lugar, fecha_cierre: fecha,
      url_detalle: j.redirect_url || null,
      url_postulacion: j.redirect_url || null,
      descripcion: j.description?.slice(0, 600) || null,
      keywords: extraerKeywords(titulo + ' ' + (j.description || '')),
    }));
  }
  return rows;
}

// ─── JOOBLE API ───────────────────────────────────────────────────────────────
// Cobertura: ~70 países incluyendo toda LatAm
// Registro gratis en: https://jooble.org/api/about
// GitHub Secret: JOOBLE_API_KEY
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;

async function joobleSearch(keywords, location, pais, fuente) {
  if (!JOOBLE_KEY) return [];
  const body = JSON.stringify({ keywords, location, resultsOnPage: 50 });
  try {
    const res = await fetch(`https://jooble.org/api/${JOOBLE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': HEADERS['User-Agent'] },
      body,
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) { console.log(`    ⚠ Jooble HTTP ${res.status}`); return []; }
    const json = await res.json();
    const jobs = json.jobs ?? [];
    const rows = [];
    for (const j of jobs.slice(0, 50)) {
      const titulo  = j.title || '';
      const empresa = j.company || '';
      const id      = String(j.id || '').replace(/\W/g,'').slice(0,48) || (titulo + empresa).replace(/\W/g,'').slice(0,48);
      if (!titulo || titulo.length < 4 || rows.some(r => r.fuente_id === id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente, pais,
        titulo: empresa ? `${titulo} — ${empresa}` : titulo,
        cargo: titulo, organismo: empresa || null,
        lugar: j.location || location,
        fecha_cierre: j.updated ? j.updated.slice(0, 10) : null,
        url_detalle: j.link || null,
        url_postulacion: j.link || null,
        descripcion: j.snippet?.replace(/<[^>]+>/g,'').slice(0, 600) || null,
        keywords: extraerKeywords(titulo + ' ' + (j.snippet || '')),
      }));
    }
    return rows;
  } catch (e) { console.log(`    ⚠ Jooble error: ${e.message}`); return []; }
}

// ─── URUGUAY ─────────────────────────────────────────────────────────────────
async function scrapeUruguay() {
  console.log('🇺🇾 Uruguay...');
  const xml = await fetchUrl(
    'https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.arssllamados?,ABIERTO'
  );
  if (!xml || !xml.includes('<item>')) { console.log('  ⚠ sin items'); return 0; }

  const $ = cheerio.load(xml, { xmlMode: true });
  const rows = [];

  $('item').each((_, el) => {
    const titleRaw  = $('title', el).text();
    const link      = $('link', el).text();
    const descHtml  = $('description', el).text();
    const idMatch   = link.match(/\?(\d+)$/);
    if (!idMatch) return;
    const fuente_id = idMatch[1];

    const titleClean = titleRaw.replace(/^Llamado\s+N[ºo°]\s*/i, '').trim();
    const parts      = titleClean.split(' - ');
    const cargo      = parts[1]?.trim() || titleClean;
    const organismo  = parts.slice(2).join(' - ').trim() || null;
    const descText   = stripHtml(descHtml);
    const periodoM   = descText.match(/(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/);

    rows.push(makeRow({
      fuente_id, fuente: 'uruguay_concursa', pais: 'UY',
      titulo: titleClean, cargo, organismo,
      fecha_inicio:  periodoM ? parseFecha(periodoM[1]) : null,
      fecha_cierre:  periodoM ? parseFecha(periodoM[2]) : null,
      url_detalle:   `https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.verllamado?${fuente_id}`,
      url_postulacion: `https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.verllamado?${fuente_id}`,
      keywords: extraerKeywords(cargo),
    }));
  });

  const n = await upsert(rows, 'uruguay_concursa');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── ARGENTINA ───────────────────────────────────────────────────────────────
async function scrapeArgentina() {
  console.log('🇦🇷 Argentina...');
  // Boletín Oficial — sección 2 = Personal del Estado
  const boeXml = await fetchUrl('https://www.boletinoficial.gob.ar/rss/seccion/2', { timeout: 12000 });
  if (boeXml && boeXml.includes('<item>')) {
    const items = parseRSS(boeXml);
    console.log(`    ℹ BOE items: ${items.length}`);
    const rows = rssToRows(items, 'AR', 'argentina_boletin_oficial');
    if (rows.length > 0) {
      const n = await upsert(rows, 'argentina_boletin_oficial');
      console.log(`  ✓ ${n} llamados (Boletín Oficial)`);
      return n;
    }
  }
  // INGRESAR / portales de empleo público
  const html = await fetchUrl('https://ingresopublico.gob.ar/', { timeout: 12000 })
    || await fetchUrl('https://www.argentina.gob.ar/servir/concursos', { timeout: 12000 })
    || await fetchUrl('https://www.argentina.gob.ar/trabajo/ingresopublico', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    const sel = 'h3 a, h4 a, .card-title a, article a, li a[href*="concurso"], td a';
    $(sel).each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 6) return;
      const link = href.startsWith('http') ? href : `https://www.argentina.gob.ar${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'argentina_concursos', pais: 'AR',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'argentina_concursos'); console.log(`  ✓ ${n}`); return n; }
  }
  // APIs externas
  const az = await adzunaSearch('ar', 'AR', 'argentina_adzuna', 'gobierno empleo público concurso');
  if (az.length > 0) { const n = await upsert(az,'argentina_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('empleo público concurso gobierno', 'Argentina', 'AR', 'argentina_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'argentina_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── BRASIL ──────────────────────────────────────────────────────────────────
async function scrapeBrasil() {
  console.log('🇧🇷 Brasil...');
  const html = await fetchUrl('https://www.pciconcursos.com.br/concursos/', { timeout: 15000 });
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);
  const rows = [];
  let estadoActual = 'Nacional';

  $('h2').each((_, h2) => {
    estadoActual = $(h2).text().trim() || estadoActual;
    let sibling = $(h2).next();
    while (sibling.length && !sibling.is('h2')) {
      if (sibling.hasClass('cd') || sibling.find('.cd').length) {
        const cdText  = sibling.hasClass('cd') ? sibling.text() : sibling.find('.cd').text();
        const ceText  = sibling.hasClass('ce') ? sibling.find('span').first().text() : sibling.next('.ce, div:has(.ce)').find('span').first().text();
        const lines   = cdText.replace(/\s+/g,' ').trim().split(/\n|\s{2,}/).map(l=>l.trim()).filter(Boolean);
        const cargoLine = lines.find(l=>!/vaga|ensino|superior|medio|tecnico|fundamental/i.test(l) && l.length>3) || lines[0] || 'Concurso';
        const vagasM  = cdText.match(/(\d+)\s+vaga/i);
        const titulo  = `${cargoLine} — ${estadoActual}`;
        const id      = `${estadoActual}_${cargoLine}_${ceText}`.replace(/\W/g,'_').slice(0,60);
        if (!rows.some(r=>r.fuente_id===id)) {
          rows.push(makeRow({
            fuente_id: id, fuente: 'brasil_pciconcursos', pais: 'BR',
            titulo, cargo: cargoLine, lugar: estadoActual,
            fecha_cierre: parseFecha(ceText),
            puestos: vagasM ? parseInt(vagasM[1]) : 1,
            url_detalle: 'https://www.pciconcursos.com.br/concursos/',
            url_postulacion: 'https://www.pciconcursos.com.br/concursos/',
            keywords: extraerKeywords(cargoLine),
          }));
        }
      }
      sibling = sibling.next();
    }
  });

  // Fallback si no encontró nada con .cd
  if (rows.length === 0) {
    $('a[href*="/concurso/"]').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 4) return;
      const link = href.startsWith('http') ? href : `https://www.pciconcursos.com.br${href}`;
      const id   = href.replace(/\W/g,'_').slice(-48);
      if (!rows.some(r=>r.fuente_id===id)) {
        rows.push(makeRow({
          fuente_id: id, fuente: 'brasil_pciconcursos', pais: 'BR',
          titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
          keywords: extraerKeywords(titulo),
        }));
      }
    });
  }

  const n = await upsert(rows, 'brasil_pciconcursos');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── CHILE ───────────────────────────────────────────────────────────────────
async function scrapeChile() {
  console.log('🇨🇱 Chile...');
  const html = await fetchUrl('https://www.empleospublicos.cl/busqueda/listaAnuncios.aspx', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    // Intentar múltiples selectores posibles
    $('tr, .anuncio-item, .item-empleo, .resultado, article').each((_, el) => {
      const a       = $(el).find('a').first();
      const href    = a.attr('href') || '';
      const cargo   = a.text().trim() || $(el).find('td').first().text().trim();
      const fechaStr= $(el).text().match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
      if (!cargo || cargo.length < 5 || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3}/.test(cargo)) return;
      const link = href.startsWith('http') ? href : href ? `https://www.empleospublicos.cl${href}` : 'https://www.empleospublicos.cl';
      const id   = href.split(/[=?]/).pop()?.replace(/\W/g,'').slice(0,40) || cargo.replace(/\W/g,'').slice(0,40);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'chile_empleospublicos', pais: 'CL',
        titulo: cargo, cargo, fecha_cierre: parseFecha(fechaStr),
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(cargo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'chile_empleospublicos'); console.log(`  ✓ ${n}`); return n; }
  }
  const az = await adzunaSearch('cl', 'CL', 'chile_adzuna', 'empleo público gobierno concurso');
  if (az.length > 0) { const n = await upsert(az,'chile_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('empleo público concurso gobierno', 'Chile', 'CL', 'chile_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'chile_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── COLOMBIA ────────────────────────────────────────────────────────────────
async function scrapeColombia() {
  console.log('🇨🇴 Colombia...');
  const html = await fetchUrl('https://www.cnsc.gov.co/index.php/convocatorias', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="convocatori"]').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 8 || rows.some(r => r.url_detalle === href)) return;
      const link = href.startsWith('http') ? href : `https://www.cnsc.gov.co${href}`;
      rows.push(makeRow({
        fuente_id: encodeURIComponent(href).slice(-50),
        fuente: 'colombia_cnsc', pais: 'CO',
        titulo, cargo: titulo, organismo: 'CNSC',
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
      if (rows.length >= 40) return false;
    });
    if (rows.length > 0) { const n = await upsert(rows,'colombia_cnsc'); console.log(`  ✓ ${n}`); return n; }
  }
  const az = await adzunaSearch('co', 'CO', 'colombia_adzuna', 'empleo público convocatoria gobierno');
  if (az.length > 0) { const n = await upsert(az,'colombia_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('empleo público convocatoria gobierno', 'Colombia', 'CO', 'colombia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'colombia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── PERÚ ────────────────────────────────────────────────────────────────────
async function scrapePerú() {
  console.log('🇵🇪 Perú...');
  const html = await fetchUrl('https://www.servir.gob.pe/convocatorias/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('article, .convocatoria, tr').each((_, el) => {
      const titulo  = $(el).find('h2,h3,.title,td').first().text().trim();
      const href    = $(el).find('a').first().attr('href') || '';
      const fechaStr= $(el).text().match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
      if (!titulo || titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.servir.gob.pe${href}`;
      rows.push(makeRow({
        fuente_id: encodeURIComponent(href).slice(-50) || titulo.replace(/\s/g,'_').slice(0,48),
        fuente: 'peru_servir', pais: 'PE',
        titulo, cargo: titulo, fecha_cierre: parseFecha(fechaStr),
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'peru_servir'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo público CAS convocatoria SERVIR', 'Peru', 'PE', 'peru_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'peru_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── PARAGUAY ────────────────────────────────────────────────────────────────
async function scrapeParaguay() {
  console.log('🇵🇾 Paraguay...');
  // sfp.gov.py tiene cert SSL inválido → insecure:true
  const html = await fetchUrl('https://www.sfp.gov.py/es/institucional/concursos', { timeout: 12000, insecure: true });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="concurso"], a[href*="llamado"], h3 a, h2 a, td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.sfp.gov.py${href}`;
      const id   = encodeURIComponent(href).slice(-50) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'paraguay_sfp', pais: 'PY',
        titulo, cargo: titulo, organismo: 'SFP',
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'paraguay_sfp'); console.log(`  ✓ ${n}`); return n; }
  }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── BOLIVIA ─────────────────────────────────────────────────────────────────
async function scrapeBolivia() {
  console.log('🇧🇴 Bolivia...');
  // MTEPS — Ministerio de Trabajo Bolivia (cert inválido → insecure)
  for (const url of [
    'https://mteps.gob.bo/convocatorias',
    'https://www.mintrabajo.gob.bo/index.php/convocatorias',
    'https://www.empleospublicos.bo/convocatorias',
  ]) {
    const html = await fetchUrl(url, { timeout: 10000, insecure: true });
    if (!html) continue;
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, .views-row a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const base = new URL(url).origin;
      const link = href.startsWith('http') ? href : `${base}${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'bolivia_mteps', pais: 'BO',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'bolivia_mteps'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo público convocatoria gobierno', 'Bolivia', 'BO', 'bolivia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'bolivia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ECUADOR ─────────────────────────────────────────────────────────────────
async function scrapeEcuador() {
  console.log('🇪🇨 Ecuador...');
  for (const url of [
    'https://www.trabajo.gob.ec/convocatorias-del-sector-publico/',
    'https://www.trabajo.gob.ec/convocatorias/',
    'https://www.trabajo.gob.ec/category/convocatorias/',
  ]) {
    const html = await fetchUrl(url, { timeout: 10000 });
    if (!html) continue;
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, .entry-title a, article a, td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.trabajo.gob.ec${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'ecuador_trabajo', pais: 'EC',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'ecuador_trabajo'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo público concurso gobierno sector', 'Ecuador', 'EC', 'ecuador_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'ecuador_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── MÉXICO ──────────────────────────────────────────────────────────────────
async function scrapeMexico() {
  console.log('🇲🇽 México...');
  // Trabajaen.gob.mx — convocatorias federales
  const html = await fetchUrl('https://www.trabajaen.gob.mx/portal/page/portal/Trabajaen/ConvocatoriasPublicadas', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="convocatori"], tr a, .resultado a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.trabajaen.gob.mx${href}`;
      const id   = encodeURIComponent(href).slice(-50) || titulo.replace(/\W/g,'').slice(0,50);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'mexico_trabajaen', pais: 'MX',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'mexico_trabajaen'); console.log(`  ✓ ${n}`); return n; }
  }
  const az = await adzunaSearch('mx', 'MX', 'mexico_adzuna', 'gobierno empleo convocatoria vacante');
  if (az.length > 0) { const n = await upsert(az,'mexico_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('empleo gobierno convocatoria vacante', 'Mexico', 'MX', 'mexico_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'mexico_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── VENEZUELA ───────────────────────────────────────────────────────────────
async function scrapeVenezuela() {
  console.log('🇻🇪 Venezuela...');
  // ONCAE y ministerios venezolanos tienen acceso muy limitado desde cloud IPs
  const html = await fetchUrl('https://www.oncae.gob.ve/convocatorias', { timeout: 8000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.oncae.gob.ve${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'venezuela_oncae', pais: 'VE',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'venezuela_oncae'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo vacante trabajo', 'Venezuela', 'VE', 'venezuela_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'venezuela_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── CUBA ────────────────────────────────────────────────────────────────────
async function scrapeCuba() {
  console.log('🇨🇺 Cuba...');
  const jb = await joobleSearch('empleo trabajo vacante', 'Cuba', 'CU', 'cuba_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'cuba_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── COSTA RICA ──────────────────────────────────────────────────────────────
async function scrapeCostaRica() {
  console.log('🇨🇷 Costa Rica...');
  // DGSC tiene cert SSL inválido → insecure
  const html = await fetchUrl('https://www.rgsc.go.cr/concursos', { timeout: 10000, insecure: true })
    || await fetchUrl('https://www.dgsc.go.cr/concursos', { timeout: 10000, insecure: true });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="concurso"], a[href*="puesto"], tr td a, h3 a, h4 a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const base = href.startsWith('http') ? '' : 'https://www.dgsc.go.cr';
      const link = base + href;
      const id   = encodeURIComponent(href).slice(-50) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'costarica_dgsc', pais: 'CR',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'costarica_dgsc'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno servicio civil', 'Costa Rica', 'CR', 'costarica_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'costarica_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── GUATEMALA ───────────────────────────────────────────────────────────────
async function scrapeGuatemala() {
  console.log('🇬🇹 Guatemala...');
  const html = await fetchUrl('https://www.onsec.gob.gt/convocatorias', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.onsec.gob.gt${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'guatemala_onsec', pais: 'GT',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'guatemala_onsec'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno trabajo convocatoria', 'Guatemala', 'GT', 'guatemala_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'guatemala_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── EL SALVADOR ─────────────────────────────────────────────────────────────
async function scrapeElSalvador() {
  console.log('🇸🇻 El Salvador...');
  const html = await fetchUrl('https://www.rrhh.gob.sv/concursos', { timeout: 10000})
    || await fetchUrl('https://www.sercop.gob.sv/concursos', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.rrhh.gob.sv${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'elsalvador_rrhh', pais: 'SV',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'elsalvador_rrhh'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno trabajo convocatoria', 'El Salvador', 'SV', 'elsalvador_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'elsalvador_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── HONDURAS ────────────────────────────────────────────────────────────────
async function scrapeHonduras() {
  console.log('🇭🇳 Honduras...');
  const html = await fetchUrl('https://www.sefin.gob.hn/concursos-publicos/', { timeout: 10000})
    || await fetchUrl('https://www.scgg.gob.hn/concursos', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.scgg.gob.hn${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'honduras_scgg', pais: 'HN',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'honduras_scgg'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno trabajo convocatoria', 'Honduras', 'HN', 'honduras_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'honduras_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── NICARAGUA ───────────────────────────────────────────────────────────────
async function scrapeNicaragua() {
  console.log('🇳🇮 Nicaragua...');
  const html = await fetchUrl('https://www.mhcp.gob.ni/concursos', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.mhcp.gob.ni${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'nicaragua_mhcp', pais: 'NI',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'nicaragua_mhcp'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno trabajo convocatoria', 'Nicaragua', 'NI', 'nicaragua_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'nicaragua_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── PANAMÁ ──────────────────────────────────────────────────────────────────
async function scrapePanama() {
  console.log('🇵🇦 Panamá...');
  const html = await fetchUrl('https://www.panama.gob.pa/convocatorias', { timeout: 10000 })
    || await fetchUrl('https://www.mop.gob.pa/empleos', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.mop.gob.pa${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'panama_gov', pais: 'PA',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'panama_gov'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno público convocatoria', 'Panama', 'PA', 'panama_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'panama_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── REPÚBLICA DOMINICANA ────────────────────────────────────────────────────
async function scrapeRepDominicana() {
  console.log('🇩🇴 Rep. Dominicana...');
  const html = await fetchUrl('https://www.map.gob.do/concursos-de-oposicion/', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, .entry-title a, td a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.map.gob.do${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'dominicana_map', pais: 'DO',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'dominicana_map'); console.log(`  ✓ ${n}`); return n; }
  }
  const jb = await joobleSearch('empleo gobierno trabajo convocatoria', 'Republica Dominicana', 'DO', 'dominicana_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'dominicana_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ESPAÑA ──────────────────────────────────────────────────────────────────
async function scrapeEspana() {
  console.log('🇪🇸 España...');
  // BOE — sección Personal del Estado (varios canales)
  for (const c of ['11', '13', '14']) {
    const rows = await fetchRSS(`https://www.boe.es/rss/canal.php?c=${c}`, 'ES', 'espana_boe');
    if (rows.length > 0) { const n = await upsert(rows,'espana_boe'); console.log(`  ✓ ${n} (BOE canal ${c})`); return n; }
  }
  // SEPE — convocatorias de empleo público
  const html = await fetchUrl('https://www.sepe.es/HomeSepe/que-es-el-sepe/comunicacion-institucional/convocatorias.html', { timeout: 10000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, .titulo a, li a, td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 6) return;
      const link = href.startsWith('http') ? href : `https://www.sepe.es${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'espana_sepe', pais: 'ES',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'espana_sepe'); console.log(`  ✓ ${n} (SEPE)`); return n; }
  }
  const az = await adzunaSearch('es', 'ES', 'espana_adzuna', 'oposición empleo público administración');
  if (az.length > 0) { const n = await upsert(az,'espana_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('oposición empleo público administración', 'España', 'ES', 'espana_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'espana_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── PORTUGAL ────────────────────────────────────────────────────────────────
async function scrapePortugal() {
  console.log('🇵🇹 Portugal...');
  // BEP — Bolsa de Emprego Público
  const html = await fetchUrl('https://www.bep.gov.pt/pt/home', { timeout: 12000 })
    || await fetchUrl('https://www.bep.gov.pt/Pesquisa/Pesquisa.aspx', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, td a, .titulo a, article a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.bep.gov.pt${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'portugal_bep', pais: 'PT',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'portugal_bep'); console.log(`  ✓ ${n} (BEP)`); return n; }
  }
  const az = await adzunaSearch('pt', 'PT', 'portugal_adzuna', 'emprego público concurso administração');
  if (az.length > 0) { const n = await upsert(az,'portugal_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('emprego público concurso administração', 'Portugal', 'PT', 'portugal_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'portugal_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ITALIA ──────────────────────────────────────────────────────────────────
async function scrapeItalia() {
  console.log('🇮🇹 Italia...');
  // tuttoconcorsi.it — agregador de concursos públicos italianos (RSS)
  const rows = await fetchRSS('https://www.tuttoconcorsi.it/feed/', 'IT', 'italia_tuttoconcorsi');
  if (rows.length > 0) { const n = await upsert(rows,'italia_tuttoconcorsi'); console.log(`  ✓ ${n} (tuttoconcorsi)`); return n; }
  // InPA — HTML scraping como fallback
  const html = await fetchUrl('https://www.inpa.gov.it/bandi-di-concorso/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const htmlRows = [];
    $('h3 a, h4 a, .bando-title a, article a, td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.inpa.gov.it${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!htmlRows.some(r => r.fuente_id === id)) htmlRows.push(makeRow({
        fuente_id: id, fuente: 'italia_inpa', pais: 'IT',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (htmlRows.length > 0) { const n = await upsert(htmlRows,'italia_inpa'); console.log(`  ✓ ${n} (InPA)`); return n; }
  }
  const az = await adzunaSearch('it', 'IT', 'italia_adzuna', 'concorso pubblico lavoro amministrazione');
  if (az.length > 0) { const n = await upsert(az,'italia_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('concorso pubblico lavoro amministrazione', 'Italia', 'IT', 'italia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'italia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── FRANCIA ─────────────────────────────────────────────────────────────────
async function scrapeFrancia() {
  console.log('🇫🇷 Francia...');
  // choisirleservicepublic.gouv.fr — nuevo dominio del portal de empleo público
  for (const url of [
    'https://www.choisirleservicepublic.gouv.fr/flux/rss/',
    'https://choisirleservicepublic.gouv.fr/flux/rss/',
    'https://place-emploi-public.gouv.fr/flux/rss/',
  ]) {
    const rows = await fetchRSS(url, 'FR', 'francia_place_emploi');
    if (rows.length > 0) { const n = await upsert(rows,'francia_place_emploi'); console.log(`  ✓ ${n} (Place Emploi Public)`); return n; }
  }
  const az = await adzunaSearch('fr', 'FR', 'francia_adzuna', 'concours fonction publique emploi');
  if (az.length > 0) { const n = await upsert(az,'francia_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('concours fonction publique emploi', 'France', 'FR', 'francia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'francia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ALEMANIA ────────────────────────────────────────────────────────────────
async function scrapeAlemania() {
  console.log('🇩🇪 Alemania...');
  // Bundesagentur für Arbeit — API pública gratuita
  const data = await fetchJSON(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?angebotsart=1&arbeitsort=Deutschland&page=0&size=50',
    { headers: { 'X-API-Key': 'jobboerse-jobsuche', 'Accept': 'application/json', 'Accept-Version': '3.9' }, timeout: 12000 }
  ) || await fetchJSON(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v3/jobs?angebotsart=1&page=0&size=50',
    { headers: { 'X-API-Key': 'jobboerse-jobsuche' }, timeout: 12000 }
  );
  if (data) {
    const jobs = data.stellenangebote ?? data.jobs ?? [];
    const rows = [];
    for (const job of jobs.slice(0, 50)) {
      const titel       = job.titel || job.beruf || '';
      const arbeitgeber = job.arbeitgeber || '';
      const refnr       = String(job.refnr || job.hashId || '');
      const ort         = job.arbeitsorte?.[0]?.ort || job.ort || null;
      const eintr       = job.eintrittsdatum || '';
      if (!titel || titel.length < 3) continue;
      const id = refnr.replace(/\W/g,'').slice(-48) || (titel + arbeitgeber).replace(/\W/g,'').slice(0,48);
      if (rows.some(r=>r.fuente_id===id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente: 'alemania_bundesagentur', pais: 'DE',
        numero_llamado: refnr || null,
        titulo: arbeitgeber ? `${titel} — ${arbeitgeber}` : titel,
        cargo: titel, organismo: arbeitgeber || null,
        lugar: ort, fecha_inicio: parseFecha(eintr),
        url_detalle: refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}` : null,
        url_postulacion: refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}` : null,
        keywords: extraerKeywords(titel + ' ' + arbeitgeber),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'alemania_bundesagentur'); console.log(`  ✓ ${n} (Bundesagentur)`); return n; }
  }
  // Interamt — portal oficial del servicio público alemán
  const html = await fetchUrl('https://www.interamt.de/koop/app/trefferliste?suche=1', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('h3 a, h4 a, .stellenangebot a, td a').each((_, el) => {
      const titel = $(el).text().trim();
      const href  = $(el).attr('href') || '';
      if (titel.length < 4) return;
      const link = href.startsWith('http') ? href : `https://www.interamt.de${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titel.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'alemania_interamt', pais: 'DE',
        titulo: titel, cargo: titel, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titel),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'alemania_interamt'); console.log(`  ✓ ${n} (Interamt)`); return n; }
  }
  const az = await adzunaSearch('de', 'DE', 'de_adzuna', 'öffentlicher Dienst Stellenangebot');
  if (az.length > 0) { const n = await upsert(az,'de_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('öffentlicher Dienst Stellenangebot', 'Deutschland', 'DE', 'de_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'de_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── REINO UNIDO ─────────────────────────────────────────────────────────────
async function scrapeReinoUnido() {
  console.log('🇬🇧 Reino Unido...');
  // Civil Service Jobs RSS — portal oficial
  for (const url of [
    'https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?pageaction=searchbykey&key=jobs_rss',
    'https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=&action=rss',
    'https://findajob.dwp.gov.uk/search?sb=date&sd=down&pp=25&format=rss',
  ]) {
    const rows = await fetchRSS(url, 'GB', 'uk_civilservice');
    if (rows.length > 0) { const n = await upsert(rows,'uk_civilservice'); console.log(`  ✓ ${n} (Civil Service)`); return n; }
  }
  const az = await adzunaSearch('gb', 'GB', 'gb_adzuna', 'public sector government jobs');
  if (az.length > 0) { const n = await upsert(az,'gb_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('public sector government', 'United Kingdom', 'GB', 'gb_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'gb_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ESTADOS UNIDOS ──────────────────────────────────────────────────────────
async function scrapeEstadosUnidos() {
  console.log('🇺🇸 Estados Unidos...');
  // USAJobs API — requiere solo User-Agent personalizado
  const data = await fetchJSON(
    'https://data.usajobs.gov/api/search?ResultsPerPage=50&WhoMayApply=All&SortField=DatePosted&SortDirection=Desc',
    { headers: { 'Host': 'data.usajobs.gov', 'User-Agent': 'nexu@nexu.uy', 'Authorization-Key': '' }, timeout: 12000 }
  );
  if (data) {
    const jobs = data?.SearchResult?.SearchResultItems ?? [];
    const rows = [];
    for (const item of jobs.slice(0, 50)) {
      const j      = item.MatchedObjectDescriptor ?? {};
      const titulo = j.PositionTitle || '';
      const org    = j.OrganizationName || '';
      const id     = String(j.PositionID || '').replace(/\W/g,'').slice(0,48) || titulo.replace(/\W/g,'').slice(0,48);
      const close  = j.ApplicationCloseDate || '';
      if (!titulo || titulo.length < 4 || rows.some(r=>r.fuente_id===id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente: 'usa_usajobs', pais: 'US',
        titulo: org ? `${titulo} — ${org}` : titulo,
        cargo: titulo, organismo: org || null,
        lugar: j.PositionLocationDisplay || 'United States',
        fecha_cierre: parseFecha(close),
        url_detalle: j.PositionURI || null,
        url_postulacion: j.ApplyURI?.[0] || j.PositionURI || null,
        keywords: extraerKeywords(titulo + ' ' + org),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'usa_usajobs'); console.log(`  ✓ ${n} (USAJobs)`); return n; }
  }
  // Fallback: USAJobs RSS
  const rssRows = await fetchRSS('https://www.usajobs.gov/Search/Results?format=rss', 'US', 'usa_usajobs_rss');
  if (rssRows.length > 0) { const n = await upsert(rssRows,'usa_usajobs_rss'); console.log(`  ✓ ${n} (USAJobs RSS)`); return n; }
  const az = await adzunaSearch('us', 'US', 'us_adzuna', 'government federal public sector jobs');
  if (az.length > 0) { const n = await upsert(az,'us_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('government federal jobs', 'United States', 'US', 'us_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'us_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── CANADÁ ──────────────────────────────────────────────────────────────────
async function scrapeCanada() {
  console.log('🇨🇦 Canadá...');
  // GC Jobs — portal de empleos federales canadienses
  for (const url of [
    'https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?jpsr=1&menu=1&poster=1&lang=en&isJobSearch=1&format=rss',
    'https://jobs.gc.ca/srs-sre/data/rss.xml?lang=eng',
    'https://www.canada.ca/en/public-service-commission.html',
  ]) {
    const rows = await fetchRSS(url, 'CA', 'canada_gc_jobs');
    if (rows.length > 0) { const n = await upsert(rows,'canada_gc_jobs'); console.log(`  ✓ ${n} (GC Jobs)`); return n; }
  }
  const az = await adzunaSearch('ca', 'CA', 'ca_adzuna', 'government public service federal jobs');
  if (az.length > 0) { const n = await upsert(az,'ca_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('government public service federal', 'Canada', 'CA', 'ca_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'ca_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── AUSTRALIA ───────────────────────────────────────────────────────────────
async function scrapeAustralia() {
  console.log('🇦🇺 Australia...');
  // APSJobs — API con parámetros actualizados
  for (const url of [
    'https://www.apsjobs.gov.au/s/global-search/services/search/global?keyword=&sort=Date&page=1&pageSize=50',
    'https://www.apsjobs.gov.au/s/global-search/services/search/global?keyword=&sort=Date&page=0',
  ]) {
    const data = await fetchJSON(url, { timeout: 12000 });
    if (data) {
      const jobs = data.results ?? data.jobs ?? data.vacancies ?? [];
      const rows = [];
      for (const job of jobs.slice(0, 50)) {
        const titulo = job.title || job.jobTitle || job.positionTitle || '';
        const agency = job.agency || job.organisation || job.department || '';
        const id     = String(job.id || job.vacancyId || job.refNumber || '').replace(/\W/g,'').slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
        const close  = job.closingDate || job.closing_date || job.CloseDate || '';
        if (!titulo || titulo.length < 4 || rows.some(r=>r.fuente_id===id)) continue;
        rows.push(makeRow({
          fuente_id: id, fuente: 'australia_apsjobs', pais: 'AU',
          titulo: agency ? `${titulo} — ${agency}` : titulo,
          cargo: titulo, organismo: agency || null,
          lugar: 'Australia', fecha_cierre: parseFecha(close),
          url_detalle: `https://www.apsjobs.gov.au/s/job-detail?Id=${job.id||''}`,
          url_postulacion: `https://www.apsjobs.gov.au/s/job-detail?Id=${job.id||''}`,
          keywords: extraerKeywords(titulo + ' ' + agency),
        }));
      }
      if (rows.length > 0) { const n = await upsert(rows,'australia_apsjobs'); console.log(`  ✓ ${n} (APSJobs)`); return n; }
    }
  }
  const az = await adzunaSearch('au', 'AU', 'au_adzuna', 'government public service APS jobs');
  if (az.length > 0) { const n = await upsert(az,'au_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('government public service APS', 'Australia', 'AU', 'au_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'au_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const SCRAPERS = {
  // Sudamérica
  UY: scrapeUruguay,   AR: scrapeArgentina, BR: scrapeBrasil,   CL: scrapeChile,
  CO: scrapeColombia,  PE: scrapePerú,      PY: scrapeParaguay, BO: scrapeBolivia,
  EC: scrapeEcuador,   MX: scrapeMexico,    VE: scrapeVenezuela,
  // Centroamérica y Caribe
  CU: scrapeCuba,      CR: scrapeCostaRica, GT: scrapeGuatemala, SV: scrapeElSalvador,
  HN: scrapeHonduras,  NI: scrapeNicaragua, PA: scrapePanama,    DO: scrapeRepDominicana,
  // Europa
  ES: scrapeEspana,    PT: scrapePortugal,  IT: scrapeItalia,    FR: scrapeFrancia,
  DE: scrapeAlemania,  GB: scrapeReinoUnido,
  // Anglosajones
  US: scrapeEstadosUnidos, CA: scrapeCanada, AU: scrapeAustralia,
};

const aCorrer = SOLO_PAIS && SCRAPERS[SOLO_PAIS]
  ? { [SOLO_PAIS]: SCRAPERS[SOLO_PAIS] }
  : SCRAPERS;

console.log(`\n🌎 Nexu Scraper${TEST_MODE ? ' [TEST]' : ''} — ${Object.keys(aCorrer).length} países — ${new Date().toISOString()}\n`);

let total = 0;
for (const [pais, fn] of Object.entries(aCorrer)) {
  try {
    total += await fn() || 0;
  } catch (e) {
    console.error(`  ❌ ${pais} falló:`, e.message);
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n✅ Total: ${total} llamados ${TEST_MODE ? 'encontrados (no guardados)' : 'guardados en Supabase'}\n`);
