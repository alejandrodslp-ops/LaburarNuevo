// Helpers compartidos entre scraper-concursos y busqueda-diaria

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Diccionario de normalizaciones ────────────────────────────────────────────
// Mapea variantes con errores ortográficos (fonéticos, fonológicos, omisiones
// de tilde, castellanizaciones) a la forma canónica que usan los concursos.
// Clave: versión normalizada (sin tildes, minúsculas)
// Valor: término canónico para la búsqueda
const CORRECCIONES: Record<string, string> = {
  // Limpieza
  "limpesa":"limpieza","limpiesa":"limpieza","limpeisa":"limpieza",
  "limpiar":"limpieza","limpadora":"limpieza","limpiadora":"limpieza",
  // Niñera / cuidado infantil
  "ninia":"niñera","ninhera":"niñera","niniera":"niñera","niera":"niñera",
  "canguro":"niñera","babicitter":"niñera","babysiter":"niñera",
  // Anciano / adulto mayor
  "ansiano":"anciano","anciano":"anciano","abuela":"adulto mayor",
  "viejo":"adulto mayor","vejito":"adulto mayor","abuelo":"adulto mayor",
  // Plomería
  "plomeria":"plomería","plomero":"plomería","plumeria":"plomería",
  "caneria":"plomería","canñeria":"plomería","cañeria":"plomería",
  "gasfiter":"plomería","gasfitera":"plomería",
  // Electricidad
  "electricita":"electricista","electrisista":"electricista",
  "electrisidad":"electricista","electricidad":"electricista",
  // Albañilería
  "albanil":"albañil","albaniles":"albañil","albañileria":"albañilería",
  "masoneria":"albañilería","pared":"albañilería","cemento":"albañilería",
  // Jardinería
  "jardineria":"jardinería","cortar pasto":"jardinería","yarda":"jardinería",
  "cesped":"jardinería","jardin":"jardinería","podar":"jardinería",
  // Cocina
  "cociñar":"cocina","cozinar":"cocina","cosinero":"cocinero",
  "cocinera":"cocinero","comida":"cocina","guisar":"cocina",
  // Manejo / conducción
  "manejar":"conductor","maneho":"conductor","chofer":"conductor",
  "choffer":"conductor","taxista":"conductor","colectivero":"conductor",
  // Cuidado de personas
  "cuidar":"cuidador","cuidadora":"cuidador","enfermeria":"enfermería",
  "enfermero":"enfermería","auxiliar enfermeria":"enfermería",
  // Mandados / recados
  "mandao":"mandados","mandaos":"mandados","recado":"mandados",
  "mensajero":"mandados","mensajeria":"mandados","delivery":"mensajería",
  // Carpintería
  "carpintero":"carpintería","carpin":"carpintería","madera":"carpintería",
  "ebanista":"carpintería","muebles":"carpintería",
  // Pintura
  "pintor":"pintura","pintora":"pintura","pintar":"pintura",
  // Mecánica
  "mecanico":"mecánico","mecanica":"mecánico","motor":"mecánico",
  "automotor":"mecánico","taller":"mecánico",
  // Seguridad
  "guardia":"seguridad","vigilante":"seguridad","seguridad privada":"seguridad",
  "sereno":"seguridad","vigilancia":"seguridad",
  // Peluquería / estética
  "peluquero":"peluquería","peluquera":"peluquería","peluca":"peluquería",
  "esteticista":"estética","manicura":"estética","maquillaje":"estética",
  // Trabajo rural
  "chacra":"trabajo rural","campo":"trabajo rural","ordeñe":"trabajo rural",
  "tambero":"trabajo rural","peón rural":"trabajo rural","tractor":"tractorista",
  "tractorista":"tractorista","tropero":"trabajo rural",
  // Mudanzas / carga
  "mudanza":"mudanzas","flete":"mudanzas","carga":"mudanzas",
  "fletes":"mudanzas","acarreo":"mudanzas",
  // Mascotas
  "perro":"cuidado de animales","gato":"cuidado de animales",
  "pasear perros":"paseador de perros","paseador":"paseador de perros",
  "veterinaria":"veterinario",
  // Costura
  "coser":"costura","costurera":"costura","arreglo ropa":"costura",
  "modista":"costura","tela":"costura",
  // Repostería / panadería
  "tortas":"repostería","pastelería":"repostería","pan":"panadería",
  "panadero":"panadería","panaderia":"panadería","reposteria":"repostería",
};

// Normaliza texto libre corrigiendo errores ortográficos frecuentes
export function corregirTexto(texto: string): string {
  let result = normalizar(texto);
  // Aplicar correcciones por cada palabra/frase del diccionario
  for (const [variante, canonica] of Object.entries(CORRECCIONES)) {
    result = result.replace(new RegExp(`\\b${variante}\\b`, 'g'), canonica);
  }
  return result;
}

// Exportar diccionario para uso en el cliente (sugerencias)
export const KEYWORDS_DICT = Object.keys(CORRECCIONES);

export function normalizar(s = ''): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function extraerKeywords(texto = ''): string[] {
  texto = corregirTexto(texto);
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
