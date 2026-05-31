import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const USAJOBS_API_KEY  = Deno.env.get("USAJOBS_API_KEY")  ?? "";
const CF_PROXY         = Deno.env.get("CF_PROXY_URL")     ?? "";
const SCRAPER_API_KEY  = Deno.env.get("SCRAPER_API_KEY")  ?? "";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "max-age=0",
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

function sumarDias(fecha: string | null, dias: number): string | null {
  if (!fecha) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function parseFechaRelativa(texto: string): string | null {
  const m = texto.match(/hace\s+(\d+)\s+(hora|d[ií]a|semana|mes)/i);
  if (!m) return null;
  const num = parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const d = new Date();
  if (unit.startsWith("hora")) d.setHours(d.getHours() - num);
  else if (unit.startsWith("d")) d.setDate(d.getDate() - num);
  else if (unit.startsWith("sem")) d.setDate(d.getDate() - num * 7);
  else if (unit.startsWith("mes")) d.setMonth(d.getMonth() - num);
  return d.toISOString().slice(0, 10);
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
    .replace(/&quot;/g, '"').replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, " ").trim();
}

async function fetchViaProxy(url: string, timeoutMs = 15000): Promise<string | null> {
  if (!CF_PROXY) return null;
  const proxyUrl = `${CF_PROXY}${encodeURIComponent(url)}`;
  return fetchUrl(proxyUrl, timeoutMs);
}

async function fetchViaScraperAPI(url: string, countryCode: string, timeoutMs = 20000): Promise<string | null> {
  if (!SCRAPER_API_KEY) return null;
  const saUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&country_code=${countryCode}&url=${encodeURIComponent(url)}`;
  return fetchUrl(saUrl, timeoutMs, { "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
}

async function fetchUrl(url: string, timeoutMs = 15000, extraHeaders?: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`fetchUrl ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.log(`fetchUrl ${url} → ERROR: ${(e as Error).message}`);
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

  // API oficial del sitio — devuelve exactamente los llamados con inscripción abierta
  let resp: string | null = null;
  try {
    const r = await fetch("https://uruguayconcursa.gub.uy/api-backend/llamados/recientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ PaginadoFiltrosSDT: { PaginaActual: 1, CntPorPagina: 2000 } }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) resp = await r.text();
    else errores.push(`UY: API recientes HTTP ${r.status}`);
  } catch (e) {
    errores.push(`UY: API recientes error — ${(e as Error).message}`);
  }

  if (!resp) return { rows, errores: ["UY: API recientes sin respuesta"] };

  let lista: Record<string, unknown>[] = [];
  try {
    const json = JSON.parse(resp);
    lista = (json.ListaLlamados ?? json.listaLlamados ?? []) as Record<string, unknown>[];
  } catch {
    return { rows, errores: ["UY: API recientes respuesta inválida"] };
  }

  if (lista.length === 0) return { rows, errores: ["UY: API recientes devolvió 0 llamados"] };

  for (const l of lista) {
    const id        = String(l.LlaId ?? "");
    if (!id) continue;

    const titulo    = String(l.LlaTit ?? l.CarNom ?? "").trim();
    const cargo     = String(l.CarNom ?? l.LlaTit ?? "").trim();
    if (titulo.length < 3) continue;

    // Puestos: suma de listaOrganismoCantPuestos
    const puestosList = (l.listaOrganismoCantPuestos as Record<string, unknown>[] | undefined) ?? [];
    const puestos = puestosList.reduce((s: number, p) => s + (Number(p.CantPuestos ?? 1)), 0) || 1;

    const fechaCierreRaw = String(l.LlaFchCieIns ?? "");
    const fechaAperRaw   = String(l.LlaFchApeIns ?? "");

    rows.push({
      fuente_id:      id,
      fuente:         "uruguay_concursa",
      pais:           "UY",
      numero_llamado: String(l.LlaNum ?? "").trim() || null,
      titulo, cargo,
      organismo:      String(l.Inciso ?? l.UnidadEjecutora ?? "").trim() || null,
      descripcion:    String(l.LlaConTra ?? "").trim().slice(0, 800) || null,
      requisitos:     String(l.LlaReqExc ?? "").trim().slice(0, 800) || null,
      tipo_tarea:     String(l.TipTarDsc ?? "").trim() || null,
      tipo_vinculo:   String(l.TipVinDsc ?? "").trim() || null,
      lugar:          String(l.LlaLugDes ?? "").trim().slice(0, 200) || null,
      fecha_inicio:   parseFecha(fechaAperRaw),
      fecha_cierre:   parseFecha(fechaCierreRaw) ?? sumarDias(null, 30),
      puestos,
      url_detalle:    `https://uruguayconcursa.gub.uy/llamado/${id}`,
      url_postulacion: `https://uruguayconcursa.gub.uy/llamado/${id}`,
      keywords:       extraerKeywords(`${titulo} ${cargo} ${l.TipTarDsc ?? ""} ${l.TipVinDsc ?? ""}`),
      activo:         true,
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
  locale: string, query: string, fuente: string, paisRow?: string, ceidLang = "es", diasExpiry = 15
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
    SE: "sv-SE", NO: "nb-NO", JP: "ja-JP", IN: "en-IN",
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
    const fechaPub = parseFecha(pubDate);
    rows.push({
      fuente_id, fuente, pais,
      numero_llamado: null, titulo, cargo: titulo, organismo: null,
      descripcion: desc.slice(0, 600), requisitos: null,
      tipo_tarea: null, tipo_vinculo: null, lugar: null,
      fecha_inicio: fechaPub,
      fecha_cierre: sumarDias(null, diasExpiry),
      puestos: 1,
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
  // Computrabajo usa /ofertas-de-trabajo/oferta-de-trabajo-de-[titulo]-[id] en todos los países
  const LINK_RE = /\/(?:empleo|ofertas-de-trabajo)\/[^"#?\s]+/;

  const artRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = artRe.exec(html)) !== null && rows.length < 60) {
    const block = m[1];
    // Allow optional #fragment after the slug (Computrabajo now appends #lc=...)
    const linkM = block.match(new RegExp(`href="(${LINK_RE.source})(?:#[^"]*)??"`, "i"));
    if (!linkM) continue;

    // Título: atributo title= o texto entre las etiquetas del link
    const titleM = block.match(/title="([^"]{5,120})"/)
      || block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>\s*([^<]{5,120})\s*<\/a>/i);
    // Fallback: primer texto significativo del h2
    const h2M = block.match(/<h2[^>]*>[\s\S]*?>\s*([^<]{5,120})\s*<\/a>/i);
    const titulo = stripHtml((titleM?.[1] ?? h2M?.[1] ?? "")).trim();
    if (titulo.length < 5) continue;

    const compM = block.match(/href="\/empresa[^"]*"[^>]*>([^<]{3,80})<\/a>/i);
    const cityM = block.match(/href="\/(?:trabajos|empleos|ofertas)-en-[^"]*"[^>]*>([^<]{3,50})<\/a>/i);
    // Fecha de publicación: "hace X días/horas/semanas" o datetime="YYYY-MM-DD"
    const datetimeM = block.match(/datetime="(\d{4}-\d{2}-\d{2})"/i);
    const haceM = block.match(/(hace\s+\d+\s+(?:hora|d[ií]a|semana|mes)[^<"]{0,10})/i);
    const fechaPub = datetimeM ? datetimeM[1] : (haceM ? parseFechaRelativa(haceM[1]) : null);
    const href = `${baseUrl}${linkM[1]}`;
    // ID único: los últimos 32 chars hex del hash al final del slug
    const hashM = linkM[1].match(/([A-F0-9]{32})(?:#|$)/i);
    const fuente_id = hashM ? hashM[1] : linkM[1].replace(/\W/g, "_").slice(-50);
    if (rows.some(r => r.fuente_id === fuente_id)) continue;

    rows.push({
      fuente_id, fuente, pais,
      numero_llamado: null, titulo, cargo: titulo,
      organismo: compM ? compM[1].trim() : null,
      descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
      lugar: cityM ? cityM[1].trim() : null,
      fecha_inicio: fechaPub,
      fecha_cierre: sumarDias(fechaPub, 45),
      puestos: 1,
      url_detalle: href, url_postulacion: href,
      keywords: extraerKeywords(titulo), activo: true,
    });
  }

  // Método 2: cualquier link de oferta si los artículos no dieron resultado
  if (rows.length === 0) {
    const re2 = /href="(\/(?:empleo|ofertas-de-trabajo)\/[^"#?\s]+)(?:#[^"]*)?"[^>]*>\s*([^<]{5,120})\s*<\/a>/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(html)) !== null && rows.length < 50) {
      const titulo = stripHtml(m2[2]).trim();
      if (titulo.length < 5) continue;
      const href = `${baseUrl}${m2[1]}`;
      const hashM2 = m2[1].match(/([A-F0-9]{32})(?:#|$)/i);
      const fuente_id = hashM2 ? hashM2[1] : m2[1].replace(/\W/g, "_").slice(-50);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;
      rows.push({
        fuente_id, fuente, pais,
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: null, fecha_inicio: null,
        fecha_cierre: sumarDias(null, 45),
        puestos: 1,
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

  // Solo intentar la primera ruta con timeout corto — si Cloudflare bloquea falla rápido
  const paths = [
    "/trabajo-de-gobierno",
    "/trabajos?q=concurso+publico&orden=fecha",
  ];

  for (const path of paths) {
    const html = await fetchUrl(`${base}${path}`, 7000);
    if (!html) { errores.push(`${pais}: ${base}${path} sin respuesta`); break; }
    parseComputrabajo(html, pais, fuente, base, rows);
    if (rows.length > 0) break;
    errores.push(`${pais}: ${base}${path} accesible pero sin ítems parseables`);
  }

  return { rows, errores };
}

// Versión paginada: busca /trabajo-de-gobierno en N páginas en lotes de 3
async function scrapeComputrabajoPaginado(
  subdomain: string, pais: string, fuente: string, numPages: number
): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const base = `https://${subdomain}.computrabajo.com`;

  const addRows = (newRows: ConcursoRow[]) => {
    for (const r of newRows) {
      if (!seen.has(r.fuente_id)) { seen.add(r.fuente_id); rows.push(r); }
    }
  };

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);
  for (let i = 0; i < pages.length; i += 3) {
    const lote = pages.slice(i, i + 3);
    await Promise.all(lote.map(async (page) => {
      const url = page === 1
        ? `${base}/trabajo-de-gobierno`
        : `${base}/trabajo-de-gobierno?p=${page}`;
      const html = await fetchUrl(url, 10000);
      if (!html) { errores.push(`${pais}: CT p${page} sin respuesta`); return; }
      const pageRows: ConcursoRow[] = [];
      parseComputrabajo(html, pais, fuente, base, pageRows);
      addRows(pageRows);
    }));
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Argentina — Computrabajo págs 1-8 + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeArgentina(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const base = "https://ar.computrabajo.com";

  const addRows = (newRows: ConcursoRow[]) => {
    for (const r of newRows) {
      if (!seen.has(r.fuente_id)) { seen.add(r.fuente_id); rows.push(r); }
    }
  };

  // Computrabajo: páginas 1-8 en paralelo (lotes de 4)
  const ctPages = Array.from({ length: 8 }, (_, i) => i + 1);
  for (let i = 0; i < ctPages.length; i += 4) {
    const lote = ctPages.slice(i, i + 4);
    await Promise.all(lote.map(async (page) => {
      const url = page === 1
        ? `${base}/trabajo-de-gobierno`
        : `${base}/trabajo-de-gobierno?p=${page}`;
      const html = await fetchUrl(url, 10000);
      if (!html) return;
      const pageRows: ConcursoRow[] = [];
      parseComputrabajo(html, "AR", "argentina_concursar", base, pageRows);
      addRows(pageRows);
    }));
  }

  // Google News en paralelo
  const [gn1, gn2, gn3] = await Promise.all([
    scrapeGoogleNews("AR", "concurso público Argentina convocatoria empleo vacante 2026", "argentina_googlenews", "AR", "es", 25),
    scrapeGoogleNews("AR", "Argentina empleo público SINEP convocatoria cargo ingreso 2026", "argentina_googlenews2", "AR", "es", 25),
    scrapeGoogleNews("AR", "Argentina concurso público provincia municipal gobierno 2026", "argentina_googlenews3", "AR", "es", 20),
  ]);
  addRows(gn1.rows); addRows(gn2.rows); addRows(gn3.rows);
  errores.push(...gn1.errores, ...gn2.errores, ...gn3.errores);

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Chile — Indeed + Servicio Civil RSS fallback
// ─────────────────────────────────────────────────────────────
async function scrapeChile(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  // 1. Computrabajo Chile (accesible desde cloud)
  const ct = await scrapeComputrabajo("cl", "CL", "chile_concursar");
  if (ct.rows.length > 0) return ct;

  // 2. Servicio Civil Chile
  const errores = [...ct.errores];
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
        lugar: null, fecha_inicio: null, fecha_cierre: sumarDias(null, 60), puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }
  if (rows.length > 0) return { rows, errores };

  // 3. Google News
  const gn = await scrapeGoogleNews("CL", "concurso público Chile cargo vacante gobierno", "chile_googlenews");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Colombia — CNSC (Comisión Nacional del Servicio Civil)
// URL confirmada: https://www.cnsc.gov.co/index.php/servicios/convocatorias
// Estructura Drupal con links /convocatorias/{slug}-{id}
// ─────────────────────────────────────────────────────────────
async function scrapeColombia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // 1. CNSC — portal oficial de concursos del Estado colombiano
  // Intentar también el JSON:API de Drupal (no requiere JS)
  const drupalApiUrl = "https://www.cnsc.gov.co/jsonapi/node/convocatoria?filter[status]=1&sort=-created&page[limit]=50";
  const drupalJson = await fetchViaProxy(drupalApiUrl) ?? await fetchUrl(drupalApiUrl, 12000);
  if (drupalJson && drupalJson.includes('"data"')) {
    try {
      const parsed = JSON.parse(drupalJson);
      const items: Record<string, unknown>[] = parsed?.data ?? [];
      for (const item of items.slice(0, 50)) {
        const attr = item.attributes as Record<string, unknown>;
        const titulo = ((attr?.title ?? attr?.field_nombre ?? "") as string).trim();
        const slug = (attr?.field_numero_convocatoria ?? attr?.drupal_internal__nid ?? "") as string | number;
        if (!titulo || titulo.length < 5) continue;
        const fuente_id = String(slug).replace(/\W/g, "_").slice(-48) || titulo.replace(/\W/g, "_").slice(0, 48);
        if (rows.some(r => r.fuente_id === fuente_id)) continue;
        rows.push({
          fuente_id, fuente: "colombia_cnsc", pais: "CO",
          numero_llamado: String(slug) || null,
          titulo, cargo: titulo, organismo: null,
          descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
          lugar: "Colombia", fecha_inicio: null, fecha_cierre: sumarDias(null, 60), puestos: 1,
          url_detalle: `https://www.cnsc.gov.co/convocatorias/${slug}`,
          url_postulacion: `https://www.cnsc.gov.co/convocatorias/${slug}`,
          keywords: extraerKeywords(titulo), activo: true,
        });
      }
      if (rows.length > 0) return { rows, errores };
    } catch (_) { /* not valid JSON */ }
  }

  const cnscUrls = [
    "https://www.cnsc.gov.co/convocatorias/en-desarrollo",
    "https://www.cnsc.gov.co/index.php/servicios/convocatorias",
  ];
  for (const cnscUrl of cnscUrls) {
    // CNSC está geo-bloqueado desde AWS — intentar vía proxy Cloudflare
    const html = await fetchViaProxy(cnscUrl) ?? await fetchUrl(cnscUrl, 15000);
    if (!html) { errores.push(`CO: CNSC ${cnscUrl} inaccesible`); continue; }

    // Links con slug de convocatoria: /convocatorias/{entidad}-{número}
    const linkRe = /href="((?:https?:\/\/www\.cnsc\.gov\.co)?(?:\/index\.php)?\/convocatorias\/([^"#?\s]{4,80}))"[^>]*>[\s\S]{0,200}?>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null && rows.length < 50) {
      const rawHref = m[1];
      const slug    = m[2];
      const titulo  = stripHtml(m[3]).replace(/\s+/g, " ").trim();
      if (titulo.length < 5) continue;
      // Filtrar links de navegación genérica y páginas de sección (no convocatorias reales)
      if (/^(ver m[aá]s|inicio|home|servicios|convocatorias|más|atrás|tutoriales|videos|historicas|lista de elegibles|nuevos procesos|universidades)$/i.test(titulo)) continue;
      // Slugs de navegación no tienen número al final — los reales sí: /{entidad}-{número}
      if (!/\d/.test(slug)) continue;

      const href    = rawHref.startsWith("http") ? rawHref : `https://www.cnsc.gov.co${rawHref}`;
      const fuente_id = slug.replace(/\W/g, "_").slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      // El slug suele ser {entidad}-{número}: extraer organismo
      const orgFromSlug = slug.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

      rows.push({
        fuente_id, fuente: "colombia_cnsc", pais: "CO",
        numero_llamado: slug.match(/-(\d+)$/)?.[1] ?? null,
        titulo, cargo: titulo,
        organismo: orgFromSlug || null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: "Colombia",
        fecha_inicio: null, fecha_cierre: sumarDias(null, 60), puestos: 1,
        url_detalle: href, url_postulacion: href,
        keywords: extraerKeywords(titulo + " " + orgFromSlug), activo: true,
      });
    }

    if (rows.length < 5) {
      errores.push(`CO: CNSC ${cnscUrl} accesible pero solo ${rows.length} items (posible JS-render)`);
      rows.length = 0;
      continue;
    }
    return { rows, errores };
  }

  // 2. Computrabajo CO
  const ct = await scrapeComputrabajo("co", "CO", "colombia_concursar");
  if (ct.rows.length > 0) return { rows: ct.rows, errores: [...errores, ...ct.errores] };
  errores.push(...ct.errores);

  // 3. Google News
  const gn = await scrapeGoogleNews("US", "Colombia empleo convocatoria concurso público cargo vacante", "colombia_googlenews", "CO");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Brasil — pciconcursos.com.br (págs 1-15) + Google News
// Cubre todos los estados de Brasil (SP, RJ, MG, BA, RS, etc.)
// ─────────────────────────────────────────────────────────────
function parsePciConcursos(html: string, seen: Set<string>, rows: ConcursoRow[]): void {
  let estadoAtual = "Nacional";
  const seccionRe = /<h2>([^<]+)<\/h2>([\s\S]*?)(?=<h2>|$)/gi;
  let seccion;
  while ((seccion = seccionRe.exec(html)) !== null) {
    estadoAtual = seccion[1].trim();
    const bloque = seccion[2];
    const cdRe = /<div class="cd">([\s\S]*?)<\/div>\s*<div class="ce"><span>([\s\S]*?)<\/span>/gi;
    let m;
    while ((m = cdRe.exec(bloque)) !== null) {
      const cdText = stripHtml(m[1]);
      // Extraer fecha de cierre: si hay rango "11/06 a<br>02/07/2026" tomar la última fecha
      const fechaRaw = m[2].replace(/<[^>]+>/g, " ").trim();
      const fechaStr = fechaRaw.includes(" a ") ? fechaRaw.split(" a ").pop()!.trim() : fechaRaw;
      const lines = cdText.split(/\n|<br>/).map((l: string) => l.trim()).filter(Boolean);
      const vagasLine = lines.find((l: string) => /vaga/i.test(l)) || "";
      const cargoLine = lines.find((l: string) => !/vaga|ensino|superior|médio|técnico|fundamental/i.test(l) && l.length > 3) || lines[0] || "Concurso";
      const vagasMatch = vagasLine.match(/(\d+)\s+vaga/i);
      const puestos = vagasMatch ? parseInt(vagasMatch[1]) : 1;
      const titulo = `${cargoLine} — ${estadoAtual}`;
      const fuente_id = `${estadoAtual}_${cargoLine}_${fechaStr}`.replace(/\W/g, "_").slice(0, 60);
      if (seen.has(fuente_id)) continue;
      seen.add(fuente_id);
      rows.push({
        fuente_id, fuente: "brasil_pciconcursos", pais: "BR",
        numero_llamado: null, titulo, cargo: cargoLine, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: estadoAtual, fecha_inicio: null, fecha_cierre: parseFecha(fechaStr),
        puestos, url_detalle: "https://www.pciconcursos.com.br/concursos/",
        url_postulacion: "https://www.pciconcursos.com.br/concursos/",
        keywords: extraerKeywords(cargoLine), activo: true,
      });
    }
  }
}

async function scrapeBrasil(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();

  // 1. pciconcursos.com.br — toda la data en una sola página (sin paginación real)
  const html = await fetchUrl("https://www.pciconcursos.com.br/concursos/", 15000);
  if (html) {
    parsePciConcursos(html, seen, rows);
  } else {
    errores.push("BR: pciconcursos.com.br inaccesible");
  }

  if (rows.length === 0) errores.push("BR: sin resultados en pciconcursos.com.br");

  // 2. concursosnobrasil.com — RSS con paginación (15 items/pág)
  const rssPages = Array.from({ length: 8 }, (_, i) => i + 1);
  await Promise.all(rssPages.map(async (p) => {
    const url = p === 1
      ? "https://concursosnobrasil.com/concursos/feed/"
      : `https://concursosnobrasil.com/concursos/feed/?paged=${p}`;
    const xml = await fetchUrl(url, 10000);
    if (!xml) return;
    const items = extraerItems(xml);
    for (const item of items) {
      const titulo = extraerTag(item, "title").replace(/&#\d+;/g, " ").trim();
      const link   = extraerTag(item, "link").trim();
      const pubDate = extraerTag(item, "pubDate").trim();
      if (!titulo || !link) continue;
      const fuente_id = `cnbr_${link.split("/").filter(Boolean).pop() ?? titulo}`.slice(0, 60);
      if (seen.has(fuente_id)) continue;
      seen.add(fuente_id);
      rows.push({
        fuente_id, fuente: "brasil_cnbr", pais: "BR",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: "Brasil", fecha_inicio: null,
        fecha_cierre: sumarDias(null, 30),
        puestos: 1, url_detalle: link, url_postulacion: link,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }));

  // 3. Google News por región — cubre lo que pciconcursos no llega
  const queries = [
    ["concurso público São Paulo edital inscrições abertas 2026", "brasil_gn_sp"],
    ["concurso público Minas Gerais Rio de Janeiro edital vagas 2026", "brasil_gn_sudeste"],
    ["concurso público Rio Grande do Sul Paraná Santa Catarina 2026", "brasil_gn_sul"],
    ["concurso público Nordeste Bahia Ceará Pernambuco 2026", "brasil_gn_nordeste"],
    ["concurso público federal IBGE Receita Correios 2026", "brasil_gn_federal"],
  ];
  const gnResults = await Promise.all(
    queries.map(([q, fuente]) => scrapeGoogleNews("US", q, fuente, "BR", "pt", 20))
  );
  for (const gn of gnResults) {
    for (const r of gn.rows) {
      if (!seen.has(r.fuente_id)) { seen.add(r.fuente_id); rows.push(r); }
    }
    errores.push(...gn.errores);
  }

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Perú — Indeed + SERVIR fallback
// ─────────────────────────────────────────────────────────────
async function scrapePerú(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("pe", "PE", "peru_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "Perú empleo concurso público plaza vacante CAS SERVIR", "peru_googlenews", "PE");
}

async function scrapeParaguay(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("py", "PY", "paraguay_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "Paraguay empleo convocatoria cargo público vacante", "paraguay_googlenews", "PY");
}

async function scrapeBolivia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("bo", "BO", "bolivia_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("BO", "Bolivia empleo convocatoria cargo público vacante", "bolivia_googlenews");
}

async function scrapeEcuador(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("ec", "EC", "ecuador_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("EC", "Ecuador empleo convocatoria cargo público vacante", "ecuador_googlenews");
}

// ─────────────────────────────────────────────────────────────
// PARSER: México — DOF (Diario Oficial de la Federación) vacantes
// URL confirmada: https://www.dof.gob.mx/vacantes.php — 26 convocatorias reales
// ─────────────────────────────────────────────────────────────
async function scrapeMexico(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // DOF está geo-bloqueado desde AWS US-East. Intentamos primero vía proxy Cloudflare.
  const html = await fetchViaProxy("https://www.dof.gob.mx/vacantes.php")
    ?? await fetchUrl("https://www.dof.gob.mx/vacantes.php", 15000, {
      "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      "Referer": "https://www.google.com.mx/",
      "Sec-Fetch-Site": "cross-site",
    });
  if (html) {
    // Cada vacante: href="vacantes/{id1}/{id2}.html" seguido de <div align="justify">descripción</div>
    const vacRe = /href="(vacantes\/(\d+)\/(\d+)\.html)"[\s\S]{0,800}?<div[^>]*align="justify"[^>]*>([\s\S]*?)<\/div>/gi;
    let m: RegExpExecArray | null;
    while ((m = vacRe.exec(html)) !== null && rows.length < 60) {
      const path = m[1];
      const id1  = m[2];
      const id2  = m[3];
      const desc = stripHtml(m[4]).replace(/\s+/g, " ").trim();
      if (desc.length < 10) continue;

      // Extraer nombre del organismo convocante desde la descripción
      const orgMatch = desc.match(
        /(?:Secretar[ií]a\s+de[l]?\s+\w[\w\s]{2,60}?|Instituto\s+\w[\w\s]{2,60}?|Comisi[oó]n\s+\w[\w\s]{2,60}?|Coordinaci[oó]n\s+\w[\w\s]{2,60}?|Subsecretar[ií]a\s+de[l]?\s+\w[\w\s]{2,60}?|Procuradur[ií]a\s+\w[\w\s]{2,60}?|Servicio\s+\w[\w\s]{2,50}?)(?=[,;.\n]|$)/i
      );
      const organismo = orgMatch ? orgMatch[0].trim().slice(0, 120) : null;

      const fuente_id = `${id1}_${id2}`;
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      const url    = `https://www.dof.gob.mx/${path}`;
      const titulo = organismo ? `Convocatoria — ${organismo}` : `Convocatoria DOF ${id2}`;

      rows.push({
        fuente_id, fuente: "mexico_dof", pais: "MX",
        numero_llamado: id2,
        titulo, cargo: titulo, organismo,
        descripcion: desc.slice(0, 600), requisitos: null,
        tipo_tarea: null, tipo_vinculo: null,
        lugar: "México",
        fecha_inicio: null, fecha_cierre: sumarDias(null, 60), puestos: 1,
        url_detalle: url, url_postulacion: url,
        keywords: extraerKeywords(desc), activo: true,
      });
    }
    if (rows.length === 0) errores.push("MX: DOF vacantes.php sin ítems parseables");
  } else {
    errores.push("MX: DOF vacantes.php inaccesible");
  }

  if (rows.length > 0) return { rows, errores };

  // 2. Computrabajo MX
  const ct = await scrapeComputrabajo("mx", "MX", "mexico_concursar");
  if (ct.rows.length > 0) return { rows: ct.rows, errores: [...errores, ...ct.errores] };
  errores.push(...ct.errores);

  // 3. Google News
  const gn = await scrapeGoogleNews("US", "México convocatoria empleo vacante gobierno plaza concurso", "mexico_googlenews", "MX");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

async function scrapeVenezuela(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("ve", "VE", "venezuela_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "Venezuela empleo vacante convocatoria trabajo cargo", "venezuela_googlenews", "VE");
}

// ─────────────────────────────────────────────────────────────
// PARSER: Costa Rica — Indeed + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapCostaRica(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("cr", "CR", "costarica_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("CR", "Costa Rica empleo convocatoria concurso servicio civil cargo público", "costarica_googlenews");
}

async function scrapeGuatemala(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const addRows = (r: ConcursoRow[]) => { for (const x of r) { if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); } } };

  const ct = await scrapeComputrabajoPaginado("gt", "GT", "guatemala_concursar", 6);
  addRows(ct.rows); errores.push(...ct.errores);

  const [gn1, gn2] = await Promise.all([
    scrapeGoogleNews("GT", "Guatemala empleo convocatoria cargo público vacante plaza 2026", "guatemala_googlenews", undefined, "es", 25),
    scrapeGoogleNews("GT", "Guatemala concurso público gobierno empleo estado vacantes 2026", "guatemala_googlenews2", undefined, "es", 20),
  ]);
  addRows(gn1.rows); errores.push(...gn1.errores);
  addRows(gn2.rows); errores.push(...gn2.errores);

  return { rows, errores };
}

async function scrapeElSalvador(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("sv", "SV", "elsalvador_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "\"El Salvador\" empleo vacante trabajo convocatoria cargo", "elsalvador_googlenews", "SV");
}

async function scrapeHonduras(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const addRows = (r: ConcursoRow[]) => { for (const x of r) { if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); } } };

  const ct = await scrapeComputrabajoPaginado("hn", "HN", "honduras_concursar", 6);
  addRows(ct.rows); errores.push(...ct.errores);

  const [gn1, gn2] = await Promise.all([
    scrapeGoogleNews("GT", "Honduras empleo convocatoria cargo público vacante gobierno 2026", "honduras_googlenews", "HN", "es", 25),
    scrapeGoogleNews("GT", "Honduras concurso público estado empleo oportunidad vacante 2026", "honduras_googlenews2", "HN", "es", 20),
  ]);
  addRows(gn1.rows); errores.push(...gn1.errores);
  addRows(gn2.rows); errores.push(...gn2.errores);

  return { rows, errores };
}

async function scrapeNicaragua(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const addRows = (r: ConcursoRow[]) => { for (const x of r) { if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); } } };

  const ct = await scrapeComputrabajoPaginado("ni", "NI", "nicaragua_concursar", 6);
  addRows(ct.rows); errores.push(...ct.errores);

  const [gn1, gn2] = await Promise.all([
    scrapeGoogleNews("GT", "Nicaragua empleo convocatoria cargo público vacante gobierno 2026", "nicaragua_googlenews", "NI", "es", 25),
    scrapeGoogleNews("GT", "Nicaragua concurso público estado empleo oportunidad vacante 2026", "nicaragua_googlenews2", "NI", "es", 20),
  ]);
  addRows(gn1.rows); errores.push(...gn1.errores);
  addRows(gn2.rows); errores.push(...gn2.errores);

  return { rows, errores };
}

async function scraperPanama(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("pa", "PA", "panama_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "Panamá empleo vacante trabajo convocatoria cargo público", "panama_googlenews", "PA");
}

async function scrapeRepDominicana(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("do", "DO", "dominicana_concursar");
  if (ct.rows.length > 0) return ct;
  return scrapeGoogleNews("US", "\"República Dominicana\" empleo vacante trabajo convocatoria", "dominicana_googlenews", "DO");
}

// ─────────────────────────────────────────────────────────────
// PARSER: España — BOE datos abiertos JSON API (sección Oposiciones y concursos)
// El RSS del BOE devuelve body vacío desde cloud; la API JSON sí funciona.
// ─────────────────────────────────────────────────────────────
async function scrapeEspana(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // BOE publica de lunes a sábado. Intentamos hoy y hasta 4 días atrás
  // para cubrir fines de semana y festivos.
  const hoy = new Date();
  for (let diasAtras = 0; diasAtras <= 4 && rows.length < 10; diasAtras++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - diasAtras);
    const fecha = d.toISOString().slice(0, 10).replace(/-/g, "");

    try {
      const res = await fetch(
        `https://www.boe.es/datosabiertos/api/boe/sumario/${fecha}`,
        {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)" },
          signal: AbortSignal.timeout(12000),
        }
      );
      if (!res.ok) { errores.push(`ES: BOE API ${fecha} status ${res.status}`); continue; }
      const data = await res.json();

      const diarios: Record<string, unknown>[] = data?.data?.sumario?.diario ?? [];
      const diario = Array.isArray(diarios) ? diarios[0] : diarios;
      const secciones: Record<string, unknown>[] = (diario as Record<string, unknown>)?.seccion ?? [];

      for (const sec of (Array.isArray(secciones) ? secciones : [secciones])) {
        const nombre_sec = (sec.nombre ?? "") as string;
        if (!nombre_sec.includes("Oposiciones")) continue;

        const deptos: Record<string, unknown>[] = (sec.departamento ?? []) as Record<string, unknown>[];
        for (const depto of (Array.isArray(deptos) ? deptos : [deptos])) {
          const nombre_depto = (depto.nombre ?? "") as string;
          const epigrafes: Record<string, unknown>[] = (depto.epigrafe ?? []) as Record<string, unknown>[];
          for (const epi of (Array.isArray(epigrafes) ? epigrafes : [epigrafes])) {
            const items: Record<string, unknown>[] = (epi.item ?? []) as Record<string, unknown>[];
            for (const item of (Array.isArray(items) ? items : [items])) {
              const iid    = (item.identificador ?? "") as string;
              const titulo = (item.titulo ?? "") as string;
              const url    = (item.url_html ?? "") as string;
              if (!titulo || titulo.length < 5 || !iid) continue;
              const fuente_id = iid.replace(/\W/g, "").slice(-48);
              if (rows.some(r => r.fuente_id === fuente_id)) continue;
              rows.push({
                fuente_id, fuente: "espana_boe", pais: "ES",
                numero_llamado: iid,
                titulo: nombre_depto ? `${titulo} — ${nombre_depto}` : titulo,
                cargo: titulo, organismo: nombre_depto || null,
                descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
                lugar: "España",
                fecha_inicio: parseFecha(`${fecha.slice(0,4)}-${fecha.slice(4,6)}-${fecha.slice(6,8)}`),
                fecha_cierre: sumarDias(null, 60),
                puestos: 1,
                url_detalle: url || null, url_postulacion: url || null,
                keywords: extraerKeywords(titulo + " " + nombre_depto), activo: true,
              });
            }
          }
        }
      }
    } catch (e) {
      errores.push(`ES: BOE API ${fecha} error — ${(e as Error).message}`);
    }
  }

  if (rows.length > 0) return { rows, errores };

  // Google News como fallback
  const gn = await scrapeGoogleNews("ES",
    "oposición convocatoria empleo público España administración cargo vacante selección",
    "espana_googlenews");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Portugal — BEP (IEFP) + Indeed PT fallback
// ─────────────────────────────────────────────────────────────
async function scrapePortugal(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const addRows = (r: ConcursoRow[]) => { for (const x of r) { if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); } } };

  // BEP portal está bloqueado desde cloud — usamos 3 consultas Google News en paralelo
  const [gn1, gn2, gn3] = await Promise.all([
    scrapeGoogleNews("PT", "concurso público Portugal emprego trabalho administração recrutamento 2026", "portugal_googlenews", undefined, "pt", 25),
    scrapeGoogleNews("PT", "Portugal vagas emprego público administração governo concurso abertas 2026", "portugal_googlenews2", undefined, "pt", 25),
    scrapeGoogleNews("PT", "Portugal emprego público SNS saúde educação governo candidatura 2026", "portugal_googlenews3", undefined, "pt", 20),
  ]);
  addRows(gn1.rows); errores.push(...gn1.errores);
  addRows(gn2.rows); errores.push(...gn2.errores);
  addRows(gn3.rows); errores.push(...gn3.errores);

  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Italia — InPA API (portal oficial) + Google News fallback
// ─────────────────────────────────────────────────────────────
async function scrapeItalia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();

  // InPA — WordPress REST API páginas 1 y 2 en paralelo
  const [res1, res2] = await Promise.all([
    fetch("https://www.inpa.gov.it/wp-json/wp/v2/posts?per_page=40&page=1&_fields=id,title,link,date", {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null),
    fetch("https://www.inpa.gov.it/wp-json/wp/v2/posts?per_page=40&page=2&_fields=id,title,link,date", {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; Nexu/1.0)" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null),
  ]);

  for (const res of [res1, res2]) {
    if (!res || !res.ok) { if (res) errores.push(`IT: InPA WP REST status ${res.status}`); continue; }
    try {
      const posts: Record<string, unknown>[] = await res.json();
      for (const post of posts) {
        const id     = post.id as number;
        const titulo = stripHtml((post.title as Record<string, string>)?.rendered ?? "");
        const link   = (post.link as string) ?? "";
        const fecha  = (post.date as string) ?? "";
        if (!titulo || titulo.length < 5) continue;
        const fuente_id = String(id);
        if (seen.has(fuente_id)) continue;
        seen.add(fuente_id);
        rows.push({
          fuente_id, fuente: "italia_inpa", pais: "IT",
          numero_llamado: String(id), titulo, cargo: titulo, organismo: null,
          descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
          lugar: null, fecha_inicio: parseFecha(fecha), fecha_cierre: sumarDias(null, 60), puestos: 1,
          url_detalle: link || null, url_postulacion: link || null,
          keywords: extraerKeywords(titulo), activo: true,
        });
      }
    } catch (e) {
      errores.push(`IT: InPA WP REST parse error — ${(e as Error).message}`);
    }
  }

  if (rows.length > 0) return { rows, errores };

  // Fallback: Google News IT
  const gn = await scrapeGoogleNews("IT",
    "concorso pubblico Italia assunzione bando amministrazione selezione",
    "italia_googlenews", undefined, "it");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Cuba — Indeed (co con filtro) + Google News fallback
// (Indeed no opera directamente en Cuba)
// ─────────────────────────────────────────────────────────────
async function scrapeCuba(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const ct = await scrapeComputrabajo("cu", "CU", "cuba_concursar");
  if (ct.rows.length > 0) return ct;
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
      "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?angebotsart=1&page=1&size=50",
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
          lugar: ort, fecha_inicio: parseFecha(eintr), fecha_cierre: sumarDias(null, 60), puestos: 1,
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
// PARSER: Reino Unido — FindAJob (portal oficial UK govt) + NHS Jobs paginado
// ─────────────────────────────────────────────────────────────
async function scrapeReinoUnido(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // 1. FindAJob — portal oficial del gobierno UK, 800+ vacantes sector público
  try {
    const r = await fetch("https://findajob.dwp.gov.uk/search?q=civil+service&pp=50", {
      headers: { "User-Agent": "curl/7.79.1", "Accept": "*/*" },
      signal: AbortSignal.timeout(15000),
    });
    const html = r.ok ? await r.text() : null;
    if (html && html.includes('class="search-result"')) {
      const parts = html.split('<div class="search-result" data-aid="');
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const aidMatch = part.match(/^(\d+)"/);
        if (!aidMatch) continue;
        const aid = aidMatch[1];
        const content = part.slice(0, 3000);

        const href  = content.match(/href="(https:\/\/findajob\.dwp\.gov\.uk\/details\/\d+)"/)?.[1];
        const titulo = content.match(/<a class="govuk-link"[^>]*>\s*([\s\S]*?)\s*<\/a>/)?.[1]?.replace(/\s+/g, " ").trim();
        if (!titulo || titulo.length < 3) continue;
        if (rows.some(r => r.fuente_id === aid)) continue;

        const org  = content.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() ?? null;
        const spans = [...content.matchAll(/<span>([^<]+)<\/span>/g)].map(m => m[1].trim());
        const loc  = spans.find(s => !s.startsWith("£")) ?? "United Kingdom";
        const desc = content.match(/search-result-description">\s*([\s\S]*?)\s*<\/p>/)?.[1]
          ?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 600) ?? null;

        rows.push({
          fuente_id: aid, fuente: "uk_findajob", pais: "GB",
          numero_llamado: aid, titulo, cargo: titulo,
          organismo: org, descripcion: desc,
          requisitos: null, tipo_tarea: null, tipo_vinculo: null,
          lugar: loc, fecha_inicio: null, fecha_cierre: sumarDias(null, 45),
          puestos: 1,
          url_detalle:     href ?? `https://findajob.dwp.gov.uk/details/${aid}`,
          url_postulacion: href ?? `https://findajob.dwp.gov.uk/details/${aid}`,
          keywords: extraerKeywords(`${titulo} ${org ?? ""} ${desc ?? ""}`),
          activo: true,
        });
      }
      if (rows.length > 5) return { rows, errores };
      errores.push(`GB: FindAJob accesible pero solo ${rows.length} ítems parseados`);
    } else {
      errores.push("GB: FindAJob inaccesible o bloqueado desde cloud");
    }
  } catch (e) {
    errores.push(`GB: FindAJob error — ${(e as Error).message}`);
  }

  // 2. NHS Jobs — paginar 5 páginas (10 por página = 50 vacantes)
  const nhsBase = "https://www.jobs.nhs.uk/candidate/search/results?keyword=&location=&distance=200&language=en&resultsPerPage=20&page=";
  for (let page = 1; page <= 5; page++) {
    const html = await fetchUrl(`${nhsBase}${page}`, 12000);
    if (!html || !html.includes('id="job-title-')) continue;

    const ids = [...html.matchAll(/id="job-title-(\d+)"/g)].map(m => m[1]);
    for (const id of ids) {
      const start = html.indexOf(`id="job-title-${id}"`);
      const nextId = String(parseInt(id) + 1);
      const end = html.indexOf(`id="job-title-${nextId}"`, start);
      const block = html.slice(start, end > 0 ? end : start + 3000);

      const href  = block.match(/href="(\/candidate\/jobadvert\/[^"?]+)/)?.[1] ?? "";
      const ref   = href.split("/").pop() ?? `${page}-${id}`;
      const titulo = block.match(/data-test="search-result-job-title"[^>]*>\s*([\s\S]*?)\s*<\/a>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
      if (!titulo || titulo.length < 3) continue;

      const fuente_id = `nhs${ref.replace(/\W/g, "")}`.slice(-48);
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      const txt      = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const empleador = block.match(/data-test="search-result-location"[\s\S]*?<h3[^>]*>\s*([\s\S]*?)\s*<div/)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
      const salario  = txt.match(/Salary:\s*(.{3,60}?)(?:\s+Date posted|\s+Closing|$)/)?.[1]?.trim() ?? null;
      const cierre   = txt.match(/Closing date:\s*(\d{1,2}\s+\w+\s+\d{4})/)?.[1] ?? null;
      const lugar    = block.match(/class="location-font-size">\s*([\s\S]*?)\s*<\/div>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "United Kingdom";

      rows.push({
        fuente_id, fuente: "uk_nhsjobs", pais: "GB",
        numero_llamado: ref || null, titulo, cargo: titulo,
        organismo: empleador,
        descripcion: salario ? `Salary: ${salario}` : null,
        requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar, fecha_inicio: null,
        fecha_cierre: cierre ? parseFecha(cierre) : sumarDias(null, 30),
        puestos: 1,
        url_detalle:     `https://www.jobs.nhs.uk${href}`,
        url_postulacion: `https://www.jobs.nhs.uk${href}`,
        keywords: extraerKeywords(titulo + " " + (empleador ?? "")),
        activo: true,
      });
    }
  }
  if (rows.length > 0) return { rows, errores };
  errores.push("GB: NHS Jobs inaccesible");

  // 3. Google News último recurso
  const gn = await scrapeGoogleNews("GB",
    "UK civil service government jobs vacancy hiring 2026",
    "uk_googlenews", "GB", "en", 14);
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Estados Unidos — USAJobs REST API oficial
// ─────────────────────────────────────────────────────────────
async function scrapeEstadosUnidos(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const apiKey = Deno.env.get("USAJOBS_API_KEY") ?? "";

  try {
    // Paginar 3 páginas para obtener hasta 3000 resultados
    const allItems: Record<string, unknown>[] = [];
    for (let page = 1; page <= 2; page++) {
      const res = await fetch(
        `https://data.usajobs.gov/api/search?ResultsPerPage=1000&Page=${page}&SortField=CloseDate&SortDirection=Desc`,
        {
          headers: {
            "Host": "data.usajobs.gov",
            "User-Agent": "alejandrodslp@gmail.com",
            "Authorization-Key": apiKey,
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) { errores.push(`US: USAJobs API page ${page} status ${res.status}`); break; }
      const data = await res.json();
      const items: Record<string, unknown>[] = data?.SearchResult?.SearchResultItems ?? [];
      allItems.push(...items);
      if (items.length < 1000) break; // última página
    }

    if (allItems.length > 0) {
      const items = allItems;

      for (const item of items.slice(0, 2000)) {
        const d = item.MatchedObjectDescriptor as Record<string, unknown>;
        if (!d) continue;

        const titulo    = (d.PositionTitle ?? "") as string;
        const organismo = (d.OrganizationName ?? d.DepartmentName ?? "") as string;
        const id        = (d.PositionID ?? item.MatchedObjectId ?? "") as string;
        const url       = ((d.ApplyURI as string[])?.[0] ?? d.PositionURI ?? "") as string;
        const lugar     = (d.PositionLocationDisplay ?? "") as string;
        const cierre    = (d.ApplicationCloseDate ?? d.PositionEndDate ?? "") as string;
        const desc      = (d.QualificationSummary ?? "") as string;

        if (!titulo || titulo.length < 4) continue;
        const fuente_id = String(id).replace(/\W/g, "").slice(-48) || titulo.replace(/\W/g, "").slice(0, 48);
        if (rows.some(r => r.fuente_id === fuente_id)) continue;

        rows.push({
          fuente_id, fuente: "usa_usajobs", pais: "US",
          numero_llamado: id || null,
          titulo: organismo ? `${titulo} — ${organismo}` : titulo,
          cargo: titulo, organismo: organismo || null,
          descripcion: (desc as string).slice(0, 600), requisitos: null,
          tipo_tarea: null, tipo_vinculo: null,
          lugar: lugar || "United States",
          fecha_inicio: null, fecha_cierre: parseFecha(cierre),
          puestos: 1,
          url_detalle: url || null, url_postulacion: url || null,
          keywords: extraerKeywords(titulo + " " + organismo), activo: true,
        });
      }
    } else {
      errores.push(`US: USAJobs API sin resultados`);
    }
  } catch (e) {
    errores.push(`US: USAJobs API error — ${(e as Error).message}`);
  }

  if (rows.length > 0) return { rows, errores };

  const gn = await scrapeGoogleNews("US",
    "USA federal government jobs vacancy hiring civil service",
    "usa_googlenews", "US", "en");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Canadá — Job Bank GC (portal federal accesible) + PSC fallback
// ─────────────────────────────────────────────────────────────
async function scrapeCanada(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // 1. Job Bank Canada — portal oficial del gobierno canadiense, sin geo-block
  const jbUrl = "https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=&locationstring=&action=search&lang=en";
  const jbHtml = await fetchUrl(jbUrl, 15000);
  if (jbHtml && jbHtml.includes('article id="article-')) {
    const ids = [...jbHtml.matchAll(/article id="article-(\d+)"/g)].map(m => m[1]);
    for (const jobId of ids.slice(0, 40)) {
      const start = jbHtml.indexOf(`article id="article-${jobId}"`);
      const end   = jbHtml.indexOf(`<article id="article-`, start + 10);
      const block = jbHtml.slice(start, end > 0 ? end : start + 3000);

      const titulo   = block.match(/class="noctitle">\s*([\s\S]*?)\s*<\/span>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
      const fecha    = block.match(/class="date">\s*([^<]+)/)?.[1]?.trim() ?? "";
      const empresa  = block.match(/class="business">\s*([^<]+)/)?.[1]?.trim() ?? null;
      const ubicRaw  = block.match(/Location<\/span>\s*([\s\S]*?)\s*<\/li>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "Canada";

      if (!titulo || titulo.length < 3) continue;
      const fuente_id = `jobbank_${jobId}`;
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id, fuente: "canada_jobbank", pais: "CA",
        numero_llamado: jobId,
        titulo, cargo: titulo,
        organismo: empresa,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: ubicRaw,
        fecha_inicio: parseFecha(fecha),
        fecha_cierre: sumarDias(parseFecha(fecha), 45),
        puestos: 1,
        url_detalle:    `https://www.jobbank.gc.ca/jobsearch/jobposting/${jobId}`,
        url_postulacion:`https://www.jobbank.gc.ca/jobsearch/jobposting/${jobId}`,
        keywords: extraerKeywords(`${titulo} ${empresa ?? ""} ${ubicRaw}`),
        activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("CA: Job Bank accesible pero sin ítems parseables");
  } else {
    errores.push("CA: Job Bank inaccesible");
  }

  // 2. PSC RSS (usualmente bloqueado)
  const pscUrl = "https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.htm?poster=1&psrsection=sch&lang=english&action=searchbykey&key=jobs_rss";
  const xml = await fetchViaProxy(pscUrl) ?? await fetchViaScraperAPI(pscUrl, "ca") ?? await fetchUrl(pscUrl, 12000);
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
  }

  // 3. Google News último recurso
  const gn = await scrapeGoogleNews("US",
    "Canada federal government jobs GC Jobs public service hiring",
    "canada_googlenews", "CA", "en", 14);
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Australia — Victoria Careers (1.976 empleos gobierno VIC) + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeAustralia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // 1. Victoria Careers — sitemap.xml público, 1.900+ vacantes gobierno de Victoria
  const sitemapXml = await fetchUrl("https://www.careers.vic.gov.au/sitemap.xml", 15000);
  if (sitemapXml && sitemapXml.includes("/job/")) {
    type JobEntry = { url: string; slug: string; lastmod: string };
    const jobMatches = [...sitemapXml.matchAll(/<loc>(https:\/\/www\.careers\.vic\.gov\.au\/job\/([^<]+))<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
    const jobs: JobEntry[] = jobMatches.map(m => ({ url: m[1], slug: m[2], lastmod: m[3] }));
    jobs.sort((a, b) => b.lastmod.localeCompare(a.lastmod));

    // Fetch top 40 en paralelo
    const fetched = await Promise.all(
      jobs.slice(0, 40).map(job =>
        fetchUrl(job.url, 10000).then(html => ({ job, html })).catch(() => ({ job, html: null as string | null }))
      )
    );

    for (const { job, html } of fetched) {
      if (!html) continue;
      const titulo = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1]?.trim() ??
                     job.slug.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (!titulo || titulo.length < 3) continue;

      const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/)?.[1] ?? "";
      const lugar  = ogDesc.match(/Location:\s*([^.]+)/)?.[1]?.trim() ?? "Victoria, Australia";
      const cierreStr = ogDesc.match(/Applications close:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

      // Organismo: a veces el título tiene formato "Cargo - Organismo"
      const dashIdx = titulo.lastIndexOf(" - ");
      const organismo = dashIdx > 10 ? titulo.slice(dashIdx + 3).trim() : null;

      const jobId = job.slug.match(/(\d+)$/)?.[1] ?? job.slug;
      const fuente_id = `vicjobs_${jobId}`;
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id, fuente: "australia_vicjobs", pais: "AU",
        numero_llamado: jobId,
        titulo, cargo: titulo,
        organismo: organismo || null,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar,
        fecha_inicio: parseFecha(job.lastmod),
        fecha_cierre: cierreStr ? parseFecha(cierreStr) : sumarDias(null, 30),
        puestos: 1,
        url_detalle: job.url,
        url_postulacion: job.url,
        keywords: extraerKeywords(`${titulo} ${organismo ?? ""} ${lugar}`),
        activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("AU: Victoria Careers accesible pero sin ítems parseables");
  } else {
    errores.push("AU: Victoria Careers sitemap inaccesible");
  }

  // 2. Google News como último recurso
  const gn = await scrapeGoogleNews("US",
    "Australia government jobs APS hiring vacancy public service recruitment",
    "australia_googlenews", "AU", "en", 14);
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// PARSER: Francia — EmploiPublic.fr sitemap (536 ofertas públicas) + Google News
// ─────────────────────────────────────────────────────────────
async function scrapeFrancia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  // 1. EmploiPublic.fr — sitemap_offres.xml, 500+ empleos públicos de Francia
  const sitemapXml = await fetchUrl("https://www.emploipublic.fr/sitemaps/sitemap_offres.xml", 15000);
  if (sitemapXml && sitemapXml.includes("/offre-emploi/")) {
    type JobEntry = { url: string; slug: string; id: string; lastmod: string };
    const jobMatches = [...sitemapXml.matchAll(/<loc>(https:\/\/www\.emploipublic\.fr\/offre-emploi\/offre-emploi-([^<]+))<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
    const jobs: JobEntry[] = jobMatches.map(m => {
      const slug = m[2];
      const id = slug.includes("-o-") ? slug.split("-o-").pop()! : slug.slice(-8);
      return { url: m[1], slug, id, lastmod: m[3] };
    });
    jobs.sort((a, b) => b.lastmod.localeCompare(a.lastmod));

    // Fetch top 40 en paralelo
    const fetched = await Promise.all(
      jobs.slice(0, 40).map(job =>
        fetchUrl(job.url, 10000).then(html => ({ job, html })).catch(() => ({ job, html: null as string | null }))
      )
    );

    for (const { job, html } of fetched) {
      if (!html) continue;
      // JSON-LD JobPosting (fuente más fiable)
      const ldRaw = html.match(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/)?.[1];
      let titulo = "", organismo: string | null = null, lugar: string | null = null;
      let fechaInicio: string | null = null, fechaCierre: string | null = null;
      if (ldRaw) {
        try {
          const ld = JSON.parse(ldRaw);
          if (ld["@type"] === "jobPosting" || ld["@type"] === "JobPosting") {
            titulo = (ld.title ?? ld.name ?? "") as string;
            organismo = (ld.hiringOrganization?.name ?? ld.hiringOrganization ?? null) as string | null;
            lugar = (ld.jobLocation?.address?.addressLocality ?? ld.jobLocation?.name ?? null) as string | null;
            fechaInicio = parseFecha((ld.datePosted ?? "") as string);
            fechaCierre = parseFecha((ld.validThrough ?? "") as string);
          }
        } catch { /* JSON parse error */ }
      }
      // Fallback og:title
      if (!titulo) {
        const ogTitle = html.match(/property="og:title"[^>]*content="([^"]+)"/)?.[1] ?? "";
        titulo = ogTitle.replace(/\s*-\s*Offre d.emploi.*$/i, "").trim();
        if (!lugar) lugar = ogTitle.match(/Offre d.emploi,\s*([^"]+)$/i)?.[1]?.trim() ?? null;
        if (!organismo) organismo = html.match(/chez\s+([^-]{3,80})\s+-/i)?.[1]?.trim() ?? null;
      }
      if (!titulo || titulo.length < 3) continue;

      const fuente_id = `emploipublic_${job.id}`;
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id, fuente: "francia_emploipublic", pais: "FR",
        numero_llamado: job.id,
        titulo, cargo: titulo,
        organismo,
        descripcion: null, requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: lugar ?? "Francia",
        fecha_inicio: fechaInicio,
        fecha_cierre: fechaCierre ?? sumarDias(fechaInicio, 30),
        puestos: 1,
        url_detalle: job.url,
        url_postulacion: job.url,
        keywords: extraerKeywords(`${titulo} ${organismo ?? ""} ${lugar ?? ""}`),
        activo: true,
      });
    }
    if (rows.length > 0) return { rows, errores };
    errores.push("FR: EmploiPublic.fr accesible pero sin ítems parseables");
  } else {
    errores.push("FR: EmploiPublic.fr sitemap inaccesible");
  }

  // 2. Google News como último recurso
  const gn = await scrapeGoogleNews("FR",
    "concours fonction publique France emploi recrutement poste administration",
    "francia_googlenews", undefined, "fr");
  return { rows: gn.rows, errores: [...errores, ...gn.errores] };
}

// ─────────────────────────────────────────────────────────────
// SUECIA — JobTech API (Arbetsförmedlingen) · sv
// 47k+ empleos, JSON estructurado: employer, city, deadline
// ─────────────────────────────────────────────────────────────
async function scrapeSweden(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const json = await fetchUrl(
    "https://jobsearch.api.jobtechdev.se/search?limit=50&sort=pubdate-desc",
    15000,
    { "Accept": "application/json" }
  );
  if (!json) return { rows, errores: ["SE: JobTech API inaccesible"] };

  let data: { hits?: unknown[] };
  try { data = JSON.parse(json); } catch { return { rows, errores: ["SE: JobTech API JSON inválido"] }; }

  const hits = Array.isArray(data.hits) ? data.hits as Record<string, unknown>[] : [];
  for (const hit of hits) {
    const titulo = (hit.headline as string) ?? "";
    if (!titulo || titulo.length < 3) continue;

    const emp    = hit.employer as Record<string, string> | null;
    const adr    = hit.workplace_address as Record<string, string> | null;
    const organismo = emp?.name ?? null;
    const lugar  = adr?.city ?? adr?.municipality ?? "Sverige";
    const url    = (hit.webpage_url as string) ?? null;
    const fechaInicio = parseFecha((hit.publication_date as string) ?? "");
    const deadlineRaw = hit.application_deadline as string | null;
    const fechaCierre = deadlineRaw ? parseFecha(deadlineRaw) : sumarDias(fechaInicio, 30);
    const fuente_id = `jobtechse_${hit.id as string ?? titulo.replace(/\W/g, "").slice(0, 30)}`;

    rows.push({
      fuente_id, fuente: "suecia_jobtechapi", pais: "SE",
      numero_llamado: null, titulo, cargo: titulo,
      organismo, descripcion: null, requisitos: null,
      tipo_tarea: null, tipo_vinculo: null, lugar,
      fecha_inicio: fechaInicio, fecha_cierre: fechaCierre,
      puestos: 1,
      url_detalle: url, url_postulacion: url,
      keywords: extraerKeywords(titulo + " " + (organismo ?? "")), activo: true,
    });
  }

  if (rows.length === 0) errores.push("SE: JobTech sin resultados");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// NORUEGA — NAV Arbeidsplassen sitemap + og:title · nb
// 16k+ empleos, SSR meta tags, sin employer/lugar en HTML estático
// ─────────────────────────────────────────────────────────────
async function scrapeNorway(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const sitemapXml = await fetchUrl("https://arbeidsplassen.nav.no/stillinger/sitemap.xml", 15000);
  if (!sitemapXml || !sitemapXml.includes("stilling/")) {
    return { rows, errores: ["NO: NAV sitemap inaccesible"] };
  }

  type JobEntry = { url: string; uuid: string; lastmod: string };
  const matches = [...sitemapXml.matchAll(
    /<loc>(https:\/\/arbeidsplassen\.nav\.no\/stillinger\/stilling\/([a-f0-9-]{36}))<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g
  )];
  const jobs: JobEntry[] = matches.map(m => ({ url: m[1], uuid: m[2], lastmod: m[3] }));
  jobs.sort((a, b) => b.lastmod.localeCompare(a.lastmod));

  // Fetch en lotes de 20 para no saturar el servidor
  const slicedJobs = jobs.slice(0, 80);
  for (let i = 0; i < slicedJobs.length; i += 20) {
    const batch = slicedJobs.slice(i, i + 20);
    const fetched = await Promise.all(
      batch.map(job =>
        fetchUrl(job.url, 10000)
          .then(html => ({ job, html }))
          .catch(() => ({ job, html: null as string | null }))
      )
    );
    for (const { job, html } of fetched) {
      if (!html) continue;
      const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1]?.trim() ?? null;
      const ogDesc  = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/)?.[1]?.trim() ?? null;
      if (!ogTitle) continue;
      const titulo = ogTitle.replace(/\s*-\s*arbeidsplassen\.no\s*$/i, "").trim();
      const fechaInicio = parseFecha(job.lastmod);
      rows.push({
        fuente_id: `nav_${job.uuid}`,
        fuente: "noruega_nav", pais: "NO",
        numero_llamado: null, titulo, cargo: titulo,
        organismo: null, descripcion: ogDesc?.slice(0, 500) ?? null,
        requisitos: null, tipo_tarea: null, tipo_vinculo: null,
        lugar: "Norge",
        fecha_inicio: fechaInicio, fecha_cierre: sumarDias(fechaInicio, 30),
        puestos: 1,
        url_detalle: job.url, url_postulacion: job.url,
        keywords: extraerKeywords(titulo + " " + (ogDesc ?? "")), activo: true,
      });
    }
  }

  // Google News como suplemento
  const seen = new Set<string>(rows.map(r => r.fuente_id));
  const [gn1, gn2] = await Promise.all([
    scrapeGoogleNews("NO", "Norway government job recruitment vacancy 2026 offentlig stilling", "noruega_googlenews", "NO", "no", 25),
    scrapeGoogleNews("NO", "Norge stilling offentlig sektor ledige jobber 2026 kommune fylke stat", "noruega_googlenews2", "NO", "no", 20),
  ]);
  for (const x of [...gn1.rows, ...gn2.rows]) {
    if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); }
  }
  errores.push(...gn1.errores, ...gn2.errores);

  if (rows.length === 0) errores.push("NO: NAV sin resultados parseables");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// SUIZA — jobs.ch + jobscout24.ch + Google News (DE/FR/IT)
// ~86.000 vacantes activas. Principal mercado laboral europeo
// con escasez estructural de trabajadores en múltiples sectores.
// ─────────────────────────────────────────────────────────────
async function scrapeSuiza(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();

  // 1. jobs.ch — listado de nuevas vacantes (300 empleos por página)
  // Los UUIDs y titles están en el mismo orden en el HTML
  const jobsChPages = [1, 2, 3];
  await Promise.all(jobsChPages.map(async (page) => {
    const url = `https://www.jobs.ch/en/new-vacancies/?page=${page}`;
    const html = await fetchUrl(url, 15000);
    if (!html) { errores.push(`CH: jobs.ch página ${page} inaccesible`); return; }
    const uuids  = [...html.matchAll(/\/en\/vacancies\/detail\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//g)].map(m => m[1]);
    const titles = [...html.matchAll(/"title":"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
    const count  = Math.min(uuids.length, titles.length);
    for (let j = 0; j < count; j++) {
      const uuid   = uuids[j];
      const titulo = titles[j].trim();
      if (!titulo || titulo.length < 4) continue;
      const fuente_id = `jobsch_${uuid}`;
      if (seen.has(fuente_id)) continue;
      seen.add(fuente_id);
      rows.push({
        fuente_id, fuente: "suiza_jobsch", pais: "CH",
        numero_llamado: null, titulo, cargo: titulo,
        organismo: null, descripcion: null, requisitos: null,
        tipo_tarea: null, tipo_vinculo: "privado",
        lugar: "Suiza", fecha_inicio: null,
        fecha_cierre: sumarDias(null, 30),
        puestos: 1,
        url_detalle: `https://www.jobs.ch/en/vacancies/detail/${uuid}/`,
        url_postulacion: `https://www.jobs.ch/en/vacancies/detail/${uuid}/`,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }));

  // 2. jobscout24.ch — mayor volumen, misma estructura HTML
  const scoutPages = [1, 2, 3];
  await Promise.all(scoutPages.map(async (page) => {
    const url = `https://www.jobscout24.ch/en/jobs?p=${page}&sort=date`;
    const html = await fetchUrl(url, 15000, { "Accept-Language": "en-CH,en;q=0.9,de;q=0.8" });
    if (!html) { errores.push(`CH: jobscout24 página ${page} inaccesible`); return; }
    const linkRe = /href="\/en\/job\/([a-zA-Z0-9_-]{8,60})\/"[^>]*>[\s\S]{0,400}?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const slug   = m[1];
      const titulo = stripHtml(m[2]).trim();
      if (!titulo || titulo.length < 4) continue;
      const fuente_id = `jobscout24_${slug}`;
      if (seen.has(fuente_id)) continue;
      seen.add(fuente_id);
      rows.push({
        fuente_id, fuente: "suiza_jobscout24", pais: "CH",
        numero_llamado: null, titulo, cargo: titulo,
        organismo: null, descripcion: null, requisitos: null,
        tipo_tarea: null, tipo_vinculo: "privado",
        lugar: "Suiza", fecha_inicio: null,
        fecha_cierre: sumarDias(null, 30),
        puestos: 1,
        url_detalle: `https://www.jobscout24.ch/en/job/${slug}/`,
        url_postulacion: `https://www.jobscout24.ch/en/job/${slug}/`,
        keywords: extraerKeywords(titulo), activo: true,
      });
    }
  }));

  // 3. Google News en 3 idiomas (DE, FR, IT) — captura anuncios de empleo de todo el país
  const [gnDE, gnFR, gnIT, gnEN] = await Promise.all([
    scrapeGoogleNews("CH", "Stellenangebot Schweiz 2026 offene Stellen Kanton", "suiza_de", "CH", "de", 30),
    scrapeGoogleNews("CH", "offre emploi suisse 2026 poste ouvert canton", "suiza_fr", "CH", "fr", 25),
    scrapeGoogleNews("CH", "offerta lavoro svizzera 2026 posto vacante ticino", "suiza_it", "CH", "it", 20),
    scrapeGoogleNews("CH", "Switzerland job vacancy hiring 2026 public private sector", "suiza_en", "CH", "en", 20),
  ]);
  for (const gn of [gnDE, gnFR, gnIT, gnEN]) {
    for (const r of gn.rows) {
      if (!seen.has(r.fuente_id)) { seen.add(r.fuente_id); rows.push(r); }
    }
    errores.push(...gn.errores);
  }

  if (rows.length === 0) errores.push("CH: sin resultados en ninguna fuente");
  console.log(`CH: ${rows.length} empleos obtenidos`);
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// JAPÓN — NPA jinji.go.jp tabla HTML · ja
// ~85 convocatorias oficiales (常勤/任期付/非常勤), tablas 2-4
// ─────────────────────────────────────────────────────────────
async function scrapeJapan(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];

  const html = await fetchUrl(
    "https://www.jinji.go.jp/saiyo/saiyo/sonota/koubo_joho.html", 15000
  );
  if (!html) return { rows, errores: ["JP: NPA page inaccesible"] };

  const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];

  for (const tableMatch of tableMatches.slice(2, 5)) {
    const tableHtml = tableMatch[1];
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

    for (const rowMatch of rowMatches.slice(1)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      if (cells.length < 3) continue;

      const stripCell = (c: string) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const organismo = stripCell(cells[0]?.[1] ?? "") || null;
      const lugar     = stripCell(cells[1]?.[1] ?? "") || "日本";
      const cell2     = cells[2]?.[1] ?? "";
      const jobUrl    = cell2.match(/href="([^"]+)"/)?.[1] ?? null;
      const titulo    = stripCell(cell2)
        .replace(/※詳細[\s\S]*$/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!titulo || titulo.length < 3) continue;

      const rawId = `${(organismo ?? "").replace(/[\s()（）]/g, "").slice(0, 15)}_${titulo.replace(/[\s()（）]/g, "").slice(0, 20)}`;
      const fuente_id = `npa_${rawId}`;
      if (rows.some(r => r.fuente_id === fuente_id)) continue;

      rows.push({
        fuente_id, fuente: "japon_npa", pais: "JP",
        numero_llamado: null, titulo, cargo: titulo,
        organismo, descripcion: null, requisitos: null,
        tipo_tarea: null, tipo_vinculo: null, lugar,
        fecha_inicio: null, fecha_cierre: sumarDias(null, 45),
        puestos: 1,
        url_detalle: jobUrl, url_postulacion: jobUrl,
        keywords: extraerKeywords(titulo + " " + (organismo ?? "")), activo: true,
      });
    }
  }

  if (rows.length === 0) {
    errores.push("JP: NPA sin resultados parseables");
    const gn = await scrapeGoogleNews("US", "Japan government jobs recruitment vacancy 2026", "japon_googlenews", "JP", "en", 21);
    return { rows: gn.rows, errores: [...errores, ...gn.errores] };
  }
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// INDIA — Employment News RSS + Google News backup
// ─────────────────────────────────────────────────────────────
async function scrapeIndia(): Promise<{ rows: ConcursoRow[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: ConcursoRow[] = [];
  const seen = new Set<string>();
  const addRows = (r: ConcursoRow[]) => { for (const x of r) { if (!seen.has(x.fuente_id)) { seen.add(x.fuente_id); rows.push(x); } } };

  // Employment News RSS oficial del gobierno indio
  const xml = await fetchUrl("https://www.employmentnews.gov.in/RSS/EmploymentNews.xml", 12000);
  if (xml && xml.includes("<item>")) {
    const items = extraerItems(xml);
    for (const item of items.slice(0, 60)) {
      const titulo  = extraerTag(item, "title");
      const link    = extraerTag(item, "link");
      const guid    = extraerTag(item, "guid");
      const pubDate = extraerTag(item, "pubDate");
      const desc    = stripHtml(extraerTag(item, "description"));
      if (!titulo || titulo.length < 6) continue;
      const fuente_id = (guid || link).replace(/[^a-zA-Z0-9]/g, "").slice(-48);
      if (seen.has(fuente_id)) continue;
      seen.add(fuente_id);
      const fechaPub = parseFecha(pubDate);
      rows.push({
        fuente_id, fuente: "india_employmentnews", pais: "IN",
        numero_llamado: null, titulo, cargo: titulo, organismo: null,
        descripcion: desc.slice(0, 600), requisitos: null,
        tipo_tarea: null, tipo_vinculo: "publico", lugar: null,
        fecha_inicio: fechaPub, fecha_cierre: sumarDias(fechaPub, 30),
        puestos: 1,
        url_detalle: link.startsWith("http") ? link : null,
        url_postulacion: link.startsWith("http") ? link : null,
        keywords: extraerKeywords(titulo + " " + desc), activo: true,
      });
    }
  } else {
    errores.push("IN: Employment News RSS sin items");
  }

  // 3 Google News en paralelo para cubrir UPSC, SSC, PSC, state boards
  const [gn1, gn2, gn3] = await Promise.all([
    scrapeGoogleNews("IN", "India government recruitment 2026 vacancy apply UPSC SSC NHM", "india_googlenews", "IN", "en", 25),
    scrapeGoogleNews("IN", "India sarkari naukri government job 2026 online recruitment board vacancy", "india_googlenews2", "IN", "en", 25),
    scrapeGoogleNews("IN", "India state government PSC recruitment vacancy notification 2026", "india_googlenews3", "IN", "en", 20),
  ]);
  addRows(gn1.rows); errores.push(...gn1.errores);
  addRows(gn2.rows); errores.push(...gn2.errores);
  addRows(gn3.rows); errores.push(...gn3.errores);

  if (rows.length === 0) errores.push("IN: sin resultados en ninguna fuente");
  return { rows, errores };
}

// ─────────────────────────────────────────────────────────────
// ALERTA ADMIN — caída detectada en un país
// ─────────────────────────────────────────────────────────────
async function enviarAlertaAdmin(pais: string, antes: number, despues: number): Promise<void> {
  const pct = Math.round((1 - despues / antes) * 100);
  const mensaje = `⚠️ ${pais}: ${despues} llamados (antes: ${antes}, caída: -${pct}%)`;
  console.warn(`ALERTA SCRAPER: ${mensaje}`);

  // Guardar en tabla de alertas
  await supabase.from("scraper_alertas").insert({
    pais, llamados_antes: antes, llamados_despues: despues,
    pct_caida: pct, mensaje,
  }).then(() => {}).catch(() => {});

  // El email se consolida en el resumen diario — no se envía email individual por caída
}

// ─────────────────────────────────────────────────────────────
// RESUMEN DIARIO
// ─────────────────────────────────────────────────────────────
const PAISES_NOMBRES: Record<string, string> = {
  UY:"Uruguay", AR:"Argentina", BR:"Brasil", CL:"Chile", CO:"Colombia",
  PE:"Peru", PY:"Paraguay", BO:"Bolivia", EC:"Ecuador", MX:"Mexico",
  VE:"Venezuela", CU:"Cuba", CR:"Costa Rica", GT:"Guatemala", SV:"El Salvador",
  HN:"Honduras", NI:"Nicaragua", PA:"Panama", DO:"Rep. Dominicana",
  ES:"Espana", PT:"Portugal", IT:"Italia", FR:"Francia", DE:"Alemania",
  GB:"Reino Unido", SE:"Suecia", NO:"Noruega", CH:"Suiza",
  US:"Estados Unidos", CA:"Canada", AU:"Australia", JP:"Japon", IN:"India",
};
const TODOS_PAISES = Object.keys(PAISES_NOMBRES);

async function enviarResumenDiario(): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) { console.log("RESEND_API_KEY no configurada, omitiendo resumen diario"); return; }

  // Activos por país — GROUP BY en SQL para evitar el límite de 1000 filas
  const { data: conteoData } = await supabase.rpc("contar_concursos_por_pais");
  const conteos: Record<string, number> = {};
  for (const r of (conteoData ?? []) as {pais:string; total:number}[]) conteos[r.pais] = Number(r.total);

  // Logs de las últimas 48h por país (errores + retry)
  const hace48h = new Date(Date.now() - 172800000).toISOString();
  const { data: logs } = await supabase
    .from("scraper_logs")
    .select("pais, ejecutado_en, total_scrapeados, ok, errores")
    .gte("ejecutado_en", hace48h)
    .order("ejecutado_en", { ascending: false });

  const ultimoLog: Record<string, { hora: string; scrapeados: number; ok: boolean; errores: string[] }> = {};
  for (const l of logs ?? []) {
    if (!ultimoLog[l.pais]) {
      ultimoLog[l.pais] = {
        hora: new Date(l.ejecutado_en).toISOString().slice(11, 16) + " UTC",
        scrapeados: l.total_scrapeados ?? 0,
        ok: l.ok ?? false,
        errores: l.errores ?? [],
      };
    }
  }

  const total = TODOS_PAISES.reduce((s, p) => s + (conteos[p] ?? 0), 0);
  const enRojo = TODOS_PAISES.filter(p => (conteos[p] ?? 0) < 20);

  const fecha = new Date().toLocaleDateString("es-UY", {timeZone:"America/Montevideo", day:"2-digit", month:"2-digit", year:"numeric"});
  const hora  = new Date().toLocaleTimeString("es-UY", {timeZone:"America/Montevideo", hour:"2-digit", minute:"2-digit"});

  // ── Armar tabla HTML ────────────────────────────────────────
  const filasPaises = TODOS_PAISES.map(p => {
    const n = conteos[p] ?? 0;
    const nombre = PAISES_NOMBRES[p] ?? p;
    const ok = n >= 20;
    const bg = ok ? "#ffffff" : "#fff3cd";
    const color = ok ? "#1a7a1a" : "#c0392b";
    const estado = ok ? "✅ OK" : "⚠️ Revisar";
    return `<tr style="background:${bg}">
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${nombre}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${color}">${n}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${color}">${estado}</td>
    </tr>`;
  }).join("");

  // Errores y correcciones
  // Alertas de caídas de las últimas 24h
  const hace24h = new Date(Date.now() - 86400000).toISOString();
  const { data: alertasHoy } = await supabase
    .from("scraper_alertas")
    .select("pais, llamados_antes, llamados_despues, pct_caida, created_at")
    .gte("created_at", hace24h)
    .order("pct_caida", { ascending: false });

  const seccionCaidas = !alertasHoy?.length
    ? `<p style="color:#1a7a1a">✅ Sin caídas detectadas en las últimas 24 hs.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#c0392b;color:white">
            <th style="padding:7px 12px;text-align:left">País</th>
            <th style="padding:7px 12px;text-align:center">Antes</th>
            <th style="padding:7px 12px;text-align:center">Después</th>
            <th style="padding:7px 12px;text-align:center">Caída</th>
          </tr>
        </thead>
        <tbody>
          ${alertasHoy.map(a => `
          <tr style="background:#fff5f5">
            <td style="padding:6px 12px;border-bottom:1px solid #eee"><b>${PAISES_NOMBRES[a.pais] ?? a.pais}</b></td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${a.llamados_antes}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${a.llamados_despues}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:#c0392b;font-weight:bold">-${a.pct_caida}%</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

  const erroresEncontrados: {nombre:string; errores:string[]; corregido:boolean}[] = [];
  for (const p of TODOS_PAISES) {
    const log = ultimoLog[p];
    if (log && log.errores && log.errores.length > 0) {
      erroresEncontrados.push({
        nombre: PAISES_NOMBRES[p] ?? p,
        errores: log.errores,
        corregido: log.scrapeados > 0,
      });
    }
  }

  const seccionErrores = erroresEncontrados.length === 0
    ? `<p style="color:#1a7a1a">✅ No se detectaron fallas en el último scan.</p>`
    : erroresEncontrados.map(e => `
        <p style="margin:8px 0">
          <b>${e.nombre}</b>: ${e.corregido
            ? `<span style="color:#1a7a1a">⚠️ Error detectado pero <b>resuelto automáticamente</b> (${ultimoLog[TODOS_PAISES.find(p=>PAISES_NOMBRES[p]===e.nombre)||""]?.scrapeados??0} llamados recuperados)</span>`
            : `<span style="color:#c0392b">❌ Error no resuelto — requiere revisión manual</span>`
          }<br>
          <small style="color:#888">${e.errores.slice(0,2).join(" | ")}</small>
        </p>`).join("");

  const estadoGeneral = enRojo.length === 0
    ? `<div style="background:#d4edda;border-left:4px solid #28a745;padding:10px 16px;margin-bottom:16px;border-radius:4px"><b style="color:#155724">✅ Sistema operativo — Todo funciona correctamente</b></div>`
    : `<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:10px 16px;margin-bottom:16px;border-radius:4px"><b style="color:#856404">⚠️ Atención — ${enRojo.length} país(es) con menos de 20 llamados activos</b></div>`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#E8785A;margin-bottom:4px">Nexu — Informe diario del scraper</h2>
  <p style="color:#888;margin-top:0;font-size:13px">${fecha} ${hora} | Total: <b>${total}</b> llamados activos en <b>${TODOS_PAISES.length}</b> países</p>

  ${estadoGeneral}

  <h3 style="color:#333;font-size:14px;margin-bottom:8px">LLAMADOS ACTIVOS POR PAÍS</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#1a1a2e;color:white">
        <th style="padding:8px 12px;text-align:left">País</th>
        <th style="padding:8px 12px;text-align:center">Llamados activos</th>
        <th style="padding:8px 12px;text-align:left">Estado</th>
      </tr>
    </thead>
    <tbody>${filasPaises}</tbody>
  </table>

  <h3 style="color:#c0392b;font-size:14px;margin-top:24px;margin-bottom:8px">⚠️ CAÍDAS DETECTADAS HOY</h3>
  ${seccionCaidas}

  <h3 style="color:#333;font-size:14px;margin-top:24px;margin-bottom:8px">FALLAS EN EL ÚLTIMO SCAN</h3>
  ${seccionErrores}

  <p style="color:#bbb;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
    Generado automáticamente por Nexu Scraper
  </p>
</div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Nexu Scraper <onboarding@resend.dev>",
      to: ["alejandrodslp@gmail.com"],
      subject: `📊 Nexu ${fecha} — ${total} llamados ${enRojo.length > 0 ? "| ⚠️ " + enRojo.length + " países con problemas" : "| ✅ Todo OK"}`,
      html,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// SCRAPER PRINCIPAL — upsert a Supabase
// ─────────────────────────────────────────────────────────────
async function upsertRows(rows: ConcursoRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const validas = rows.filter(r => !r.fecha_cierre || r.fecha_cierre >= manana);
  if (validas.length === 0) return 0;
  const { error } = await supabase
    .from("concursos")
    .upsert(validas, { onConflict: "fuente,fuente_id", ignoreDuplicates: false });
  if (error) console.error("upsert error:", error.message);
  return error ? 0 : validas.length;
}

async function marcarFuenteInactiva(fuente: string) {
  await supabase.from("concursos").update({ activo: false }).eq("fuente", fuente);
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

    // Modo resumen diario
    if (body.modo === "resumen" || url.searchParams.get("modo") === "resumen") {
      await enviarResumenDiario();
      return new Response(JSON.stringify({ ok: true, mensaje: "Resumen enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      SE: scrapeSweden,
      NO: scrapeNorway,
      CH: scrapeSuiza,
      // Anglosajones
      US: scrapeEstadosUnidos,
      CA: scrapeCanada,
      AU: scrapeAustralia,
      // Asia
      JP: scrapeJapan,
      IN: scrapeIndia,
    };

    const paises = soloPais
      ? [soloPais.toUpperCase()].filter(p => SCRAPERS[p])
      : Object.keys(SCRAPERS);

    // Conteos actuales antes de scrapeary — para detectar caídas del 40%
    const cuentasAntes: Record<string, number> = {};
    if (!modoTest) {
      const { data: activos } = await supabase
        .from("concursos").select("pais").eq("activo", true);
      for (const row of (activos ?? [])) {
        cuentasAntes[row.pais] = (cuentasAntes[row.pais] ?? 0) + 1;
      }
    }

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
        const { pais, errores } = r.value;
        let rows = r.value.rows;

        // Retry si cayó más del 40% respecto al conteo anterior (hasta 2 reintentos)
        const antes = cuentasAntes[pais] ?? 0;
        if (!modoTest && antes > 10 && rows.length > 0 && rows.length < antes * 0.6) {
          console.log(`${pais}: caída detectada (${rows.length} vs ${antes} prev). Reintentando...`);
          for (let intento = 1; intento <= 2; intento++) {
            await new Promise(res => setTimeout(res, 4000 * intento));
            try {
              const { rows: r2 } = await SCRAPERS[pais]();
              if (r2.length > rows.length) rows = r2;
              if (rows.length >= antes * 0.6) break;
            } catch (_) { /* retry silencioso */ }
          }
          // Si después de reintentos sigue por debajo del 60%, alertar
          if (rows.length < antes * 0.6) {
            await enviarAlertaAdmin(pais, antes, rows.length);
          }
        }

        if (modoTest) {
          resumen[pais] = { rows_sample: rows.slice(0, 3), total: rows.length, errores };
        } else {
          const insertados = await upsertRows(rows);
          total_insertados += insertados;

          // Cleanup con piso duro: no eliminar más del 50% de los activos actuales
          let cleanupBloqueado = false;
          if (insertados >= 15 && rows.length >= 15) {
            const { count: activosActuales } = await supabase
              .from("concursos").select("*", { count: "exact", head: true })
              .eq("pais", pais).eq("activo", true);
            const total = activosActuales ?? 0;

            const fuenteGroups = new Map<string, string[]>();
            for (const row of rows) {
              if (!fuenteGroups.has(row.fuente)) fuenteGroups.set(row.fuente, []);
              fuenteGroups.get(row.fuente)!.push(row.fuente_id);
            }
            // Estimar cuántos se desactivarían
            let aBorrar = 0;
            for (const [fuente, ids] of fuenteGroups) {
              const { count } = await supabase
                .from("concursos").select("*", { count: "exact", head: true })
                .eq("fuente", fuente).eq("activo", true)
                .not("fuente_id", "in", `(${ids.map(id => `"${id.replace(/"/g, '""')}"`).join(",")})`);
              aBorrar += count ?? 0;
            }
            if (total > 0 && aBorrar > total * 0.5) {
              // Cleanup bloquado: alertar pero no borrar
              cleanupBloqueado = true;
              await enviarAlertaAdmin(pais, total, total - aBorrar);
            } else {
              for (const [fuente, ids] of fuenteGroups) {
                await supabase
                  .from("concursos")
                  .update({ activo: false })
                  .eq("fuente", fuente).eq("activo", true)
                  .not("fuente_id", "in", `(${ids.map(id => `"${id.replace(/"/g, '""')}"`).join(",")})`);
              }
            }
          }

          // Contar activos finales para el log
          const { count: activosFinal } = await supabase
            .from("concursos").select("*", { count: "exact", head: true })
            .eq("pais", pais).eq("activo", true);

          resumen[pais] = { insertados, total_scrapeados: rows.length, errores, cleanup_bloqueado: cleanupBloqueado || undefined };

          // Escribir log de ejecución
          supabase.from("scraper_logs").insert({
            pais,
            total_scrapeados: rows.length,
            total_insertados: insertados,
            activos_antes: cuentasAntes[pais] ?? 0,
            activos_despues: activosFinal ?? 0,
            errores: errores.length > 0 ? errores : [],
            ok: rows.length > 0,
          }).then(() => {}).catch(() => {});
        }
      }
    }

    // Auto-retry: si un país devolvió 0, reintenta directo con Google News (evita reintentar fuente caída)
    const GN_FALLBACK: Record<string, [string, string, string, string]> = {
      UY: ["US","Uruguay concurso público empleo convocatoria vacante","uy_googlenews","es"],
      AR: ["AR","Argentina concurso público empleo convocatoria vacante","ar_googlenews","es"],
      CL: ["CL","Chile concurso público empleo cargo vacante gobierno","cl_googlenews","es"],
      CO: ["US","Colombia empleo convocatoria concurso público cargo vacante","co_googlenews","es"],
      BR: ["US","Brasil concurso público emprego convocatória vaga governo","br_googlenews","pt"],
      PE: ["US","Perú empleo concurso público plaza vacante CAS SERVIR","pe_googlenews","es"],
      PY: ["US","Paraguay empleo convocatoria cargo público vacante","py_googlenews","es"],
      BO: ["BO","Bolivia empleo convocatoria cargo público vacante","bo_googlenews","es"],
      EC: ["EC","Ecuador empleo convocatoria cargo público vacante","ec_googlenews","es"],
      MX: ["US","México convocatoria empleo vacante gobierno plaza concurso","mx_googlenews","es"],
      VE: ["US","Venezuela empleo vacante convocatoria trabajo cargo","ve_googlenews","es"],
      CU: ["US","Cuba empleo convocatoria trabajo cargo vacante","cu_googlenews","es"],
      CR: ["CR","Costa Rica empleo convocatoria concurso servicio civil","cr_googlenews","es"],
      GT: ["GT","Guatemala empleo convocatoria cargo público vacante","gt_googlenews","es"],
      SV: ["US","El Salvador empleo vacante trabajo convocatoria cargo","sv_googlenews","es"],
      HN: ["US","Honduras empleo vacante trabajo convocatoria cargo","hn_googlenews","es"],
      NI: ["US","Nicaragua empleo vacante trabajo convocatoria cargo","ni_googlenews","es"],
      PA: ["US","Panamá empleo vacante trabajo convocatoria cargo público","pa_googlenews","es"],
      DO: ["US","República Dominicana empleo vacante trabajo convocatoria","do_googlenews","es"],
      ES: ["ES","oposición convocatoria empleo público España administración","es_googlenews","es"],
      PT: ["US","Portugal concurso emprego público administração recrutamento","pt_googlenews","pt"],
      IT: ["IT","concorso pubblico Italia assunzione bando selezione","it_googlenews","it"],
      FR: ["FR","concours fonction publique France emploi recrutement administration","fr_googlenews","fr"],
      DE: ["DE","Stellenausschreibung öffentlicher Dienst Deutschland Stelle","de_googlenews","de"],
      GB: ["GB","UK civil service government jobs vacancy hiring 2026","gb_googlenews","en"],
      SE: ["US","Sweden government jobs recruitment vacancy public service 2026","se_googlenews","en"],
      NO: ["US","Norway government jobs recruitment vacancy public service 2026","no_googlenews","en"],
      US: ["US","USA federal government jobs vacancy hiring civil service 2026","usa_googlenews","en"],
      CA: ["US","Canada federal government jobs GC Jobs public service hiring","ca_googlenews","en"],
      AU: ["US","Australia government jobs APS hiring vacancy public service","au_googlenews","en"],
      JP: ["US","Japan government jobs recruitment vacancy civil service 2026","jp_googlenews","en"],
      IN: ["IN","India government recruitment 2026 vacancy apply UPSC SSC NHM","in_googlenews","en"],
    };

    if (!modoTest) {
      const fallidos = paises.filter(p => {
        const r = resumen[p] as Record<string, unknown>;
        return r && (r.total_scrapeados as number) === 0;
      });
      if (fallidos.length > 0) {
        console.log(`Auto-retry (Google News fallback) para: ${fallidos.join(", ")}`);
        for (const pais of fallidos) {
          try {
            const fb = GN_FALLBACK[pais];
            if (!fb) continue;
            const [locale, query, fuente, lang] = fb;
            const { rows: r2, errores: e2 } = await scrapeGoogleNews(locale, query, fuente, pais, lang, 20);
            if (r2.length > 0) {
              const ins2 = await upsertRows(r2);
              total_insertados += ins2;
              resumen[pais] = { insertados: ins2, total_scrapeados: r2.length, errores: e2, retry: "google_news" };
            } else {
              (resumen[pais] as Record<string, unknown>).retry_fallido = true;
            }
          } catch (_) { /* retry silencioso */ }
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
