import Link from 'next/link'
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../../lib/config'

export const metadata = {
  title: 'Descarga Nexu',
  description: 'Descarga Nexu gratis en App Store y Google Play. Recibí alertas de empleos y concursos que se adaptan a tu perfil.',
}

export default function DownloadPage() {
  return (
    <>
      <nav style={{
        background: '#0D1117', padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ color: '#E8785A', fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>Nexu</Link>
      </nav>

      <section style={{
        background: '#0D1117', color: 'white',
        padding: '80px 24px 88px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Glow sutil */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(45,212,191,0.08) 0%, transparent 70%)',
        }} />

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#2DD4BF', marginBottom: 20 }}>
          Disponible en
        </p>

        <h1 style={{
          fontFamily: 'Georgia, serif', fontStyle: 'italic',
          fontSize: 'clamp(34px, 6vw, 58px)', fontWeight: 700,
          lineHeight: 1.12, color: 'white', maxWidth: 600,
          margin: '0 auto 16px',
        }}>
          Haz que las <span style={{ color: '#E8785A' }}>oportunidades</span><br />te encuentren
        </h1>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 420, margin: '0 auto 48px', lineHeight: 1.65 }}>
          Deja de buscar. Tu próximo trabajo ya está en tu bolsillo.
        </p>

        {/* Botones de descarga */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>

          {/* App Store */}
          <a href={APP_STORE_URL} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'white', color: '#0D1117',
            borderRadius: 14, padding: '14px 24px',
            textDecoration: 'none', minWidth: 200,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#0D1117">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, letterSpacing: 0.5 }}>Descargar en el</div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>App Store</div>
            </div>
          </a>

          {/* Google Play */}
          <a href={GOOGLE_PLAY_URL} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'white', color: '#0D1117',
            borderRadius: 14, padding: '14px 24px',
            textDecoration: 'none', minWidth: 200,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#0D1117">
              <path d="M3.18 23.76c.3.17.64.22.99.14l12.12-6.98-2.61-2.61-10.5 9.45zm-1.05-20.3C2.06 3.73 2 4.03 2 4.37v15.26c0 .34.06.64.13.91l.07.06 8.55-8.55v-.2L2.2 3.4l-.07.06zm17.42 8.98l-2.44-1.41-2.91 2.91 2.91 2.91 2.46-1.42c.7-.4.7-1.58-.02-1.99zM4.17.42L16.29 7.4l-2.61 2.61L3.18.56c.3-.18.67-.2.99-.14z"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, letterSpacing: 0.5 }}>Disponible en</div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>Google Play</div>
            </div>
          </a>
        </div>

        <p style={{ marginTop: 28, fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
          Gratis · Sin tarjeta de crédito
        </p>
      </section>

      <footer style={{
        background: '#0D1117', color: 'rgba(255,255,255,0.4)',
        textAlign: 'center', padding: '24px', fontSize: 13,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p>© {new Date().getFullYear()} Nexu · <Link href="/empleos" style={{ color: 'inherit' }}>Ver empleos</Link></p>
      </footer>
    </>
  )
}
