import { db } from '../lib/supabase'
import { toSlug, paisSlug } from '../lib/utils'
import { SLUGS_CATEGORIA, CATEGORIAS } from '../lib/categorias'

const SITE = 'https://www.konexu.app'

const PAISES_SLUGS = [
  // Sudamérica
  'uruguay', 'argentina', 'chile', 'peru', 'colombia',
  'ecuador', 'bolivia', 'paraguay', 'brasil', 'mexico', 'venezuela',
  // Centroamérica y Caribe
  'cuba', 'costa-rica', 'guatemala', 'el-salvador',
  'honduras', 'nicaragua', 'panama', 'republica-dominicana',
  // Europa
  'espana', 'portugal', 'italia', 'francia', 'alemania',
  // Anglosajones
  'reino-unido', 'estados-unidos', 'canada', 'australia',
  // Resto del mundo
  'suecia', 'noruega', 'japon', 'india', 'suiza',
]

// Mismo criterio de inventario que la página de categoría
// (empleos/pais/[pais]/[categoria]/page.js → hayEmpleos). MANTENER EN SYNC:
// si cambia el filtro allá, replicarlo acá. Sirve para NO listar en el sitemap
// combos vacíos que la página se auto-marca noindex (un sitemap con páginas
// noindex hace que Google desconfíe de él, y crea conflicto hreflang+noindex).
async function hayEmpleos(codigo, cat) {
  let q = db.from('concursos').select('id').eq('activo', true).eq('pais', codigo).limit(1)
  if (cat.filtro.publico) {
    q = q.or('tipo_vinculo.is.null,and(tipo_vinculo.neq.privado,tipo_vinculo.neq.empleo)')
  } else if (cat.filtro.tipo_vinculo) {
    q = q.eq('tipo_vinculo', cat.filtro.tipo_vinculo)
  } else if (cat.filtro.keywords) {
    q = q.or(cat.filtro.keywords.map((k) => `titulo.ilike.%${k}%,cargo.ilike.%${k}%`).join(','))
  }
  const { data } = await q
  return (data?.length ?? 0) > 0
}

export default async function sitemap() {
  const { data } = await db
    .from('concursos')
    .select('id,cargo,titulo,pais,updated_at')
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .limit(5000)

  const concursoUrls = (data ?? []).map(c => ({
    url: `${SITE}/empleos/${toSlug(c)}`,
    lastModified: c.updated_at,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const paisUrls = PAISES_SLUGS.map(pais => ({
    url: `${SITE}/empleos/pais/${pais}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.85,
  }))

  // Páginas por país + categoría — SOLO mercados con inventario real.
  // Evita anunciar cientos de combos vacíos de países extranjeros (Google
  // los marca "duplicado / eligió otra canónica"). Las páginas vacías, además,
  // se auto-marcan noindex en la propia ruta.
  const CODIGOS_CORE = ['UY', 'AR', 'BR', 'MX', 'CL', 'CO', 'PE', 'EC', 'BO', 'PY', 'VE']
  // Un combo país×categoría entra al sitemap SOLO si tiene inventario real —
  // el mismo chequeo hayEmpleos que la página usa para decidir el noindex.
  // Así el sitemap nunca anuncia una página que se auto-marca noindex.
  const combos = CODIGOS_CORE.flatMap((cod) =>
    SLUGS_CATEGORIA.map((catSlug) => ({ cod, catSlug, cat: CATEGORIAS[catSlug] }))
  )
  const combosConInventario = await Promise.all(
    combos.map(async (c) => ({ ...c, hay: await hayEmpleos(c.cod, c.cat) }))
  )
  const categoriaUrls = combosConInventario
    .filter((c) => c.hay)
    .map((c) => ({
      url: `${SITE}/empleos/pais/${paisSlug(c.cod)}/${c.catSlug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.80,
    }))

  return [
    { url: SITE,                          lastModified: new Date(), changeFrequency: 'daily',  priority: 1    },
    { url: `${SITE}/empleos`,             lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9  },
    { url: `${SITE}/pulso-latam`,         lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 },
    { url: `${SITE}/pt`,                  lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9  },
    { url: `${SITE}/es-es`,               lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 },
    ...['en','fr','it','de','sv','no','ja'].map((l) => (
      { url: `${SITE}/${l}`,              lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 }
    )),
    ...paisUrls,
    ...categoriaUrls,
    ...concursoUrls,
  ]
}
