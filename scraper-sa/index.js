import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_MODE   = process.argv.includes('--test');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Nexu/1.0; concursos@nexu.uy)',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es,en;q=0.5',
};

// ─── HELPERS ───────────────────────────────────────────────
function normalizar(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extraerKeywords(texto = '') {
  const stop = new Set(['de','del','la','el','las','los','en','un','una','y','o',
    'a','con','por','para','al','se','no','es','que','sus','esta','este','lo',
    'como','mas','su','ser','tiene','han','sido','son','fue','hay','pero']);
  return [...new Set(
    normalizar(texto).split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 15);
}

function parseFecha(str = '') {
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

async function fetchHtml(url, timeout = 15000) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function upsert(rows, fuente) {
  if (!rows.length) return 0;
  if (TEST_MODE) {
    console.log(`  [TEST] ${rows.length} rows — muestra:`);
    rows.slice(0, 2).forEach(r => console.log(`    - ${r.cargo} | ${r.lugar || '—'} | ${r.fecha_cierre || '—'}`));
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

// ─── ARGENTINA — concursar.renapra.gob.ar ──────────────────
async function scrapeArgentina() {
  console.log('🇦🇷 Argentina...');
  const rows = [];

  // Intentar el sistema nacional de concursos SINEP
  const html = await fetchHtml('https://concursar.renapra.gob.ar/Concursar/faces/public/buscarConcurso.xhtml');
  if (!html) {
    // Fallback: buscar en argentina.gob.ar
    const html2 = await fetchHtml('https://www.argentina.gob.ar/buscar/concurso%20p%C3%BAblico');
    if (!html2) { console.log('  ⚠ inaccesible'); return 0; }
    const $ = cheerio.load(html2);
    $('article, .views-row, .search-result').each((_, el) => {
      const titulo = $(el).find('h3, h2, .title').first().text().trim();
      const href   = $(el).find('a').first().attr('href') || '';
      const link   = href.startsWith('http') ? href : `https://www.argentina.gob.ar${href}`;
      if (titulo.length < 6) return;
      rows.push({
        fuente_id: link.split('/').pop()?.slice(0, 60) || titulo.slice(0, 40).replace(/\s/g, '_'),
        fuente: 'argentina_ingresopublico', pais: 'AR',
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo), activo: true,
      });
    });
  } else {
    const $ = cheerio.load(html);
    // Tabla de resultados RENAPRA
    $('tr').each((_, row) => {
      const celdas = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      if (celdas.length < 2) return;
      const cargo     = celdas[0];
      const organismo = celdas[1] || null;
      const link      = $(row).find('a').attr('href') || '';
      const href      = link.startsWith('http') ? link : `https://concursar.renapra.gob.ar${link}`;
      const fechaStr  = celdas.find(c => /\d{2}\/\d{2}\/\d{4}/.test(c)) || '';
      if (!cargo || cargo.length < 4) return;
      rows.push({
        fuente_id: href.split('/').pop()?.replace(/\W/g, '') || cargo.slice(0, 40).replace(/\s/g, '_'),
        fuente: 'argentina_ingresopublico', pais: 'AR',
        numero_llamado: null, titulo: cargo, cargo, organismo,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(fechaStr), puestos: 1,
        url_detalle: href || null, url_postulacion: href || null,
        keywords: extraerKeywords(cargo), activo: true,
      });
    });
  }

  const n = await upsert(rows, 'argentina_ingresopublico');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── CHILE — empleospublicos.cl ─────────────────────────────
async function scrapeChile() {
  console.log('🇨🇱 Chile...');
  const rows = [];

  const html = await fetchHtml('https://www.empleospublicos.cl/busqueda/listaAnuncios.aspx');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  // Cada cargo está en una fila con clase odd/even o en divs con info
  $('tr.odd, tr.even, .anuncio-item, [class*="cargo"]').each((_, el) => {
    const texto    = $(el).text().replace(/\s+/g, ' ').trim();
    const href     = $(el).find('a').first().attr('href') || '';
    const link     = href.startsWith('http') ? href : `https://www.empleospublicos.cl${href}`;
    const cargo    = $(el).find('td, .cargo, h3').first().text().trim() || texto.slice(0, 60);
    const fechaStr = texto.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
    const lugar    = texto.match(/Regi[oó]n[^:]*:\s*([^\n]{3,40})/i)?.[1]?.trim() || null;
    if (!cargo || cargo.length < 5) return;
    rows.push({
      fuente_id: href.split('=').pop()?.replace(/\W/g, '').slice(0, 40) || cargo.slice(0, 40).replace(/\s/g, '_'),
      fuente: 'chile_empleospublicos', pais: 'CL',
      numero_llamado: null, titulo: cargo, cargo, organismo: null,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar, fecha_inicio: null, fecha_cierre: parseFecha(fechaStr), puestos: 1,
      url_detalle: link || null, url_postulacion: link || null,
      keywords: extraerKeywords(cargo), activo: true,
    });
  });

  // Si no encontró filas, buscar links directos
  if (rows.length === 0) {
    $('a[href*="cargo"], a[href*="detalle"], a[href*="anuncio"]').each((_, el) => {
      const titulo = $(el).text().trim();
      const href   = $(el).attr('href') || '';
      const link   = href.startsWith('http') ? href : `https://www.empleospublicos.cl${href}`;
      if (titulo.length < 5) return;
      rows.push({
        fuente_id: encodeURIComponent(href).slice(-50),
        fuente: 'chile_empleospublicos', pais: 'CL',
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo), activo: true,
      });
    });
  }

  const n = await upsert(rows, 'chile_empleospublicos');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── COLOMBIA — cnsc.gov.co ─────────────────────────────────
async function scrapeColombia() {
  console.log('🇨🇴 Colombia...');
  const rows = [];

  const html = await fetchHtml('https://www.cnsc.gov.co/index.php/convocatorias');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('a[href*="convocatori"]').each((_, el) => {
    const titulo = $(el).text().trim();
    const href   = $(el).attr('href') || '';
    const link   = href.startsWith('http') ? href : `https://www.cnsc.gov.co${href}`;
    if (titulo.length < 8) return;
    if (rows.some(r => r.url_detalle === link)) return;
    rows.push({
      fuente_id: encodeURIComponent(href).slice(-50),
      fuente: 'colombia_cnsc', pais: 'CO',
      numero_llamado: null, titulo, cargo: titulo, organismo: 'CNSC',
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
      url_detalle: link, url_postulacion: link,
      keywords: extraerKeywords(titulo), activo: true,
    });
    if (rows.length >= 40) return false;
  });

  const n = await upsert(rows, 'colombia_cnsc');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── PERÚ — servir.gob.pe ───────────────────────────────────
async function scrapePerú() {
  console.log('🇵🇪 Perú...');
  const rows = [];

  const html = await fetchHtml('https://www.servir.gob.pe/convocatorias/');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('article, .convocatoria, tr').each((_, el) => {
    const titulo   = $(el).find('h2,h3,.title,td').first().text().trim();
    const href     = $(el).find('a').first().attr('href') || '';
    const link     = href.startsWith('http') ? href : `https://www.servir.gob.pe${href}`;
    const fechaStr = $(el).text().match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
    if (!titulo || titulo.length < 5) return;
    rows.push({
      fuente_id: encodeURIComponent(href).slice(-50) || titulo.slice(0, 40).replace(/\s/g, '_'),
      fuente: 'peru_servir', pais: 'PE',
      numero_llamado: null, titulo, cargo: titulo, organismo: null,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(fechaStr), puestos: 1,
      url_detalle: link, url_postulacion: link,
      keywords: extraerKeywords(titulo), activo: true,
    });
  });

  const n = await upsert(rows, 'peru_servir');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── PARAGUAY — sfp.gov.py ──────────────────────────────────
async function scrapeParaguay() {
  console.log('🇵🇾 Paraguay...');
  const rows = [];

  const html = await fetchHtml('https://www.sfp.gov.py/es/institucional/concursos');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);
  $('a[href*="concurso"], .views-row h3 a, article h2 a').each((_, el) => {
    const titulo = $(el).text().trim();
    const href   = $(el).attr('href') || '';
    const link   = href.startsWith('http') ? href : `https://www.sfp.gov.py${href}`;
    if (titulo.length < 5) return;
    rows.push({
      fuente_id: encodeURIComponent(href).slice(-50),
      fuente: 'paraguay_sfp', pais: 'PY',
      numero_llamado: null, titulo, cargo: titulo, organismo: 'SFP',
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
      url_detalle: link, url_postulacion: link,
      keywords: extraerKeywords(titulo), activo: true,
    });
  });

  const n = await upsert(rows, 'paraguay_sfp');
  console.log(`  ✓ ${n} llamados`);
  return n;
}

// ─── MAIN ───────────────────────────────────────────────────
const PAIS = process.env.PAIS?.toUpperCase();

console.log(`\n🌎 Scraper Sudamérica${TEST_MODE ? ' [TEST]' : ''} — ${new Date().toISOString()}\n`);

const scrapers = {
  AR: scrapeArgentina,
  CL: scrapeChile,
  CO: scrapeColombia,
  PE: scrapePerú,
  PY: scrapeParaguay,
};

const aCorrer = PAIS && scrapers[PAIS]
  ? { [PAIS]: scrapers[PAIS] }
  : scrapers;

let total = 0;
for (const [pais, fn] of Object.entries(aCorrer)) {
  try {
    total += await fn();
  } catch (e) {
    console.error(`  ❌ ${pais} falló:`, e.message);
  }
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✅ Total: ${total} llamados ${TEST_MODE ? 'encontrados (no guardados)' : 'guardados en Supabase'}\n`);
