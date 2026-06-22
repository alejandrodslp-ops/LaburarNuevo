import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '../../../../lib/supabase'
import { bandPais, PAIS } from '../../../../lib/utils'
import { getLang, t } from '../../../../lib/i18n'
import AppCta from '../../../AppCta'
import JobsRealtime from '../../../JobsRealtime'

export const dynamic = 'force-dynamic'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.fyi'

// Slug en URL → código ISO 2 letras
const SLUG_A_CODIGO = {
  // Sudamérica
  uruguay:              'UY',
  argentina:            'AR',
  chile:                'CL',
  peru:                 'PE',
  colombia:             'CO',
  ecuador:              'EC',
  bolivia:              'BO',
  paraguay:             'PY',
  brasil:               'BR',
  mexico:               'MX',
  venezuela:            'VE',
  // Centroamérica y Caribe
  cuba:                 'CU',
  'costa-rica':         'CR',
  guatemala:            'GT',
  'el-salvador':        'SV',
  honduras:             'HN',
  nicaragua:            'NI',
  panama:               'PA',
  'republica-dominicana': 'DO',
  // Europa
  espana:               'ES',
  portugal:             'PT',
  italia:               'IT',
  francia:              'FR',
  alemania:             'DE',
  'reino-unido':        'GB',
  // Anglosajones
  'estados-unidos':     'US',
  canada:               'CA',
  australia:            'AU',
  // Resto del mundo
  suecia:               'SE',
  noruega:              'NO',
  japon:                'JP',
  india:                'IN',
  suiza:                'CH',
}

export async function generateStaticParams() {
  return Object.keys(SLUG_A_CODIGO).map(pais => ({ pais }))
}

export async function generateMetadata({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  if (!codigo) return { title: 'País no encontrado' }
  const nombre = PAIS[codigo]?.nombre ?? params.pais
  const lang   = getLang(codigo)
  return {
    title: t(lang, 'meta_title', nombre),
    description: t(lang, 'meta_desc', nombre),
    alternates: {
      canonical: `${SITE}/empleos/pais/${params.pais}`,
      languages: {
        'x-default': `${SITE}/empleos/pais/${params.pais}`,
        [lang]:       `${SITE}/empleos/pais/${params.pais}`,
      },
    },
    openGraph: {
      title: t(lang, 'meta_og_title', nombre),
      description: t(lang, 'meta_og_desc', nombre),
      url: `/empleos/pais/${params.pais}`,
    },
    twitter: {
      card: 'summary',
      title: t(lang, 'meta_og_title', nombre),
      description: t(lang, 'meta_og_desc', nombre),
    },
  }
}

async function getConcursosPais(codigo) {
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)
    .eq('pais', codigo)
    .order('created_at', { ascending: false })
    .limit(300)
  const list = data ?? []
  return { concursos: list, total: list.length >= 300 ? list.length + 1 : list.length }
}

export default async function PaisPage({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  if (!codigo) notFound()

  const lang    = getLang(codigo)
  const nombre  = PAIS[codigo]?.nombre ?? params.pais
  const bandera = bandPais(codigo)
  const { concursos, total } = await getConcursosPais(codigo)

  const jsonLd = [
    {
      '@context': 'https://schema.org/',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Empleos', item: `${SITE}/empleos` },
        { '@type': 'ListItem', position: 2, name: `Empleos en ${nombre}`, item: `${SITE}/empleos/pais/${params.pais}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Empleos y concursos en ${nombre}`,
      description: `Concursos públicos y llamados de trabajo en ${nombre}, actualizados diariamente.`,
      url: `${SITE}/empleos/pais/${params.pais}`,
    },
  ]

  const otrosPaises = Object.entries(SLUG_A_CODIGO).filter(([slug]) => slug !== params.pais)

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
  const CONTINENTE_LABELS = {
    es: { 'América Latina':'América Latina', 'Europa':'Europa', 'América del Norte':'América del Norte', 'Oceanía':'Oceanía', 'Asia':'Asia' },
    pt: { 'América Latina':'América Latina', 'Europa':'Europa', 'América do Norte':'América do Norte', 'Oceanía':'Oceania', 'Asia':'Ásia' },
    en: { 'América Latina':'Latin America', 'Europa':'Europe', 'América del Norte':'North America', 'Oceanía':'Oceania', 'Asia':'Asia' },
    fr: { 'América Latina':'Amérique latine', 'Europa':'Europe', 'América del Norte':'Amérique du Nord', 'Oceanía':'Océanie', 'Asia':'Asie' },
    it: { 'América Latina':'America Latina', 'Europa':'Europa', 'América del Norte':'America del Nord', 'Oceanía':'Oceania', 'Asia':'Asia' },
    de: { 'América Latina':'Lateinamerika', 'Europa':'Europa', 'América del Norte':'Nordamerika', 'Oceanía':'Ozeanien', 'Asia':'Asien' },
    sv: { 'América Latina':'Latinamerika', 'Europa':'Europa', 'América del Norte':'Nordamerika', 'Oceanía':'Oceanien', 'Asia':'Asien' },
    no: { 'América Latina':'Latin-Amerika', 'Europa':'Europa', 'América del Norte':'Nord-Amerika', 'Oceanía':'Oseania', 'Asia':'Asia' },
    ja: { 'América Latina':'ラテンアメリカ', 'Europa':'ヨーロッパ', 'América del Norte':'北アメリカ', 'Oceanía':'オセアニア', 'Asia':'アジア' },
  }
  const continenteKey = CONTINENTE_MAP[codigo] ?? 'América Latina'
  const continenteLabel = (CONTINENTE_LABELS[lang] ?? CONTINENTE_LABELS.es)[continenteKey] ?? continenteKey
  const otrosLabel = {
    es: `Empleos en ${continenteLabel}`, pt: `Empregos em ${continenteLabel}`,
    en: `Jobs in ${continenteLabel}`,    fr: `Emplois en ${continenteLabel}`,
    it: `Lavori in ${continenteLabel}`,  de: `Jobs in ${continenteLabel}`,
    sv: `Jobb i ${continenteLabel}`,     no: `Jobber i ${continenteLabel}`,
    ja: `${continenteLabel}の求人`,
  }[lang] ?? `Empleos en ${continenteLabel}`

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
        <p className="hero-pre">{bandera} {t(lang, 'section_title', nombre)}</p>
        <h1>
          {t(lang, 'hero_h1_1')} <em>{t(lang, 'hero_h1_em')}</em><br />{t(lang, 'hero_h1_2')}
        </h1>
        <p className="hero-sub">
          {total > concursos.length
            ? t(lang, 'hero_sub_many', total, nombre)
            : t(lang, 'hero_sub_few', total, nombre)}
        </p>
        <div className="hero-btns">
          <a href="/download" className="btn-primary">{t(lang, 'hero_btn_primary', nombre)}</a>
          <a href="#empleos" className="btn-outline">{t(lang, 'hero_btn_outline')}</a>
        </div>
      </div>

      <div className="container" id="empleos">
        <div style={{ padding: '16px 0 4px', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/empleos" style={{ color: 'var(--muted)' }}>{t(lang, 'breadcrumb_jobs')}</Link>
          {' › '}
          <span>{nombre}</span>
        </div>

        <div className="section-header">
          <span className="section-title">{t(lang, 'section_title', nombre)}</span>
          <span className="section-count">{t(lang, 'section_recent')}</span>
        </div>

        <JobsRealtime initialJobs={concursos} pais={codigo} />

        <div style={{ marginTop: 56, marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A3A5C', marginBottom: 14 }}>
            {otrosLabel}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {otrosPaises.map(([slug, cod]) => (
              <Link
                key={slug}
                href={`/empleos/pais/${slug}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#EEF4FF', color: '#2A5280',
                  borderRadius: 20, padding: '7px 14px',
                  fontSize: 13, fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {bandPais(cod)} {PAIS[cod]?.nombre}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <AppCta lang={lang} />

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Konexu · nexu.fyi ·{' '}
          <Link href="/empleos" style={{ color: 'inherit' }}>{t(lang, 'footer_jobs')}</Link>
        </p>
      </footer>
    </>
  )
}
