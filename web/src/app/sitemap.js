import { db } from '../lib/supabase'
import { toSlug } from '../lib/utils'
import { SLUGS_CATEGORIA } from '../lib/categorias'

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
  const PAISES_CORE = [
    'uruguay', 'argentina', 'brasil', 'mexico', 'chile', 'colombia',
    'peru', 'ecuador', 'bolivia', 'paraguay', 'venezuela',
  ]
  const categoriaUrls = PAISES_CORE.flatMap(pais =>
    SLUGS_CATEGORIA.map(cat => ({
      url: `${SITE}/empleos/pais/${pais}/${cat}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.80,
    }))
  )

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
