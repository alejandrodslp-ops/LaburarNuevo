import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const PAISES_META = {
  BR: { nombre: 'Brasil',    bandera: '🇧🇷' },
  AR: { nombre: 'Argentina', bandera: '🇦🇷' },
  MX: { nombre: 'México',    bandera: '🇲🇽' },
  CL: { nombre: 'Chile',     bandera: '🇨🇱' },
  ES: { nombre: 'España',    bandera: '🇪🇸' },
  UY: { nombre: 'Uruguay',   bandera: '🇺🇾' },
  CO: { nombre: 'Colombia',  bandera: '🇨🇴' },
  PE: { nombre: 'Perú',      bandera: '🇵🇪' },
  EC: { nombre: 'Ecuador',   bandera: '🇪🇨' },
  BO: { nombre: 'Bolivia',   bandera: '🇧🇴' },
  PY: { nombre: 'Paraguay',  bandera: '🇵🇾' },
}

const RUBROS_LABELS = {
  tecnologia:'Tecnología & IT', industria:'Industria', comercio:'Comercio & Ventas',
  salud:'Salud', logistica:'Logística', finanzas:'Finanzas',
  construccion:'Construcción', educacion:'Educación', admin:'Administración', gastronomia:'Gastronomía',
}

export const metadata = {
  title: 'Pulso Laboral LatAm — ¿Cuántos empleos hay en América Latina hoy?',
  description: 'Datos reales: cuántos empleos hay disponibles hoy en Brasil, Argentina, México, Colombia, Chile y toda América Latina. Actualizado cada 24 horas.',
  keywords: ['cuántos empleos hay en latinoamérica','mercado laboral latinoamérica 2026','empleos disponibles latam','vacantes por país latam','estadísticas empleo brasil','mercado trabajo argentina','vacantes colombia chile','empleos disponibles hoy'],
  openGraph: {
    title: 'Pulso Laboral LatAm — Empleos en América Latina hoy',
    description: 'Datos reales del mercado laboral latinoamericano. País por país, actualizado diariamente.',
    url: '/pulso-latam',
  },
  alternates: { canonical: '/pulso-latam' },
}

async function getDatos() {
  const [{ data: historial }, { data: rubros }] = await Promise.all([
    db.from('mercado_stats').select('pais,total_empleos,fecha').order('fecha', { ascending: false }).limit(77),
    db.from('mercado_rubros').select('pais,rubro,total_empleos,fecha').order('fecha', { ascending: false }).limit(100),
  ])

  if (!historial?.length) return null

  const porPais = {}
  for (const row of historial) {
    if (!porPais[row.pais]) porPais[row.pais] = row
  }

  const porFecha = {}
  for (const row of historial) {
    if (!porFecha[row.fecha]) porFecha[row.fecha] = 0
    porFecha[row.fecha] += row.total_empleos
  }
  const tendencia = Object.entries(porFecha)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([fecha, total]) => ({ fecha, total }))

  const ranking = Object.values(porPais).sort((a, b) => b.total_empleos - a.total_empleos)
  const total = ranking.reduce((s, r) => s + r.total_empleos, 0)
  const maximo = ranking[0]?.total_empleos ?? 1
  const ultimaFecha = ranking[0]?.fecha ?? null

  const rubrosMap = {}
  for (const row of (rubros || [])) {
    if (!rubrosMap[row.rubro]) rubrosMap[row.rubro] = row
  }
  const rubrosList = Object.values(rubrosMap).sort((a, b) => b.total_empleos - a.total_empleos)

  return { ranking, total, maximo, tendencia, rubros: rubrosList, ultimaFecha }
}

function fmtN(n) { return Number(n).toLocaleString('es-UY') }
function fmtFecha(f) {
  if (!f) return ''
  return new Date(f + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtFechaCorta(f) {
  if (!f) return ''
  return new Date(f + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}
function pct(n, total) { return ((n / total) * 100).toFixed(1) }

function derivarInsights(ranking, total) {
  if (!ranking?.length) return []
  const insights = []
  const top = ranking[0]
  const seg = ranking[1]
  const topM = PAISES_META[top?.pais]
  const segM = PAISES_META[seg?.pais]

  if (top && seg && Math.abs(top.total_empleos - seg.total_empleos) < top.total_empleos * 0.05) {
    insights.push(`${topM?.nombre} y ${segM?.nombre} empatan en el liderato con ${fmtN(top.total_empleos)} vacantes cada uno.`)
  } else if (top) {
    insights.push(`${topM?.nombre} lidera la región con ${fmtN(top.total_empleos)} empleos — el ${pct(top.total_empleos, total)}% del mercado.`)
  }

  for (let i = 1; i < ranking.length - 1; i++) {
    const a = ranking[i], b = ranking[i + 1]
    const mA = PAISES_META[a.pais], mB = PAISES_META[b.pais]
    if (a.total_empleos > b.total_empleos * 1.1) {
      insights.push(`${mA?.nombre} supera a ${mB?.nombre}: ${fmtN(a.total_empleos)} vs ${fmtN(b.total_empleos)} puestos activos.`)
      break
    }
  }

  const ultimo = ranking[ranking.length - 1]
  if (ultimo && top && top.total_empleos > ultimo.total_empleos * 50) {
    const veces = Math.round(top.total_empleos / ultimo.total_empleos).toLocaleString('es-UY')
    const ultiM = PAISES_META[ultimo.pais]
    insights.push(`${topM?.nombre} tiene ${veces}× más vacantes que ${ultiM?.nombre}.`)
  }

  return insights.slice(0, 3)
}

export default async function PulsoLatam() {
  const d = await getDatos()
  const ranking = d?.ranking ?? []
  const total = d?.total ?? 0
  const maximo = d?.maximo ?? 1
  const tendencia = d?.tendencia ?? []
  const rubros = d?.rubros ?? []
  const ultimaFecha = d?.ultimaFecha
  const insights = derivarInsights(ranking, total)
  const hayDatos = ranking.length > 0
  const top1 = ranking[0]
  const top1Meta = top1 ? PAISES_META[top1.pais] : null
  const ultimo = ranking[ranking.length - 1]
  const ultiMeta = ultimo ? PAISES_META[ultimo.pais] : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Pulso Laboral LatAm',
    description: 'Empleos activos por país en América Latina, relevado diariamente.',
    url: 'https://www.nexu.fyi/pulso-latam',
    creator: { '@type': 'Organization', name: 'Nexu', url: 'https://www.nexu.fyi' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
        .fu{animation:fadeUp .55s ease both}
        .d1{animation-delay:.05s}.d2{animation-delay:.12s}.d3{animation-delay:.22s}.d4{animation-delay:.32s}
        .live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2DD4BF;animation:blink 2s infinite;margin-right:8px;vertical-align:middle;flex-shrink:0}
        .num-hero{font-size:clamp(64px,11vw,120px);font-weight:900;line-height:1;letter-spacing:clamp(-3px,-0.05em,-5px);color:#fff;font-family:'Inter',system-ui,sans-serif}
        .insight{border-left:3px solid #E8785A;padding:11px 16px;background:rgba(232,120,90,0.07);border-radius:0 8px 8px 0;font-size:14px;color:#CBD5E1;line-height:1.5}
        .bar-row{display:flex;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
        .bar-row:last-child{border-bottom:none}
        .bar-track{flex:1;height:10px;background:rgba(255,255,255,0.07);border-radius:5px;overflow:hidden;min-width:60px}
        .bar-fill{height:100%;border-radius:5px}
        .bar-fill-coral{background:linear-gradient(90deg,#E8785A 0%,#f0a080 100%)}
        .bar-fill-teal{background:linear-gradient(90deg,#2DD4BF 0%,#5eead4 100%)}
        .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px 28px}
        .trend-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
        .trend-row:last-child{border-bottom:none}
        .badge-hoy{background:rgba(45,212,191,0.15);color:#2DD4BF;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:800;margin-left:8px;letter-spacing:.5px}
        .label-sec{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#475569;margin-bottom:18px}
        .callout{background:linear-gradient(135deg,rgba(232,120,90,0.1),rgba(232,120,90,0.03));border:1px solid rgba(232,120,90,0.22);border-radius:18px;padding:36px 36px}
        .seo p{font-size:15px;color:#64748B;line-height:1.8;margin-bottom:14px}
        .seo h2{font-size:19px;font-weight:800;color:#94A3B8;margin:32px 0 10px;letter-spacing:-.3px}
        .seo strong{color:#94A3B8}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:16px 32px;border-bottom:1px solid rgba(255,255,255,0.06);position:sticky;top:0;background:rgba(8,11,16,0.94);backdrop-filter:blur(14px);z-index:100}
        .nav-logo{text-decoration:none;font-size:22px;font-weight:900;color:#E8785A;letter-spacing:-.5px}
        .nav-btn{background:#E8785A;color:#fff!important;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;text-decoration:none}
        .divider{height:1px;background:rgba(255,255,255,0.06);margin:56px 0}
        @media(max-width:600px){
          .card{padding:18px 16px}
          .callout{padding:24px 18px}
          .bar-name{display:none}
          .num-hero{letter-spacing:-2px}
          .nav{padding:14px 20px}
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu<span style={{fontSize:9,marginLeft:'-8px',verticalAlign:'bottom'}}>🧩</span></Link>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <Link href="/empleos" style={{color:'#94A3B8',fontSize:13,fontWeight:600,textDecoration:'none'}}>Ver empleos</Link>
          <a href="/download" className="nav-btn">App gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{maxWidth:900,margin:'0 auto',padding:'68px 32px 56px'}}>

        <div className="fu d1" style={{marginBottom:20}}>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:'uppercase',color:'#475569'}}>Pulso Laboral LatAm</span>
          <span style={{margin:'0 12px',color:'#334155'}}>·</span>
          <span className="live-dot"/>
          <span style={{fontSize:11,color:'#2DD4BF',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>
            {hayDatos ? fmtFecha(ultimaFecha) : 'Sin datos aún'}
          </span>
        </div>

        <div className="fu d1">
          <h1 style={{fontSize:'clamp(26px,4vw,40px)',fontWeight:900,color:'#F1F5F9',lineHeight:1.15,letterSpacing:-.8,marginBottom:28,maxWidth:660}}>
            ¿Cuántos empleos hay disponibles en América Latina hoy?
          </h1>
        </div>

        {hayDatos ? (
          <>
            <div className="fu d2" style={{marginBottom:8}}>
              <div className="num-hero">{fmtN(total)}</div>
            </div>
            <div className="fu d2" style={{marginBottom:44}}>
              <p style={{fontSize:'clamp(15px,2vw,20px)',color:'#64748B',fontWeight:600,marginTop:6}}>
                empleos activos en {ranking.length} países · actualizados cada 24 horas
              </p>
            </div>

            {insights.length > 0 && (
              <div className="fu d3" style={{display:'flex',flexDirection:'column',gap:8}}>
                {insights.map((txt, i) => <div key={i} className="insight">{txt}</div>)}
              </div>
            )}
          </>
        ) : (
          <div className="fu d2">
            <div style={{fontSize:72,fontWeight:900,color:'#1E293B',letterSpacing:-3,marginBottom:16}}>–</div>
            <p style={{fontSize:16,color:'#475569'}}>Datos disponibles mañana. El sistema recopila automáticamente cada mañana.</p>
          </div>
        )}
      </section>

      {hayDatos && (
        <div style={{maxWidth:900,margin:'0 auto',padding:'0 32px 80px'}}>

          {/* RANKING */}
          <section className="fu d3" style={{marginBottom:60}}>
            <p className="label-sec">Ranking de países · {fmtFecha(ultimaFecha)}</p>
            <div className="card">
              {ranking.map(({pais, total_empleos}, i) => {
                const meta = PAISES_META[pais] ?? {nombre:pais, bandera:'🌐'}
                const ancho = Math.round((total_empleos / maximo) * 100)
                const porcentaje = pct(total_empleos, total)
                return (
                  <div key={pais} className="bar-row">
                    <span style={{fontSize:12,color:'#334155',fontWeight:800,minWidth:18,textAlign:'right'}}>{i+1}</span>
                    <span style={{fontSize:26,width:32,flexShrink:0}}>{meta.bandera}</span>
                    <span className="bar-name" style={{fontSize:13,color:'#94A3B8',fontWeight:600,minWidth:80}}>{meta.nombre}</span>
                    <div className="bar-track">
                      <div className="bar-fill bar-fill-coral" style={{width:`${ancho}%`}} />
                    </div>
                    <span style={{fontSize:'clamp(14px,2vw,17px)',fontWeight:800,color:'#F1F5F9',minWidth:90,textAlign:'right',letterSpacing:-.3}}>{fmtN(total_empleos)}</span>
                    <span style={{fontSize:12,color:'#475569',fontWeight:700,minWidth:40,textAlign:'right'}}>{porcentaje}%</span>
                  </div>
                )
              })}
            </div>
            <p style={{fontSize:11,color:'#1E293B',marginTop:10}}>Fuente: Computrabajo · Relevamiento automático diario</p>
          </section>

          {/* EL DATO */}
          {top1 && ultimo && top1.pais !== ultimo.pais && (
            <section className="fu d3" style={{marginBottom:60}}>
              <div className="callout">
                <p style={{fontSize:11,color:'#E8785A',fontWeight:800,letterSpacing:2,textTransform:'uppercase',marginBottom:14}}>El dato</p>
                <p style={{fontSize:'clamp(20px,3vw,34px)',fontWeight:900,color:'#F1F5F9',lineHeight:1.2,letterSpacing:-.5,marginBottom:14}}>
                  {top1Meta?.nombre} tiene {Math.round(top1.total_empleos / ultimo.total_empleos).toLocaleString('es-UY')}× más empleos publicados que {ultiMeta?.nombre}
                </p>
                <p style={{fontSize:14,color:'#64748B',lineHeight:1.65}}>
                  La brecha entre los mercados más digitalizados y los más pequeños refleja la desigualdad estructural del empleo formal en LatAm. Los países con mayor penetración de internet y economías más formalizadas concentran la mayoría de las vacantes.
                </p>
              </div>
            </section>
          )}

          {/* TENDENCIA */}
          <section className="fu d4" style={{marginBottom:60}}>
            <p className="label-sec">Evolución del total regional</p>
            <div className="card">
              <p style={{fontSize:13,color:'#475569',marginBottom:16,lineHeight:1.6}}>
                Suma de vacantes activas en los {ranking.length} países monitoreados.
                {tendencia.length === 1 && ' El historial semanal se construye solo — volvé en 7 días para ver la curva completa.'}
              </p>
              {tendencia.map((row, i) => {
                const sig = tendencia[i+1]
                const diff = sig ? row.total - sig.total : null
                const varPct = sig ? ((row.total - sig.total) / sig.total * 100).toFixed(1) : null
                return (
                  <div key={row.fecha} className="trend-row">
                    <div>
                      <span style={{fontSize:14,color:'#94A3B8',fontWeight:600}}>{fmtFechaCorta(row.fecha)}</span>
                      {i === 0 && <span className="badge-hoy">HOY</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:14}}>
                      {diff !== null && (
                        <span style={{fontSize:12,fontWeight:700,color:diff>=0?'#4ADE80':'#F87171'}}>
                          {diff>=0?'▲':'▼'} {Math.abs(diff).toLocaleString('es-UY')} ({diff>=0?'+':''}{varPct}%)
                        </span>
                      )}
                      <span style={{fontSize:18,fontWeight:800,color:'#E8785A',minWidth:100,textAlign:'right'}}>{fmtN(row.total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* RUBROS */}
          {rubros.length > 0 && (
            <section className="fu d4" style={{marginBottom:60}}>
              <p className="label-sec">Empleos por sector · Argentina</p>
              <div className="card">
                {rubros.map(({rubro, total_empleos}) => (
                  <div key={rubro} className="bar-row">
                    <span style={{fontSize:13,color:'#94A3B8',fontWeight:600,minWidth:140}}>{RUBROS_LABELS[rubro] ?? rubro}</span>
                    <div className="bar-track">
                      <div className="bar-fill bar-fill-teal" style={{width:`${Math.round((total_empleos/rubros[0].total_empleos)*100)}%`}} />
                    </div>
                    <span style={{fontSize:16,fontWeight:800,color:'#F1F5F9',minWidth:80,textAlign:'right'}}>{fmtN(total_empleos)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="divider"/>

          {/* SEO TEXT */}
          <section className="seo" style={{marginBottom:64}}>
            <h2>¿Qué mide el Pulso Laboral LatAm?</h2>
            <p>
              El <strong>Pulso Laboral LatAm</strong> es un relevamiento diario de la cantidad de empleos activos en los principales portales de trabajo de América Latina y España. Los datos provienen de <strong>Computrabajo</strong>, con presencia en Brasil, Argentina, México, Colombia, Chile, Perú, Uruguay, Ecuador, Bolivia, Paraguay y España.
            </p>

            <h2>¿Qué significa cada número?</h2>
            <p>
              Cada cifra representa avisos de empleo <strong>activos en ese momento</strong> — puestos publicados por empresas en proceso de selección. No son proyecciones ni estimaciones estadísticas: son vacantes reales que cualquier persona puede ver al ingresar al portal.
            </p>
            <p>Los datos se actualizan automáticamente cada mañana. El historial se acumula día a día, permitiendo ver si el mercado de cada país crece, se estabiliza o se contrae.</p>

            <h2>El mercado laboral latinoamericano en 2026</h2>
            <p>
              {top1 && top1Meta
                ? <>Al {fmtFecha(ultimaFecha)}, <strong>{top1Meta.nombre}</strong> lidera la región con <strong>{fmtN(top1.total_empleos)} vacantes activas</strong> — el {pct(top1.total_empleos, total)}% del total. México ocupa el tercer lugar con {fmtN(ranking.find(r=>r.pais==='MX')?.total_empleos??0)} vacantes, seguido de Colombia y Chile.</>
                : 'Datos en proceso de recopilación.'}
            </p>
            <p>
              La concentración de empleos en los países más grandes refleja el tamaño de sus economías y el grado de digitalización de sus mercados laborales. Bolivia y Paraguay, con menor penetración de portales digitales, muestran cifras significativamente menores — aunque sus mercados laborales informales pueden ser más amplios.
            </p>

            <h2>¿Por qué confiar en estos datos?</h2>
            <p>
              Son un conteo directo de avisos publicados. Sin metodología estadística ni margen de error: exactamente los empleos visibles en el portal en el momento del relevamiento. Actualizamos diariamente para capturar la dinámica real del mercado.
            </p>
          </section>

          {/* CTA */}
          <section style={{textAlign:'center',padding:'12px 0 20px'}}>
            <p style={{fontSize:11,color:'#334155',fontWeight:800,letterSpacing:2,textTransform:'uppercase',marginBottom:12}}>¿Buscás trabajo?</p>
            <p style={{fontSize:'clamp(18px,2.5vw,26px)',fontWeight:900,color:'#F1F5F9',letterSpacing:-.5,marginBottom:8}}>
              Nexu monitorea todos estos mercados por vos
            </p>
            <p style={{fontSize:14,color:'#64748B',marginBottom:28,lineHeight:1.6}}>
              Concursos públicos y empleos de LatAm en un solo lugar.<br/>
              La app te avisa cuando aparece algo que encaja con tu perfil.
            </p>
            <Link href="/empleos" style={{display:'inline-block',background:'#E8785A',color:'#fff',borderRadius:10,padding:'14px 32px',fontSize:15,fontWeight:800,textDecoration:'none',marginRight:10}}>
              Ver empleos →
            </Link>
            <a href="/download" style={{display:'inline-block',color:'#64748B',padding:'14px 16px',fontSize:14,fontWeight:600,textDecoration:'none'}}>
              Descargar app gratis
            </a>
          </section>

        </div>
      )}

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'24px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <Link href="/" style={{color:'#E8785A',fontSize:18,fontWeight:900,letterSpacing:-.5,textDecoration:'none'}}>
          Nexu<span style={{fontSize:8,marginLeft:'-8px',verticalAlign:'bottom'}}>🧩</span>
        </Link>
        <p style={{color:'#334155',fontSize:12}}>
          <Link href="/pulso-latam" style={{color:'#475569',textDecoration:'none'}}>Pulso Laboral</Link>
          {' · '}
          <Link href="/empleos" style={{color:'#475569',textDecoration:'none'}}>Ver empleos</Link>
          {' · '}soporte@nexu.fyi
        </p>
      </footer>
    </>
  )
}
