import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '../../../lib/supabase'
import { idFromSlug, toSlug, nombrePais, bandPais, fmtFecha, employmentType, paisSlug } from '../../../lib/utils'
import AppCta from '../../AppCta'

export const revalidate = 3600

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.fyi'

async function getConcurso(slug) {
  const id = idFromSlug(slug)
  // Valida que parece un UUID válido
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null
  const { data } = await db.from('concursos').select('*').eq('id', id).single()
  return data ?? null
}

async function getSimilares(c) {
  const term = (c.cargo || c.titulo || '').split(' ')[0]
  if (!term || term.length < 3) return []
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre')
    .eq('activo', true)
    .ilike('titulo', `%${term}%`)
    .neq('id', c.id)
    .limit(3)
  return data ?? []
}

export async function generateMetadata({ params }) {
  const c = await getConcurso(params.slug)
  if (!c) return { title: 'Empleo no encontrado' }
  const cargo = c.cargo || c.titulo
  const loc   = c.lugar || nombrePais(c.pais)
  const org   = c.organismo ? ` en ${c.organismo}` : ''
  return {
    title: `${cargo}${org} — ${loc}`,
    description: `Concurso para ${cargo}${org}. ${loc}. ${c.fecha_cierre ? `Cierre: ${fmtFecha(c.fecha_cierre)}.` : ''} Registrate gratis en Nexu.`,
    alternates: { canonical: `${SITE}/empleos/${params.slug}` },
    openGraph: {
      title: `${cargo} — ${loc}`,
      description: c.descripcion?.slice(0, 160) ?? `Concurso para ${cargo} en ${loc}.`,
    },
  }
}

export default async function ConcursoPage({ params }) {
  const c = await getConcurso(params.slug)
  if (!c) notFound()

  const similares  = await getSimilares(c)
  const esPublico  = c.tipo_vinculo?.toLowerCase() !== 'privado'
  const cargo      = c.cargo || c.titulo
  const lugar      = c.lugar || nombrePais(c.pais)

  // Descripción para Google (usa el campo real o la genera de los metadatos)
  const descripcion =
    c.descripcion ||
    [
      `${cargo}${c.organismo ? ` en ${c.organismo}` : ''}.`,
      c.lugar      ? `Lugar de desempeño: ${c.lugar}.`       : '',
      c.tipo_tarea ? `Tipo de tarea: ${c.tipo_tarea}.`       : '',
      c.requisitos ? c.requisitos                             : '',
      `Registrate gratis en Nexu para recibir alertas de concursos similares.`,
    ].filter(Boolean).join(' ')

  // ─── BreadcrumbList ────────────────────────────────────────────────────────
  const breadcrumbLd = {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Empleos', item: `${SITE}/empleos` },
      ...(c.pais ? [{
        '@type': 'ListItem', position: 2,
        name: nombrePais(c.pais),
        item: `${SITE}/empleos/pais/${paisSlug(c.pais)}`,
      }] : []),
      { '@type': 'ListItem', position: c.pais ? 3 : 2, name: cargo, item: `${SITE}/empleos/${params.slug}` },
    ],
  }

  // ─── JSON-LD para Google for Jobs ──────────────────────────────────────────
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: cargo,
    description: descripcion,
    datePosted: c.created_at?.split('T')[0],
    ...(c.fecha_cierre && { validThrough: c.fecha_cierre }),
    employmentType: employmentType(c.tipo_vinculo),
    hiringOrganization: {
      '@type': 'Organization',
      name: c.organismo || 'Organismo público',
      sameAs: SITE,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: lugar,
        addressCountry: c.pais,
      },
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'Nexu',
      value: c.id,
    },
    url: `${SITE}/empleos/${params.slug}`,
    ...(c.puestos > 0 && { totalJobOpenings: c.puestos }),
  }
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/<\/script>/gi, '<\\/script>') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>') }} />

      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu</Link>
        <a href="/download" className="nav-btn">Descargar app</a>
      </nav>

      <div className="container">
        <Link href="/empleos" className="detail-back">← Todos los empleos</Link>

        <div className={`detail-badge ${esPublico ? 'badge-pub' : 'badge-priv'}`}>
          {esPublico ? '🏛️ Concurso oficial' : '🏢 Empleo privado'}
        </div>

        <h1 className="detail-title">{cargo}</h1>

        {/* Grilla de datos rápidos */}
        <div className="detail-grid">
          {c.organismo && (
            <div className="detail-item">
              <div className="detail-item-label">Organismo</div>
              <div className="detail-item-value">{c.organismo}</div>
            </div>
          )}
          <div className="detail-item">
            <div className="detail-item-label">País</div>
            <div className="detail-item-value">{bandPais(c.pais)} {nombrePais(c.pais)}</div>
          </div>
          {c.lugar && (
            <div className="detail-item">
              <div className="detail-item-label">Lugar</div>
              <div className="detail-item-value">{c.lugar}</div>
            </div>
          )}
          {c.fecha_cierre && (
            <div className="detail-item">
              <div className="detail-item-label">Fecha de cierre</div>
              <div className="detail-item-value" style={{ color: '#E8785A' }}>
                {fmtFecha(c.fecha_cierre)}
              </div>
            </div>
          )}
          {c.puestos > 0 && (
            <div className="detail-item">
              <div className="detail-item-label">Puestos</div>
              <div className="detail-item-value">{c.puestos}</div>
            </div>
          )}
          {c.tipo_tarea && (
            <div className="detail-item">
              <div className="detail-item-label">Tipo de tarea</div>
              <div className="detail-item-value">{c.tipo_tarea}</div>
            </div>
          )}
          {c.tipo_vinculo && (
            <div className="detail-item">
              <div className="detail-item-label">Tipo de vínculo</div>
              <div className="detail-item-value">{c.tipo_vinculo}</div>
            </div>
          )}
          {c.numero_llamado && (
            <div className="detail-item">
              <div className="detail-item-label">N° de llamado</div>
              <div className="detail-item-value">{c.numero_llamado}</div>
            </div>
          )}
        </div>

        {/* Descripción */}
        {c.descripcion && (
          <div className="detail-section">
            <h3>Descripción del puesto</h3>
            <p>{c.descripcion}</p>
          </div>
        )}

        {/* Requisitos */}
        {c.requisitos && (
          <div className="detail-section">
            <h3>Requisitos</h3>
            <p>{c.requisitos}</p>
          </div>
        )}

        {/* Gate de registro — ver bases y postularse requiere la app */}
        <div style={{
          background: '#0D1117', borderRadius: 16,
          padding: '32px 24px', textAlign: 'center',
          margin: '24px 0', color: 'white',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
            Para ver las bases y postularte
          </h2>
          <a href="/download" style={{
            display: 'inline-block', background: '#E8785A',
            color: 'white', borderRadius: 8, padding: '14px 28px',
            fontSize: 15, fontWeight: 800, textDecoration: 'none',
          }}>
            📱 Registrate gratis en Nexu
          </a>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 16, maxWidth: 380, margin: '16px auto 0' }}>
            Completá tu perfil y te avisamos cuando se publiquen concursos y oportunidades laborales en las cuales puedas aplicar o se ajusten a ti.
          </p>
        </div>

        {/* Concursos similares */}
        {similares.length > 0 && (
          <>
            <div className="similar-title">Empleos similares</div>
            <div className="jobs-grid">
              {similares.map(s => (
                <Link key={s.id} href={`/empleos/${toSlug(s)}`} className="job-card">
                  <div className="job-icon">🏛️</div>
                  <div className="job-body">
                    <div className="job-title">{s.cargo || s.titulo}</div>
                    <div className="job-org">{s.organismo || '—'}</div>
                    <div className="job-meta">
                      <span className="job-tag">
                        {bandPais(s.pais)} {nombrePais(s.pais)}{s.lugar ? ` · ${s.lugar}` : ''}
                      </span>
                      {s.fecha_cierre && (
                        <span className="job-tag job-tag-coral">
                          Cierra {fmtFecha(s.fecha_cierre)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="job-arrow">›</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <AppCta lang={c.pais === 'BR' ? 'pt' : 'es'} cargo={cargo} />

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Nexu · nexu.fyi ·{' '}
          <Link href="/empleos" style={{ color: 'inherit' }}>Ver todos los empleos</Link>
        </p>
      </footer>
    </>
  )
}
