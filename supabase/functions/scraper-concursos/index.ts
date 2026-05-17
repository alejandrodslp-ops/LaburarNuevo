import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0; concursos@nexu.uy)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-UY,es;q=0.9",
};

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
type ConcursoRow = {
  fuente_id: string; fuente: string; pais: string;
  numero_llamado: string | null; titulo: string; cargo: string | null;
  organismo: string | null; descripcion: string | null; requisitos: string | null;
  tipo_tarea: string | null; tipo_vinculo: string | null; lugar: string | null;
  fecha_inicio: string | null; fecha_cierre: string | null; puestos: number;
  url_detalle: string | null; url_postulacion: string | null;
  keywords: string[]; activo: boolean;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function extraerTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
}

function extraerItems(xml: string): string[] {
  const items: string[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

function normalizar(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function extraerKeywords(texto: string): string[] {
  const stopwords = new Set([
    "de","del","la","el","las","los","en","un","una","y","o","a","con","por",
    "para","al","se","no","es","que","sus","esta","este","lo","le","les",
    "como","más","su","ser","tiene","han","sido","esta","son","fue","hay",
  ]);
  const palabras = normalizar(texto).split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  return [...new Set(palabras)].slice(0, 15);
}

function parseFecha(str: string): string | null {
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Formato RFC: "Mon, 12 May 2026 10:00:00 -0300"
  const rfcDate = new Date(str);
  if (!isNaN(rfcDate.getTime())) return rfcDate.toISOString().slice(0, 10);
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#0047;/g, "/").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

async function fetchUrl(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// PARSER: Uruguay Concursa (RSS — confirmado funcionando)
// URL: https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.arssllamados?,ABIERTO
// ─────────────────────────────────────────────────────────────
async function scrapeUruguay(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const xml = await fetchUrl(
    "https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.arssllamados?,ABIERTO"
  );
  if (!xml || !xml.includes("<item>")) {
    return { rows, errores: ["UY: sin items en RSS"] };
  }

  const items = extraerItems(xml);

  for (const item of items.slice(0, 60)) {
    const titleRaw = extraerTag(item, "title");
    const link     = extraerTag(item, "link");
    const descHtml = extraerTag(item, "description");

    // ID desde el link: verllamadorss?41210
    const idMatch = link.match(/\?(\d+)$/);
    if (!idMatch) continue;
    const fuente_id = idMatch[1];

    // Parsear título: "Llamado Nº A0018/2026 - Cargo - Organismo"
    const titleClean = titleRaw.replace(/^Llamado\s+N[ºo°]\s*/i, "").trim();
    const parts = titleClean.split(" - ");
    const numero_llamado = parts[0]?.trim() || null;
    const cargo = parts[1]?.trim() || titleClean;
    const organismo = parts.slice(2).join(" - ").trim() || null;

    // Parsear descripción HTML (tabla con período, lugar, organismo)
    const descText = stripHtml(descHtml);
    const periodoMatch = descText.match(/(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/);
    const puestosMatch = descText.match(/(\d+)\s+[Pp]uesto/);
    const lugarMatch  = descHtml.match(/<span[^>]*>Lugar de desempe[ñn]o:?<\/span>[^<]*<\/td>[^<]*<td[^>]*>&nbsp;<\/td>[^<]*<td[^>]*><span[^>]*>([^<]+)<\/span>/i)
      || descHtml.match(/desempe[ñn]o[^<]*<\/td>[^<]*<td[^>]*>&nbsp;<\/td>[^<]*<td[^>]*><span[^>]*>([^<]+)/i);
    const lugar = lugarMatch ? lugarMatch[1].trim() : (() => {
      const idx = descText.indexOf("Lugar de desempeño:");
      if (idx === -1) return null;
      return descText.slice(idx + 19, idx + 80).split(/\s{2,}/)[0]?.trim() || null;
    })();

    // Obtener detalles de la página individual del llamado
    let descripcion: string | null = null;
    let requisitos:  string | null = null;
    let tipo_tarea:   string | null = null;
    let tipo_vinculo: string | null = null;
    let url_postulacion: string | null = null;

    const detalleHtml = await fetchUrl(
      `https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.verllamado?${fuente_id}`,
      8000
    );
    if (detalleHtml) {
      const dt = stripHtml(detalleHtml);
      descripcion  = dt.match(/Descripci[oó]n de Funci[oó]n:\s*(.{20,800}?)(?:Requisitos|Lugar de Recepci|Tipo de Tarea)/is)?.[1]?.trim() || null;
      requisitos   = dt.match(/Requisitos Espec[ií]ficos:\s*(.{10,800}?)(?:Lugar de Recepci|Organismo|Comentario|Tipo de)/is)?.[1]?.trim() || null;
      tipo_tarea   = dt.match(/Tipo de Tarea:\s*([^\n\r]{2,60})/i)?.[1]?.trim() || null;
      tipo_vinculo = dt.match(/Tipo de V[ií]nculo:\s*([^\n\r]{2,60})/i)?.[1]?.trim() || null;
      url_postulacion = detalleHtml.match(/href="(https?:\/\/[^"]*(?:postul|comprasestatales|uruguay\.gub)[^"]*)"/)
        ?.[1] || null;
    }

    const keywords = extraerKeywords(`${cargo} ${descripcion || ""} ${requisitos || ""}`);

    rows.push({
      fuente_id, fuente: "uruguay_concursa", pais: "UY",
      numero_llamado, titulo: titleClean, cargo, organismo,
      descripcion, requisitos, tipo_tarea, tipo_vinculo,
      lugar: lugar || null,
      fecha_inicio: periodoMatch ? parseFecha(periodoMatch[1]) : null,
      fecha_cierre: periodoMatch ? parseFecha(periodoMatch[2]) : null,
      puestos: puestosMatch ? parseInt(puestosMatch[1]) : 1,
      url_detalle: `https://www.uruguayconcursa.gub.uy/Portal/servlet/com.si.recsel.verllamado?${fuente_id}`,
      url_postulacion,
      keywords, activo: true,
    });
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// HELPER: Indeed RSS — accesible desde servidores cloud
// Indeed tiene RSS públicos por país con resultados reales de empleo
// ─────────────────────────────────────────────────────────────
async function scrapeIndeed(
  subdominio: string, query: string, pais: string, fuente: string, lugar?: string
): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  const q = encodeURIComponent(query);
  const l = lugar ? `&l=${encodeURIComponent(lugar)}` : "";
  // Probar primero el feed estándar de Indeed
  const urls = [
    `https://${subdominio}.indeed.com/rss?q=${q}${l}&sort=date`,
    `https://rss.indeed.com/rss?q=${q}&l=${encodeURIComponent(lugar || pais)}&sort=date`,
  ];

  for (const url of urls) {
    const xml = await fetchUrl(url, 10000);
    if (!xml || !xml.includes("<item>")) continue;

    for (const item of extraerItems(xml).slice(0, 30)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const guid    = extraerTag(item, "guid");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;

      const fuente_id = (guid || link).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      const parts = titulo.split(" - ");
      const cargo = parts[0]?.trim() || titulo;
      const organismo = parts.length > 1 ? parts[parts.length - 1].trim() : null;

      rows.push({
        fuente_id, fuente, pais,
        numero_llamado: null, titulo, cargo, organismo,
        descripcion: desc.slice(0, 600), requisitos: null,
        tipo_tarea: null, tipo_vinculo: null, lugar: lugar || null,
        fecha_inicio: null, fecha_cierre: parseFecha(pubDate), puestos: 1,
        url_detalle: link || null, url_postulacion: link || null,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) break;
    errores.push(`${pais}: Indeed ${url} sin items`);
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// HELPER: Google News RSS — siempre accesible desde cualquier región
// Retorna noticias de concursos/convocatorias para el país dado
// ─────────────────────────────────────────────────────────────
async function scrapeGoogleNews(
  locale: string, query: string, fuente: string, paisRow?: string, ceidLang = "es"
): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];
  const pais = paisRow ?? locale;

  const langMap: Record<string, string> = {
    AR: "es-AR", CL: "es-CL", CO: "es-CO", PE: "es-PE",
    BO: "es-BO", EC: "es-EC", MX: "es-MX", CR: "es-CR",
    GT: "es-GT", SV: "es-SV", PA: "es-PA",
    ES: "es-ES", PT: "pt-PT", IT: "it", FR: "fr",
    DE: "de", GB: "en-GB", CA: "en-CA", AU: "en-AU",
    US: "es-419",
  };
  const hl = langMap[locale] ?? "es-419";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${locale}&ceid=${locale}:${ceidLang}`;

  const xml = await fetchUrl(rssUrl, 14000);
  if (!xml || !xml.includes("<item>")) {
    errores.push(`${pais}: Google News RSS sin items`);
    return { rows, errores };
  }

  const items = extraerItems(xml);
  for (const item of items.slice(0, 35)) {
    const titulo  = extraerTag(item, "title");
    const link    = extraerTag(item, "link");
    const guid    = extraerTag(item, "guid");
    const desc    = stripHtml(extraerTag(item, "description"));
    const pubDate = extraerTag(item, "pubDate");
    if (!titulo || titulo.length < 6) continue;

    // Use guid as fuente_id (stable across re-runs)
    const fuente_id = (guid || link).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
    if (rows.some(r => r.fuente_id === fuente_id)) continue;

    const href = link.startsWith("http") ? link : null;
    rows.push({
      fuente_id, fuente, pais,
      numero_llamado: null, titulo, cargo: titulo, organismo: null,
      descripcion: desc.slice(0, 600), requisitos: null,
      tipo_tarea: null, tipo_vinculo: null, lugar: null,
      fecha_inicio: null, fecha_cierre: null, puestos: 1,
      url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo + " " + desc), activo: true,
    });
  }

  if (rows.length === 0) errores.push(`${pais}: Google News accesible pero sin ítems`);
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// HELPER: parsea páginas de listado de computrabajo.com
// Funciona para todos los subdomínios de LatAm
// ─────────────────────────────────────────────────────────────
function parseComputrabajo(
  html: string, pais: string, fuente: string, baseUrl: string, rows: ConcursoRow[]
): void {
  // Método 1: artículos de oferta (estructura principal de computrabajo)
  const artRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = artRe.exec(html)) !== null && rows.length < 60) {
    const block = m[1];
    if (!block.includes("/empleo/")) continue;

    const linkM = block.match(/href="(\/empleo\/[^"#?]+)"/i);
    if (!linkM) continue;

    // Título: primero del atributo title=, luego del texto del link
    const titleM = block.match(/title="([^"]{5,100})"/)
      || block.match(/<a[^>]+href="\/empleo\/[^"]*"[^>]*>([^<]{5,100})<\/a>/i);
    const titulo = titleM ? stripHtml(titleM[1]).trim() : "";
    if (titulo.length < 5) continue;

    const compM  = block.match(/href="\/empresa[^"]*"[^>]*>([^<]{3,80})<\/a>/i);
    const cityM  = block.match(/href="\/(?:trabajos|empleos)-en-[^"]*"[^>]*>([^<]{3,50})<\/a>/i);
    const href   = `${baseUrl}${linkM[1]}`;
    const fuente_id = linkM[1].replace(/\W/g, "_").slice(-50);
    if (rows.some(r => r.fuente_id === fuente_id)) continue;

    rows.push({
      fuente_id, fuente, pais,
      numero_llamado: null, titulo, cargo: titulo,
      organismo: compM ? compM[1].trim() : null,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: cityM ? cityM[1].trim() : null,
      fecha_inicio: null, fecha_cierre: null, puestos: 1,
      url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo), activo: true,
    });
  }

  // Método 2: cualquier link /empleo/ si el método 1 no encontró nada
  if (rows.length === 0) {
    const re2 = /href="(\/empleo\/[^"#?]+)"[^>]*(?:title="([^"]{5,100})"|>([^<]{5,100})<\/a>)/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(html)) !== null && rows.length < 50) {
      const titulo = stripHtml(m2[2] || m2[3] || "").trim();
      if (titulo.length < 5) continue;
      const href = `${baseUrl}${m2[1]}`;
      const fuente_id = m2[1].replace(/\W/g, "_").slice(-50);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente, pais,
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }
}

// Scraper genérico para cualquier país en computrabajo.com
async function scrapeComputrabajo(
  subdomain: string, pais: string, fuente: string
): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];
  const base = `https://${subdomain}.computrabajo.com`;

  // Intentar: sector gobierno → administración pública → todos los trabajos recientes
  const paths = [
    "/trabajo-de-gobierno",
    "/trabajo-de-administracion-publica",
    "/trabajos?q=concurso+publico&orden=fecha",
    "/trabajos?orden=fecha",
  ];

  for (const path of paths) {
    const html = await fetchUrl(`${base}${path}`, 15000);
    if (!html) { errores.push(`${pais}: ${base}${path} sin respuesta`); continue; }
    parseComputrabajo(html, pais, fuente, base, rows);
    if (rows.length > 0) break;
    errores.push(`${pais}: ${base}${path} accesible pero sin ítems parseables`);
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Argentina
// 1. Boletín Oficial RSS (sección Personal del Estado) — siempre accesible
// 2. computrabajo.ar como respaldo comercial
// ─────────────────────────────────────────────────────────────
async function scrapeArgentina(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // ── 1. Boletín Oficial sección 2 (Personal del Estado) ───────────────────
  // Acepta TODOS los ítems de la sección — ya es solo empleo público
  for (const rssUrl of [
    "https://www.boletinoficial.gob.ar/rss/seccion/2",
    "https://www.boletinoficial.gob.ar/rss/2",
  ]) {
    const xml = await fetchUrl(rssUrl, 12000);
    if (!xml || !xml.includes("<item>")) { errores.push(`AR: RSS ${rssUrl} vacío`); continue; }
    for (const item of extraerItems(xml).slice(0, 50)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const href = link.startsWith("http") ? link : `https://www.boletinoficial.gob.ar${link}`;
      const fuente_id = link.split("/").filter(Boolean).pop()?.replace(/\W/g, "") || titulo.slice(0, 30).replace(/\s/g, "_");
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "argentina_boletin_oficial", pais: "AR",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push(`AR: ${rssUrl} accesible pero sin ítems`);
    break;
  }

  // ── 2. Google News — siempre accesible ───────────────────────────────────
  const gn = await scrapeGoogleNews("AR", "concurso público Argentina convocatoria empleo postulación", "argentina_googlenews");
  if (gn.rows.length > 0) return { rows: gn.rows, errores: [...errores, ...gn.errores] };
  errores.push(...gn.errores);

  if (rows.length === 0) errores.push("AR: todas las fuentes sin datos");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Chile — Indeed + Servicio Civil RSS fallback
// ─────────────────────────────────────────────────────────────
async function scrapeChile(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("cl", "empleo gobierno concurso público", "CL", "chile_indeed", "Chile");
  if (ind.rows.length > 0) return ind;

  // Fallback: Servicio Civil Chile HTML simple
  const errores = [...ind.errores];
  const rows: ConcursoRow[] = [];
  const html = await fetchUrl("https://www.serviciocivil.cl/concursos/publicados/", 12000);
  if (html && html.includes("concurso")) {
    const re = /href="(\/concurso[^"]+)"[^>]*>([^<]{5,120})</gi;
    let m;
    while ((m = re.exec(html)) !== null && rows.length < 30) {
      const titulo = stripHtml(m[2]).trim();
      if (titulo.length < 5) continue;
      const href = `https://www.serviciocivil.cl${m[1]}`;
      const fuente_id = m[1].replace(/\W/g, "_").slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "chile_serviciocivil", pais: "CL",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }
  if (rows.length > 0) return { rows, errores };
  errores.push("CL: todas las fuentes sin datos");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Colombia — Indeed + CNSC fallback
// ─────────────────────────────────────────────────────────────
async function scrapeColombia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("co", "empleo público convocatoria concurso", "CO", "colombia_indeed", "Colombia");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("CO", "concurso méritos Colombia convocatoria CNSC empleo", "colombia_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Brasil — pciconcursos.com.br
// Estructura real: divs .cd (cargo+vagas) y .ce (fecha cierre)
// agrupados bajo h2 con nombre del estado/región
// ─────────────────────────────────────────────────────────────
async function scrapeBrasil(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const html = await fetchUrl("https://www.pciconcursos.com.br/concursos/", 15000);
  if (!html) {
    errores.push("BR: pciconcursos.com.br inaccesible");
    return { rows, errores };
  }

  // Extraer bloques: cada concurso tiene un .cd con info y .ce con fecha
  // La estructura es: <div class="cd">CARGO<br><span>Organismo<br>...</span></div><div class="ce"><span>DD/MM/YYYY</span></div>
  // Antes hay un h2 o .uf con el estado
  let estadoActual = "Nacional";

  // Dividir el HTML en secciones por estado (h2)
  const seccionRe = /<h2>([^<]+)<\/h2>([\s\S]*?)(?=<h2>|$)/gi;
  let seccion;
  while ((seccion = seccionRe.exec(html)) !== null && rows.length < 80) {
    estadoActual = seccion[1].trim();
    const bloque = seccion[2];

    // Dentro de cada sección, extraer pares .cd + .ce
    const cdRe = /<div class="cd">([\s\S]*?)<\/div>\s*<div class="ce"><span>([^<]*)<\/span>/gi;
    let m;
    while ((m = cdRe.exec(bloque)) !== null) {
      const cdText = stripHtml(m[1]);
      const fechaStr = m[2].trim();

      // Parsear texto del .cd: "X vagas\nCargo1, Cargo2\nNível"
      const lines = cdText.split(/\n|<br>/).map(l => l.trim()).filter(Boolean);
      const vagasLine = lines.find(l => /vaga/i.test(l)) || "";
      const cargoLine = lines.find(l => !/vaga|ensino|superior|médio|técnico|fundamental/i.test(l) && l.length > 3) || lines[0] || "Concurso";
      const vagasMatch = vagasLine.match(/(\d+)\s+vaga/i);
      const puestos = vagasMatch ? parseInt(vagasMatch[1]) : 1;

      const titulo = `${cargoLine} — ${estadoActual}`;
      const fuente_id = `${estadoActual}_${cargoLine}_${fechaStr}`.replace(/\W/g, "_").slice(0, 60);

      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id,
        fuente: "brasil_pciconcursos", pais: "BR",
        numero_llamado: null, titulo, cargo: cargoLine, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: estadoActual, fecha_inicio: null,
        fecha_cierre: parseFecha(fechaStr),
        puestos,
        url_detalle: "https://www.pciconcursos.com.br/concursos/",
        url_postulacion: "https://www.pciconcursos.com.br/concursos/",
        keywords: extraerKeywords(cargoLine), activo: true,
      });
    }
  }

  if (rows.length === 0) errores.push("BR: sin resultados parseables en pciconcursos.com.br");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Perú — Indeed + SERVIR fallback
// ─────────────────────────────────────────────────────────────
async function scrapePerú(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("pe", "empleo público concurso CAS SERVIR", "PE", "peru_indeed", "Peru");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("PE", "concurso público Perú plaza vacante CAS SERVIR", "peru_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Paraguay — Indeed (ar con filtro) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeParaguay(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("ar", "empleo Paraguay convocatoria trabajo", "PY", "paraguay_indeed", "Paraguay");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Paraguay empleo convocatoria cargo público vacante", "paraguay_googlenews", "PY");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Bolivia — Indeed (ar con filtro) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeBolivia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("ar", "empleo Bolivia convocatoria trabajo público", "BO", "bolivia_indeed", "Bolivia");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("BO", "Bolivia empleo convocatoria cargo público vacante", "bolivia_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Ecuador — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeEcuador(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("ec", "empleo público convocatoria concurso gobierno", "EC", "ecuador_indeed", "Ecuador");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("EC", "Ecuador empleo convocatoria cargo público vacante", "ecuador_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: México — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeMexico(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("mx", "empleo gobierno convocatoria vacante plaza", "MX", "mexico_indeed", "Mexico");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("MX", "convocatoria empleo México vacante gobierno plaza concurso", "mexico_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Venezuela — Indeed (co/cl con filtro) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeVenezuela(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  // Venezuela tiene acceso limitado a Indeed; usar co.indeed.com con filtro geográfico
  const ind = await scrapeIndeed("co", "empleo Venezuela trabajo vacante", "VE", "venezuela_indeed", "Venezuela");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Venezuela empleo vacante convocatoria trabajo cargo", "venezuela_googlenews", "VE");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Costa Rica — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapCostaRica(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("cr", "empleo gobierno servicio civil convocatoria", "CR", "costarica_indeed", "Costa Rica");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("CR", "Costa Rica empleo convocatoria concurso servicio civil cargo público", "costarica_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Guatemala — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeGuatemala(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("gt", "empleo público convocatoria gobierno trabajo", "GT", "guatemala_indeed", "Guatemala");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("GT", "Guatemala empleo convocatoria cargo público vacante plaza", "guatemala_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: El Salvador — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeElSalvador(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("sv", "empleo público convocatoria gobierno trabajo", "SV", "elsalvador_indeed", "El Salvador");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "\"El Salvador\" empleo vacante trabajo convocatoria cargo", "elsalvador_googlenews", "SV");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Honduras — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeHonduras(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("hn", "empleo público convocatoria gobierno trabajo", "HN", "honduras_indeed", "Honduras");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Honduras empleo vacante trabajo convocatoria cargo", "honduras_googlenews", "HN");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Nicaragua — Indeed (cr/sv con filtro) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeNicaragua(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("cr", "empleo Nicaragua trabajo convocatoria vacante", "NI", "nicaragua_indeed", "Nicaragua");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Nicaragua empleo vacante trabajo convocatoria cargo", "nicaragua_googlenews", "NI");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Panamá — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scraperPanama(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("pa", "empleo gobierno público convocatoria trabajo", "PA", "panama_indeed", "Panama");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Panamá empleo vacante trabajo convocatoria cargo público", "panama_googlenews", "PA");
}

// ─────────────────────────────────────────────────────────────
// PARSER: República Dominicana — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeRepDominicana(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("ar", "empleo República Dominicana trabajo convocatoria", "DO", "dominicana_indeed", "Republica Dominicana");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "\"República Dominicana\" empleo vacante trabajo convocatoria", "dominicana_googlenews", "DO");
}

// ─────────────────────────────────────────────────────────────
// PARSER: España — BOE (Boletín Oficial del Estado) + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeEspana(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // BOE RSS — sección de empleo público / oposiciones
  const boeUrl = "https://www.boe.es/rss/canal.php?c=11";
  const xml = await fetchUrl(boeUrl, 12000);
  if (xml && xml.includes("<item>")) {
    for (const item of extraerItems(xml).slice(0, 50)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const href = link.startsWith("http") ? link : `https://www.boe.es${link}`;
      const fuente_id = link.split("/").filter(Boolean).pop()?.replace(/\W/g,"") || titulo.slice(0,30).replace(/\s/g,"_");
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "espana_boe", pais: "ES",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("ES: BOE RSS accesible pero sin ítems parseables");
  } else {
    errores.push("ES: BOE RSS inaccesible");
  }

  // Google News como respaldo
  const gn = await scrapeGoogleNews("ES",
    "oposición convocatoria empleo público España administración cargo vacante selección",
    "espana_googlenews");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Portugal — BEP (IEFP) + Indeed PT fallback
// ─────────────────────────────────────────────────────────────
async function scrapePortugal(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  // BEP — Bolsa de Emprego Público (portal oficial Portugal)
  const bepUrl = "https://www.bep.gov.pt/offerta/index.phtml?lang=pt&area=2&action=search";
  const html = await fetchUrl(bepUrl, 12000);
  if (html && (html.includes("offerta") || html.includes("emprego"))) {
    const re = /href="([^"]*offerta[^"]*)"[^>]*>([^<]{5,120})</gi;
    let m;
    while ((m = re.exec(html)) !== null && rows.length < 30) {
      const titulo = stripHtml(m[2]).trim();
      if (titulo.length < 5) continue;
      const href = m[1].startsWith("http") ? m[1] : `https://www.bep.gov.pt${m[1]}`;
      const fuente_id = m[1].replace(/\W/g, "_").slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "portugal_bep", pais: "PT",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("PT: BEP accesible pero sin ítems parseables");
  } else {
    errores.push("PT: BEP inaccesible");
  }

  // Fallback: Indeed PT
  const ind = await scrapeIndeed("pt", "emprego público concurso administração governo", "PT", "portugal_indeed", "Portugal");
  if (ind.rows.length > 0) return { rows: ind.rows, errores: [...errores, ...ind.errores] };

  const gn = await scrapeGoogleNews("PT",
    "concurso público Portugal emprego trabalho administração recrutamento",
    "portugal_googlenews", undefined, "pt");
  return { rows: gn.rows, errores: [...errores, ...ind.errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Italia — InPA API (portal oficial) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeItalia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  // InPA — portale nazionale del reclutamento della PA
  try {
    const res = await fetch(
      "https://www.inpa.gov.it/bandi/api/v1/bandi/?page=1&page_size=40&is_closed=false",
      {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)" },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const bandi: Record<string, unknown>[] = (data.results ?? data.bandi ?? data ?? []) as Record<string, unknown>[];
      for (const b of bandi.slice(0, 40)) {
        const titulo     = (b.titolo ?? b.denominazione ?? b.title ?? "") as string;
        const organismo  = (b.ente ?? b.amministrazione ?? "") as string;
        const id         = (b.id ?? b.codice ?? b.slug ?? "") as string | number;
        const scadenza   = (b.data_scadenza ?? b.scadenza ?? b.closing_date ?? "") as string;

        if (!titulo || titulo.length < 4) continue;
        const fuente_id = String(id).replace(/\W/g, "").slice(-48) || titulo.replace(/\W/g, "").slice(0, 48);
        if (rows.some(r => r.fuente_id === fuente_id)) continue;

        rows.push({
          fuente_id, fuente: "italia_inpa", pais: "IT",
          numero_llamado: String(id) || null,
          titulo: organismo ? `${titulo} — ${organismo}` : titulo,
          cargo: titulo, organismo: organismo || null,
          descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
          lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(scadenza), puestos: 1,
          url_detalle: `https://www.inpa.gov.it/bandi/${id}/`,
          url_postulacion: `https://www.inpa.gov.it/bandi/${id}/`,
          keywords: extraerKeywords(titulo + " " + organismo), activo: true,
        });
      }
    } else {
      errores.push(`IT: InPA API status ${res.status}`);
    }
  } catch (e) {
    errores.push(`IT: InPA API error — ${(e as Error).message}`);
  }

  if (rows.length > 0) return { rows, errores };

  // Fallback: Google News IT
  const gn = await scrapeGoogleNews("IT",
    "concorso pubblico Italia lavoro assunzione bando selezione amministrazione",
    "italia_googlenews", undefined, "it");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Cuba — Indeed (co con filtro) + Google News fallback
// (Indeed no opera directamente en Cuba)
// ─────────────────────────────────────────────────────────────
async function scrapeCuba(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ind = await scrapeIndeed("co", "empleo Cuba trabajo convocatoria vacante", "CU", "cuba_indeed", "Cuba");
  if (ind.rows.length > 0) return ind;
  return scrapeGoogleNews("US", "Cuba empleo convocatoria trabajo cargo vacante oportunidad laboral", "cuba_googlenews", "CU");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Alemania — API pública de Bundesagentur für Arbeit
// (API oficial, gratuita, sin clave de pago, sólo X-API-Key pública)
// ─────────────────────────────────────────────────────────────
async function scrapeAlemania(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  try {
    const res = await fetch(
      "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?angebotsart=1&page=0&size=50",
      {
        headers: {
          "X-API-Key": "jobboerse-jobsuche",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)",
        },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const jobs: Record<string, unknown>[] = (data.stellenangebote ?? data.jobs ?? []) as Record<string, unknown>[];
      for (const job of jobs.slice(0, 50)) {
        const titel       = (job.titel ?? job.beruf ?? "") as string;
        const arbeitgeber = (job.arbeitgeber ?? "") as string;
        const refnr       = (job.refnr ?? job.hashId ?? "") as string;
        const orte        = job.arbeitsorte as { ort?: string }[] | undefined;
        const ort         = orte?.[0]?.ort ?? (job.ort as string | undefined) ?? null;
        const eintr       = (job.eintrittsdatum ?? "") as string;

        if (!titel || titel.length < 3) continue;
        const fuente_id = String(refnr).replace(/\W/g, "").slice(-48) || (titel + arbeitgeber).replace(/\W/g, "").slice(0, 48);
        if (rows.some(r => r.fuente_id === fuente_id)) continue;

        const detailUrl = refnr
          ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`
          : null;

        rows.push({
          fuente_id, fuente: "alemania_bundesagentur", pais: "DE",
          numero_llamado: refnr || null,
          titulo: arbeitgeber ? `${titel} — ${arbeitgeber}` : titel,
          cargo: titel, organismo: arbeitgeber || null,
          descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
          lugar: ort, fecha_inicio: parseFecha(eintr), fecha_cierre: null, puestos: 1,
          url_detalle: detailUrl, url_postulacion: detailUrl,
          keywords: extraerKeywords(titel + " " + arbeitgeber), activo: true,
        });
      }
    } else {
      errores.push(`DE: Bundesagentur API status ${res.status}`);
    }
  } catch (e) {
    errores.push(`DE: Bundesagentur API error — ${(e as Error).message}`);
  }

  if (rows.length > 0) return { rows, errores };

  // Fallback: Google News DE
  const gn = await scrapeGoogleNews("DE",
    "Stellenausschreibung öffentlicher Dienst Deutschland Stelle Bewerbung",
    "alemania_googlenews", undefined, "de");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Reino Unido — Civil Service Jobs + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeReinoUnido(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // Civil Service Jobs RSS
  const csUrl = "https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?pageaction=searchbykey&key=jobs_rss&action=searchbykey";
  const xml = await fetchUrl(csUrl, 12000);
  if (xml && xml.includes("<item>")) {
    for (const item of extraerItems(xml).slice(0, 50)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const fuente_id = link.replace(/\W/g,"").slice(-48) || titulo.slice(0,30).replace(/\s/g,"_");
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "uk_civilservice", pais: "GB",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: link || null, url_postulacion: link || null,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("GB: Civil Service RSS accesible pero sin ítems");
  } else {
    errores.push("GB: Civil Service RSS inaccesible");
  }

  const gn = await scrapeGoogleNews("GB",
    "UK civil service government jobs vacancy recruitment hiring public sector",
    "uk_googlenews", undefined, "en");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Estados Unidos — USAJobs RSS + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeEstadosUnidos(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // USAJobs RSS feed
  const usaUrl = "https://www.usajobs.gov/Search/Results?format=rss";
  const xml = await fetchUrl(usaUrl, 12000);
  if (xml && xml.includes("<item>")) {
    for (const item of extraerItems(xml).slice(0, 50)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const fuente_id = link.replace(/\W/g,"").slice(-48) || titulo.slice(0,30).replace(/\s/g,"_");
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "usa_usajobs", pais: "US",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: link || null, url_postulacion: link || null,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("US: USAJobs RSS accesible pero sin ítems");
  } else {
    errores.push("US: USAJobs RSS inaccesible");
  }

  const gn = await scrapeGoogleNews("US",
    "USA federal government jobs vacancy hiring civil service USAJobs",
    "usa_googlenews", "US", "en");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Canadá — GC Jobs RSS + Job Bank + Indeed CA fallback
// ─────────────────────────────────────────────────────────────
async function scrapeCanada(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  // PSC — Public Service Commission of Canada (RSS oficial de gobierno)
  const pscUrl = "https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.htm?poster=1&psrsection=sch&lang=english&action=searchbykey&key=jobs_rss";
  const xml = await fetchUrl(pscUrl, 12000);
  if (xml && xml.includes("<item>")) {
    for (const item of extraerItems(xml).slice(0, 40)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const fuente_id = link.replace(/\W/g, "").slice(-48) || titulo.slice(0, 30).replace(/\s/g, "_");
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "canada_gc_jobs", pais: "CA",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: link || null, url_postulacion: link || null,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("CA: PSC RSS accesible pero sin ítems");
  } else {
    errores.push("CA: PSC RSS inaccesible");
  }

  // Fallback: Indeed CA
  const ind = await scrapeIndeed("ca", "government jobs federal public service", "CA", "canada_indeed", "Canada");
  if (ind.rows.length > 0) return { rows: ind.rows, errores: [...errores, ...ind.errores] };

  const gn = await scrapeGoogleNews("CA",
    "Canada government jobs federal hiring vacancy public service GC Jobs",
    "canada_googlenews", undefined, "en");
  return { rows: gn.rows, errores: [...errores, ...ind.errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Australia — APSJobs RSS + Indeed AU fallback
// ─────────────────────────────────────────────────────────────
async function scrapeAustralia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const rows: ConcursoRow[] = [];
  const errores: string[] = [];

  // APSJobs — portal oficial empleos federales australianos
  const apsUrl = "https://www.apsjobs.gov.au/s/global-search/services/search/global?keyword=&category=&location=&sort=Date&page=1";
  const res = await fetch(apsUrl, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)" },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);

  if (res?.ok) {
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    const jobs: Record<string, unknown>[] = (data.results ?? data.jobs ?? []) as Record<string, unknown>[];
    for (const job of jobs.slice(0, 40)) {
      const titulo = (job.title ?? job.jobTitle ?? "") as string;
      const agency = (job.agency ?? job.organisation ?? "") as string;
      const id     = (job.id ?? job.vacancyId ?? job.slug ?? "") as string | number;
      const close  = (job.closingDate ?? job.closing_date ?? "") as string;

      if (!titulo || titulo.length < 4) continue;
      const fuente_id = String(id).replace(/\W/g, "").slice(-48) || titulo.replace(/\W/g, "").slice(0, 48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id, fuente: "australia_apsjobs", pais: "AU",
        numero_llamado: String(id) || null,
        titulo: agency ? `${titulo} — ${agency}` : titulo,
        cargo: titulo, organismo: agency || null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: "Australia", fecha_inicio: null, fecha_cierre: parseFecha(close), puestos: 1,
        url_detalle: `https://www.apsjobs.gov.au/s/job-detail?Id=${id}`,
        url_postulacion: `https://www.apsjobs.gov.au/s/job-detail?Id=${id}`,
        keywords: extraerKeywords(titulo + " " + agency), activo: true,
      });
    }
  } else {
    errores.push("AU: APSJobs API inaccesible");
  }

  if (rows.length > 0) return { rows, errores };

  // Fallback: Indeed AU
  const ind = await scrapeIndeed("au", "government jobs public service APS federal", "AU", "australia_indeed", "Australia");
  if (ind.rows.length > 0) return { rows: ind.rows, errores: [...errores, ...ind.errores] };

  const gn = await scrapeGoogleNews("AU",
    "Australia government jobs APS hiring vacancy public service recruitment",
    "australia_googlenews", undefined, "en");
  return { rows: gn.rows, errores: [...errores, ...ind.errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Francia — Place de l'Emploi Public + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeFrancia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // Place de l'Emploi Public RSS oficial
  const pepUrl = "https://place-emploi-public.gouv.fr/flux/rss/";
  const xml = await fetchUrl(pepUrl, 12000);
  if (xml && xml.includes("<item>")) {
    for (const item of extraerItems(xml).slice(0, 50)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const desc    = stripHtml(extraerTag(item, "description"));
      const pubDate = extraerTag(item, "pubDate");
      if (!titulo || titulo.length < 5) continue;
      const href = link.startsWith("http") ? link : null;
      const fuente_id = (href || titulo).replace(/\W/g,"").slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente: "francia_place_emploi", pais: "FR",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
        puestos: 1, url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("FR: RSS Place de l'Emploi Public accesible pero sin ítems");
  } else {
    errores.push("FR: RSS Place de l'Emploi Public inaccesible");
  }

  // Google News como respaldo
  const gn = await scrapeGoogleNews("FR",
    "concours fonction publique France emploi recrutement poste administration",
    "francia_googlenews", undefined, "fr");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// SCRAPER PRINCIPAL — upsert a Supabase
// ─────────────────────────────────────────────────────────────
async function upsertRows(rows: ConcursoRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("concursos")
    .upsert(rows, { onConflict: "fuente,fuente_id", ignoreDuplicates: false });
  if (error) console.error("upsert error:", error.message);
  return error ? 0 : rows.length;
}

async function marcarVencidos(fuente: string) {
  const hoy = new Date().toISOString().slice(0, 10);
  await supabase.from("concursos").update({ activo: false })
    .eq("fuente", fuente).lt("fecha_cierre", hoy);
}

// ─────────────────────────────────────────────────────────────
// HTTP HANDLER
// POST /scraper-concursos            — scrape todos los países
// POST /scraper-concursos {pais:"UY"} — solo ese país
// GET  /scraper-concursos?test=UY    — test sin guardar en DB
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url   = new URL(req.url);
    const body  = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const soloPais: string | null = body.pais || url.searchParams.get("pais") || null;
    const modoTest = url.searchParams.has("test");

    // Mapa de scrapers por país
    const SCRAPERS: Record<string, () => Promise<{ rows: ConcursoRow[]; errores: string[] }>> = {
      // Sudamérica
      UY: scrapeUruguay,
      AR: scrapeArgentina,
      CL: scrapeChile,
      CO: scrapeColombia,
      BR: scrapeBrasil,
      PE: scrapePerú,
      PY: scrapeParaguay,
      BO: scrapeBolivia,
      EC: scrapeEcuador,
      MX: scrapeMexico,
      VE: scrapeVenezuela,
      // Centroamérica y Caribe
      CU: scrapeCuba,
      CR: scrapCostaRica,
      GT: scrapeGuatemala,
      SV: scrapeElSalvador,
      HN: scrapeHonduras,
      NI: scrapeNicaragua,
      PA: scraperPanama,
      DO: scrapeRepDominicana,
      // Europa
      ES: scrapeEspana,
      PT: scrapePortugal,
      IT: scrapeItalia,
      FR: scrapeFrancia,
      DE: scrapeAlemania,
      GB: scrapeReinoUnido,
      // Anglosajones
      US: scrapeEstadosUnidos,
      CA: scrapeCanada,
      AU: scrapeAustralia,
    };

    const paises = soloPais
      ? [soloPais.toUpperCase()].filter(p => SCRAPERS[p])
      : Object.keys(SCRAPERS);

    const resumen: Record<string, unknown> = {};
    let total_insertados = 0;

    // Procesar en lotes de 6 en paralelo para no agotar el timeout de Edge Functions
    const BATCH = 6;
    for (let i = 0; i < paises.length; i += BATCH) {
      const lote = paises.slice(i, i + BATCH);
      const resultados = await Promise.allSettled(
        lote.map(async pais => {
          console.log(`Scrapeando ${pais}...`);
          const { rows, errores } = await SCRAPERS[pais]();
          return { pais, rows, errores };
        })
      );

      for (const r of resultados) {
        if (r.status === "rejected") continue;
        const { pais, rows, errores } = r.value;

        if (modoTest) {
          resumen[pais] = { rows_sample: rows.slice(0, 3), total: rows.length, errores };
        } else {
          const insertados = await upsertRows(rows);
          total_insertados += insertados;
          resumen[pais] = { insertados, total_scrapeados: rows.length, errores };
          if (rows.length > 0) await marcarVencidos(rows[0].fuente);
        }
      }
    }

    // Disparar matching para todos los workers activos
    if (!modoTest) {
      supabase.functions.invoke("match-concursos", { body: { todos: true } }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, total_insertados, paises_procesados: paises.length, resumen }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
