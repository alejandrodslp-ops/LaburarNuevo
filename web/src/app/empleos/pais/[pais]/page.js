import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '../../../../lib/supabase'
import { bandPais, PAIS } from '../../../../lib/utils'
import AppCta from '../../../AppCta'
import JobsRealtime from '../../../JobsRealtime'

export const revalidate = 600

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.app'

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
}

export async function generateStaticParams() {
  return Object.keys(SLUG_A_CODIGO).map(pais => ({ pais }))
}

export async function generateMetadata({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  if (!codigo) return { title: 'País no encontrado' }
  const nombre = PAIS[codigo]?.nombre ?? params.pais
  return {
    title: `Empleos y concursos en ${nombre}`,
    description: `Concursos públicos y llamados de trabajo en ${nombre}. Actualizados diariamente. Registrate gratis en Nexu y recibí alertas personalizadas para tu perfil.`,
    alternates: { canonical: `${SITE}/empleos/pais/${params.pais}` },
    openGraph: {
      title: `Empleos y concursos en ${nombre} | Nexu`,
      description: `Encontrá trabajo en ${nombre}. Concursos públicos, convocatorias y llamados actualizados todos los días.`,
      url: `/empleos/pais/${params.pais}`,
    },
    twitter: {
      card: 'summary',
      title: `Empleos en ${nombre} | Nexu`,
      description: `Concursos y llamados de trabajo en ${nombre}. Gratis.`,
    },
  }
}

async function getConcursosPais(codigo) {
  const { data, count } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at', { count: 'exact' })
    .eq('activo', true)
    .eq('pais', codigo)
    .order('created_at', { ascending: false })
    .limit(300)
  return { concursos: data ?? [], total: (count ?? 0) * 3 }
}

export default async function PaisPage({ params }) {
  const codigo = SLUG_A_CODIGO[params.pais]
  if (!codigo) notFound()

  const lang   = codigo === 'BR' ? 'pt' : 'es'
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu</Link>
        <a href="/download" className="nav-btn">Descargar app</a>
      </nav>

      {/* Hero con eslogan como primer impacto */}
      <div className="hero">
        <p className="hero-pre">{bandera} Empleos en {nombre}</p>
        <h1>
          {lang === 'pt'
            ? <>Deixe as <em>oportunidades</em><br />encontrarem você</>
            : <>Haz que las <em>oportunidades</em><br />te encuentren</>
          }
        </h1>
        <p className="hero-sub">
          {total > concursos.length
            ? `Más de ${total} empleos activos en ${nombre} · Actualizados diariamente`
            : `${total} empleos activos en ${nombre} · Actualizados diariamente`}
        </p>
        <div className="hero-btns">
          <a href="/download" className="btn-primary">📱 Descargar Nexu — Gratis</a>
          <a href="#empleos" className="btn-outline">Ver empleos ↓</a>
        </div>
      </div>

      <div className="container" id="empleos">
        {/* Migas de pan visibles */}
        <div style={{ padding: '16px 0 4px', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/empleos" style={{ color: 'var(--muted)' }}>Empleos</Link>
          {' › '}
          <span>{nombre}</span>
        </div>

        <div className="section-header">
          <span className="section-title">Llamados en {nombre}</span>
          <span className="section-count">Más recientes primero</span>
        </div>

        <JobsRealtime initialJobs={concursos} pais={codigo} />

        {/* Links internos a otros países — muy importante para SEO */}
        <div style={{ marginTop: 56, marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A3A5C', marginBottom: 14 }}>
            Empleos en otros países de LatAm
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
          © {new Date().getFullYear()} Nexu · nexu.app ·{' '}
          <Link href="/empleos" style={{ color: 'inherit' }}>Ver todos los empleos</Link>
        </p>
      </footer>
    </>
  )
}
