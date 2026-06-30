import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../components/WaitlistForm'
import JobsRealtime from './JobsRealtime'
import CounterRealtime from './CounterRealtime'
import SearchForm from './empleos/SearchForm'

export const revalidate = 300
export const fetchCache = 'force-no-store'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function getStats() {
  const { data } = await db.rpc('count_concursos_activos')
  return { total: (data ?? 0) }
}

async function getRecentJobs() {
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)
    .in('pais', ['UY','AR','BR','MX','CL','CO','PE','EC','BO','PY','VE'])
    .order('created_at', { ascending: false })
    .limit(8)
  return data ?? []
}

export const metadata = {
  title: 'Konexu — Concursos Públicos y Empleos en Uruguay, Argentina y toda LatAm',
  description: 'Encontrá concursos públicos, llamados de trabajo y vacantes en Uruguay, Argentina, Brasil y 30 países más. Actualizados todos los días. Gratis para trabajadores.',
  keywords: ['concursos públicos Uruguay','empleos Uruguay','llamados trabajo Uruguay','ONSC concursos','Uruguay Concursa','empleos Argentina','vacantes gobierno','empleo público','trabajo LatAm'],
  openGraph: {
    title: 'Konexu — Concursos Públicos y Empleos en LatAm',
    description: 'Miles de concursos públicos y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Actualizados diariamente. Gratis.',
  },
}

export default async function Home() {
  const [{ total }, recentJobs] = await Promise.all([getStats(), getRecentJobs()])

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .hero-anim { animation: fadeUp 0.6s ease both }
        .live-dot { animation: pulse 2s infinite }
        .stat-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px 24px; text-align:center }
        .stat-num  { font-size:clamp(28px,4vw,40px); font-weight:900; color:#E8785A; letter-spacing:-2px; line-height:1 }
        .stat-lbl  { font-size:13px; color:#94A3B8; margin-top:4px; font-weight:500 }
        .feature-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:24px }
        .hero-row{display:flex;align-items:center;justify-content:center;gap:50px;max-width:1080px;width:100%;margin:0 auto}
        .hero-copy{flex:1;min-width:0;max-width:560px}
        .hero-visual{flex-shrink:0}
        .hphone{width:248px;height:506px;border-radius:38px;background:#000;padding:9px;box-shadow:0 30px 70px rgba(0,0,0,0.55)}
        .hphone .scr{position:relative;width:100%;height:100%;border-radius:30px;background:#FBF8F4;overflow:hidden}
        .hphone .nt{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:72px;height:16px;background:#000;border-radius:0 0 12px 12px;z-index:6}
        .hphone .sb{position:absolute;top:0;left:0;right:0;height:30px;display:flex;align-items:center;justify-content:space-between;padding:9px 16px 0;font-size:10px;font-weight:800;color:#1A1020;z-index:5}
        .hphone .app{position:absolute;top:30px;bottom:54px;left:0;right:0;overflow:hidden;padding:8px 13px 0}
        .hphone .lv{display:inline-flex;align-items:center;gap:5px;background:#E6FBF5;border-radius:20px;padding:3px 9px;font-size:9px;color:#0E9E92;font-weight:800;margin-bottom:10px}
        .hphone .lv i{width:5px;height:5px;border-radius:50%;background:#0E9E92;display:inline-block}
        .hphone h5{color:#1A1020;font-size:15px;font-weight:900;letter-spacing:-0.3px;line-height:1.2;margin-bottom:11px;text-align:left}
        .hphone h5 em{color:#E8785A;font-style:normal}
        .hphone .jc{background:#142130;border:1px solid rgba(255,255,255,0.07);border-radius:11px;padding:9px 10px;margin-bottom:8px;text-align:left}
        .hphone .jc .t{color:#F1F5F9;font-size:10.5px;font-weight:700;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hphone .jc .m{color:#9AA6B6;font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hphone .jc .p{color:#2DD4BF;font-size:8.5px;font-weight:800;margin-top:4px}
        .hphone .tb{position:absolute;bottom:0;left:0;right:0;height:54px;background:#fff;border-top:1px solid #ECE6DE;display:flex;align-items:center;justify-content:space-around;padding-bottom:5px;z-index:5}
        .hphone .tb span{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:8px;color:#A99FB5;font-weight:600}
        .hphone .tb span.on{color:#E8785A}
        .hphone .tb span b{font-size:14px;font-weight:400}
        @media(max-width:900px){
          .hero-row{flex-direction:column;gap:36px}
          .hero-visual{display:none}
        }
        @media(max-width:640px){
          .hero-title { font-size:clamp(32px,9vw,52px) !important }
          .stats-grid { grid-template-columns:1fr 1fr !important }
          .feature-grid { grid-template-columns:1fr !important }
          .hero-btns { flex-direction:column !important; align-items:center !important }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo"><span>Konexu</span><span style={{fontSize:'0.42em',marginLeft:'-9px',lineHeight:1,marginBottom:'3px'}}>🧩</span></Link>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <Link href="/pulso-latam" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Pulso Laboral</Link>
          <Link href="/empleos" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Ver empleos</Link>
          <a href="/download" className="nav-btn">App gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:'radial-gradient(900px 500px at 80% 18%,rgba(232,120,90,0.12),transparent 60%),radial-gradient(700px 420px at 8% 82%,rgba(45,212,191,0.07),transparent 55%),#0D1117', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>
        <div className="hero-anim" style={{ width:'100%' }}>
         <div className="hero-row">
          <div className="hero-copy">

          {/* Badge EN VIVO */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(45,212,191,0.1)', border:'1px solid rgba(45,212,191,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
            <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#2DD4BF', display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#2DD4BF', fontWeight:700, letterSpacing:0.5 }}>EN VIVO — <CounterRealtime initialTotal={total} /> empleos activos hoy</span>
          </div>

          {/* Título */}
          <h1 className="hero-title" style={{ fontSize:'clamp(36px,6vw,64px)', fontWeight:900, color:'#F1F5F9', lineHeight:1.08, letterSpacing:-2, marginBottom:20 }}>
            El empleo de{' '}
            <em style={{ color:'#E8785A', fontStyle:'italic' }}>América Latina</em>
            <br />en un solo lugar
          </h1>

          <p style={{ fontSize:'clamp(16px,2.5vw,20px)', color:'#94A3B8', maxWidth:500, margin:'0 auto 40px', lineHeight:1.6 }}>
            Todos los llamados públicos y privados de 33 países, actualizados a diario en tu celular. Descargá la app gratis ahora.
          </p>

          <div style={{ maxWidth: 540, margin: '0 auto 28px' }}>
            <SearchForm />
          </div>

          {/* CTA buttons */}
          <div className="hero-btns" style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:56, flexWrap:'wrap' }}>
            <Link href="/empleos" style={{ background:'var(--coral-cta)', color:'#fff', borderRadius:10, padding:'14px 28px', fontSize:15, fontWeight:800, textDecoration:'none', letterSpacing:-0.3 }}>
              Ver empleos →
            </Link>
            <a href="/download" style={{ background:'rgba(255,255,255,0.07)', color:'#F1F5F9', borderRadius:10, padding:'14px 28px', fontSize:15, fontWeight:700, textDecoration:'none', border:'1px solid rgba(255,255,255,0.12)' }}>
              📱 App gratis
            </a>
          </div>
          </div>{/* /hero-copy */}

          <div className="hero-visual">
            <div className="hphone"><div className="scr">
              <div className="nt"></div>
              <div className="sb"><span>9:41</span><span>📶 🔋</span></div>
              <div className="app">
                <div className="lv"><i></i>EN VIVO</div>
                <h5>Tu próximo <em>trabajo</em> te está buscando</h5>
                {recentJobs.slice(0, 4).map((j) => (
                  <div className="jc" key={j.id}>
                    <div className="t">{j.cargo || j.titulo}</div>
                    <div className="m">{j.organismo || '—'}</div>
                    <div className="p">{j.lugar || j.pais}</div>
                  </div>
                ))}
              </div>
              <div className="tb">
                <span className="on"><b>🏠</b>Inicio</span>
                <span><b>🏆</b>Concursa</span>
                <span><b>💬</b>Mensajes</span>
                <span><b>👤</b>Cuenta</span>
              </div>
            </div></div>
          </div>
         </div>{/* /hero-row */}

          {/* Stats */}
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:480, margin:'0 auto 48px' }}>
            <div className="stat-card">
              <div className="stat-num"><CounterRealtime initialTotal={total} /></div>
              <div className="stat-lbl">empleos activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">33</div>
              <div className="stat-lbl">países</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ fontSize:24 }}>Actualización</div>
              <div className="stat-lbl">diario</div>
            </div>
          </div>

        </div>
      </section>

      {/* EMPLEOS RECIENTES */}
      <section style={{ background:'#0D1117', padding:'64px 24px 48px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#F1F5F9', letterSpacing:-0.5 }}>Empleos recientes</h2>
            <Link href="/empleos" style={{ color:'#E8785A', fontSize:13, fontWeight:700, textDecoration:'none' }}>Ver todos →</Link>
          </div>
          <JobsRealtime initialJobs={recentJobs} />
        </div>
      </section>

      {/* PULSO LABORAL LATAM BANNER */}
      <section style={{ background:'#080D12', padding:'48px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <Link href="/pulso-latam" style={{ display:'block', background:'linear-gradient(120deg,#0D1117,#0f1a14)', border:'1px solid rgba(45,212,191,0.2)', borderRadius:18, padding:'28px 32px', textDecoration:'none', transition:'border-color .2s' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#2DD4BF', display:'inline-block', animation:'pulse 2s infinite' }}/>
                  <span style={{ fontSize:11, color:'#2DD4BF', fontWeight:800, letterSpacing:'1.5px', textTransform:'uppercase' }}>Datos en tiempo real</span>
                </div>
                <p style={{ fontSize:'clamp(16px,2.5vw,22px)', fontWeight:900, color:'#F1F5F9', letterSpacing:'-.5px', marginBottom:6 }}>
                  Pulso Laboral LatAm — vacantes activas por país
                </p>
                <p style={{ fontSize:14, color:'#64748B', lineHeight:1.5 }}>
                  ¿Cuántos empleos hay disponibles hoy en Brasil, Argentina, México y toda la región? Datos reales actualizados cada mañana.
                </p>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:'#2DD4BF', whiteSpace:'nowrap' }}>Ver datos →</span>
            </div>
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ background:'#080D12', padding:'64px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(22px,4vw,34px)', fontWeight:900, color:'#F1F5F9', textAlign:'center', marginBottom:10, letterSpacing:-1 }}>¿Qué es Konexu?</h2>
          <p style={{ color:'#64748B', textAlign:'center', marginBottom:48, fontSize:15 }}>Una plataforma diseñada para el mercado laboral de América Latina</p>
          <div className="feature-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { icon:'🔍', tit:'Buscá empleos', desc:'Concursos públicos, convocatorias y vacantes privadas de 33 países. Todo en un solo lugar, actualizado todos los días.' },
              { icon:'👤', tit:'Creá tu perfil', desc:'Los empleadores te encuentran a vos. Sin intermediarios, sin comisiones. Gratis para registrarte.' },
              { icon:'🔔', tit:'Alertas diarias', desc:'Configurá tu perfil y Konexu te avisa cuando aparezca una oportunidad que se ajuste a lo que buscás.' },
              { icon:'🏛️', tit:'Concursa', desc:'Llamados del sector público, ONSC, convocatorias gubernamentales. Todo comparado con tu perfil.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontSize:32, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', marginBottom:6 }}>{f.tit}</div>
                <div style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section style={{ background:'linear-gradient(160deg,#0D1117,#0d1a17)', padding:'80px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(22px,4vw,36px)', fontWeight:900, color:'#F1F5F9', marginBottom:10, letterSpacing:-1 }}>
            Deja de buscar. El trabajo te encuentra.
          </h2>
          <p style={{ color:'#94A3B8', marginBottom:40, fontSize:15, lineHeight:1.6 }}>
            Regístrate y Konexu te avisa apenas aparece un empleo para ti —público o privado— en tu país. Gratis.
          </p>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <Link href="/" style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1, textDecoration:'none' }}>
          <span>Konexu</span><span style={{fontSize:'0.42em', marginLeft:'-9px', lineHeight:1, marginBottom:'3px'}}>🧩</span>
        </Link>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Konexu ·{' '}
          <Link href="/empleos" style={{ color:'#64748B' }}>Ver empleos</Link> ·{' '}
          <a href="/download" style={{ color:'#64748B' }}>App gratis</a> ·{' '}
          soporte@konexu.app
        </p>
      </footer>
    </>
  )
}
