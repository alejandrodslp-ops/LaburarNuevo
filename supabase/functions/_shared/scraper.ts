// Helpers compartidos entre scraper-concursos y busqueda-diaria

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function normalizar(s = ''): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function extraerKeywords(texto = ''): string[] {
  const stop = new Set([
    'de','del','la','el','las','los','en','un','una','y','o','a','con','por',
    'para','al','se','no','es','que','sus','esta','este','lo','como','mas',
    'su','ser','tiene','han','sido','son','fue','hay','pero','the','and','for',
    'to','in','of','at','is','are','we','you','our','with','from','your','an',
    'puedo','hago','hace','hacer','soy','tengo','busco','trabajo','ofrezco',
  ]);
  return [...new Set(
    normalizar(texto).split(/\s+/).filter(w => w.length > 3 && !stop.has(w))
  )].slice(0, 12);
}

export function extraerTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim();
}

export function extraerItems(xml: string): string[] {
  const items: string[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

export function sumarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Busca en Google News RSS y devuelve rows listos para upsert en concursos
export async function scrapeGoogleNews(
  pais: string,
  query: string,
  fuente: string,
  idioma = 'es',
  limite = 20
): Promise<{ rows: Record<string, unknown>[]; errores: string[] }> {
  const errores: string[] = [];
  const rows: Record<string, unknown>[] = [];

  try {
    const q = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${q}&hl=${idioma}&gl=${pais}&ceid=${pais}:${idioma}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { errores.push(`Google News HTTP ${res.status}`); return { rows, errores }; }
    const xml = await res.text();
    const items = extraerItems(xml).slice(0, limite);

    for (const item of items) {
      const titulo = extraerTag(item, 'title');
      const link   = extraerTag(item, 'link') || extraerTag(item, 'guid');
      const fuente_str = extraerTag(item, 'source') || 'Google News';
      if (!titulo || titulo.length < 5) continue;

      const fuente_id = `${fuente}_${btoa(encodeURIComponent((link || titulo).slice(0, 60))).slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}`;

      rows.push({
        fuente_id,
        fuente,
        pais,
        numero_llamado: null,
        titulo,
        cargo:       titulo,
        organismo:   fuente_str,
        descripcion: null,
        requisitos:  null,
        tipo_tarea:  null,
        tipo_vinculo: 'google_news',
        lugar:       null,
        fecha_inicio: null,
        fecha_cierre: sumarDias(30),
        puestos:     1,
        url_detalle:     link || null,
        url_postulacion: link || null,
        keywords:    extraerKeywords(titulo),
        activo:      true,
      });
    }
  } catch (e) {
    errores.push(`scrapeGoogleNews: ${(e as Error).message}`);
  }

  return { rows, errores };
}
