import Link from 'next/link'
import WaitlistForm from './WaitlistForm'
import JobsRealtime from '../app/JobsRealtime'
import CounterRealtime from '../app/CounterRealtime'

// Plantilla compartida de las landings internacionales (misma receta que /pt).
// Recibe todo por props: los page.js de cada idioma hacen el fetch y la metadata.
export default function LandingIntl({ lang, t, total, jobs }) {
  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .hero-anim { animation: fadeUp 0.6s ease both }
        .live-dot { animation: pulse 2s infinite }
        .stat-card { background:#FFFFFF; border:1px solid #EDE6DC; border-radius:16px; padding:20px 24px; text-align:center }
        .stat-num  { font-size:clamp(28px,4vw,40px); font-weight:900; color:#C2502F; letter-spacing:-2px; line-height:1 }
        .stat-lbl  { font-size:13px; color:#8c8492; margin-top:4px; font-weight:500 }
        .feature-card { background:#FFFFFF; border:1px solid #EDE6DC; border-radius:16px; padding:24px }
        @media(max-width:640px){
          .hero-title { font-size:clamp(32px,9vw,52px) !important }
          .stats-grid { grid-template-columns:1fr 1fr !important }
          .feature-grid { grid-template-columns:1fr !important }
        }
      `}</style>

      <nav className="nav">
        <Link href={`/${lang}`} className="nav-logo"><span>Konexu</span><span style={{fontSize:'0.42em',marginLeft:'-9px',lineHeight:1,marginBottom:'3px'}}>🧩</span></Link>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <Link href="/empleos" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>{t.nav_jobs}</Link>
          <a href="#alertas" className="nav-btn">{t.nav_alerts}</a>
        </div>
      </nav>

      <section style={{ background:'radial-gradient(900px 500px at 80% 18%,rgba(232,120,90,0.10),transparent 60%),radial-gradient(700px 420px at 8% 82%,rgba(45,212,191,0.05),transparent 55%),#FBF8F4', minHeight:'88vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>
        <div className="hero-anim" style={{ width:'100%', maxWidth:640, margin:'0 auto' }}>

          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#E6FBF5', border:'1px solid #9BE8DC', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
            <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#0E9E92', display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#0E9E92', fontWeight:700, letterSpacing:0.5 }}>{t.live_pre}<CounterRealtime initialTotal={total} />{t.live_post}</span>
          </div>

          <h1 className="hero-title" style={{ fontSize:'clamp(32px,5.4vw,56px)', fontWeight:900, color:'#1A1020', lineHeight:1.08, letterSpacing:-1.5, marginBottom:12 }}>
            {t.h1_a}
            <em style={{ color:'#C2502F', fontStyle:'italic' }}>{t.h1_b}</em>
          </h1>
          <p style={{ fontSize:'clamp(15px,2.1vw,20px)', fontWeight:700, color:'#5A4E6A', letterSpacing:-0.3, marginBottom:28 }}>
            {t.sub}
          </p>

          <div id="alertas" style={{ display:'flex', justifyContent:'center', marginBottom:40 }}>
            <WaitlistForm lang={lang} paisDefault={t.pais_default} ctaLabel={t.cta} />
          </div>

          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:480, margin:'4px auto 0' }}>
            <div className="stat-card">
              <div className="stat-num"><CounterRealtime initialTotal={total} /></div>
              <div className="stat-lbl">{t.stat_jobs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">33</div>
              <div className="stat-lbl">{t.stat_countries}</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ fontSize:24 }}>{t.stat_upd_big}</div>
              <div className="stat-lbl">{t.stat_upd_small}</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background:'#FBF8F4', padding:'64px 24px 48px', borderTop:'1px solid #EDE6DC' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#1A1020', letterSpacing:-0.5 }}>{t.recent_title}</h2>
            <Link href="/empleos" style={{ color:'#E8785A', fontSize:13, fontWeight:700, textDecoration:'none' }}>{t.see_all}</Link>
          </div>
          <JobsRealtime initialJobs={jobs} />
        </div>
      </section>

      <section style={{ background:'#F5EFE6', padding:'64px 24px', borderTop:'1px solid #EDE6DC' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(22px,4vw,34px)', fontWeight:900, color:'#1A1020', textAlign:'center', marginBottom:10, letterSpacing:-1 }}>{t.how_title}</h2>
          <p style={{ color:'#64748B', textAlign:'center', marginBottom:48, fontSize:15 }}>{t.how_sub}</p>
          <div className="feature-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {t.steps.map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontSize:32, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#1A1020', marginBottom:6 }}>{f.tit}</div>
                <div style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <Link href={`/${lang}`} style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1, textDecoration:'none' }}>
          <span>Konexu</span><span style={{fontSize:'0.42em', marginLeft:'-9px', lineHeight:1, marginBottom:'3px'}}>🧩</span>
        </Link>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Konexu ·{' '}
          <Link href="/empleos" style={{ color:'#64748B' }}>{t.footer_jobs}</Link> ·{' '}
          <Link href="/" style={{ color:'#64748B' }}>Español</Link> ·{' '}
          soporte@konexu.app
        </p>
      </footer>
    </>
  )
}
