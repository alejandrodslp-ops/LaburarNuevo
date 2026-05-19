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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Cargar .env.local si existe (para cron local en Mac)
try {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(path.join(dir, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

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

// Parsea RSS 2.0 y Atom con Cheerio en modo XML
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
  // Atom format (entry en vez de item)
  if (items.length === 0) {
    $('entry').each((_, el) => {
      const link = $('link', el).first().attr('href') || $('link', el).first().text() || $('id', el).first().text();
      items.push({
        title:   stripHtml($('title', el).first().text()),
        link,
        guid:    $('id', el).first().text() || link,
        desc:    stripHtml($('summary', el).first().text() || $('content', el).first().text()),
        pubDate: $('updated', el).first().text() || $('published', el).first().text(),
      });
    });
  }
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

const _fuentesLimpiadas = new Set();

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
  // Limpiar registros anteriores de esta fuente (solo la primera vez por ejecución)
  if (!_fuentesLimpiadas.has(fuente)) {
    _fuentesLimpiadas.add(fuente);
    await supabase.from('concursos').delete().eq('fuente', fuente);
  }
  const { error } = await supabase
    .from('concursos')
    .upsert(unique, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false });
  if (error) { console.error(`  ❌ upsert ${fuente}:`, error.message); return 0; }
  return unique.length;
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
  if (!xml || (!xml.includes('<item>') && !xml.includes('<entry>'))) return [];
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

// ─── GOOGLE NEWS RSS ─────────────────────────────────────────────────────────
// Funciona desde cualquier IP (Azure, Supabase, Mac). Sin auth. Sin costo.
// Devuelve noticias actuales de convocatorias/concursos para cada país.
async function googleNewsRSS(query, gl, hl, pais, fuente) {
  const q   = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
  const rows = await fetchRSS(url, pais, fuente);
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
  // Google Sheets público embebido en argentina.gob.ar/concursar
  // La página carga este JSON directo vía $.getJSON — no necesita JS
  const SHEET = 'https://sheets.googleapis.com/v4/spreadsheets/19tL43dt3hZjszOFFWuw-gdKdKscxhJ0THsUw4HCGgC8/values/Sheet1!A2%3AP?dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&key=AIzaSyBR7ArO3cRNRSibA8L3spSwT-imu6hz05M';
  const data = await fetchJSON(SHEET, { timeout: 15000 });
  if (data?.values?.length) {
    const rows = [];
    const seen = new Set();
    for (const r of data.values) {
      const jurisdiccion = r[0] || '';
      const organismo    = r[1] || '';
      const cantidad     = parseInt(r[2]) || 1;
      const tipo         = r[3] || '';
      const estado       = r[6] || '';
      const agrupamiento = r[8] || '';
      const zona         = r[11] || '';
      const denominacion = r[12] || '';
      const urlPath      = r[13] || '';
      if (!denominacion || denominacion.length < 3) continue;
      const esActivo = estado !== 'Finalizado';
      const fullUrl  = urlPath
        ? `https://www.argentina.gob.ar/${urlPath}`
        : 'https://www.argentina.gob.ar/jefatura/gestion-y-empleo-publico/concursar/funciones-ejecutivas';
      const id = (jurisdiccion + denominacion).replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(makeRow({
        fuente_id: id, fuente: 'argentina_concursar', pais: 'AR',
        titulo: denominacion, cargo: denominacion,
        organismo: organismo || null,
        lugar: zona || null,
        tipo_vinculo: tipo || null,
        puestos: cantidad,
        activo: esActivo,
        url_detalle: fullUrl, url_postulacion: fullUrl,
        keywords: extraerKeywords(denominacion + ' ' + organismo + ' ' + agrupamiento),
      }));
    }
    if (rows.length > 0) {
      // Upsert en batches de 500 para no superar límites de Supabase
      let total = 0;
      for (let i = 0; i < rows.length; i += 500) {
        total += await upsert(rows.slice(i, i + 500), 'argentina_concursar');
      }
      console.log(`  ✓ ${total} (Google Sheets CONCURSAR — ${rows.filter(r=>r.activo).length} activos)`);
      return total;
    }
  }
  // Boletín Oficial fallback
  const boeXml = await fetchUrl('https://www.boletinoficial.gob.ar/rss/seccion/2', { timeout: 12000 });
  if (boeXml && boeXml.includes('<item>')) {
    const items = parseRSS(boeXml);
    const rows = rssToRows(items, 'AR', 'argentina_boletin_oficial');
    if (rows.length > 0) { const n = await upsert(rows,'argentina_boletin_oficial'); console.log(`  ✓ ${n} (BOE)`); return n; }
  }
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
  // 1) Servicio Civil — API JSON de concursos abiertos
  const scData = await fetchJSON(
    'https://portal.serviciocivil.cl/cgi-bin/apps.cgi?id=buscar_concursos&estado=abierto&rows=50&start=0',
    { timeout: 14000 }
  );
  if (scData?.response?.docs?.length) {
    const rows = [];
    for (const d of scData.response.docs) {
      const titulo = d.cargo || d.titulo || '';
      const id = String(d.id || '').replace(/\W/g,'').slice(0,48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!titulo || rows.some(r=>r.fuente_id===id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente: 'chile_serviciocivil', pais: 'CL',
        titulo, cargo: titulo, organismo: d.institucion || null,
        lugar: d.region || null,
        fecha_cierre: parseFecha(d.fecha_cierre || d.plazo || ''),
        url_detalle: d.url || `https://portal.serviciocivil.cl/cgi-bin/apps.cgi?id=detalle_concurso&id_concurso=${d.id}`,
        url_postulacion: d.url || `https://portal.serviciocivil.cl/cgi-bin/apps.cgi?id=detalle_concurso&id_concurso=${d.id}`,
        keywords: extraerKeywords(titulo + ' ' + (d.institucion||'')),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'chile_serviciocivil'); console.log(`  ✓ ${n} (Servicio Civil API)`); return n; }
  }
  // 2) empleospublicos.cl — HTML scraping con múltiples selectores
  for (const url of [
    'https://www.empleospublicos.cl/pub/convocatorias/convocatorias.aspx',
    'https://www.empleospublicos.cl/pub/convocatorias/',
  ]) {
    const html = await fetchUrl(url, { timeout: 15000 });
    if (!html) continue;
    const $ = cheerio.load(html);
    const rows = [];
    // Selector nuevo y viejo a la vez
    $('[id="bx_caja"], .ficha-concurso, .concurso-item, tr.convocatoria').each((_, el) => {
      const titulo = ($('[id="bx_titulos"]', el).text() || $('h3,h4,.titulo', el).text() || $('td', el).first().text()).trim();
      const org    = ($('strong', el).first().text() || $('.institucion', el).text()).trim();
      const href   = ($('a.btnverficha', el).attr('href') || $('a', el).first().attr('href') || '');
      if (!titulo || titulo.length < 4) return;
      const link = href.startsWith('http') ? href : href ? `https://www.empleospublicos.cl${href}` : url;
      const id   = href.match(/i=(\d+)/)?.[1] || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r=>r.fuente_id===id)) rows.push(makeRow({
        fuente_id: id, fuente: 'chile_empleospublicos', pais: 'CL',
        titulo, cargo: titulo, organismo: org || null,
        url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo + ' ' + org),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'chile_empleospublicos'); console.log(`  ✓ ${n} (empleospublicos.cl)`); return n; }
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
  // cnsc.gov.co redirige: /index.php/convocatorias → /convocatorias
  const html = await fetchUrl('https://www.cnsc.gov.co/convocatorias/en-desarrollo', { timeout: 12000 })
    || await fetchUrl('https://www.cnsc.gov.co/convocatorias', { timeout: 12000 });
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
  // 1) SERVIR API — busqueda de convocatorias CAS y otras
  const apiData = await fetchJSON(
    'https://www.gob.pe/api/busqueda?type=convocatorias&sort_by=date&page=1&per_page=50',
    { timeout: 12000 }
  );
  if (apiData?.items?.length) {
    const rows = [];
    for (const item of apiData.items.slice(0,50)) {
      const titulo = item.title || item.nombre || '';
      const href   = item.url || item.link || '';
      const id     = String(item.id || '').replace(/\W/g,'').slice(0,48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!titulo || rows.some(r=>r.fuente_id===id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente: 'peru_gobpe', pais: 'PE',
        titulo, cargo: titulo, organismo: item.entity || item.institucion || null,
        fecha_cierre: parseFecha(item.end_date || item.fecha_cierre || ''),
        url_detalle: href || 'https://www.gob.pe/convocatorias',
        url_postulacion: href || 'https://www.gob.pe/convocatorias',
        keywords: extraerKeywords(titulo),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'peru_gobpe'); console.log(`  ✓ ${n} (gob.pe)`); return n; }
  }
  // 2) SERVIR HTML
  const html = await fetchUrl('https://www.servir.gob.pe/convocatorias/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('article, .convocatoria, tr, h3, h4').each((_, el) => {
      const titulo = ($(el).find('h2,h3,h4,.title,td').first().text() || $(el).text()).trim();
      const href   = $(el).find('a').first().attr('href') || '';
      if (!titulo || titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.servir.gob.pe${href}`;
      const id   = encodeURIComponent(href).slice(-50) || titulo.replace(/\s/g,'_').slice(0,48);
      if (!rows.some(r=>r.fuente_id===id)) rows.push(makeRow({
        fuente_id: id, fuente: 'peru_servir', pais: 'PE',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
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
    'https://encuentraempleo.trabajo.gob.ec/socioEmpleo-war/paginas/procesos/busquedaOfertaPublica.jsf',
    'https://www.trabajo.gob.ec/convocatorias-del-sector-publico/',
    'https://www.trabajo.gob.ec/convocatorias/',
  ]) {
    const html = await fetchUrl(url, { timeout: 14000 });
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
  // DOF — Diario Oficial de la Federación, sección vacantes gobierno federal
  const html = await fetchUrl('https://dof.gob.mx/vacantes.php', { timeout: 12000, insecure: true });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    // Cada vacante tiene un <a href="vacantes/XXXXX/XXXXXX.html"> — tomamos el link
    // y buscamos la celda de la fila anterior para obtener organismo y fecha
    $('a[href*="vacantes/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('vacantes/')) return;
      // Subir al TR que contiene el link
      const trLink = $(el).closest('tr');
      // El TR anterior tiene fecha + organismo
      const trOrg  = trLink.prev('tr');
      const tds    = trOrg.find('td').map((_, td) => $(td).clone().children().remove().end().text().trim()).toArray();
      const fecha  = tds.find(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t)) || '';
      const organismo = tds.filter(t => t && t !== fecha && !t.match(/^Documento/i)).join(' — ').slice(0, 200) || 'Gobierno Federal MX';
      const fullUrl = `https://dof.gob.mx/${href}`;
      const id = href.replace(/\W/g, '').slice(-48);
      if (rows.some(r => r.fuente_id === id)) return;
      rows.push(makeRow({
        fuente_id: id, fuente: 'mexico_dof', pais: 'MX',
        titulo: organismo, cargo: organismo, organismo,
        fecha_inicio: parseFecha(fecha),
        url_detalle: fullUrl, url_postulacion: fullUrl,
        keywords: extraerKeywords(organismo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'mexico_dof'); console.log(`  ✓ ${n} (DOF vacantes)`); return n; }
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
  // DGSC — cert SSL inválido (cadena incompleta) → insecure: true
  const html = await fetchUrl('https://vacantes.dgsc.go.cr/', { timeout: 12000, insecure: true })
    || await fetchUrl('https://piep.dgsc.go.cr/', { timeout: 12000, insecure: true })
    || await fetchUrl('https://www.dgsc.go.cr/puestosVacantes.html', { timeout: 12000, insecure: true });
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
  // administracion.gob.es — XML export, solo convocatorias abiertas
  const xmlRaw = await fetchUrl(
    'https://administracion.gob.es/pagFront/ofertasempleopublico/descargaXMLE.htm?buscar=true&orders=id&sort=desc&tipoPlazo=1',
    { timeout: 30000 }
  );
  if (xmlRaw && xmlRaw.includes('<referencia>')) {
    const exTag = (blk, tag) => { const m = blk.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's')); return m ? m[1].trim() : null; };
    const parseF = s => { if (!s) return null; const p = s.split('/'); return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : null; };
    const blocks = xmlRaw.split('<convocatorias>').slice(1);
    const rows = [];
    const seen = new Set();
    for (const blk of blocks) {
      const ref = exTag(blk, 'referencia');
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      const titulo = exTag(blk, 'titulo') || '';
      if (titulo.length < 3) continue;
      const organo = exTag(blk, 'organo');
      const plazas = parseInt(exTag(blk, 'plazasconvocadas')) || 1;
      const url    = exTag(blk, 'direccioninternet') || `https://administracion.gob.es/pagFront/ofertasempleopublico/resultadosEmpleo.htm?referencia=${ref}`;
      const plazoBlk = blk.match(/<plazos>(.*?)<\/plazos>/s)?.[1] || '';
      const fi = parseF(exTag(plazoBlk, 'fechainicio'));
      const ff = parseF(exTag(plazoBlk, 'fechafin'));
      rows.push(makeRow({
        fuente_id: ref, fuente: 'espana_administracion', pais: 'ES',
        titulo, cargo: titulo, organismo: organo,
        fecha_inicio: fi, fecha_cierre: ff,
        puestos: plazas, activo: true,
        url_detalle: url, url_postulacion: url,
        keywords: extraerKeywords(titulo + ' ' + (organo||'')),
      }));
    }
    if (rows.length > 0) {
      let total = 0;
      for (let i = 0; i < rows.length; i += 500) total += await upsert(rows.slice(i, i+500), 'espana_administracion');
      console.log(`  ✓ ${total} (administracion.gob.es — convocatorias abiertas)`);
      return total;
    }
  }
  // Fallback: BOE RSS
  for (const c of ['11', '13', '14']) {
    const rows = await fetchRSS(`https://www.boe.es/rss/canal.php?c=${c}`, 'ES', 'espana_boe');
    if (rows.length > 0) { const n = await upsert(rows,'espana_boe'); console.log(`  ✓ ${n} (BOE canal ${c})`); return n; }
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
  // InPA — API WordPress (portal oficial italiano de empleo público)
  const data = await fetchJSON(
    'https://www.inpa.gov.it/wp-json/wp/v2/posts?per_page=50&search=concorso&_fields=id,title,date,link,excerpt',
    { timeout: 15000 }
  );
  if (data && data.length > 0) {
    const rows = [];
    const seen = new Set();
    for (const post of data) {
      const id = String(post.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const titulo = (post.title?.rendered || '').replace(/&#\d+;/g,'').replace(/&[a-z]+;/g,'').trim();
      if (titulo.length < 5) continue;
      const link = post.link || 'https://www.inpa.gov.it/';
      rows.push(makeRow({
        fuente_id: id, fuente: 'italia_inpa', pais: 'IT',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'italia_inpa'); console.log(`  ✓ ${n} (InPA WP API)`); return n; }
  }
  // Fallback: Gazzetta Ufficiale concorsi RSS
  const rssRows = await fetchRSS('https://www.gazzettaufficiale.it/rss/concorsi.xml', 'IT', 'italia_gazzetta');
  if (rssRows.length > 0) { const n = await upsert(rssRows,'italia_gazzetta'); console.log(`  ✓ ${n} (Gazzetta Ufficiale)`); return n; }
  const az = await adzunaSearch('it', 'IT', 'italia_adzuna', 'concorso pubblico lavoro amministrazione');
  if (az.length > 0) { const n = await upsert(az,'italia_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('concorso pubblico lavoro amministrazione', 'Italia', 'IT', 'italia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'italia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── FRANCIA ─────────────────────────────────────────────────────────────────
async function scrapeFrancia() {
  console.log('🇫🇷 Francia...');
  // choisirleservicepublic.gouv.fr — API JSON paginada (49000+ ofertas)
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch('https://choisirleservicepublic.gouv.fr/wp-json/api/offer-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': HEADERS['User-Agent'],
          'Referer': 'https://choisirleservicepublic.gouv.fr/nos-offres/',
          'Origin': 'https://choisirleservicepublic.gouv.fr',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ page }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { console.log(`    ⚠ Francia pág ${page}: HTTP ${res.status}`); break; }
      const d = await res.json();
      const items = d.items || [];
      if (items.length === 0) break;
      for (const item of items) {
        const ref = item.reference || '';
        const id  = ref.replace(/\W/g,'').slice(-48) || (item.title||'').replace(/\W/g,'').slice(0,48);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const titulo = item.title || '';
        if (titulo.length < 3) continue;
        rows.push(makeRow({
          fuente_id: id, fuente: 'francia_choisirservicepublic', pais: 'FR',
          titulo, cargo: titulo, organismo: item.employeur || null,
          lugar: (item.localisation || '').replace(/<[^>]+>/g,'').trim() || null,
          url_detalle: item.url || 'https://choisirleservicepublic.gouv.fr/nos-offres/',
          url_postulacion: item.url || 'https://choisirleservicepublic.gouv.fr/nos-offres/',
          keywords: extraerKeywords(titulo + ' ' + (item.employeur||'') + ' ' + (item.domain||'')),
        }));
      }
    } catch(e) { console.log(`    ⚠ Francia página ${page}: ${e.message}`); break; }
  }
  if (rows.length > 0) { const n = await upsert(rows,'francia_choisirservicepublic'); console.log(`  ✓ ${n} (choisirleservicepublic.gouv.fr)`); return n; }
  const az = await adzunaSearch('fr', 'FR', 'francia_adzuna', 'concours fonction publique emploi');
  if (az.length > 0) { const n = await upsert(az,'francia_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('concours fonction publique emploi', 'France', 'FR', 'francia_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'francia_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── ALEMANIA ────────────────────────────────────────────────────────────────
async function scrapeAlemania() {
  console.log('🇩🇪 Alemania...');
  // Bundesagentur für Arbeit — API pública gratuita (sin angebotsart que causa 400)
  const data = await fetchJSON(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?page=1&size=50&was=verwaltung',
    { headers: { 'X-API-Key': 'jobboerse-jobsuche', 'Accept': 'application/json' }, timeout: 12000 }
  ) || await fetchJSON(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?page=1&size=50',
    { headers: { 'X-API-Key': 'jobboerse-jobsuche', 'Accept': 'application/json' }, timeout: 12000 }
  );
  if (data) {
    const jobs = data.stellenangebote ?? data.jobs ?? [];
    const rows = [];
    for (const job of jobs.slice(0, 50)) {
      const titel       = job.titel || job.beruf || '';
      const arbeitgeber = job.arbeitgeber || '';
      const refnr       = String(job.refnr || job.hashId || '');
      const ort         = job.arbeitsort?.ort || job.arbeitsorte?.[0]?.ort || job.ort || null;
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
  // Civil Service Jobs + LocalGov RSS
  for (const url of [
    'https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?pageaction=searchresults&stc=1&format=rss',
    'https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?pageaction=searchbykey&key=jobs_rss',
    'https://jobs.localgov.co.uk/rss/',
    'https://findajob.dwp.gov.uk/search?sb=date&sd=down&pp=25&format=rss',
  ]) {
    const rows = await fetchRSS(url, 'GB', 'uk_localgov');
    if (rows.length > 0) { const n = await upsert(rows,'uk_localgov'); console.log(`  ✓ ${n} (LocalGov)`); return n; }
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
    { headers: { 'User-Agent': 'nexu@nexu.uy' }, timeout: 12000 }
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
    'https://www.canada.ca/content/dam/canada/jobs/job-bank/documents/jobopp-rss-en.xml',
    'https://www.jobbank.gc.ca/jobsearch/rss?searchstring=government&fsrc=16',
  ]) {
    const rows = await fetchRSS(url, 'CA', 'canada_gc_jobs');
    if (rows.length > 0) { const n = await upsert(rows,'canada_gc_jobs'); console.log(`  ✓ ${n} (GC Jobs)`); return n; }
  }
  // Job Bank — portal oficial de empleos del gobierno canadiense (HTML)
  const html = await fetchUrl('https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=federal+government&fsrc=16&sort=M', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a.resultJobItem, article.results-jobs a, .jobs-search-results a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.jobbank.gc.ca${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'canada_jobbank', pais: 'CA',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'canada_jobbank'); console.log(`  ✓ ${n} (Job Bank)`); return n; }
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
  // APSJobs — portal oficial APS, múltiples endpoints posibles
  for (const url of [
    'https://www.apsjobs.gov.au/s/global-search/services/search/global?keyword=&sort=Date&pageSize=50&page=1',
    'https://api.apsjobs.gov.au/v1/jobs?sort=date&pageSize=50',
    'https://www.apsjobs.gov.au/s/sfsites/auraFW/aura?r=3&aura.ApexAction.execute=1',
  ]) {
    const data = await fetchJSON(url, { timeout: 12000 });
    if (data) {
      const jobs = data.results ?? data.jobs ?? data.vacancies ?? data.records ?? [];
      const rows = [];
      for (const job of jobs.slice(0, 50)) {
        const titulo = job.title || job.jobTitle || job.positionTitle || job.Name || '';
        const agency = job.agency || job.organisation || job.department || job.Agency__c || '';
        const id     = String(job.id || job.vacancyId || job.refNumber || job.Id || '').replace(/\W/g,'').slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
        const close  = job.closingDate || job.closing_date || job.CloseDate || job.ClosingDate__c || '';
        if (!titulo || titulo.length < 4 || rows.some(r=>r.fuente_id===id)) continue;
        rows.push(makeRow({
          fuente_id: id, fuente: 'australia_apsjobs', pais: 'AU',
          titulo: agency ? `${titulo} — ${agency}` : titulo,
          cargo: titulo, organismo: agency || null,
          lugar: 'Australia', fecha_cierre: parseFecha(close),
          url_detalle: `https://www.apsjobs.gov.au/s/job-detail?Id=${job.id||job.Id||''}`,
          url_postulacion: `https://www.apsjobs.gov.au/s/job-detail?Id=${job.id||job.Id||''}`,
          keywords: extraerKeywords(titulo + ' ' + agency),
        }));
      }
      if (rows.length > 0) { const n = await upsert(rows,'australia_apsjobs'); console.log(`  ✓ ${n} (APSJobs)`); return n; }
    }
  }
  // Scraping HTML de APSJobs como fallback
  const html = await fetchUrl('https://www.apsjobs.gov.au/s/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="job-detail"], a[href*="vacancy"], h3 a, h4 a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.apsjobs.gov.au${href}`;
      const id   = encodeURIComponent(href).slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      if (!rows.some(r => r.fuente_id === id)) rows.push(makeRow({
        fuente_id: id, fuente: 'australia_apsjobs', pais: 'AU',
        titulo, cargo: titulo, lugar: 'Australia',
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'australia_apsjobs'); console.log(`  ✓ ${n} (APSJobs HTML)`); return n; }
  }
  const az = await adzunaSearch('au', 'AU', 'au_adzuna', 'government public service APS jobs');
  if (az.length > 0) { const n = await upsert(az,'au_adzuna'); console.log(`  ✓ ${n} (Adzuna)`); return n; }
  const jb = await joobleSearch('government public service APS', 'Australia', 'AU', 'au_jooble');
  if (jb.length > 0) { const n = await upsert(jb,'au_jooble'); console.log(`  ✓ ${n} (Jooble)`); return n; }
  console.log('  ⚠ sin resultados'); return 0;
}

// ─── GOOGLE NEWS QUERIES POR PAÍS ────────────────────────────────────────────
const GN = {
  UY: { q: 'llamado concurso empleo público Uruguay',          gl: 'UY', hl: 'es-419' },
  AR: { q: 'concurso público empleo gobierno Argentina',       gl: 'AR', hl: 'es-419' },
  BR: { q: 'concurso público emprego governo Brasil',          gl: 'BR', hl: 'pt-BR'  },
  CL: { q: 'concurso público empleo gobierno Chile',          gl: 'CL', hl: 'es-419' },
  CO: { q: 'convocatoria empleo público Colombia CNSC',        gl: 'CO', hl: 'es-419' },
  PE: { q: 'convocatoria CAS empleo público Perú',            gl: 'PE', hl: 'es-419' },
  PY: { q: 'concurso empleo público Paraguay',                 gl: 'PY', hl: 'es-419' },
  BO: { q: 'convocatoria empleo público Bolivia',             gl: 'BO', hl: 'es-419' },
  EC: { q: 'convocatoria empleo público Ecuador',             gl: 'EC', hl: 'es-419' },
  MX: { q: 'convocatoria empleo público México',              gl: 'MX', hl: 'es-419' },
  VE: { q: 'convocatoria empleo público Venezuela',           gl: 'VE', hl: 'es-419' },
  CU: { q: 'convocatoria empleo Cuba',                        gl: 'CU', hl: 'es-419' },
  CR: { q: 'concurso empleo público Costa Rica',              gl: 'CR', hl: 'es-419' },
  GT: { q: 'convocatoria empleo público Guatemala',           gl: 'GT', hl: 'es-419' },
  SV: { q: 'convocatoria empleo público El Salvador',        gl: 'SV', hl: 'es-419' },
  HN: { q: 'convocatoria empleo público Honduras',            gl: 'HN', hl: 'es-419' },
  NI: { q: 'convocatoria empleo público Nicaragua',           gl: 'NI', hl: 'es-419' },
  PA: { q: 'convocatoria empleo público Panamá',              gl: 'PA', hl: 'es-419' },
  DO: { q: 'concurso oposición empleo público Dominicana',   gl: 'DO', hl: 'es-419' },
  ES: { q: 'oposición empleo público administración España',  gl: 'ES', hl: 'es'     },
  PT: { q: 'concurso emprego público administração Portugal', gl: 'PT', hl: 'pt-PT'  },
  IT: { q: 'concorso pubblico lavoro amministrazione Italia', gl: 'IT', hl: 'it'     },
  FR: { q: 'concours fonction publique emploi France',        gl: 'FR', hl: 'fr'     },
  DE: { q: 'Stellenangebot öffentlicher Dienst Deutschland',  gl: 'DE', hl: 'de'     },
  GB: { q: 'government public sector jobs UK civil service',  gl: 'GB', hl: 'en-GB'  },
  US: { q: 'federal government jobs USA civil service',       gl: 'US', hl: 'en-US'  },
  CA: { q: 'government jobs Canada federal public service',   gl: 'CA', hl: 'en-CA'  },
  AU: { q: 'APS government jobs Australia public service',    gl: 'AU', hl: 'en-AU'  },
};

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

// Fuentes con nombres viejos que ya no escribe el scraper → acumulan datos rancios
const FUENTES_OBSOLETAS = [
  'remoto',                   // UY viejo
  'bolivia_googlenoticias',   'México_GoogleNoticias',  'Portugal_GoogleNoticias',
  'España Google News',       'italia_googlenews',      'noticias_de_it',
  'uk_googlenews',            'usa_googlenews',         'noticias_us',
  'Venezuela_GoogLeNoticia',  'Alemania_googlenews',    'Cuba Google News',
  'Noticias de Cug',          'Francia_GoogleNoticias', 'Colombia_GoogleNoticias',
  'Paraguay_GoogleNoticias',  'noticias_peg',           'Banco de empleo de Cana',
  'chile_googlenoticias',     'argentina_googlenoticias','brasil_googlenoticias',
  'elsalvador_googlenoticias','honduras_googlenoticias', 'nicaragua_googlenoticias',
  'costarica_googlenoticias', 'panama_googlenoticias',   'dominicana_googlenoticias',
  'ecuador_googlenoticias',   'cuba_googlenoticias',     'venezuela_googlenoticias',
  'peru_googlenoticias',
];

if (!TEST_MODE) {
  // 1) Borrar fuentes renombradas/obsoletas
  for (const f of FUENTES_OBSOLETAS) {
    await supabase.from('concursos').delete().eq('fuente', f);
  }
  console.log(`🧹 ${FUENTES_OBSOLETAS.length} fuentes obsoletas limpiadas`);

  // 2) Borrar llamados con fecha_cierre vencida (más de 1 día de gracia)
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const { error: errExp } = await supabase
    .from('concursos')
    .delete()
    .not('fecha_cierre', 'is', null)
    .lt('fecha_cierre', ayer);
  if (!errExp) console.log(`🗑  llamados vencidos eliminados (fecha_cierre < ${ayer})`);
}

console.log(`\n🌎 Nexu Scraper${TEST_MODE ? ' [TEST]' : ''} — ${Object.keys(aCorrer).length} países — ${new Date().toISOString()}\n`);

let total = 0;
for (const [pais, fn] of Object.entries(aCorrer)) {
  try {
    let n = await fn() || 0;
    // Fallback universal: Google News RSS si la fuente primaria no dio resultados
    if (n === 0 && GN[pais]) {
      const { q, gl, hl } = GN[pais];
      const gnRows = await googleNewsRSS(q, gl, hl, pais, `${pais.toLowerCase()}_gnews`);
      if (gnRows.length > 0) {
        n = await upsert(gnRows, `${pais.toLowerCase()}_gnews`);
        if (n > 0) console.log(`  ✓ ${n} (Google News)`);
      }
    }
    total += n;
  } catch (e) {
    console.error(`  ❌ ${pais} falló:`, e.message);
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n✅ Total: ${total} llamados ${TEST_MODE ? 'encontrados (no guardados)' : 'guardados en Supabase'}\n`);
