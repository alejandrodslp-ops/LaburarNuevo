import Link from 'next/link'
import { db } from '../../../lib/supabase'
import { idFromSlug, paisFromSlug, toSlug, nombrePais, bandPais, fmtFecha, employmentType, paisSlug } from '../../../lib/utils'
import AppCta from '../../AppCta'

export const revalidate = 3600

// Estrategia (decisión del usuario 2026-08-18): PRE-LANZAMIENTO damos el servicio
// gratis y mostramos el link real de la oferta para captar usuarios. Cuando se
// lance la app, poner APP_LANZADA = true y la postulación vuelve a gatearse detrás
// de /download (descargar la app). Es el único cambio necesario para ese giro.
const APP_LANZADA = false

const SITE = 'https://www.konexu.app'

async function getConcurso(slug) {
  const id = idFromSlug(slug)
  // Valida que parece un UUID válido
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null
  // 1) Concurso scrapeado. Inactivo (vencido/cubierto) → "ya no disponible"
  //    (estado amable + noindex vía generateMetadata) para soltar avisos viejos.
  const { data: c } = await db.from('concursos').select('*').eq('id', id).maybeSingle()
  if (c) return c.activo ? c : null
  // 2) Oferta propia de un empleador (tabla ofertas). Se normaliza a la forma
  //    del detalle y se marca con _esOferta + el contacto de postulación real.
  const { data: o } = await db.from('ofertas').select('*').eq('id', id).maybeSingle()
  if (o && o.activa) {
    return {
      id: o.id, titulo: o.titulo, cargo: o.titulo, organismo: null,
      pais: o.pais, lugar: o.lugar || o.ciudad || null,
      fecha_cierre: o.fecha_cierre, descripcion: o.descripcion, requisitos: o.requisitos,
      tipo_vinculo: 'privado', tipo_tarea: null, puestos: null, numero_llamado: null,
      keywords: [], activo: true, beneficios: o.beneficios || null,
      contacto_email: o.contacto_email || null, contacto_whatsapp: o.contacto_whatsapp || null,
      _esOferta: true,
    }
  }
  return null
}

// Cuando el aviso original ya no existe: sugerencias por país sacado del slug
async function getSimilaresPorPais(pais) {
  if (!pais) return []
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre')
    .eq('activo', true)
    .eq('pais', pais)
    .order('created_at', { ascending: false })
    .limit(3)
  return data ?? []
}

async function getSimilares(c) {
  const kw = (c.keywords ?? []).slice(0, 3)
  if (!kw.length) return []
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre')
    .eq('activo', true)
    .eq('pais', c.pais)
    .overlaps('keywords', kw)
    .neq('id', c.id)
    .limit(3)
  return data ?? []
}

export async function generateMetadata({ params }) {
  const c = await getConcurso(params.slug)
  if (!c) return { title: 'Empleo no disponible — Konexu', robots: { index: false, follow: true } }
  const cargo = c.cargo || c.titulo
  const loc   = c.lugar || nombrePais(c.pais)
  const org   = c.organismo ? ` en ${c.organismo}` : ''
  return {
    title: `${cargo}${org} — ${loc}`,
    description: `Concurso para ${cargo}${org}. ${loc}. ${c.fecha_cierre ? `Cierre: ${fmtFecha(c.fecha_cierre)}.` : ''} Registrate gratis en Konexu.`,
    alternates: { canonical: `${SITE}/empleos/${params.slug}` },
    openGraph: {
      title: `${cargo} — ${loc}`,
      description: c.descripcion?.slice(0, 160) ?? `Concurso para ${cargo} en ${loc}.`,
      images: [{ url: '/og-konexu.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${cargo} — ${loc}`,
      description: c.descripcion?.slice(0, 160) ?? `Concurso para ${cargo} en ${loc}.`,
    },
  }
}

export default async function ConcursoPage({ params }) {
  const c = await getConcurso(params.slug)

  if (!c) {
    const pais = paisFromSlug(params.slug)
    const sugeridos = await getSimilaresPorPais(pais)
    return (
      <>
        <nav className="nav">
          <Link href="/" className="nav-logo"><span>Konexu</span><span style={{fontSize:"0.42em",marginLeft:"-9px",lineHeight:1,marginBottom:"3px"}}>🧩</span></Link>
          <a href="/download" className="nav-btn">Alertas gratis</a>
        </nav>

        <div className="container">
          <div className="empty-state" style={{ paddingTop: 60, paddingBottom: sugeridos.length ? 40 : 0 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#1A3A5C', marginBottom: 8 }}>
              Este empleo ya no está disponible
            </p>
            <p style={{ marginBottom: 24 }}>
              Puede que haya vencido o que la posición ya fue cubierta{pais ? ` en ${nombrePais(pais)}` : ''}.
            </p>
            <Link href="/empleos" className="btn-primary" style={{ display: 'inline-block' }}>
              Ver empleos disponibles →
            </Link>
          </div>

          {sugeridos.length > 0 && (
            <>
              <div className="similar-title">Empleos similares en {nombrePais(pais)}</div>
              <div className="jobs-grid">
                {sugeridos.map(s => (
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

        <footer className="footer">
          <p>
            © {new Date().getFullYear()} Konexu · konexu.app ·{' '}
            <Link href="/empleos" style={{ color: 'inherit' }}>Ver todos los empleos</Link>
          </p>
        </footer>
      </>
    )
  }

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
      `Registrate gratis en Konexu para recibir alertas de concursos similares.`,
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
    validThrough: c.fecha_cierre || new Date((c.created_at ? Date.parse(c.created_at) : Date.now()) + 60 * 86400000).toISOString().slice(0, 10),
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
      name: 'Konexu',
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
        <Link href="/" className="nav-logo"><span>Konexu</span><span style={{fontSize:"0.42em",marginLeft:"-9px",lineHeight:1,marginBottom:"3px"}}>🧩</span></Link>
        <a href="/download" className="nav-btn">Alertas gratis</a>
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
              <div className="detail-item-value" style={{ color: 'var(--coral-cta)' }}>
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

        {/* Postulación — ver nota de estrategia arriba (APP_LANZADA). */}
        <div style={{
          background: '#0D1117', borderRadius: 16,
          padding: '32px 24px', textAlign: 'center',
          margin: '24px 0', color: 'white',
        }}>
          {(!APP_LANZADA && c._esOferta && (c.contacto_email || c.contacto_whatsapp)) ? (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>Postulate a este empleo</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380, margin: '0 auto' }}>
                {c.contacto_email && (
                  <a href={`mailto:${c.contacto_email}`} style={{ display: 'block', background: 'var(--coral-cta)', color: 'white', borderRadius: 8, padding: '14px 22px', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
                    ✉️ Enviar CV a {c.contacto_email}
                  </a>
                )}
                {c.contacto_whatsapp && (
                  <a href={`https://wa.me/${c.contacto_whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#25D366', color: 'white', borderRadius: 8, padding: '14px 22px', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
                    💬 WhatsApp {c.contacto_whatsapp}
                  </a>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 18, maxWidth: 400, margin: '18px auto 0' }}>
                Contactás directo al empleador — sin intermediarios.
              </p>
            </>
          ) : (!APP_LANZADA && (c.url_postulacion || c.url_detalle)) ? (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>Postulate a este empleo</h2>
              <a href={c.url_postulacion || c.url_detalle} target="_blank" rel="noopener noreferrer nofollow" style={{ display: 'inline-block', background: 'var(--coral-cta)', color: 'white', borderRadius: 8, padding: '15px 30px', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}>
                Ver la oferta y postularme →
              </a>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 18, maxWidth: 400, margin: '18px auto 0' }}>
                ¿Querés que te avisemos gratis cuando aparezcan vacantes como esta?{' '}
                <a href="/download" style={{ color: '#F0A588', fontWeight: 700, textDecoration: 'none' }}>Activá alertas en Konexu →</a>
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Para ver las bases y postularte</h2>
              <a href="/download" style={{ display: 'inline-block', background: 'var(--coral-cta)', color: 'white', borderRadius: 8, padding: '14px 28px', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
                📱 Registrate gratis en Konexu
              </a>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 16, maxWidth: 380, margin: '16px auto 0' }}>
                Completá tu perfil y te avisamos cuando se publiquen concursos y oportunidades laborales en las cuales puedas aplicar o se ajusten a ti.
              </p>
            </>
          )}
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
          © {new Date().getFullYear()} Konexu · konexu.app ·{' '}
          <Link href="/empleos" style={{ color: 'inherit' }}>Ver todos los empleos</Link>
        </p>
      </footer>
    </>
  )
}
