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
// PARSER: Argentina — HTML scraping de concursar.renapra.gob.ar
// Sistema nacional de ingreso por concurso
// ─────────────────────────────────────────────────────────────
async function scrapeArgentina(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // Intentar el sistema RENAPRA (Sistema Nacional de Empleo Público)
  const url = "https://concursar.renapra.gob.ar/Concursar/faces/public/buscarConcurso.xhtml";
  const html = await fetchUrl(url, 15000);

  if (!html) {
    // Fallback: intentar página de ingreso público
    const html2 = await fetchUrl("https://ingresopublico.gob.ar/", 10000);
    if (!html2) {
      errores.push("AR: ambas fuentes inaccesibles (posiblemente restringidas geográficamente)");
      return { rows, errores };
    }
    // Parsear links de convocatorias en la página fallback
    const linkRe = /href="([^"]*convocatori[^"]*)"[^>]*>([^<]{5,100})/gi;
    let m;
    while ((m = linkRe.exec(html2)) !== null) {
      const href = m[1].startsWith("http") ? m[1] : `https://ingresopublico.gob.ar${m[1]}`;
      const titulo = m[2].trim();
      if (titulo.length < 8) continue;
      rows.push({
        fuente_id: encodeURIComponent(href).slice(-40),
        fuente: "argentina_ingresopublico", pais: "AR",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
    return { rows, errores };
  }

  // Parsear tabla de resultados de RENAPRA
  const filas = html.match(/<tr[^>]*class="[^"]*(?:odd|even|row)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const fila of filas.slice(0, 40)) {
    const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => stripHtml(c[1]).trim());
    if (celdas.length < 3) continue;

    const cargo     = celdas[0] || "";
    const organismo = celdas[1] || null;
    const fechaStr  = celdas.find(c => /\d{2}\/\d{2}\/\d{4}/.test(c)) || "";
    const linkMatch = fila.match(/href="([^"]+)"/i);
    const href = linkMatch
      ? (linkMatch[1].startsWith("http") ? linkMatch[1] : `https://concursar.renapra.gob.ar${linkMatch[1]}`)
      : null;

    if (!cargo || cargo.length < 4) continue;
    const fuente_id = href?.split("/").pop()?.replace(/\W/g, "") || cargo.slice(0, 20).replace(/\s/g, "_");

    rows.push({
      fuente_id, fuente: "argentina_ingresopublico", pais: "AR",
      numero_llamado: null, titulo: cargo, cargo, organismo,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: null, fecha_inicio: null,
      fecha_cierre: parseFecha(fechaStr),
      puestos: 1, url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(cargo), activo: true,
    });
  }

  if (rows.length === 0) errores.push("AR: página accesible pero sin filas parseables");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Chile — empleospublicos.cl HTML scraping
// Portal del Servicio Civil de Chile
// ─────────────────────────────────────────────────────────────
async function scrapeChile(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const html = await fetchUrl(
    "https://www.empleospublicos.cl/busqueda/listaAnuncios.aspx",
    15000
  );

  if (!html) {
    errores.push("CL: empleospublicos.cl inaccesible");
    return { rows, errores };
  }

  // Los anuncios están en elementos con clase "anuncio" o "item-cargo"
  const bloques = html.match(/class="[^"]*(?:anuncio|item-cargo|resultado-cargo)[^"]*"[\s\S]*?<\/(?:div|tr|li)>/gi)
    || html.match(/<tr[^>]*id="[^"]*anuncio[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)
    || [];

  if (bloques.length === 0) {
    // Fallback: buscar cualquier link que parezca un cargo
    const linkRe = /href="([^"]*(?:ver_cargo|detalle|anuncio)[^"]*)"[^>]*>\s*([^<]{5,120})/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1].startsWith("http") ? m[1] : `https://www.empleospublicos.cl${m[1]}`;
      const titulo = m[2].trim();
      if (titulo.length < 6) continue;
      rows.push({
        fuente_id: encodeURIComponent(m[1]).slice(-40),
        fuente: "chile_empleospublicos", pais: "CL",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
    if (rows.length === 0) errores.push("CL: sin resultados parseables en empleospublicos.cl");
    return { rows, errores };
  }

  for (const bloque of bloques.slice(0, 40)) {
    const texto = stripHtml(bloque);
    const linkMatch = bloque.match(/href="([^"]+)"/i);
    const href = linkMatch
      ? (linkMatch[1].startsWith("http") ? linkMatch[1] : `https://www.empleospublicos.cl${linkMatch[1]}`)
      : null;

    // Extraer institución y cargo del texto
    const lines = texto.split(/\s{2,}|\n/).map(l => l.trim()).filter(l => l.length > 3);
    const cargo     = lines[0] || "Cargo público";
    const organismo = lines[1] || null;
    const fechaStr  = texto.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || "";
    const lugar     = texto.match(/Regi[oó]n[^:]*:\s*([^\n]{3,40})/i)?.[1]?.trim() || null;
    const fuente_id = href?.split("=").pop()?.replace(/\W/g, "") || cargo.slice(0, 20).replace(/\s/g, "_");

    rows.push({
      fuente_id, fuente: "chile_empleospublicos", pais: "CL",
      numero_llamado: null, titulo: cargo, cargo, organismo,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar, fecha_inicio: null,
      fecha_cierre: parseFecha(fechaStr),
      puestos: 1, url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(cargo), activo: true,
    });
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Colombia — CNSC HTML scraping
// Comisión Nacional del Servicio Civil
// ─────────────────────────────────────────────────────────────
async function scrapeColombia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const html = await fetchUrl("https://www.cnsc.gov.co/index.php/convocatorias", 15000);
  if (!html) {
    errores.push("CO: cnsc.gov.co inaccesible");
    return { rows, errores };
  }

  // Buscar links con texto de convocatorias
  const re = /href="(\/[^"]*convocatori[^"]*|https:\/\/cnsc[^"]*)"[^>]*>\s*([^<]{8,150})/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].startsWith("http") ? m[1] : `https://www.cnsc.gov.co${m[1]}`;
    const titulo = stripHtml(m[2]).trim();
    if (titulo.length < 8 || rows.some(r => r.url_detalle === href)) continue;
    rows.push({
      fuente_id: encodeURIComponent(m[1]).slice(-40),
      fuente: "colombia_cnsc", pais: "CO",
      numero_llamado: null, titulo, cargo: titulo, organismo: "CNSC",
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: null, fecha_inicio: null, fecha_cierre: null, puestos: 1,
      url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo), activo: true,
    });
    if (rows.length >= 30) break;
  }

  if (rows.length === 0) errores.push("CO: sin convocatorias parseables en CNSC");
  return { rows, errores };
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
// PARSER: Genérico RSS — para fuentes con RSS funcional
// ─────────────────────────────────────────────────────────────
async function scrapeGenericoRSS(
  rssUrl: string, fuente: string, pais: string, baseUrl: string
): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const xml = await fetchUrl(rssUrl);
  if (!xml || !xml.includes("<item>")) {
    errores.push(`${pais}: sin items en RSS (${rssUrl})`);
    return { rows, errores };
  }

  const items = extraerItems(xml);
  for (const item of items.slice(0, 30)) {
    const titulo   = extraerTag(item, "title");
    const link     = extraerTag(item, "link");
    const desc     = stripHtml(extraerTag(item, "description"));
    const pubDate  = extraerTag(item, "pubDate");
    if (!titulo) continue;

    const href = link.startsWith("http") ? link : `${baseUrl}${link}`;
    const fuente_id = link.split("/").filter(Boolean).pop()
      || titulo.slice(0, 20).replace(/\W/g, "_");

    rows.push({
      fuente_id, fuente, pais,
      numero_llamado: null, titulo, cargo: titulo, organismo: null,
      descripcion: desc.slice(0, 800), requisitos: null,
      tipo_tarea: null, tipo_vinculo: null, lugar: null,
      fecha_inicio: null, fecha_cierre: parseFecha(pubDate),
      puestos: 1, url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo), activo: true,
    });
  }

  return { rows, errores };
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
      UY: scrapeUruguay,
      AR: scrapeArgentina,
      CL: scrapeChile,
      CO: scrapeColombia,
      BR: scrapeBrasil,
      PE: () => scrapeGenericoRSS("https://www.gob.pe/servir/concursos/rss", "peru_servir", "PE", "https://www.gob.pe"),
      PY: () => scrapeGenericoRSS("https://www.sfp.gov.py/concursos/rss", "paraguay_sfp", "PY", "https://www.sfp.gov.py"),
      BO: () => scrapeGenericoRSS("https://www.agetic.gob.bo/convocatorias/rss", "bolivia_agetic", "BO", "https://www.agetic.gob.bo"),
      EC: () => scrapeGenericoRSS("https://www.trabajo.gob.ec/concursos/rss", "ecuador_trabajo", "EC", "https://www.trabajo.gob.ec"),
    };

    const paises = soloPais
      ? [soloPais.toUpperCase()].filter(p => SCRAPERS[p])
      : Object.keys(SCRAPERS);

    const resumen: Record<string, unknown> = {};
    let total_insertados = 0;

    for (const pais of paises) {
      console.log(`Scrapeando ${pais}...`);
      const { rows, errores } = await SCRAPERS[pais]();

      if (modoTest) {
        resumen[pais] = { rows_sample: rows.slice(0, 3), total: rows.length, errores };
      } else {
        const insertados = await upsertRows(rows);
        total_insertados += insertados;
        resumen[pais] = { insertados, total_scrapeados: rows.length, errores };
        if (rows.length > 0) {
          const fuente = rows[0].fuente;
          await marcarVencidos(fuente);
        }
      }

      // Pausa corta entre fuentes
      await new Promise(r => setTimeout(r, 300));
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
