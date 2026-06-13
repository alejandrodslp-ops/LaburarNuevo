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

const RUBROS_META = {
  tecnologia:   { label: 'Tecnología & IT',         icono: '💻' },
  industria:    { label: 'Industria & Manufactura',  icono: '🏭' },
  comercio:     { label: 'Comercio & Ventas',        icono: '🛒' },
  salud:        { label: 'Salud & Medicina',         icono: '🏥' },
  logistica:    { label: 'Logística & Transporte',   icono: '🚛' },
  finanzas:     { label: 'Contabilidad & Finanzas',  icono: '💰' },
  construccion: { label: 'Construcción',             icono: '🏗️' },
  educacion:    { label: 'Educación & Docencia',     icono: '📚' },
  admin:        { label: 'Administración',           icono: '📋' },
  gastronomia:  { label: 'Turismo & Gastronomía',    icono: '🍽️' },
}

export const metadata = {
  title: 'Pulso Laboral LatAm — Empleos disponibles en América Latina hoy',
  description: 'Seguimiento diario del mercado laboral en América Latina. Cuántos empleos hay por país y por sector. Datos actualizados cada 24 horas.',
  keywords: ['mercado laboral latinoamérica','empleos disponibles latam','estadísticas empleo','vacantes por sector','empleos tecnología latam','mercado trabajo argentina','empleos brasil','vacantes colombia'],
  openGraph: {
    title: 'Pulso Laboral LatAm — Empleos en América Latina hoy',
    description: 'Cuántos empleos hay disponibles por país y por sector en América Latina. Datos diarios del mercado laboral.',
    url: '/pulso-latam',
  },
  alternates: { canonical: '/pulso-latam' },
}

async function getDatos() {
  // Últimos 7 días de totales por país
  const { data: historial } = await db
    .from('mercado_stats')
    .select('pais, total_empleos, fecha')
    .order('fecha', { ascending: false })
    .limit(77) // 11 países × 7 días

  // Rubros más recientes
  const { data: rubros } = await db
    .from('mercado_rubros')
    .select('pais, rubro, total_empleos, fecha')
    .order('fecha', { ascending: false })
    .limit(100)

  if (!historial?.length) return { porPais: [], tendencia: [], rubros: [], ultimaFecha: null }

  // Dato más reciente por país
  const porPais = {}
  for (const row of historial) {
    if (!porPais[row.pais]) porPais[row.pais] = row
  }

  // Tendencia: totales globales por fecha
  const porFecha = {}
  for (const row of historial) {
    if (!porFecha[row.fecha]) porFecha[row.fecha] = 0
    porFecha[row.fecha] += row.total_empleos
  }
  const tendencia = Object.entries(porFecha)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([fecha, total]) => ({ fecha, total }))

  // Rubros más recientes por sector
  const rubrosMap = {}
  for (const row of (rubros || [])) {
    if (!rubrosMap[row.rubro]) rubrosMap[row.rubro] = row
  }

  const ultimaFecha = Object.values(porPais)[0]?.fecha ?? null
  return {
    porPais: Object.values(porPais).sort((a, b) => b.total_empleos - a.total_empleos),
    tendencia,
    rubros: Object.values(rubrosMap).sort((a, b) => b.total_empleos - a.total_empleos),
    ultimaFecha,
  }
}

function fmtNum(n) { return Number(n).toLocaleString('es-UY') }
function fmtFecha(f) {
  if (!f) return '–'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtFechaCorta(f) {
  if (!f) return '–'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

export default async function PulsoLatam() {
  const { porPais, tendencia, rubros, ultimaFecha } = await getDatos()
  const totalGlobal = porPais.reduce((acc, s) => acc + (s.total_empleos ?? 0), 0)
  const hayDatos = porPais.length > 0
  const maxPais = porPais[0]?.total_empleos ?? 1
  const maxRubro = rubros[0]?.total_empleos ?? 1

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Pulso Laboral LatAm',
    description: 'Cantidad de empleos disponibles por país y sector en América Latina, actualizado diariamente.',
    url: 'https://www.nexu.fyi/pulso-latam',
    creator: { '@type': 'Organization', name: 'Nexu', url: 'https://www.nexu.fyi' },
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        .fade-up { animation: fadeUp 0.55s ease both }
        .live-dot { animation: pulse 2.4s infinite }
        .card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px 24px;
          transition: background 0.15s, border-color 0.15s;
        }
        .card:hover { background: rgba(255,255,255,0.07); border-color: rgba(232,120,90,0.3); }
        .bar-bg { background: rgba(255,255,255,0.06); border-radius: 4px; height: 6px; margin-top: 8px; }
        .bar-fill { background: #E8785A; border-radius: 4px; height: 6px; transition: width 0.6s ease; }
        .bar-fill-teal { background: #2DD4BF; }
        .section-title { font-size: 18px; font-weight: 800; color: #F1F5F9; letter-spacing: -0.5px; margin-bottom: 6px; }
        .section-sub { font-size: 13px; color: #64748B; margin-bottom: 24px; }
        .trend-table { width: 100%; border-collapse: collapse; }
        .trend-table th { font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 0 0 12px; text-align: left; }
        .trend-table td { font-size: 14px; color: #CBD5E1; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.05); }
        .trend-table td:last-child { text-align: right; font-weight: 700; color: #E8785A; font-size: 16px; }
        .badge-new { background: rgba(45,212,191,0.15); color: #2DD4BF; border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; margin-left: 8px; }
        @media(max-width:640px){
          .grid-2 { grid-template-columns: 1fr !important }
          .total-num { font-size: clamp(40px,12vw,64px) !important }
        }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span>Nexu</span>
          <span style={{ fontSize:'0.42em', marginLeft:'-9px', lineHeight:1, marginBottom:'3px' }}>🧩</span>
        </Link>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <Link href="/empleos" style={{ color:'#94A3B8', fontSize:13, fontWeight:600 }}>Ver empleos</Link>
          <a href="/download" className="nav-btn">App gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:'linear-gradient(160deg,#0D1117 60%,#0d1520)', padding:'72px 24px 64px', textAlign:'center', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="fade-up" style={{ maxWidth:720, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(45,212,191,0.1)', border:'1px solid rgba(45,212,191,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:28 }}>
            <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#2DD4BF', display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#2DD4BF', fontWeight:700, letterSpacing:0.5 }}>
              ACTUALIZADO DIARIAMENTE — {hayDatos ? fmtFecha(ultimaFecha) : 'próximamente'}
            </span>
          </div>

          <h1 style={{ fontSize:'clamp(32px,6vw,58px)', fontWeight:900, color:'#F1F5F9', lineHeight:1.08, letterSpacing:-2, marginBottom:14 }}>
            Pulso Laboral <em style={{ color:'#E8785A', fontStyle:'italic' }}>LatAm</em>
          </h1>
          <p style={{ fontSize:'clamp(15px,2vw,18px)', color:'#94A3B8', maxWidth:520, margin:'0 auto 40px', lineHeight:1.65 }}>
            ¿Cuántos empleos hay disponibles hoy en América Latina?<br/>
            Datos reales del mercado laboral, país por país y sector por sector.
          </p>

          {/* Total global */}
          {hayDatos ? (
            <div style={{ background:'rgba(232,120,90,0.08)', border:'1px solid rgba(232,120,90,0.2)', borderRadius:20, padding:'28px 40px', display:'inline-block' }}>
              <div className="total-num" style={{ fontSize:'clamp(48px,9vw,80px)', fontWeight:900, color:'#E8785A', letterSpacing:-3, lineHeight:1, marginBottom:8 }}>
                {fmtNum(totalGlobal)}
              </div>
              <div style={{ fontSize:14, color:'#94A3B8', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase' }}>
                empleos disponibles en {porPais.length} países
              </div>
            </div>
          ) : (
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'32px 40px', display:'inline-block' }}>
              <div style={{ fontSize:48, fontWeight:900, color:'#475569', letterSpacing:-2, lineHeight:1, marginBottom:8 }}>—</div>
              <div style={{ fontSize:14, color:'#64748B', fontWeight:600 }}>Datos disponibles mañana</div>
            </div>
          )}
        </div>
      </section>

      {hayDatos && (
        <div style={{ background:'#0D1117' }}>

          {/* TENDENCIA DIARIA */}
          <section style={{ padding:'56px 24px 0' }}>
            <div style={{ maxWidth:900, margin:'0 auto' }}>
              <div className="section-title">Tendencia diaria</div>
              <div className="section-sub">
                Total de empleos en los {tendencia.length} {tendencia.length === 1 ? 'día disponible' : 'días disponibles'} — se actualiza cada mañana
              </div>

              {tendencia.length === 1 && (
                <div style={{ background:'rgba(45,212,191,0.06)', border:'1px solid rgba(45,212,191,0.15)', borderRadius:12, padding:'14px 20px', marginBottom:24, fontSize:13, color:'#64748B' }}>
                  📊 El historial semanal se completa automáticamente — hoy es el primer día de datos. Volvé en 7 días para ver la curva completa.
                </div>
              )}

              <div className="card" style={{ padding:'24px 28px' }}>
                <table className="trend-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign:'right' }}>Total LatAm</th>
                      <th style={{ textAlign:'right', paddingLeft:24 }}>Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tendencia.map((row, i) => {
                      const siguiente = tendencia[i + 1]
                      const variacion = siguiente ? row.total - siguiente.total : null
                      const pct = siguiente ? ((row.total - siguiente.total) / siguiente.total * 100).toFixed(1) : null
                      return (
                        <tr key={row.fecha}>
                          <td>
                            {fmtFechaCorta(row.fecha)}
                            {i === 0 && <span className="badge-new">HOY</span>}
                          </td>
                          <td style={{ textAlign:'right', fontWeight:700, color:'#E8785A', fontSize:16 }}>
                            {fmtNum(row.total)}
                          </td>
                          <td style={{ textAlign:'right', paddingLeft:24, fontSize:13, color: variacion === null ? '#475569' : variacion >= 0 ? '#4ADE80' : '#F87171' }}>
                            {variacion === null ? '–' : `${variacion >= 0 ? '+' : ''}${fmtNum(variacion)} (${variacion >= 0 ? '+' : ''}${pct}%)`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* EMPLEOS POR PAÍS */}
          <section style={{ padding:'56px 24px 0' }}>
            <div style={{ maxWidth:900, margin:'0 auto' }}>
              <div className="section-title">Empleos por país</div>
              <div className="section-sub">Ranking actualizado al {fmtFecha(ultimaFecha)}</div>
              <div className="grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
                {porPais.map(({ pais, total_empleos }) => {
                  const meta = PAISES_META[pais] ?? { nombre: pais, bandera: '🌐' }
                  const pct = Math.round((total_empleos / maxPais) * 100)
                  return (
                    <div key={pais} className="card">
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:32 }}>{meta.bandera}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'#F1F5F9', marginBottom:2 }}>{meta.nombre}</div>
                          <div style={{ fontSize:11, color:'#64748B', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>empleos activos</div>
                        </div>
                        <div style={{ fontSize:'clamp(18px,3vw,24px)', fontWeight:900, color:'#E8785A', letterSpacing:-1 }}>
                          {fmtNum(total_empleos)}
                        </div>
                      </div>
                      <div className="bar-bg">
                        <div className="bar-fill" style={{ width:`${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* EMPLEOS POR SECTOR (rubros) */}
          {rubros.length > 0 && (
            <section style={{ padding:'56px 24px 0' }}>
              <div style={{ maxWidth:900, margin:'0 auto' }}>
                <div className="section-title">Empleos por sector</div>
                <div className="section-sub">
                  Argentina · {fmtFecha(rubros[0]?.fecha)} — expandiendo a más países
                </div>
                <div className="grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
                  {rubros.map(({ rubro, total_empleos }) => {
                    const meta = RUBROS_META[rubro] ?? { label: rubro, icono: '💼' }
                    const pct = Math.round((total_empleos / maxRubro) * 100)
                    return (
                      <div key={rubro} className="card">
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <span style={{ fontSize:28, flexShrink:0 }}>{meta.icono}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#F1F5F9', marginBottom:2 }}>{meta.label}</div>
                            <div style={{ fontSize:11, color:'#64748B', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>vacantes</div>
                          </div>
                          <div style={{ fontSize:'clamp(16px,2.5vw,22px)', fontWeight:900, color:'#2DD4BF', letterSpacing:-1 }}>
                            {fmtNum(total_empleos)}
                          </div>
                        </div>
                        <div className="bar-bg">
                          <div className="bar-fill bar-fill-teal" style={{ width:`${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p style={{ marginTop:16, fontSize:12, color:'#475569' }}>
                  * Datos de sector disponibles para Argentina. Brasil, México, Chile y demás países en proceso de integración.
                </p>
              </div>
            </section>
          )}

          {/* QUÉ MIDE */}
          <section style={{ padding:'56px 24px', borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:56 }}>
            <div style={{ maxWidth:900, margin:'0 auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
                <div className="card">
                  <div style={{ fontSize:28, marginBottom:12 }}>📡</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', marginBottom:6 }}>Datos reales, sin filtros</div>
                  <div style={{ fontSize:13, color:'#64748B', lineHeight:1.65 }}>
                    Relevamos la cantidad total de empleos activos en los principales mercados de LatAm. No son proyecciones — son los números reales del día.
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontSize:28, marginBottom:12 }}>🔄</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', marginBottom:6 }}>Actualización diaria automática</div>
                  <div style={{ fontSize:13, color:'#64748B', lineHeight:1.65 }}>
                    Cada mañana el sistema recopila los datos de 11 países. El historial se acumula automáticamente, construyendo la curva de tendencia semana a semana.
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontSize:28, marginBottom:12 }}>🗺️</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', marginBottom:6 }}>11 países monitoreados</div>
                  <div style={{ fontSize:13, color:'#64748B', lineHeight:1.65 }}>
                    Brasil, Argentina, México, Chile, España, Uruguay, Colombia, Perú, Ecuador, Bolivia y Paraguay. Cobertura del 95% del mercado laboral hispanohablante.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* CTA */}
      <section style={{ background:'linear-gradient(160deg,#0D1117,#0d1a17)', padding:'64px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(20px,3.5vw,32px)', fontWeight:900, color:'#F1F5F9', marginBottom:12, letterSpacing:-0.8 }}>
            ¿Buscás trabajo en LatAm?
          </h2>
          <p style={{ fontSize:15, color:'#64748B', marginBottom:32, lineHeight:1.65 }}>
            En Nexu encontrás los concursos públicos y vacantes de todos estos países, actualizados diariamente.
          </p>
          <Link href="/empleos" style={{ display:'inline-block', background:'#E8785A', color:'#fff', borderRadius:10, padding:'14px 32px', fontSize:15, fontWeight:800, textDecoration:'none', letterSpacing:-0.3 }}>
            Ver empleos disponibles →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0D1117', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'32px 24px', textAlign:'center' }}>
        <Link href="/" style={{ color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-1, textDecoration:'none' }}>
          <span>Nexu</span><span style={{ fontSize:'0.42em', marginLeft:'-9px', lineHeight:1 }}>🧩</span>
        </Link>
        <p style={{ color:'#475569', fontSize:12, marginTop:8 }}>
          © {new Date().getFullYear()} Nexu ·{' '}
          <Link href="/empleos" style={{ color:'#64748B' }}>Ver empleos</Link> ·{' '}
          <Link href="/pulso-latam" style={{ color:'#64748B' }}>Pulso Laboral</Link> ·{' '}
          <a href="/download" style={{ color:'#64748B' }}>App gratis</a> ·{' '}
          soporte@nexu.fyi
        </p>
      </footer>
    </>
  )
}
