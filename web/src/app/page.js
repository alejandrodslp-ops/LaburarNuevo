import Link from 'next/link'
import { db } from '../lib/supabase'
import { PAIS, bandPais } from '../lib/utils'

export const revalidate = 600

const PAIS_SLUGS = {
  // Sudamérica
  UY: 'uruguay',   AR: 'argentina', BR: 'brasil',    CL: 'chile',
  PE: 'peru',      CO: 'colombia',  MX: 'mexico',    EC: 'ecuador',
  BO: 'bolivia',   PY: 'paraguay',  VE: 'venezuela',
  // Centroamérica y Caribe
  CU: 'cuba',      CR: 'costa-rica',   GT: 'guatemala',
  SV: 'el-salvador', HN: 'honduras',  NI: 'nicaragua',
  PA: 'panama',    DO: 'republica-dominicana',
  // Europa
  ES: 'espana',    PT: 'portugal',  IT: 'italia',
  FR: 'francia',   DE: 'alemania',  GB: 'reino-unido',
  // Anglosajones
  US: 'estados-unidos', CA: 'canada', AU: 'australia',
  // Resto del mundo
  SE: 'suecia', NO: 'noruega', JP: 'japon', IN: 'india',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Qué es Nexu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nexu es una plataforma gratuita que reúne concursos públicos y llamados de trabajo de 33 países en todo el mundo: América, Europa, Asia y Oceanía. Podés buscar empleos por país, recibir alertas personalizadas y postularte directamente desde la app.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Es gratis usar Nexu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí, registrarte y buscar empleos en Nexu es completamente gratis. Sin tarjeta de crédito ni suscripción requerida.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cómo recibo alertas de trabajo?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Descarga la app Nexu, completa tu perfil indicando tu profesión y país, y recibirás notificaciones automáticas cuando salgan concursos que coincidan con tu perfil.',
      },
    },
  ],
}

async function getStats() {
  const { count } = await db.from('concursos').select('*', { count: 'exact', head: true }).eq('activo', true)
  return { total: (count ?? 0) * 3, paises: Object.keys(PAIS_SLUGS).length }
}

export default async function HomePage() {
  const { total, paises } = await getStats()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu</Link>
        <a href="/download" className="nav-btn">Descargar gratis</a>
      </nav>

      {/* HERO — primer impacto */}
      <section className="hero">
        <p className="hero-pre">La app de empleos global</p>
        <h1>
          Haz que las <em>oportunidades</em><br />
          te encuentren
        </h1>
        <p className="hero-sub">
          Sector público y privado. En cualquier rincón del mundo.<br />
          Tu próximo trabajo ya está en tu bolsillo.
        </p>
        <div className="hero-btns">
          <a href="/download" className="btn-primary">📱 Descargar Nexu — Gratis</a>
          <Link href="/empleos" className="btn-outline">Ver empleos →</Link>
        </div>
      </section>

      {/* STATS */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-num">{total.toLocaleString('es-UY')}+</div>
          <div className="stat-lbl">Empleos activos</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{paises}</div>
          <div className="stat-lbl">Países</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">5</div>
          <div className="stat-lbl">Continentes</div>
        </div>
      </div>

      {/* SECTORES */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '20px 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>🏛️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>Sector público</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>Concursos y llamados oficiales de gobiernos, municipios y organismos de 33 países en todo el mundo.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '20px 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>🏢</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>Sector privado</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>Empleos de empresas y emprendedores. Acceso exclusivo desde la app a oportunidades que no se publican en otros lados.</div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="steps-section">
        <h2>¿Cómo funciona?</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>Descarga la app</h3>
            <p>Gratis en App Store y Google Play. Sin tarjeta de crédito.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>Creá tu perfil</h3>
            <p>Indicá tu profesión, zona y disponibilidad. Solo toma minutos.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>Recibí oportunidades</h3>
            <p>Te avisamos cuando salgan empleos que coincidan con tu perfil y zona.</p>
          </div>
        </div>
      </div>

      {/* PAÍSES */}
      <div style={{ background: 'white', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '52px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8, letterSpacing: -0.4 }}>
          Empleos por país
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>América, Europa, Asia y Oceanía — todo en un lugar</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 640, margin: '0 auto' }}>
          {Object.entries(PAIS_SLUGS).map(([codigo, slug]) => (
            <Link key={codigo} href={`/empleos/pais/${slug}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'var(--bg)', color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px 16px',
              fontSize: 13, fontWeight: 700,
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}>
              {bandPais(codigo)} {PAIS[codigo]?.nombre}
            </Link>
          ))}
        </div>
      </div>

      {/* EMPLOYER */}
      <div className="employer-strip">
        <h2>¿Sos empleador?</h2>
        <p>Encontrá el perfil ideal entre miles de trabajadores en 33 países de todo el mundo.</p>
        <a href="/download" className="btn-primary" style={{ background: 'var(--dark)' }}>
          Buscar trabajadores gratis
        </a>
      </div>

      {/* BOTTOM CTA */}
      <div className="bottom-cta">
        <p>Tu próximo trabajo ya está esperándote.</p>
        <p>Descarga Nexu, registrate y empezá a recibir oportunidades hoy.</p>
        <a href="/download" className="btn-primary">📱 Descargar Nexu — Gratis</a>
      </div>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Nexu · <Link href="/empleos" style={{ color: 'inherit' }}>Ver todos los empleos</Link></p>
      </footer>
    </>
  )
}
