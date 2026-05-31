import { db } from '../lib/supabase'
import { toSlug } from '../lib/utils'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.app'

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
  'suecia', 'noruega', 'japon', 'india',
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

  return [
    { url: SITE,                lastModified: new Date(), changeFrequency: 'daily',  priority: 1    },
    { url: `${SITE}/empleos`,   lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9  },
    ...paisUrls,
    ...concursoUrls,
  ]
}
