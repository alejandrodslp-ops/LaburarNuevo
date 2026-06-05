import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../components/WaitlistForm'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getStats() {
  const { count } = await db.from('concursos').select('*', { count: 'exact', head: true }).eq('activo', true)
  return { total: count ?? 0 }
}

const BANDERAS = [
  '🇧🇷','🇦🇷','🇺🇾','🇨🇱','🇨🇴','🇲🇽','🇵🇪','🇪🇨','🇧🇴','🇵🇾','🇻🇪',
  '🇬🇹','🇭🇳','🇳🇮','🇨🇷','🇵🇦','🇨🇺','🇩🇴','🇸🇻','🇵🇹','🇪🇸','🇮🇹',
  '🇫🇷','🇩🇪','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇸🇪','🇳🇴','🇨🇭','🇯🇵','🇮🇳',
]

export const metadata = {
  title: 'Nexu — Concursos Públicos y Empleos en Uruguay, Argentina y toda LatAm',
  description: 'Encontrá concursos públicos, llamados de trabajo y vacantes en Uruguay, Argentina, Brasil y 30 países más. Actualizados todos los días. Gratis para trabajadores.',
  keywords: ['concursos públicos Uruguay','empleos Uruguay','llamados trabajo Uruguay','ONSC concursos','Uruguay Concursa','empleos Argentina','vacantes gobierno','empleo público','trabajo LatAm'],
  openGraph: {
    title: 'Nexu — Concursos Públicos y Empleos en LatAm',
    description: 'Miles de concursos públicos y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Actualizados diariamente. Gratis.',
  },
}

export default async function Home() {
  const { total } = await getStats()

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        .hero-anim { animation: fadeUp 0.7s ease both }
        .stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 28px; text-align: center; }
        .stat-num  { font-size: 40px; font-weight: 900; color: #E8785A; letter-spacing: -2px; line-height: 1; }
        .stat-lbl  { font-size: 13px; color: #94A3B8; margin-top: 4px; font-weight: 500; }
        .feature-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .feature-icon { font-size: 32px; margin-bottom: 12px; }
        .feature-tit  { font-size: 16px; font-weight: 800; color: #F1F5F9; margin-bottom: 6px; }
        .feature-desc { font-size: 14px; color: #64748B; line-height: 1.6; }
        @media (max-width: 640px) {
          .hero-title  { font-size: clamp(32px, 9vw, 52px) !important; }
          .stats-grid  { grid-template-columns: 1fr 1fr !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <span className="nav-logo">Nexu</span>
        <a href="/empleos" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Ver empleos →</a>
      </nav>

      {/* HERO */}
      <section style={{ background:'linear-gradient(160deg, #0D1117 60%, #1a0f0a)', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>

        <div className="hero-anim" style={{ maxWidth:680, width:'100%' }}>

          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(232,120,90,0.12)', border:'1px solid rgba(232,120,90,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#E8785A', display:'inline-block', boxShadow:'0 0 8px #E8785A' }}/>
            <span style={{ fontSize:12, color:'#E8785A', fontWeight:700, letterSpacing:0.5 }}>LANZAMIENTO PRÓXIMO — LISTA DE ESPERA ABIERTA</span>
          </div>

          {/* Título */}
          <h1 className="hero-title" style={{ fontSize:'clamp(36px, 6vw, 64px)', fontWeight:900, color:'#F1F5F9', lineHeight:1.08, letterSpacing:-2, marginBottom:20 }}>
            El empleo de{' '}
            <em style={{ color:'#E8785A', fontStyle:'italic' }}>América Latina</em>
            <br />en un solo lugar
          </h1>

          <p style={{ fontSize:'clamp(16px, 2.5vw, 20px)', color:'#94A3B8', maxWidth:500, margin:'0 auto 48px', lineHeight:1.6 }}>
            Nexu conecta trabajadores y empleadores en 33 países. Gratis para buscar. Gratis para encontrar.
          </p>

          {/* Form */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:48 }}>
            <WaitlistForm />
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, maxWidth:480, margin:'0 auto 48px' }}>
            <div className="stat-card">
              <div className="stat-num">{total.toLocaleString('es')}</div>
              <div className="stat-lbl">empleos activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">33</div>
              <div className="stat-lbl">países</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{fontSize:28}}>100%</div>
              <div className="stat-lbl">gratis para vos</div>
            </div>
          </div>

          {/* Banderas */}
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8, maxWidth:500, margin:'0 auto' }}>
            {BANDERAS.map((b, i) => (
              <span key={i} style={{ fontSize:24, lineHeight:1 }} title="">{b}</span>
            ))}
          </div>

        </div>
      </section>

      {/* FEATURES */}
      <section style={{ background:'#0D1117', padding:'80px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(24px, 4vw, 36px)', fontWeight:900, color:'#F1F5F9', textAlign:'center', marginBottom:12, letterSpacing:-1 }}>
            ¿Qué es Nexu?
          </h2>
          <p style={{ color:'#64748B', textAlign:'center', marginBottom:48, fontSize:16 }}>
            Una plataforma diseñada para el mercado laboral de América Latina
          </p>
          <div className="feature-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
            {[
              { icon:'💼', tit:'Para trabajadores', desc:'Creá tu perfil, aparecé en búsquedas de empleadores de tu zona y recibí propuestas directas. Sin intermediarios.' },
              { icon:'🏢', tit:'Para empleadores', desc:'Encontrá el perfil que necesitás entre miles de trabajadores calificados. Pagás solo para contactar.' },
              { icon:'🌎', tit:'33 países', desc:'América Latina, Europa, Asia y Oceanía. Empleos públicos y privados, actualizados todos los días.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-tit">{f.tit}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background:'linear-gradient(135deg, #1a0a05, #0D1117)', padding:'80px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(24px, 4vw, 36px)', fontWeight:900, color:'#F1F5F9', marginBottom:12, letterSpacing:-1 }}>
            Miles ya están en lista.
          </h2>
          <p style={{ color:'#64748B', marginBottom:40, fontSize:16 }}>
            No dejes que otros se queden con tus oportunidades.
          </p>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <span style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1 }}>Nexu</span>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Nexu · <a href="/empleos" style={{ color:'#64748B' }}>Ver empleos</a> · soporte@nexu.fyi
        </p>
      </footer>
    </>
  )
}
