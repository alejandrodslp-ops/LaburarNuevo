import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_MODE   = process.argv.includes('--test');
const PAIS_ARG    = process.env.PAIS?.toUpperCase();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
});

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-UY,es;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

// ─── HELPERS ──────────────────────────────────────────────────
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
    'con','sin','bajo','sobre','entre','desde','hasta','hacia','según','durante',
  ]);
  return [...new Set(
    normalizar(texto).split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 15);
}

async function fetchHtml(url, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) { console.log(`    HTTP ${res.status} → ${url}`); return null; }
    return await res.text();
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
    fuente_id: String(id).slice(0, 80),
    fuente,
    pais,
    numero_llamado: null,
    titulo: cargo,
    cargo,
    organismo: organismo || null,
    descripcion: descripcion || null,
    requisitos: null,
    tipo_tarea: null,
    tipo_vinculo: 'privado',
    lugar: lugar || null,
    fecha_inicio: null,
    fecha_cierre: fechaCierre || null,
    puestos: 1,
    url_detalle: url,
    url_postulacion: url,
    keywords: extraerKeywords(`${cargo} ${organismo || ''} ${descripcion || ''}`),
    activo: true,
  };
}

// ─── COMPUTRABAJO URUGUAY ──────────────────────────────────────
async function scrapeComputrabajoUY() {
  console.log('🇺🇾 Computrabajo Uruguay...');
  const rows = [];
  const paginas = [1, 2, 3];

  for (const pag of paginas) {
    const url = pag === 1
      ? 'https://www.computrabajo.com.uy/trabajo'
      : `https://www.computrabajo.com.uy/trabajo?p=${pag}`;
    const html = await fetchHtml(url);
    if (!html) break;

    const $ = cheerio.load(html);

    // Selectores múltiples para cubrir cambios en el sitio
    $('article[data-id], .box_oferta, .oferta-item, [class*="oferta"]').each((_, el) => {
      const id       = $(el).attr('data-id') || $(el).attr('id') || '';
      const cargo    = $(el).find('h2, h3, .title_oferta, [class*="title"]').first().text().trim();
      const empresa  = $(el).find('.nombre_empresa, [class*="empresa"], [class*="company"]').first().text().trim();
      const lugar    = $(el).find('.ciudad, [class*="ciudad"], [class*="location"]').first().text().trim();
      const href     = $(el).find('a').first().attr('href') || '';
      const link     = href.startsWith('http') ? href : `https://www.computrabajo.com.uy${href}`;
      if (!cargo || cargo.length < 4) return;
      if (rows.some(r => r.fuente_id === (id || cargo.slice(0,40)))) return;
      rows.push(buildRow('computrabajo_uy', 'UY',
        id || encodeURIComponent(cargo + empresa).slice(0, 60),
        cargo, empresa || null, lugar || null, null, link, null));
    });

    // Fallback: buscar links con /empleo/ en la URL
    if (rows.length === 0) {
      $('a[href*="/empleo/"], a[href*="/trabajo/"]').each((_, el) => {
        const cargo  = $(el).text().trim();
        const href   = $(el).attr('href') || '';
        const link   = href.startsWith('http') ? href : `https://www.computrabajo.com.uy${href}`;
        if (cargo.length < 5) return;
        rows.push(buildRow('computrabajo_uy', 'UY',
          encodeURIComponent(href).slice(-60), cargo, null, null, null, link, null));
      });
    }

    await new Promise(r => setTimeout(r, 800));
  }

  const n = await upsert(rows, 'computrabajo_uy');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── BUMERAN URUGUAY ───────────────────────────────────────────
async function scrapeBumeranUY() {
  console.log('🇺🇾 Bumeran Uruguay...');
  const rows = [];

  const html = await fetchHtml('https://www.bumeran.com.uy/empleos.html');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('[class*="posting"], [class*="job-card"], [class*="aviso"], article').each((_, el) => {
    const cargo   = $(el).find('h2, h3, [class*="title"], [class*="cargo"]').first().text().trim();
    const empresa = $(el).find('[class*="empresa"], [class*="company"], [class*="client"]').first().text().trim();
    const lugar   = $(el).find('[class*="location"], [class*="lugar"], [class*="ciudad"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || $(el).attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://www.bumeran.com.uy${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('bumeran_uy', 'UY',
      encodeURIComponent(href || cargo).slice(-60),
      cargo, empresa || null, lugar || null, null, link || 'https://www.bumeran.com.uy', null));
  });

  // Fallback links
  if (rows.length === 0) {
    $('a[href*="empleo"], a[href*="aviso"]').each((_, el) => {
      const cargo = $(el).text().trim();
      const href  = $(el).attr('href') || '';
      const link  = href.startsWith('http') ? href : `https://www.bumeran.com.uy${href}`;
      if (cargo.length < 5 || cargo.length > 100) return;
      rows.push(buildRow('bumeran_uy', 'UY',
        encodeURIComponent(href).slice(-60), cargo, null, null, null, link, null));
    });
  }

  const n = await upsert(rows, 'bumeran_uy');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── OPCIÓN EMPLEO URUGUAY ─────────────────────────────────────
async function scrapeOpcionEmpleoUY() {
  console.log('🇺🇾 Opción Empleo Uruguay...');
  const rows = [];

  const html = await fetchHtml('https://www.opcionempleo.com.uy/buscar.php');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('article, .job, .oferta, [class*="result"]').each((_, el) => {
    const cargo   = $(el).find('h2, h3, a').first().text().trim();
    const empresa = $(el).find('[class*="company"], [class*="empresa"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://www.opcionempleo.com.uy${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('opcionempleo_uy', 'UY',
      encodeURIComponent(href || cargo).slice(-60),
      cargo, empresa || null, 'Uruguay', null, link, null));
  });

  const n = await upsert(rows, 'opcionempleo_uy');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── GETONBOARD (tech / remoto) ────────────────────────────────
async function scrapeGetonboard() {
  console.log('💻 Getonboard (remoto/tech)...');
  const rows = [];

  const html = await fetchHtml('https://www.getonboard.com/vacancies?country=Uruguay&remote=true');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('[class*="vacancy"], [class*="job-card"], article').each((_, el) => {
    const cargo   = $(el).find('h2, h3, [class*="title"]').first().text().trim();
    const empresa = $(el).find('[class*="company"], [class*="organization"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://www.getonboard.com${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('getonboard', 'UY',
      encodeURIComponent(href || cargo).slice(-60),
      cargo, empresa || null, 'Remoto', null, link, null));
  });

  const n = await upsert(rows, 'getonboard');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── COMPUTRABAJO ARGENTINA ────────────────────────────────────
async function scrapeComputrabajoAR() {
  console.log('🇦🇷 Computrabajo Argentina...');
  const rows = [];

  const html = await fetchHtml('https://www.computrabajo.com.ar/trabajo');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('article[data-id], .box_oferta, [class*="oferta"]').each((_, el) => {
    const id      = $(el).attr('data-id') || '';
    const cargo   = $(el).find('h2, h3, .title_oferta').first().text().trim();
    const empresa = $(el).find('.nombre_empresa, [class*="empresa"]').first().text().trim();
    const lugar   = $(el).find('.ciudad, [class*="ciudad"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://www.computrabajo.com.ar${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('computrabajo_ar', 'AR',
      id || encodeURIComponent(cargo + empresa).slice(0, 60),
      cargo, empresa || null, lugar || null, null, link, null));
  });

  const n = await upsert(rows, 'computrabajo_ar');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── COMPUTRABAJO CHILE ────────────────────────────────────────
async function scrapeComputrabajoCL() {
  console.log('🇨🇱 Computrabajo Chile...');
  const rows = [];

  const html = await fetchHtml('https://www.computrabajo.cl/trabajo');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('article[data-id], .box_oferta, [class*="oferta"]').each((_, el) => {
    const id      = $(el).attr('data-id') || '';
    const cargo   = $(el).find('h2, h3, .title_oferta').first().text().trim();
    const empresa = $(el).find('.nombre_empresa, [class*="empresa"]').first().text().trim();
    const lugar   = $(el).find('.ciudad, [class*="ciudad"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://www.computrabajo.cl${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('computrabajo_cl', 'CL',
      id || encodeURIComponent(cargo + empresa).slice(0, 60),
      cargo, empresa || null, lugar || null, null, link, null));
  });

  const n = await upsert(rows, 'computrabajo_cl');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── COMPUTRABAJO COLOMBIA ─────────────────────────────────────
async function scrapeComputrabajoCO() {
  console.log('🇨🇴 Computrabajo Colombia...');
  const rows = [];

  const html = await fetchHtml('https://co.computrabajo.com/trabajo');
  if (!html) { console.log('  ⚠ inaccesible'); return 0; }

  const $ = cheerio.load(html);

  $('article[data-id], .box_oferta, [class*="oferta"]').each((_, el) => {
    const id      = $(el).attr('data-id') || '';
    const cargo   = $(el).find('h2, h3, .title_oferta').first().text().trim();
    const empresa = $(el).find('.nombre_empresa, [class*="empresa"]').first().text().trim();
    const lugar   = $(el).find('.ciudad, [class*="ciudad"]').first().text().trim();
    const href    = $(el).find('a').first().attr('href') || '';
    const link    = href.startsWith('http') ? href : `https://co.computrabajo.com${href}`;
    if (!cargo || cargo.length < 4) return;
    rows.push(buildRow('computrabajo_co', 'CO',
      id || encodeURIComponent(cargo + empresa).slice(0, 60),
      cargo, empresa || null, lugar || null, null, link, null));
  });

  const n = await upsert(rows, 'computrabajo_co');
  console.log(`  ✓ ${n} ofertas`);
  return n;
}

// ─── MAIN ──────────────────────────────────────────────────────
const SCRAPERS = {
  UY: [scrapeComputrabajoUY, scrapeBumeranUY, scrapeOpcionEmpleoUY, scrapeGetonboard],
  AR: [scrapeComputrabajoAR],
  CL: [scrapeComputrabajoCL],
  CO: [scrapeComputrabajoCO],
};

const aCorrer = PAIS_ARG && SCRAPERS[PAIS_ARG]
  ? { [PAIS_ARG]: SCRAPERS[PAIS_ARG] }
  : SCRAPERS;

console.log(`\n💼 Scraper Ofertas Privadas${TEST_MODE ? ' [TEST]' : ''} — ${new Date().toISOString()}\n`);

let total = 0;
for (const [pais, fns] of Object.entries(aCorrer)) {
  for (const fn of fns) {
    try { total += await fn(); }
    catch (e) { console.error(`  ❌ ${fn.name} falló:`, e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

console.log(`\n✅ Total: ${total} ofertas ${TEST_MODE ? 'encontradas (no guardadas)' : 'guardadas en Supabase'}\n`);
