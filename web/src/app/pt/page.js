import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../../components/WaitlistForm'
import JobsRealtime from '../JobsRealtime'
import CounterRealtime from '../CounterRealtime'

export const revalidate = 300
export const fetchCache = 'force-no-store'

// Server component: credenciales de servidor, igual que la home en español.
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getStats() {
  const { data } = await db.rpc('count_concursos_activos')
  return { total: (data ?? 0) }
}

async function getRecentJobsBR() {
  const { data } = await db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)
    .eq('pais', 'BR')
    .order('created_at', { ascending: false })
    .limit(8)
  return data ?? []
}

export const metadata = {
  title: 'Konexu — Vagas de emprego no Brasil direto no seu email. Grátis.',
  description: 'Escreva o que você sabe fazer e a Konexu vigia milhares de vagas por você. Quando aparece uma vaga do seu perfil, chega no seu email. Grátis, sem cadastro complicado.',
  keywords: ['vagas Brasil','emprego Brasil','vagas de emprego','alerta de vagas','concursos públicos Brasil','trabalho Brasil'],
  alternates: { canonical: '/pt' },
  openGraph: {
    title: 'Pare de procurar. O trabalho encontra você.',
    description: 'Vagas do seu perfil direto no seu email, todos os dias. Grátis.',
    url: '/pt',
    siteName: 'Konexu',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og-konexu-pt.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pare de procurar. O trabalho encontra você.',
    description: 'Vagas do seu perfil direto no seu email, todos os dias. Grátis.',
    images: ['/og-konexu-pt.png'],
  },
  robots: { index: true, follow: true },
}

export default async function HomePT() {
  const [{ total }, recentJobs] = await Promise.all([getStats(), getRecentJobsBR()])

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
        @media(max-width:640px){
          .hero-title { font-size:clamp(32px,9vw,52px) !important }
          .stats-grid { grid-template-columns:1fr 1fr !important }
          .feature-grid { grid-template-columns:1fr !important }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <Link href="/pt" className="nav-logo"><span>Konexu</span><span style={{fontSize:'0.42em',marginLeft:'-9px',lineHeight:1,marginBottom:'3px'}}>🧩</span></Link>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <Link href="/empleos/pais/brasil" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Ver vagas</Link>
          <a href="#alertas" className="nav-btn">Alertas grátis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:'radial-gradient(900px 500px at 80% 18%,rgba(232,120,90,0.12),transparent 60%),radial-gradient(700px 420px at 8% 82%,rgba(45,212,191,0.07),transparent 55%),#0D1117', minHeight:'88vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>
        <div className="hero-anim" style={{ width:'100%', maxWidth:640, margin:'0 auto' }}>

          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(45,212,191,0.1)', border:'1px solid rgba(45,212,191,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
            <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#2DD4BF', display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#2DD4BF', fontWeight:700, letterSpacing:0.5 }}>AO VIVO — <CounterRealtime initialTotal={total} /> vagas ativas hoje</span>
          </div>

          <h1 className="hero-title" style={{ fontSize:'clamp(32px,5.4vw,56px)', fontWeight:900, color:'#F1F5F9', lineHeight:1.08, letterSpacing:-1.5, marginBottom:12 }}>
            Pare de procurar.{' '}
            <em style={{ color:'#E8785A', fontStyle:'italic' }}>O trabalho encontra você.</em>
          </h1>
          <p style={{ fontSize:'clamp(15px,2.1vw,20px)', fontWeight:700, color:'#CBD5E1', letterSpacing:-0.3, marginBottom:28 }}>
            Escreva o que você sabe fazer — a Konexu vigia as vagas por você e te avisa por email. Grátis.
          </p>

          {/* FORMULARIO ARRIBA: continuidad con el post de Facebook */}
          <div id="alertas" style={{ display:'flex', justifyContent:'center', marginBottom:40 }}>
            <WaitlistForm lang="pt" paisDefault="🇧🇷 Brasil" ctaLabel="Quero receber vagas grátis →" />
          </div>

          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:480, margin:'4px auto 0' }}>
            <div className="stat-card">
              <div className="stat-num"><CounterRealtime initialTotal={total} /></div>
              <div className="stat-lbl">vagas ativas</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">33</div>
              <div className="stat-lbl">países</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ fontSize:24 }}>Atualização</div>
              <div className="stat-lbl">diária</div>
            </div>
          </div>
        </div>
      </section>

      {/* VAGAS RECIENTES BR */}
      <section style={{ background:'#0D1117', padding:'64px 24px 48px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#F1F5F9', letterSpacing:-0.5 }}>Vagas recentes no Brasil</h2>
            <Link href="/empleos/pais/brasil" style={{ color:'#E8785A', fontSize:13, fontWeight:700, textDecoration:'none' }}>Ver todas →</Link>
          </div>
          <JobsRealtime initialJobs={recentJobs} />
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section style={{ background:'#080D12', padding:'64px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(22px,4vw,34px)', fontWeight:900, color:'#F1F5F9', textAlign:'center', marginBottom:10, letterSpacing:-1 }}>Como funciona?</h2>
          <p style={{ color:'#64748B', textAlign:'center', marginBottom:48, fontSize:15 }}>Três passos. Sem cadastro complicado, sem pagar nada.</p>
          <div className="feature-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { icon:'✍️', tit:'1. Escreva seu ofício', desc:'Com suas palavras: "auxiliar de produção", "motorista", "atendente", "cozinheira"... o que você sabe fazer.' },
              { icon:'🤖', tit:'2. A Konexu vigia por você', desc:'Milhares de vagas monitoradas todos os dias, públicas e privadas, em todo o Brasil.' },
              { icon:'📩', tit:'3. A vaga chega no seu email', desc:'Quando aparece uma vaga do seu perfil, você fica sabendo antes de todo mundo. Grátis.' },
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

      {/* FOOTER */}
      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <Link href="/pt" style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1, textDecoration:'none' }}>
          <span>Konexu</span><span style={{fontSize:'0.42em', marginLeft:'-9px', lineHeight:1, marginBottom:'3px'}}>🧩</span>
        </Link>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Konexu ·{' '}
          <Link href="/empleos/pais/brasil" style={{ color:'#64748B' }}>Ver vagas</Link> ·{' '}
          <Link href="/" style={{ color:'#64748B' }}>Español</Link> ·{' '}
          soporte@konexu.app
        </p>
      </footer>
    </>
  )
}
