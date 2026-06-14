import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Población 2024 (Banco Mundial, millones)
const POBLACION = {
  BR:215, AR:46, MX:130, CL:19.5, ES:47.5, UY:3.5, CO:52, PE:33, EC:18, BO:12, PY:7.5,
  FR:68, IT:60, PT:10.3, GB:67,
}

// Países LATAM para separar en hallazgos
const LATAM = new Set(['BR','AR','MX','CL','UY','CO','PE','EC','BO','PY','VE','CU','CR','GT','SV','HN','NI','PA','DO'])

const PAIS_INFO = {
  BR: { nombre:'Brasil',         bandera:'🇧🇷', moneda:'BRL' },
  AR: { nombre:'Argentina',      bandera:'🇦🇷', moneda:'ARS' },
  MX: { nombre:'México',         bandera:'🇲🇽', moneda:'MXN' },
  CL: { nombre:'Chile',          bandera:'🇨🇱', moneda:'CLP' },
  CO: { nombre:'Colombia',       bandera:'🇨🇴', moneda:'COP' },
  PE: { nombre:'Perú',           bandera:'🇵🇪', moneda:'PEN' },
  EC: { nombre:'Ecuador',        bandera:'🇪🇨', moneda:'USD' },
  UY: { nombre:'Uruguay',        bandera:'🇺🇾', moneda:'UYU' },
  BO: { nombre:'Bolivia',        bandera:'🇧🇴', moneda:'BOB' },
  PY: { nombre:'Paraguay',       bandera:'🇵🇾', moneda:'PYG' },
  ES: { nombre:'España',         bandera:'🇪🇸', moneda:'EUR' },
  FR: { nombre:'Francia',        bandera:'🇫🇷', moneda:'EUR' },
  IT: { nombre:'Italia',         bandera:'🇮🇹', moneda:'EUR' },
  PT: { nombre:'Portugal',       bandera:'🇵🇹', moneda:'EUR' },
  GB: { nombre:'Reino Unido',    bandera:'🇬🇧', moneda:'GBP' },
}

const RUBROS_LABELS = {
  tecnologia:'Tecnología e IT', industria:'Industria y manufactura',
  comercio:'Comercio y ventas', salud:'Salud y medicina',
  logistica:'Logística y transporte', finanzas:'Finanzas y contabilidad',
  construccion:'Construcción', educacion:'Educación y docencia',
  admin:'Administración', gastronomia:'Turismo y gastronomía',
}

export const metadata = {
  title: 'Pulso Laboral — Vacantes activas en América Latina y Europa',
  description: 'Cuántos empleos hay disponibles hoy en Brasil, Argentina, México, España, Francia, Italia, Portugal y más. Datos reales por país y por sector, actualizados diariamente.',
  keywords: ['vacantes latam','empleos disponibles latinoamerica','mercado laboral 2026','estadísticas empleo por país','vacantes argentina brasil mexico','vacantes españa francia italia','mercado laboral europa latam'],
  openGraph: {
    title: 'Pulso Laboral — Vacantes activas en América Latina y Europa',
    description: 'Datos reales del mercado laboral: vacantes activas en 15 países de LatAm y Europa, ajustadas por población.',
    url: '/pulso-latam',
  },
  alternates: { canonical: '/pulso-latam' },
}

async function getDatos() {
  const [{ data: historial }, { data: rubros }] = await Promise.all([
    db.from('mercado_stats').select('pais,total_empleos,fecha').order('fecha',{ascending:false}).limit(77),
    db.from('mercado_rubros').select('pais,rubro,total_empleos,fecha').order('fecha',{ascending:false}).limit(100),
  ])
  if (!historial?.length) return null

  const porPais = {}
  for (const r of historial) { if (!porPais[r.pais]) porPais[r.pais] = r }

  const porFecha = {}
  for (const r of historial) {
    if (!porFecha[r.fecha]) porFecha[r.fecha] = 0
    porFecha[r.fecha] += r.total_empleos
  }
  const tendencia = Object.entries(porFecha)
    .sort(([a],[b]) => b.localeCompare(a)).slice(0,7)
    .map(([fecha,total]) => ({fecha,total}))

  const ranking = Object.values(porPais)
    .map(r => {
      const pob = POBLACION[r.pais] ?? 10
      return { ...r, por100k: Math.round(r.total_empleos / pob / 10) }
    })
    .sort((a,b) => b.total_empleos - a.total_empleos)

  const total = ranking.reduce((s,r) => s + r.total_empleos, 0)
  const rankingDensidad = [...ranking].sort((a,b) => b.por100k - a.por100k)

  const rubrosMap = {}
  for (const r of (rubros||[])) { if (!rubrosMap[r.rubro]) rubrosMap[r.rubro] = r }
  const rubrosList = Object.values(rubrosMap).sort((a,b) => b.total_empleos - a.total_empleos)

  return { ranking, rankingDensidad, total, tendencia, rubros:rubrosList, ultimaFecha:ranking[0]?.fecha }
}

const fmtN = n => Number(n).toLocaleString('es-UY')
const fmtPct = (n,t) => ((n/t)*100).toFixed(1)
const fmtFecha = f => f ? new Date(f+'T12:00:00').toLocaleDateString('es-UY',{day:'numeric',month:'long',year:'numeric'}) : ''
const fmtCorta = f => f ? new Date(f+'T12:00:00').toLocaleDateString('es-UY',{day:'numeric',month:'short'}) : ''

export default async function PulsoLatam() {
  const d = await getDatos()
  if (!d) return <SinDatos />

  const { ranking, rankingDensidad, total, tendencia, rubros, ultimaFecha } = d
  const top = ranking[0]
  const topDens = rankingDensidad[0]
  const topInfo = PAIS_INFO[top?.pais]
  const topDensInfo = PAIS_INFO[topDens?.pais]
  const maxTotal = top?.total_empleos ?? 1
  const maxDens = topDens?.por100k ?? 1

  // Hallazgos editoriales derivados del dato
  const hallazgos = []

  // Líder en LatAm por densidad
  const lidLatam = rankingDensidad.filter(r => LATAM.has(r.pais))[0]
  const lidLatamInfo = PAIS_INFO[lidLatam?.pais]
  if (lidLatam) hallazgos.push(`${lidLatamInfo?.nombre} es el mercado laboral más denso de América Latina con ${fmtN(lidLatam.por100k)} vacantes por cada 100.000 habitantes.`)

  const ar = ranking.find(r=>r.pais==='AR'), mx = ranking.find(r=>r.pais==='MX')
  if (ar && mx && mx.total_empleos > ar.total_empleos) {
    hallazgos.push(`México supera a Argentina en volumen: ${fmtN(mx.total_empleos)} vs ${fmtN(ar.total_empleos)} vacantes activas, pese a tener menor densidad laboral digital (${fmtN(mx.por100k)} vs ${fmtN(ar.por100k)} por 100k hab).`)
  }

  const ult = ranking[ranking.length-1]
  const ultInfo = PAIS_INFO[ult?.pais]
  if (ult && top && ult.pais !== top.pais) {
    hallazgos.push(`La brecha es extrema: ${topInfo?.nombre} acumula ${fmtPct(top.total_empleos,total)}% de todas las vacantes del panel, mientras ${ultInfo?.nombre} no llega al 0,1%.`)
  }

  // Comparativa Europa vs LatAm por densidad
  const lidEuropa = rankingDensidad.filter(r => !LATAM.has(r.pais))[0]
  const lidEuropaInfo = PAIS_INFO[lidEuropa?.pais]
  if (lidEuropa && lidLatam) {
    const masOmenos = lidEuropa.por100k > lidLatam.por100k ? 'supera' : 'se ubica por debajo de'
    hallazgos.push(`En densidad laboral digital, ${lidEuropaInfo?.nombre} (${fmtN(lidEuropa.por100k)} por 100k hab) ${masOmenos} al líder latinoamericano ${lidLatamInfo?.nombre} (${fmtN(lidLatam.por100k)} por 100k hab).`)
  }

  const jsonLd = {
    '@context':'https://schema.org','@type':'Dataset',
    name:'Pulso Laboral LatAm',
    description:'Vacantes activas por país en América Latina, actualizadas diariamente.',
    url:'https://www.nexu.fyi/pulso-latam',
    creator:{'@type':'Organization',name:'Nexu',url:'https://www.nexu.fyi'},
    temporalCoverage:'2026/..',
  }

  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#08090D;color:#E2E8F0;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      a{color:inherit;text-decoration:none}
      @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
      .fi{animation:fadeIn .5s ease both}
      .d1{animation-delay:.04s}.d2{animation-delay:.1s}.d3{animation-delay:.18s}.d4{animation-delay:.26s}.d5{animation-delay:.34s}

      /* NAV */
      .nav{display:flex;justify-content:space-between;align-items:center;padding:14px 40px;border-bottom:1px solid #1E2433;position:sticky;top:0;background:rgba(8,9,13,.95);backdrop-filter:blur(16px);z-index:100}
      .nav-logo{font-size:20px;font-weight:900;color:#E8785A;letter-spacing:-.5px}
      .nav-btn{background:#E8785A;color:#fff;border-radius:7px;padding:7px 16px;font-size:12px;font-weight:700}

      /* LAYOUT */
      .wrap{max-width:960px;margin:0 auto;padding:0 32px}
      .divider{height:1px;background:#1E2433;margin:52px 0}

      /* HEADER */
      .eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:18px}
      .live-dot{width:7px;height:7px;border-radius:50%;background:#2DD4BF;animation:blink 2s infinite;flex-shrink:0}
      .eyebrow-txt{font-size:11px;font-weight:700;color:#2DD4BF;letter-spacing:1.5px;text-transform:uppercase}
      .eyebrow-fecha{font-size:11px;color:#4A5568;font-weight:600;letter-spacing:.5px}

      /* KPI CARDS */
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1E2433;border:1px solid #1E2433;border-radius:14px;overflow:hidden;margin:36px 0}
      .kpi{background:#0D1117;padding:22px 24px}
      .kpi-label{font-size:11px;font-weight:700;color:#4A5568;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}
      .kpi-value{font-size:clamp(22px,3vw,32px);font-weight:900;color:#F1F5F9;letter-spacing:-1px;line-height:1}
      .kpi-sub{font-size:12px;color:#4A5568;margin-top:5px}

      /* HALLAZGOS */
      .hallazgos{background:#0D1117;border:1px solid #1E2433;border-radius:14px;padding:24px 28px;margin-bottom:48px}
      .hallazgos-title{font-size:11px;font-weight:800;color:#E8785A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px}
      .hallazgo{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #1A1F2E;font-size:14px;color:#94A3B8;line-height:1.6}
      .hallazgo:last-child{border-bottom:none;padding-bottom:0}
      .hallazgo-num{font-size:12px;font-weight:800;color:#E8785A;min-width:20px;padding-top:1px}
      .hallazgo strong{color:#CBD5E1}

      /* TABLA */
      .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
      table{width:100%;border-collapse:collapse;font-size:14px}
      thead th{font-size:10px;font-weight:800;color:#4A5568;letter-spacing:1.2px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid #1E2433;text-align:left;white-space:nowrap}
      thead th:not(:first-child){text-align:right}
      tbody tr{border-bottom:1px solid #111827;transition:background .1s}
      tbody tr:last-child{border-bottom:none}
      tbody tr:hover{background:#0D1117}
      td{padding:13px 12px;vertical-align:middle}
      td:not(:first-child){text-align:right}
      .td-pais{display:flex;align-items:center;gap:10px}
      .td-flag{font-size:22px;width:28px;flex-shrink:0}
      .td-nombre{font-size:14px;font-weight:700;color:#E2E8F0}
      .td-big{font-size:16px;font-weight:800;color:#F1F5F9;letter-spacing:-.3px}
      .td-med{font-size:13px;font-weight:600;color:#94A3B8}
      .td-small{font-size:12px;color:#4A5568}
      .mini-bar-wrap{width:80px;height:5px;background:#1A1F2E;border-radius:3px;overflow:hidden;display:inline-block;vertical-align:middle;margin-left:8px}
      .mini-bar{height:100%;border-radius:3px;background:#E8785A}
      .mini-bar-teal{background:#2DD4BF}
      .badge-top{display:inline-block;background:rgba(232,120,90,.15);color:#E8785A;border-radius:4px;font-size:10px;font-weight:800;padding:2px 6px;margin-left:6px;letter-spacing:.5px}
      .badge-top-teal{background:rgba(45,212,191,.12);color:#2DD4BF}

      /* TABS (simulados) */
      .tab-row{display:flex;gap:4px;margin-bottom:20px}
      .tab{font-size:12px;font-weight:700;padding:7px 14px;border-radius:7px;color:#4A5568;border:1px solid transparent;cursor:default}
      .tab-active{background:#0D1117;color:#E2E8F0;border-color:#1E2433}

      /* TENDENCIA */
      .trend-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #111827}
      .trend-item:last-child{border-bottom:none}
      .badge-hoy{background:rgba(45,212,191,.12);color:#2DD4BF;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:800;margin-left:8px;letter-spacing:.5px}
      .var-pos{color:#34D399;font-size:12px;font-weight:700}
      .var-neg{color:#F87171;font-size:12px;font-weight:700}

      /* METODOLOGÍA */
      .metodo{background:#0D1117;border:1px solid #1E2433;border-radius:14px;padding:28px 32px}
      .metodo p{font-size:13px;color:#4A5568;line-height:1.75;margin-bottom:10px}
      .metodo p:last-child{margin-bottom:0}
      .metodo strong{color:#64748B}

      /* SECTION TITLE */
      .sec-title{font-size:18px;font-weight:800;color:#F1F5F9;letter-spacing:-.3px;margin-bottom:4px}
      .sec-sub{font-size:13px;color:#4A5568;margin-bottom:22px}

      /* CTA */
      .cta-box{background:linear-gradient(135deg,#0F1822,#0D1117);border:1px solid #1E2433;border-radius:16px;padding:40px 36px;text-align:center}

      @media(max-width:640px){
        .wrap{padding:0 18px}
        .nav{padding:12px 18px}
        .kpi-grid{grid-template-columns:1fr;gap:1px}
        .mini-bar-wrap{display:none}
        .td-small{display:none}
        .metodo{padding:20px 18px}
        .hallazgos{padding:18px}
        .cta-box{padding:28px 18px}
        .tab-row{overflow-x:auto}
      }
    `}</style>

    {/* NAV */}
    <nav className="nav">
      <Link href="/" className="nav-logo">Nexu<span style={{fontSize:9,marginLeft:'-7px',verticalAlign:'bottom'}}>🧩</span></Link>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <Link href="/empleos" style={{fontSize:13,fontWeight:600,color:'#4A5568'}}>Ver empleos</Link>
        <a href="/download" className="nav-btn">App gratis</a>
      </div>
    </nav>

    <div className="wrap" style={{paddingTop:52,paddingBottom:80}}>

      {/* EYEBROW */}
      <div className="eyebrow fi d1">
        <span className="live-dot"/>
        <span className="eyebrow-txt">Pulso Laboral — LatAm + Europa</span>
        <span className="eyebrow-fecha">· Datos al {fmtFecha(ultimaFecha)}</span>
      </div>

      {/* H1 */}
      <div className="fi d1">
        <h1 style={{fontSize:'clamp(26px,4vw,42px)',fontWeight:900,color:'#F8FAFC',lineHeight:1.12,letterSpacing:'-1px',maxWidth:680,marginBottom:10}}>
          Vacantes activas en América Latina y Europa — por país
        </h1>
        <p style={{fontSize:16,color:'#64748B',lineHeight:1.6,maxWidth:580,marginBottom:0}}>
          Relevamiento diario de empleos publicados en portales de trabajo de {ranking.length} países. Datos reales, sin proyecciones.
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="kpi-grid fi d2">
        <div className="kpi">
          <div className="kpi-label">Total del panel</div>
          <div className="kpi-value">{fmtN(total)}</div>
          <div className="kpi-sub">vacantes activas · {ranking.length} países</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Mayor volumen</div>
          <div className="kpi-value">{topInfo?.bandera} {topInfo?.nombre}</div>
          <div className="kpi-sub">{fmtN(top?.total_empleos)} vacantes · {fmtPct(top?.total_empleos,total)}% del total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Mayor densidad</div>
          <div className="kpi-value">{topDensInfo?.bandera} {topDensInfo?.nombre}</div>
          <div className="kpi-sub">{fmtN(topDens?.por100k)} vacantes por cada 100k hab.</div>
        </div>
      </div>

      {/* HALLAZGOS */}
      {hallazgos.length > 0 && (
        <div className="hallazgos fi d3">
          <div className="hallazgos-title">Hallazgos del día</div>
          {hallazgos.map((h,i) => (
            <div key={i} className="hallazgo">
              <span className="hallazgo-num">{i+1}.</span>
              <span dangerouslySetInnerHTML={{__html: h.replace(/(\d[\d.,]*)/g,'<strong>$1</strong>')}}/>
            </div>
          ))}
        </div>
      )}

      {/* TABLA VACANTES POR PAÍS */}
      <section className="fi d3" style={{marginBottom:52}}>
        <div className="sec-title">Vacantes activas por país</div>
        <div className="sec-sub">Empleos publicados en portales de trabajo · ordenado por volumen total</div>

        <div className="tab-row">
          <span className="tab tab-active">Por volumen total</span>
          <span className="tab" style={{color:'#334155'}}>Ver por densidad ↓</span>
        </div>

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>#&nbsp;&nbsp;País</th>
                <th>Vacantes activas</th>
                <th>% del mercado</th>
                <th>Por 100k hab.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({pais,total_empleos,por100k},i) => {
                const info = PAIS_INFO[pais] ?? {nombre:pais,bandera:'🌐'}
                const anchoBar = Math.round((total_empleos/maxTotal)*100)
                return (
                  <tr key={pais}>
                    <td>
                      <div className="td-pais">
                        <span style={{fontSize:12,color:'#2D3748',fontWeight:800,minWidth:16}}>{i+1}</span>
                        <span className="td-flag">{info.bandera}</span>
                        <div>
                          <span className="td-nombre">{info.nombre}</span>
                          {i===0 && <span className="badge-top">LÍDER</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="td-big">{fmtN(total_empleos)}</span>
                      <div className="mini-bar-wrap">
                        <div className="mini-bar" style={{width:`${anchoBar}%`}}/>
                      </div>
                    </td>
                    <td><span className="td-med">{fmtPct(total_empleos,total)}%</span></td>
                    <td><span className="td-med">{fmtN(por100k)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* TABLA DENSIDAD */}
      <section className="fi d4" style={{marginBottom:52}}>
        <div className="sec-title">Densidad laboral digital por país</div>
        <div className="sec-sub">Vacantes por cada 100.000 habitantes — permite comparar mercados de distinto tamaño</div>

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>#&nbsp;&nbsp;País</th>
                <th>Vacantes / 100k hab.</th>
                <th>Total vacantes</th>
                <th className="td-small">Población (M)</th>
              </tr>
            </thead>
            <tbody>
              {rankingDensidad.map(({pais,total_empleos,por100k},i) => {
                const info = PAIS_INFO[pais] ?? {nombre:pais,bandera:'🌐'}
                const anchoDens = Math.round((por100k/maxDens)*100)
                return (
                  <tr key={pais}>
                    <td>
                      <div className="td-pais">
                        <span style={{fontSize:12,color:'#2D3748',fontWeight:800,minWidth:16}}>{i+1}</span>
                        <span className="td-flag">{info.bandera}</span>
                        <div>
                          <span className="td-nombre">{info.nombre}</span>
                          {i===0 && <span className="badge-top badge-top-teal">MAYOR DENSIDAD</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="td-big" style={{color:'#2DD4BF'}}>{fmtN(por100k)}</span>
                      <div className="mini-bar-wrap">
                        <div className="mini-bar mini-bar-teal" style={{width:`${anchoDens}%`}}/>
                      </div>
                    </td>
                    <td><span className="td-med">{fmtN(total_empleos)}</span></td>
                    <td className="td-small"><span className="td-small">{POBLACION[pais]}M</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{fontSize:11,color:'#1E293B',marginTop:10}}>Fuente vacantes: Computrabajo · Población: Banco Mundial 2024</p>
      </section>

      {/* TENDENCIA */}
      {tendencia.length > 0 && (
        <section className="fi d4" style={{marginBottom:52}}>
          <div className="sec-title">Evolución del mercado regional</div>
          <div className="sec-sub">Total acumulado de vacantes activas en los {ranking.length} países · se actualiza cada mañana</div>
          <div style={{background:'#0D1117',border:'1px solid #1E2433',borderRadius:14,padding:'8px 24px'}}>
            {tendencia.map((row,i) => {
              const sig = tendencia[i+1]
              const diff = sig ? row.total - sig.total : null
              const varPct = sig ? ((row.total-sig.total)/sig.total*100).toFixed(1) : null
              return (
                <div key={row.fecha} className="trend-item">
                  <div style={{display:'flex',alignItems:'center'}}>
                    <span style={{fontSize:14,color:'#64748B',fontWeight:600,minWidth:90}}>{fmtCorta(row.fecha)}</span>
                    {i===0 && <span className="badge-hoy">HOY</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    {diff !== null && (
                      <span className={diff>=0?'var-pos':'var-neg'}>
                        {diff>=0?'▲':'▼'} {Math.abs(diff).toLocaleString('es-UY')} ({diff>=0?'+':''}{varPct}%)
                      </span>
                    )}
                    {diff === null && <span style={{fontSize:12,color:'#1E293B'}}>primer registro</span>}
                    <span style={{fontSize:17,fontWeight:800,color:'#F1F5F9',minWidth:110,textAlign:'right'}}>{fmtN(row.total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {tendencia.length === 1 && (
            <p style={{fontSize:12,color:'#1E293B',marginTop:10}}>
              El historial semanal se construye automáticamente — cada mañana el sistema agrega una nueva fila.
            </p>
          )}
        </section>
      )}

      {/* RUBROS */}
      {rubros.length > 0 && (
        <section className="fi d5" style={{marginBottom:52}}>
          <div className="sec-title">Vacantes por sector — Argentina</div>
          <div className="sec-sub">Distribución por rubro de las {fmtN(rubros.reduce((s,r)=>s+r.total_empleos,0))} vacantes activas en Argentina</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>Sector</th>
                  <th>Vacantes</th>
                  <th>% del total AR</th>
                </tr>
              </thead>
              <tbody>
                {rubros.map(({rubro,total_empleos}) => {
                  const totalAR = rubros.reduce((s,r)=>s+r.total_empleos,0)
                  return (
                    <tr key={rubro}>
                      <td><span className="td-nombre">{RUBROS_LABELS[rubro]??rubro}</span></td>
                      <td>
                        <span className="td-big" style={{color:'#2DD4BF'}}>{fmtN(total_empleos)}</span>
                        <div className="mini-bar-wrap">
                          <div className="mini-bar mini-bar-teal" style={{width:`${Math.round((total_empleos/rubros[0].total_empleos)*100)}%`}}/>
                        </div>
                      </td>
                      <td><span className="td-med">{fmtPct(total_empleos,totalAR)}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="divider"/>

      {/* METODOLOGÍA */}
      <section style={{marginBottom:52}}>
        <div className="sec-title" style={{marginBottom:16}}>Metodología y fuentes</div>
        <div className="metodo">
          <p><strong>Qué medimos:</strong> La cantidad total de avisos de empleo activos publicados en Computrabajo, uno de los portales de empleo con mayor presencia en América Latina. Solo se cuentan empleos con convocatoria vigente al momento del relevamiento.</p>
          <p><strong>Frecuencia:</strong> El sistema realiza un relevamiento automático cada mañana. Los datos corresponden al momento de la última actualización indicada al tope de la página.</p>
          <p><strong>Vacantes por 100.000 habitantes:</strong> Se calculan dividiendo las vacantes activas entre la población del país (en cientos de miles), usando estimaciones del Banco Mundial 2024. Esta métrica permite comparar mercados de distinto tamaño.</p>
          <p><strong>Limitaciones:</strong> Los datos reflejan el empleo formal digital publicado en un portal específico. El empleo informal, las búsquedas presenciales y los portales alternativos no están incluidos. Las cifras pueden variar intraday según actualizaciones del portal de origen.</p>
          <p><strong>Países incluidos:</strong> América Latina: Brasil, Argentina, México, Colombia, Chile, Perú, Uruguay, Ecuador, Bolivia y Paraguay. Europa: España, Francia, Italia, Portugal y Reino Unido. Los países europeos se incorporan para comparación directa con los mercados laborales digitales latinoamericanos.</p>
        </div>
      </section>

      {/* CTA */}
      <div className="cta-box">
        <p style={{fontSize:11,fontWeight:800,color:'#E8785A',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:12}}>¿Buscás trabajo en LatAm o Europa?</p>
        <p style={{fontSize:'clamp(18px,2.5vw,24px)',fontWeight:900,color:'#F1F5F9',letterSpacing:'-.5px',marginBottom:10}}>
          Nexu monitorea todos estos mercados por vos
        </p>
        <p style={{fontSize:14,color:'#4A5568',marginBottom:28,lineHeight:1.65}}>
          Empleos de América Latina y Europa, todos en un solo lugar.<br/>
          La app cruza tu perfil con las vacantes activas y te avisa cuando aparece algo que encaja.
        </p>
        <Link href="/empleos" style={{display:'inline-block',background:'#E8785A',color:'#fff',borderRadius:9,padding:'13px 30px',fontSize:14,fontWeight:800,marginRight:8}}>
          Ver empleos disponibles →
        </Link>
        <a href="/download" style={{display:'inline-block',color:'#4A5568',padding:'13px 16px',fontSize:13,fontWeight:600}}>
          Descargar app
        </a>
      </div>

    </div>

    {/* FOOTER */}
    <footer style={{borderTop:'1px solid #111827',padding:'22px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <Link href="/" style={{fontSize:18,fontWeight:900,color:'#E8785A',letterSpacing:'-.5px'}}>
        Nexu<span style={{fontSize:8,marginLeft:'-7px',verticalAlign:'bottom'}}>🧩</span>
      </Link>
      <p style={{fontSize:12,color:'#1E293B'}}>
        <Link href="/pulso-latam" style={{color:'#2D3748'}}>Pulso Laboral</Link>
        {' · '}
        <Link href="/empleos" style={{color:'#2D3748'}}>Empleos</Link>
        {' · '}soporte@nexu.fyi
      </p>
    </footer>
  </>)
}

function SinDatos() {
  return (
    <>
      <style>{`body{background:#08090D;color:#E2E8F0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}`}</style>
      <div style={{textAlign:'center',padding:40}}>
        <p style={{fontSize:11,color:'#2DD4BF',fontWeight:700,letterSpacing:2,textTransform:'uppercase',marginBottom:16}}>Pulso Laboral LatAm</p>
        <p style={{fontSize:28,fontWeight:900,color:'#F1F5F9',marginBottom:10}}>Recopilando datos…</p>
        <p style={{fontSize:14,color:'#4A5568'}}>Los datos del mercado laboral estarán disponibles mañana temprano.</p>
      </div>
    </>
  )
}
