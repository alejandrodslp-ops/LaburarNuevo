/**
 * Scraper Nexu — todos los países (28)
 * Corre en GitHub Actions 1x/día.
 * Fuentes: RSS oficiales, APIs públicas (Bundesagentur, InPA), Indeed RSS, HTML scraping.
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

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

async function fetchUrl(url, { timeout = 14000, headers = {} } = {}) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function fetchJSON(url, { timeout = 14000, headers = {} } = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': HEADERS['User-Agent'], ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
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
  if (TEST_MODE) {
    console.log(`  [TEST] ${rows.length} rows en ${fuente}`);
    rows.slice(0, 2).forEach(r => console.log(`    • ${r.cargo} | ${r.pais} | ${r.lugar || '—'}`));
    return rows.length;
  }
  const { error } = await supabase
    .from('concursos')
    .upsert(rows, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false });
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

// Helper para Indeed RSS
async function indeedRSS(subdominio, query, pais, fuente, lugar) {
  const q = encodeURIComponent(query);
  const l = lugar ? `&l=${encodeURIComponent(lugar)}` : '';
  const urls = [
    `https://${subdominio}.indeed.com/rss?q=${q}${l}&sort=date`,
    `https://rss.indeed.com/rss?q=${q}&l=${encodeURIComponent(lugar || pais)}&sort=date`,
  ];
  for (const url of urls) {
    const xml = await fetchUrl(url, { timeout: 10000 });
    if (!xml || !xml.includes('<item>')) continue;
    const items = parseRSS(xml);
    if (items.length === 0) continue;
    const rows = rssToRows(items, pais, fuente, { lugar });
    if (rows.length > 0) return rows;
  }
  return [];
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
  const xml = await fetchUrl('https://www.boletinoficial.gob.ar/rss/seccion/2', { timeout: 12000 });
  if (xml && xml.includes('<item>')) {
    const items = parseRSS(xml);
    const rows  = rssToRows(items, 'AR', 'argentina_boletin_oficial');
    if (rows.length > 0) {
      const n = await upsert(rows, 'argentina_boletin_oficial');
      console.log(`  ✓ ${n} llamados (Boletín Oficial)`);
      return n;
    }
  }
  // Fallback: HTML de concursos argentina.gob.ar
  const html = await fetchUrl('https://www.argentina.gob.ar/buscar/concurso+p%C3%BAblico');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }
  const $ = cheerio.load(html);
  const rows = [];
  $('article h3 a, .search-result h3 a, .views-row h3 a').each((_, el) => {
    const titulo = $(el).text().trim();
    const href   = $(el).attr('href') || '';
    if (titulo.length < 6) return;
    const link = href.startsWith('http') ? href : `https://www.argentina.gob.ar${href}`;
    rows.push(makeRow({
      fuente_id: link.split('/').pop()?.replace(/\W/g,'').slice(0,48) || titulo.replace(/\s/g,'_').slice(0,48),
      fuente: 'argentina_ingresopublico', pais: 'AR',
      titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
      keywords: extraerKeywords(titulo),
    }));
  });
  const n = await upsert(rows, 'argentina_ingresopublico');
  console.log(`  ✓ ${n} llamados`);
  return n;
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
  // Portal Empleos Públicos Chile
  const html = await fetchUrl('https://www.empleospublicos.cl/busqueda/listaAnuncios.aspx', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('tr.odd, tr.even, .anuncio-item').each((_, el) => {
      const href    = $(el).find('a').first().attr('href') || '';
      const cargo   = $(el).find('td, .cargo').first().text().trim() || $(el).text().slice(0,60).trim();
      const fechaStr= $(el).text().match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
      if (!cargo || cargo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.empleospublicos.cl${href}`;
      rows.push(makeRow({
        fuente_id: href.split('=').pop()?.replace(/\W/g,'').slice(0,40) || cargo.replace(/\s/g,'_').slice(0,40),
        fuente: 'chile_empleospublicos', pais: 'CL',
        titulo: cargo, cargo, fecha_cierre: parseFecha(fechaStr),
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(cargo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'chile_empleospublicos'); console.log(`  ✓ ${n}`); return n; }
  }
  // Fallback: Indeed CL
  const ind = await indeedRSS('cl', 'empleo gobierno concurso', 'CL', 'chile_indeed', 'Chile');
  const n = await upsert(ind, 'chile_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
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
  const ind = await indeedRSS('co', 'empleo público convocatoria', 'CO', 'colombia_indeed', 'Colombia');
  const n = await upsert(ind,'colombia_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
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
  const ind = await indeedRSS('pe', 'empleo público CAS SERVIR', 'PE', 'peru_indeed', 'Peru');
  const n = await upsert(ind,'peru_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── PARAGUAY ────────────────────────────────────────────────────────────────
async function scrapeParaguay() {
  console.log('🇵🇾 Paraguay...');
  const html = await fetchUrl('https://www.sfp.gov.py/es/institucional/concursos', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="concurso"], .views-row h3 a, article h2 a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.sfp.gov.py${href}`;
      rows.push(makeRow({
        fuente_id: encodeURIComponent(href).slice(-50),
        fuente: 'paraguay_sfp', pais: 'PY',
        titulo, cargo: titulo, organismo: 'SFP',
        url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'paraguay_sfp'); console.log(`  ✓ ${n}`); return n; }
  }
  const ind = await indeedRSS('ar', 'empleo Paraguay trabajo', 'PY', 'paraguay_indeed', 'Paraguay');
  const n = await upsert(ind,'paraguay_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── BOLIVIA ─────────────────────────────────────────────────────────────────
async function scrapeBolivia() {
  console.log('🇧🇴 Bolivia...');
  const html = await fetchUrl('https://www.empleospublicos.gob.bo/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="convocatori"], a[href*="concurso"], .cargo, tr td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.empleospublicos.gob.bo${href}`;
      const id = encodeURIComponent(href).slice(-48) || titulo.replace(/\s/g,'_').slice(0,48);
      if (!rows.some(r=>r.fuente_id===id)) rows.push(makeRow({
        fuente_id: id, fuente: 'bolivia_empleospublicos', pais: 'BO',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'bolivia_empleospublicos'); console.log(`  ✓ ${n}`); return n; }
  }
  const ind = await indeedRSS('ar', 'empleo Bolivia trabajo público', 'BO', 'bolivia_indeed', 'Bolivia');
  const n = await upsert(ind,'bolivia_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── ECUADOR ─────────────────────────────────────────────────────────────────
async function scrapeEcuador() {
  console.log('🇪🇨 Ecuador...');
  // MDT Ecuador — portal de empleo público
  const html = await fetchUrl('https://www.trabajo.gob.ec/bolsa-de-empleo/', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="empleo"], a[href*="convocatori"], .cargo, tr td a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.trabajo.gob.ec${href}`;
      const id = encodeURIComponent(href).slice(-48);
      if (!rows.some(r=>r.fuente_id===id)) rows.push(makeRow({
        fuente_id: id, fuente: 'ecuador_mdt', pais: 'EC',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'ecuador_mdt'); console.log(`  ✓ ${n}`); return n; }
  }
  const ind = await indeedRSS('ec', 'empleo público concurso gobierno', 'EC', 'ecuador_indeed', 'Ecuador');
  const n = await upsert(ind,'ecuador_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── MÉXICO ──────────────────────────────────────────────────────────────────
async function scrapeMexico() {
  console.log('🇲🇽 México...');
  const ind = await indeedRSS('mx', 'empleo gobierno convocatoria vacante', 'MX', 'mexico_indeed', 'Mexico');
  if (ind.length > 0) { const n = await upsert(ind,'mexico_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n; }
  // Trabajaen.gob.mx fallback
  const html = await fetchUrl('https://www.trabajaen.gob.mx/portal/page/portal/Trabajaen/ConvocatoriasPublicadas', { timeout: 12000 });
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }
  const $ = cheerio.load(html);
  const rows = [];
  $('a[href*="convocatori"], tr td:first-child').each((_, el) => {
    const titulo = $(el).text().trim();
    const href   = $(el).find('a').attr('href') || $(el).closest('tr').find('a').attr('href') || '';
    if (titulo.length < 5) return;
    const link = href.startsWith('http') ? href : `https://www.trabajaen.gob.mx${href}`;
    rows.push(makeRow({
      fuente_id: encodeURIComponent(href).slice(-50) || titulo.replace(/\s/g,'_').slice(0,50),
      fuente: 'mexico_trabajaen', pais: 'MX',
      titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
    }));
  });
  const n = await upsert(rows,'mexico_trabajaen'); console.log(`  ✓ ${n}`); return n;
}

// ─── VENEZUELA ───────────────────────────────────────────────────────────────
async function scrapeVenezuela() {
  console.log('🇻🇪 Venezuela...');
  const ind = await indeedRSS('co', 'empleo Venezuela trabajo vacante', 'VE', 'venezuela_indeed', 'Venezuela');
  const n = await upsert(ind,'venezuela_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── CUBA ────────────────────────────────────────────────────────────────────
async function scrapeCuba() {
  console.log('🇨🇺 Cuba...');
  const ind = await indeedRSS('co', 'empleo Cuba trabajo convocatoria', 'CU', 'cuba_indeed', 'Cuba');
  const n = await upsert(ind,'cuba_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── COSTA RICA ──────────────────────────────────────────────────────────────
async function scrapeCostaRica() {
  console.log('🇨🇷 Costa Rica...');
  const html = await fetchUrl('https://www.dgsc.go.cr/concursos', { timeout: 12000 });
  if (html) {
    const $ = cheerio.load(html);
    const rows = [];
    $('a[href*="concurso"], tr td a, .views-row a').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      if (titulo.length < 5) return;
      const link = href.startsWith('http') ? href : `https://www.dgsc.go.cr${href}`;
      rows.push(makeRow({
        fuente_id: encodeURIComponent(href).slice(-50),
        fuente: 'costarica_dgsc', pais: 'CR',
        titulo, cargo: titulo, url_detalle: link, url_postulacion: link, keywords: extraerKeywords(titulo),
      }));
    });
    if (rows.length > 0) { const n = await upsert(rows,'costarica_dgsc'); console.log(`  ✓ ${n}`); return n; }
  }
  const ind = await indeedRSS('cr', 'empleo gobierno servicio civil', 'CR', 'costarica_indeed', 'Costa Rica');
  const n = await upsert(ind,'costarica_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── GUATEMALA ───────────────────────────────────────────────────────────────
async function scrapeGuatemala() {
  console.log('🇬🇹 Guatemala...');
  const ind = await indeedRSS('gt', 'empleo público gobierno trabajo', 'GT', 'guatemala_indeed', 'Guatemala');
  const n = await upsert(ind,'guatemala_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── EL SALVADOR ─────────────────────────────────────────────────────────────
async function scrapeElSalvador() {
  console.log('🇸🇻 El Salvador...');
  const ind = await indeedRSS('sv', 'empleo gobierno trabajo convocatoria', 'SV', 'elsalvador_indeed', 'El Salvador');
  const n = await upsert(ind,'elsalvador_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── HONDURAS ────────────────────────────────────────────────────────────────
async function scrapeHonduras() {
  console.log('🇭🇳 Honduras...');
  const ind = await indeedRSS('hn', 'empleo gobierno trabajo convocatoria', 'HN', 'honduras_indeed', 'Honduras');
  if (ind.length > 0) { const n = await upsert(ind,'honduras_indeed'); console.log(`  ✓ ${n}`); return n; }
  const ind2 = await indeedRSS('cr', 'empleo Honduras trabajo', 'HN', 'honduras_indeed2', 'Honduras');
  const n = await upsert(ind2,'honduras_indeed2'); console.log(`  ✓ ${n}`); return n;
}

// ─── NICARAGUA ───────────────────────────────────────────────────────────────
async function scrapeNicaragua() {
  console.log('🇳🇮 Nicaragua...');
  const ind = await indeedRSS('cr', 'empleo Nicaragua trabajo convocatoria', 'NI', 'nicaragua_indeed', 'Nicaragua');
  const n = await upsert(ind,'nicaragua_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── PANAMÁ ──────────────────────────────────────────────────────────────────
async function scrapePanama() {
  console.log('🇵🇦 Panamá...');
  const ind = await indeedRSS('pa', 'empleo gobierno público convocatoria', 'PA', 'panama_indeed', 'Panama');
  const n = await upsert(ind,'panama_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── REPÚBLICA DOMINICANA ────────────────────────────────────────────────────
async function scrapeRepDominicana() {
  console.log('🇩🇴 Rep. Dominicana...');
  const ind = await indeedRSS('ar', 'empleo República Dominicana trabajo', 'DO', 'dominicana_indeed', 'Republica Dominicana');
  const n = await upsert(ind,'dominicana_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── ESPAÑA ──────────────────────────────────────────────────────────────────
async function scrapeEspana() {
  console.log('🇪🇸 España...');
  const xml = await fetchUrl('https://www.boe.es/rss/canal.php?c=11', { timeout: 12000 });
  if (xml && xml.includes('<item>')) {
    const rows = rssToRows(parseRSS(xml), 'ES', 'espana_boe');
    if (rows.length > 0) { const n = await upsert(rows,'espana_boe'); console.log(`  ✓ ${n} (BOE)`); return n; }
  }
  const ind = await indeedRSS('es', 'oposición empleo público administración', 'ES', 'espana_indeed', 'España');
  const n = await upsert(ind,'espana_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── PORTUGAL ────────────────────────────────────────────────────────────────
async function scrapePortugal() {
  console.log('🇵🇹 Portugal...');
  const ind = await indeedRSS('pt', 'emprego público concurso administração', 'PT', 'portugal_indeed', 'Portugal');
  const n = await upsert(ind,'portugal_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── ITALIA ──────────────────────────────────────────────────────────────────
async function scrapeItalia() {
  console.log('🇮🇹 Italia...');
  // InPA — portal oficial de concursos públicos italianos
  const data = await fetchJSON(
    'https://www.inpa.gov.it/bandi/api/v1/bandi/?page=1&page_size=40&is_closed=false',
    { timeout: 12000 }
  );
  if (data) {
    const bandi = data.results ?? data.bandi ?? data ?? [];
    const rows = [];
    for (const b of bandi.slice(0, 40)) {
      const titulo    = b.titolo || b.denominazione || b.title || '';
      const organismo = b.ente || b.amministrazione || '';
      const id        = String(b.id || b.codice || b.slug || '').replace(/\W/g,'').slice(0,48) || titulo.replace(/\W/g,'').slice(0,48);
      const scadenza  = b.data_scadenza || b.scadenza || b.closing_date || '';
      if (!titulo || titulo.length < 4 || rows.some(r=>r.fuente_id===id)) continue;
      rows.push(makeRow({
        fuente_id: id, fuente: 'italia_inpa', pais: 'IT',
        titulo: organismo ? `${titulo} — ${organismo}` : titulo,
        cargo: titulo, organismo: organismo || null,
        fecha_cierre: parseFecha(scadenza),
        url_detalle: `https://www.inpa.gov.it/bandi/${b.id || ''}/`,
        url_postulacion: `https://www.inpa.gov.it/bandi/${b.id || ''}/`,
        keywords: extraerKeywords(titulo + ' ' + organismo),
      }));
    }
    if (rows.length > 0) { const n = await upsert(rows,'italia_inpa'); console.log(`  ✓ ${n} (InPA)`); return n; }
  }
  const ind = await indeedRSS('it', 'concorso pubblico lavoro amministrazione', 'IT', 'italia_indeed', 'Italia');
  const n = await upsert(ind,'italia_indeed'); console.log(`  ✓ ${n}`); return n;
}

// ─── FRANCIA ─────────────────────────────────────────────────────────────────
async function scrapeFrancia() {
  console.log('🇫🇷 Francia...');
  const xml = await fetchUrl('https://place-emploi-public.gouv.fr/flux/rss/', { timeout: 12000 });
  if (xml && xml.includes('<item>')) {
    const rows = rssToRows(parseRSS(xml), 'FR', 'francia_place_emploi');
    if (rows.length > 0) { const n = await upsert(rows,'francia_place_emploi'); console.log(`  ✓ ${n} (Place Emploi Public)`); return n; }
  }
  const ind = await indeedRSS('fr', 'concours fonction publique emploi', 'FR', 'francia_indeed', 'France');
  const n = await upsert(ind,'francia_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── ALEMANIA ────────────────────────────────────────────────────────────────
async function scrapeAlemania() {
  console.log('🇩🇪 Alemania...');
  // Bundesagentur für Arbeit — API pública gratuita
  const data = await fetchJSON(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?angebotsart=1&page=0&size=50',
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
  const ind = await indeedRSS('de', 'Stelle Bewerbung öffentlicher Dienst', 'DE', 'alemania_indeed', 'Deutschland');
  const n = await upsert(ind,'alemania_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── REINO UNIDO ─────────────────────────────────────────────────────────────
async function scrapeReinoUnido() {
  console.log('🇬🇧 Reino Unido...');
  const xml = await fetchUrl(
    'https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?pageaction=searchbykey&key=jobs_rss', { timeout: 12000 }
  );
  if (xml && xml.includes('<item>')) {
    const rows = rssToRows(parseRSS(xml), 'GB', 'uk_civilservice');
    if (rows.length > 0) { const n = await upsert(rows,'uk_civilservice'); console.log(`  ✓ ${n} (Civil Service)`); return n; }
  }
  const ind = await indeedRSS('co.uk', 'government civil service jobs vacancy', 'GB', 'uk_indeed', 'United Kingdom');
  const n = await upsert(ind,'uk_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── ESTADOS UNIDOS ──────────────────────────────────────────────────────────
async function scrapeEstadosUnidos() {
  console.log('🇺🇸 Estados Unidos...');
  const xml = await fetchUrl('https://www.usajobs.gov/Search/Results?format=rss', { timeout: 12000 });
  if (xml && xml.includes('<item>')) {
    const rows = rssToRows(parseRSS(xml), 'US', 'usa_usajobs');
    if (rows.length > 0) { const n = await upsert(rows,'usa_usajobs'); console.log(`  ✓ ${n} (USAJobs)`); return n; }
  }
  const ind = await indeedRSS('com', 'government federal jobs hiring', 'US', 'usa_indeed', 'United States');
  const n = await upsert(ind,'usa_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── CANADÁ ──────────────────────────────────────────────────────────────────
async function scrapeCanada() {
  console.log('🇨🇦 Canadá...');
  // PSC — Public Service Commission
  const xml = await fetchUrl(
    'https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.htm?poster=1&psrsection=sch&lang=english&action=searchbykey&key=jobs_rss',
    { timeout: 12000 }
  );
  if (xml && xml.includes('<item>')) {
    const rows = rssToRows(parseRSS(xml), 'CA', 'canada_gc_jobs');
    if (rows.length > 0) { const n = await upsert(rows,'canada_gc_jobs'); console.log(`  ✓ ${n} (GC Jobs)`); return n; }
  }
  const ind = await indeedRSS('ca', 'government jobs federal public service', 'CA', 'canada_indeed', 'Canada');
  const n = await upsert(ind,'canada_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
}

// ─── AUSTRALIA ───────────────────────────────────────────────────────────────
async function scrapeAustralia() {
  console.log('🇦🇺 Australia...');
  // APSJobs — portal oficial del gobierno federal australiano
  const data = await fetchJSON(
    'https://www.apsjobs.gov.au/s/global-search/services/search/global?keyword=&sort=Date&page=1',
    { timeout: 12000 }
  );
  if (data) {
    const jobs = data.results ?? data.jobs ?? [];
    const rows = [];
    for (const job of jobs.slice(0, 40)) {
      const titulo = job.title || job.jobTitle || '';
      const agency = job.agency || job.organisation || '';
      const id     = String(job.id || job.vacancyId || '').replace(/\W/g,'').slice(-48) || titulo.replace(/\W/g,'').slice(0,48);
      const close  = job.closingDate || job.closing_date || '';
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
  const ind = await indeedRSS('com.au', 'government public service APS jobs', 'AU', 'australia_indeed', 'Australia');
  const n = await upsert(ind,'australia_indeed'); console.log(`  ✓ ${n} (Indeed)`); return n;
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
