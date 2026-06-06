import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../components/WaitlistForm'
import { bandPais, nombrePais, toSlug } from '../lib/utils'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getData() {
  const [statsRes, jobsRes] = await Promise.all([
    db.from('concursos').select('*', { count: 'exact', head: true }).eq('activo', true),
    db.from('concursos')
      .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo')
      .eq('activo', true)
      .or(`fecha_cierre.is.null,fecha_cierre.gte.${new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10)}`)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
  return {
    total: statsRes.count ?? 0,
    jobs: jobsRes.data ?? [],
  }
}

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
  const { total, jobs } = await getData()

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        .hero-anim  { animation: fadeUp 0.7s ease both }
        .stat-card  { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 28px; text-align: center; }
        .stat-num   { font-size: 40px; font-weight: 900; color: #E8785A; letter-spacing: -2px; line-height: 1; }
        .stat-lbl   { font-size: 13px; color: #94A3B8; margin-top: 4px; font-weight: 500; }
        .feature-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .feature-icon { font-size: 32px; margin-bottom: 12px; }
        .feature-tit  { font-size: 16px; font-weight: 800; color: #F1F5F9; margin-bottom: 6px; }
        .feature-desc { font-size: 14px; color: #64748B; line-height: 1.6; }
        .preview-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px 18px; transition: border-color .2s; text-decoration: none; display: block; }
        .preview-card:hover { border-color: rgba(232,120,90,0.4); }
        .preview-title { font-size: 14px; font-weight: 700; color: #F1F5F9; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .preview-org   { font-size: 12px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .preview-tag   { display: inline-block; background: rgba(232,120,90,0.12); color: #E8785A; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
        @media (max-width: 640px) {
          .hero-title   { font-size: clamp(32px, 9vw, 52px) !important; }
          .stats-grid   { grid-template-columns: 1fr 1fr !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .preview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <span className="nav-logo">Nexu</span>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <a href="/empleos" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Empleos</a>
          <a href="/download" style={{ background:'#E8785A', color:'white', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:700, textDecoration:'none' }}>App gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:'linear-gradient(160deg, #0D1117 60%, #1a0f0a)', minHeight:'92vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>
        <div className="hero-anim" style={{ maxWidth:700, width:'100%' }}>

          {/* Live pill */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', boxShadow:'0 0 8px #22c55e' }}/>
            <span style={{ fontSize:12, color:'#22c55e', fontWeight:700, letterSpacing:0.5 }}>EN VIVO — {total.toLocaleString('es')} empleos activos hoy</span>
          </div>

          <h1 className="hero-title" style={{ fontSize:'clamp(36px, 6vw, 64px)', fontWeight:900, color:'#F1F5F9', lineHeight:1.08, letterSpacing:-2, marginBottom:20 }}>
            El empleo de{' '}
            <em style={{ color:'#E8785A', fontStyle:'italic' }}>América Latina</em>
            <br />en un solo lugar
          </h1>

          <p style={{ fontSize:'clamp(16px, 2.5vw, 20px)', color:'#94A3B8', maxWidth:520, margin:'0 auto 40px', lineHeight:1.6 }}>
            Concursos públicos, empleos privados y llamados de trabajo de 33 países — actualizados todos los días. Podés descargarlo y probarlo gratis.
          </p>

          {/* CTAs */}
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:52 }}>
            <a href="/empleos" style={{ background:'#E8785A', color:'white', borderRadius:12, padding:'14px 28px', fontSize:16, fontWeight:800, textDecoration:'none', letterSpacing:-0.3 }}>
              Ver empleos →
            </a>
            <a href="/download" style={{ background:'rgba(255,255,255,0.06)', color:'#F1F5F9', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'14px 28px', fontSize:16, fontWeight:700, textDecoration:'none' }}>
              📱 Descargar app
            </a>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, maxWidth:480, margin:'0 auto 40px' }}>
            <div className="stat-card">
              <div className="stat-num">{total.toLocaleString('es')}</div>
              <div className="stat-lbl">empleos activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">33</div>
              <div className="stat-lbl">países</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{fontSize:22}}>Diario</div>
              <div className="stat-lbl">actualización</div>
            </div>
          </div>

          {/* Banderas */}
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:6, maxWidth:480, margin:'0 auto' }}>
            {['🇧🇷','🇦🇷','🇺🇾','🇨🇱','🇨🇴','🇲🇽','🇵🇪','🇪🇨','🇧🇴','🇵🇾','🇻🇪','🇬🇹','🇭🇳','🇳🇮','🇨🇷','🇵🇦','🇨🇺','🇩🇴','🇸🇻','🇵🇹','🇪🇸','🇮🇹','🇫🇷','🇩🇪','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇸🇪','🇳🇴','🇨🇭','🇯🇵','🇮🇳'].map((b, i) => (
              <span key={i} style={{ fontSize:22, lineHeight:1 }}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PREVIEW DE EMPLEOS */}
      {jobs.length > 0 && (
        <section style={{ background:'#0a0f1a', padding:'72px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth:900, margin:'0 auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32, flexWrap:'wrap', gap:12 }}>
              <div>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#F1F5F9', margin:0, letterSpacing:-0.5 }}>Últimos empleos publicados</h2>
                <p style={{ color:'#64748B', fontSize:14, margin:'4px 0 0' }}>Actualizados hace minutos</p>
              </div>
              <a href="/empleos" style={{ color:'#E8785A', fontWeight:700, fontSize:14, textDecoration:'none' }}>Ver todos →</a>
            </div>

            <div className="preview-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
              {jobs.map(j => (
                <Link key={j.id} href={`/empleos/${toSlug(j)}`} className="preview-card">
                  <div className="preview-title">{j.cargo || j.titulo}</div>
                  <div className="preview-org" style={{ marginBottom:8 }}>{j.organismo || '—'}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {j.pais && <span className="preview-tag">{bandPais(j.pais)} {nombrePais(j.pais)}</span>}
                    {j.lugar && <span style={{ fontSize:11, color:'#475569' }}>{j.lugar}</span>}
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ textAlign:'center', marginTop:28 }}>
              <a href="/empleos" style={{ background:'rgba(232,120,90,0.1)', color:'#E8785A', border:'1px solid rgba(232,120,90,0.25)', borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:700, textDecoration:'none' }}>
                Ver los {total.toLocaleString('es')} empleos →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section style={{ background:'#0D1117', padding:'80px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(24px, 4vw, 36px)', fontWeight:900, color:'#F1F5F9', textAlign:'center', marginBottom:12, letterSpacing:-1 }}>
            ¿Qué es Nexu?
          </h2>
          <p style={{ color:'#64748B', textAlign:'center', marginBottom:48, fontSize:16 }}>
            La plataforma de empleo diseñada para América Latina
          </p>
          <div className="feature-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
            {[
              { icon:'🔍', tit:'Buscá empleos', desc:'Miles de concursos públicos y empleos privados de 33 países, actualizados todos los días. Descargá la app y probala gratis.' },
              { icon:'💼', tit:'Creá tu perfil', desc:'Armá tu perfil de trabajador, aparecé en búsquedas de empleadores de tu zona y recibí propuestas directas.' },
              { icon:'📱', tit:'Alertas diarias', desc:'Describí con tus propias palabras qué sabés hacer y Nexu te avisa cada día cuando aparece una oportunidad para vos.' },
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

      {/* LISTA DE ESPERA — secundaria */}
      <section style={{ background:'linear-gradient(135deg, #0d1117, #1a1a2e)', padding:'80px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <div style={{ fontSize:32, marginBottom:16 }}>🔔</div>
          <h2 style={{ fontSize:'clamp(22px, 4vw, 32px)', fontWeight:900, color:'#F1F5F9', marginBottom:12, letterSpacing:-1 }}>
            Alertas personalizadas para tu perfil
          </h2>
          <p style={{ color:'#64748B', marginBottom:36, fontSize:15, lineHeight:1.6 }}>
            Anotate y te avisamos cuando salgan empleos que coincidan con tu oficio, en tu país.
          </p>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
            <WaitlistForm />
          </div>
          <p style={{ color:'#334155', fontSize:12 }}>Sin spam. Solo te avisamos cuando hay algo para vos.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <span style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1 }}>Nexu</span>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Nexu ·{' '}
          <a href="/empleos" style={{ color:'#64748B' }}>Ver empleos</a> ·{' '}
          <a href="/download" style={{ color:'#64748B' }}>App</a> ·{' '}
          soporte@nexu.fyi
        </p>
      </footer>
    </>
  )
}
