import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '../../../../../lib/supabase'
import { bandPais, PAIS } from '../../../../../lib/utils'
import { getLang, t } from '../../../../../lib/i18n'
import { CATEGORIAS, SLUGS_CATEGORIA } from '../../../../../lib/categorias'
import AppCta from '../../../../AppCta'
import JobsRealtime from '../../../../JobsRealtime'

// ISR on-demand igual que la página de país: caché 6h, generación al primer hit.
export const revalidate = 21600

const SITE = 'https://www.konexu.app'

const SLUG_A_CODIGO = {
  uruguay:'UY', argentina:'AR', chile:'CL', peru:'PE', colombia:'CO',
  ecuador:'EC', bolivia:'BO', paraguay:'PY', brasil:'BR', mexico:'MX',
  venezuela:'VE', cuba:'CU', 'costa-rica':'CR', guatemala:'GT',
  'el-salvador':'SV', honduras:'HN', nicaragua:'NI', panama:'PA',
  'republica-dominicana':'DO', espana:'ES', portugal:'PT', italia:'IT',
  francia:'FR', alemania:'DE', 'reino-unido':'GB', 'estados-unidos':'US',
  canada:'CA', australia:'AU', suecia:'SE', noruega:'NO', japon:'JP',
  india:'IN', suiza:'CH',
}

export async function generateStaticParams() {
  // Vacío a propósito: 33 países × categorías en build = timeouts (ver junio).
  // Con ISR on-demand cada combinación se genera recién al primer hit.
  return []
}

// ¿Hay al menos un empleo para este país+categoría? (chequeo barato, limit 1)
async function hayEmpleos(codigo, cat) {
  let q = db.from('concursos').select('id').eq('activo', true).eq('pais', codigo).limit(1)
  if (cat.filtro.publico) {
    q = q.or('tipo_vinculo.is.null,and(tipo_vinculo.neq.privado,tipo_vinculo.neq.empleo)')
  } else if (cat.filtro.tipo_vinculo) {
    q = q.eq('tipo_vinculo', cat.filtro.tipo_vinculo)
  } else if (cat.filtro.keywords) {
    q = q.or(cat.filtro.keywords.map(k => `titulo.ilike.%${k}%,cargo.ilike.%${k}%`).join(','))
  }
  const { data } = await q
  return (data?.length ?? 0) > 0
}

export async function generateMetadata({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  const cat    = CATEGORIAS[params.categoria]
  if (!codigo || !cat) return { title: 'No encontrado' }

  const nombre = PAIS[codigo]?.nombre ?? params.pais
  const lang   = getLang(codigo)
  const catNombre = cat.nombres[lang] || cat.nombres.es
  const desc   = (cat.desc[lang] || cat.desc.es)(nombre)

  // Página sin empleos = contenido fino/duplicado → no indexar (pero seguir links)
  const conContenido = await hayEmpleos(codigo, cat)

  return {
    title: `${catNombre} en ${nombre}`,
    description: desc,
    ...(conContenido ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: `${SITE}/empleos/pais/${params.pais}/${params.categoria}`,
      languages: {
        'x-default': `${SITE}/empleos/pais/${params.pais}/${params.categoria}`,
        [lang]: `${SITE}/empleos/pais/${params.pais}/${params.categoria}`,
      },
    },
    openGraph: {
      title: `${catNombre} en ${nombre} | Konexu`,
      description: desc,
      url: `/empleos/pais/${params.pais}/${params.categoria}`,
    },
    twitter: { card: 'summary', title: `${catNombre} en ${nombre} | Konexu`, description: desc },
  }
}

async function getConcursosCategoria(codigo, cat) {
  let query = db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)
    .eq('pais', codigo)
    .order('created_at', { ascending: false })
    .limit(300)

  // Aplicar filtro de categoría
  if (cat.filtro.publico) {
    query = query.or('tipo_vinculo.is.null,and(tipo_vinculo.neq.privado,tipo_vinculo.neq.empleo)')
  } else if (cat.filtro.tipo_vinculo) {
    query = query.eq('tipo_vinculo', cat.filtro.tipo_vinculo)
  } else if (cat.filtro.keywords) {
    const kws = cat.filtro.keywords
    const orParts = kws.map(k => `titulo.ilike.%${k}%,cargo.ilike.%${k}%`).join(',')
    query = query.or(orParts)
  }

  const { data } = await query
  const list = data ?? []
  // Si llegamos al límite (300), asumimos que hay más en DB
  return { concursos: list, total: list.length >= 300 ? list.length + 1 : list.length }
}

export default async function CategoriaPage({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  const cat    = CATEGORIAS[params.categoria]
  if (!codigo || !cat) notFound()

  const lang       = getLang(codigo)
  const nombre     = PAIS[codigo]?.nombre ?? params.pais
  const bandera    = bandPais(codigo)
  const catNombre  = cat.nombres[lang] || cat.nombres.es
  const { concursos, total } = await getConcursosCategoria(codigo, cat)

  const jsonLd = [
    {
      '@context': 'https://schema.org/',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t(lang,'breadcrumb_jobs'), item: `${SITE}/empleos` },
        { '@type': 'ListItem', position: 2, name: nombre, item: `${SITE}/empleos/pais/${params.pais}` },
        { '@type': 'ListItem', position: 3, name: catNombre, item: `${SITE}/empleos/pais/${params.pais}/${params.categoria}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${catNombre} en ${nombre}`,
      description: (cat.desc[lang] || cat.desc.es)(nombre),
      url: `${SITE}/empleos/pais/${params.pais}/${params.categoria}`,
    },
  ]

  // Otras categorías del mismo país para links internos
  const otrasCateg = SLUGS_CATEGORIA.filter(s => s !== params.categoria)

  const CONTINENTE_MAP = {
    UY:'América Latina', AR:'América Latina', CL:'América Latina', PE:'América Latina',
    CO:'América Latina', EC:'América Latina', BO:'América Latina', PY:'América Latina',
    BR:'América Latina', MX:'América Latina', VE:'América Latina', CU:'América Latina',
    CR:'América Latina', GT:'América Latina', SV:'América Latina', HN:'América Latina',
    NI:'América Latina', PA:'América Latina', DO:'América Latina',
    ES:'Europa', PT:'Europa', IT:'Europa', FR:'Europa', DE:'Europa',
    GB:'Europa', SE:'Europa', NO:'Europa', CH:'Europa',
    US:'América del Norte', CA:'América del Norte',
    AU:'Oceanía', JP:'Asia', IN:'Asia',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>') }}
      />

      <nav className="nav">
        <Link href="/" className="nav-logo"><span>Konexu</span><span style={{fontSize:"0.42em",marginLeft:"-9px",lineHeight:1,marginBottom:"3px"}}>🧩</span></Link>
        <a href="/download" className="nav-btn">{t(lang, 'nav_download')}</a>
      </nav>

      <div className="hero">
        <p className="hero-pre">{bandera} {nombre} · {catNombre}</p>
        <h1>
          {t(lang, 'hero_h1_1')} <em>{t(lang, 'hero_h1_em')}</em><br />{t(lang, 'hero_h1_2')}
        </h1>
        <p className="hero-sub">
          {total > concursos.length
            ? t(lang, 'hero_sub_many', total, nombre)
            : t(lang, 'hero_sub_few', total, nombre)}
          {' · '}{catNombre}
        </p>
        <div className="hero-btns">
          <a href="/download" className="btn-primary">{t(lang, 'hero_btn_primary')}</a>
          <a href="#empleos" className="btn-outline">{t(lang, 'hero_btn_outline')}</a>
        </div>
      </div>

      <div className="container" id="empleos">
        {/* Migas de pan */}
        <div style={{ padding: '16px 0 4px', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/empleos" style={{ color: 'var(--muted)' }}>{t(lang, 'breadcrumb_jobs')}</Link>
          {' › '}
          <Link href={`/empleos/pais/${params.pais}`} style={{ color: 'var(--muted)' }}>{nombre}</Link>
          {' › '}
          <span>{catNombre}</span>
        </div>

        <div className="section-header">
          <span className="section-title">{catNombre} — {nombre}</span>
          <span className="section-count">{t(lang, 'section_recent')}</span>
        </div>

        <JobsRealtime initialJobs={concursos} pais={codigo} />

        {/* Otras categorías del mismo país */}
        <div style={{ marginTop: 48, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1A3A5C', marginBottom: 12 }}>
            {t(lang, 'breadcrumb_jobs')} · {nombre}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link
              href={`/empleos/pais/${params.pais}`}
              style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#EEF4FF', color:'#2A5280', borderRadius:20, padding:'7px 14px', fontSize:13, fontWeight:700, textDecoration:'none' }}
            >
              {bandera} {t(lang, 'section_title', nombre)}
            </Link>
            {otrasCateg.map(slug => (
              <Link
                key={slug}
                href={`/empleos/pais/${params.pais}/${slug}`}
                style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#F0F4FF', color:'#3B5998', borderRadius:20, padding:'7px 14px', fontSize:13, fontWeight:700, textDecoration:'none' }}
              >
                {CATEGORIAS[slug].nombres[lang] || CATEGORIAS[slug].nombres.es}
              </Link>
            ))}
          </div>
        </div>

        {/* Link a todos los países del mismo continente */}
        <div style={{ marginTop: 32, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1A3A5C', marginBottom: 12 }}>
            {catNombre} — {CONTINENTE_MAP[codigo] ?? 'América Latina'}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(SLUG_A_CODIGO)
              .filter(([, cod]) => cod !== codigo && CONTINENTE_MAP[cod] === CONTINENTE_MAP[codigo])
              .map(([slug, cod]) => (
                <Link
                  key={slug}
                  href={`/empleos/pais/${slug}/${params.categoria}`}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#EEF4FF', color:'#2A5280', borderRadius:20, padding:'7px 14px', fontSize:13, fontWeight:700, textDecoration:'none' }}
                >
                  {bandPais(cod)} {PAIS[cod]?.nombre}
                </Link>
              ))
            }
          </div>
        </div>
      </div>

      <AppCta lang={lang} />

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Konexu · konexu.app ·{' '}
          <Link href={`/empleos/pais/${params.pais}`} style={{ color: 'inherit' }}>{nombre}</Link>
          {' · '}
          <Link href="/empleos" style={{ color: 'inherit' }}>{t(lang, 'footer_jobs')}</Link>
        </p>
      </footer>
    </>
  )
}
