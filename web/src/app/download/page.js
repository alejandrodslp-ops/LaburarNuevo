import Link from 'next/link'
import WaitlistForm from '../../components/WaitlistForm'

export const metadata = {
  title: 'Descargá Nexu — Acceso anticipado',
  description: 'Miles de personas quieren descargar Nexu. Anotate para recibir tu acceso antes que el resto.',
}

export default function DownloadPage() {
  return (
    <>
      <nav style={{
        background: '#0D1117', padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ color: '#E8785A', fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>Nexu</Link>
        <Link href="/empleos" style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Ver empleos →</Link>
      </nav>

      <section style={{
        background: 'linear-gradient(160deg, #0D1117 60%, #1a0a05)',
        color: 'white',
        padding: '80px 24px 88px', textAlign: 'center',
        minHeight: '85vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>

        {/* Badge de demanda */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(232,120,90,0.12)', border: '1px solid rgba(232,120,90,0.3)',
          borderRadius: 100, padding: '7px 18px', marginBottom: 32,
        }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 12, color: '#E8785A', fontWeight: 700, letterSpacing: 0.5 }}>
            ALTA DEMANDA — ACCESO POR ORDEN DE REGISTRO
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 58px)', fontWeight: 900,
          lineHeight: 1.08, color: 'white', maxWidth: 580,
          margin: '0 auto 18px', letterSpacing: -2,
        }}>
          El flujo de descargas es<br />
          <em style={{ color: '#E8785A', fontStyle: 'italic' }}>más alto de lo esperado</em>
        </h1>

        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', maxWidth: 460, margin: '0 auto 12px', lineHeight: 1.65 }}>
          Para garantizarte la mejor experiencia, estamos activando cuentas por tandas según el orden de registro.
        </p>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', maxWidth: 400, margin: '0 auto 44px', lineHeight: 1.6 }}>
          Anotate ahora y te avisamos por email cuando sea tu turno — los primeros de la lista tienen prioridad.
        </p>

        {/* Waitlist form */}
        <div style={{ width: '100%', maxWidth: 440 }}>
          <WaitlistForm ctaLabel="Quiero mi acceso →" />
        </div>

        {/* Social proof */}
        <div style={{
          display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
          marginTop: 48, paddingTop: 40,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          maxWidth: 500,
        }}>
          {[
            { num: '65.000+', label: 'empleos disponibles hoy' },
            { num: '33',      label: 'países cubiertos' },
            { num: '100%',    label: 'alertas personalizadas' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#E8785A', letterSpacing: -1 }}>{s.num}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        background: '#0D1117', color: 'rgba(255,255,255,0.3)',
        textAlign: 'center', padding: '24px', fontSize: 13,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p>© {new Date().getFullYear()} Nexu · <Link href="/empleos" style={{ color: 'inherit' }}>Ver empleos</Link></p>
      </footer>
    </>
  )
}
