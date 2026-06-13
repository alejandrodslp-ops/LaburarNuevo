import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

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

export const metadata = {
  title: 'Pulso Laboral LatAm — Empleos disponibles en América Latina hoy',
  description:
    'Seguimiento diario del mercado laboral en América Latina. Cuántos empleos hay disponibles hoy en Argentina, Brasil, México, Chile, Colombia, Uruguay y más países.',
  keywords: [
    'mercado laboral latinoamérica', 'empleos disponibles latam', 'estadísticas empleo latam',
    'cuántos empleos hay en argentina', 'mercado laboral argentina', 'empleos brasil',
    'mercado trabajo chile', 'vacantes colombia', 'empleos mexico', 'estadísticas laborales',
    'demanda laboral latam', 'índice empleo latinoamérica',
  ],
  openGraph: {
    title: 'Pulso Laboral LatAm — Empleos en América Latina hoy',
    description: 'Cuántos empleos hay disponibles hoy en cada país de América Latina. Datos diarios del mercado laboral.',
    url: '/pulso-latam',
    type: 'website',
  },
  alternates: { canonical: '/pulso-latam' },
}

async function getMercadoStats() {
  const { data, error } = await db
    .from('mercado_stats')
    .select('pais, total_empleos, fecha, actualizado_at')
    .order('fecha', { ascending: false })
    .limit(100)

  if (error || !data) return { stats: [], ultimaFecha: null }

  // Tomar el dato más reciente por país
  const porPais = {}
  for (const row of data) {
    if (!porPais[row.pais]) porPais[row.pais] = row
  }

  const stats = Object.values(porPais).sort((a, b) => b.total_empleos - a.total_empleos)
  const ultimaFecha = stats[0]?.fecha ?? null
  return { stats, ultimaFecha }
}

function fmtNum(n) {
  return n.toLocaleString('es-UY')
}

function fmtFecha(fechaStr) {
  if (!fechaStr) return '–'
  const d = new Date(fechaStr + 'T12:00:00')
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function PulsoLatam() {
  const { stats, ultimaFecha } = await getMercadoStats()

  const totalGlobal = stats.reduce((acc, s) => acc + (s.total_empleos ?? 0), 0)
  const hayDatos = stats.length > 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Pulso Laboral LatAm',
    description: 'Cantidad de empleos disponibles por país en América Latina, actualizado diariamente.',
    url: 'https://www.nexu.fyi/pulso-latam',
    temporalCoverage: ultimaFecha ?? undefined,
    spatialCoverage: {
      '@type': 'Place',
      name: 'América Latina',
    },
    creator: {
      '@type': 'Organization',
      name: 'Nexu',
      url: 'https://www.nexu.fyi',
    },
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        .fade-up { animation: fadeUp 0.55s ease both }
        .live-dot { animation: pulse 2.4s infinite }
        .country-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: background 0.15s, border-color 0.15s;
        }
        .country-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(232,120,90,0.3);
        }
        .country-num {
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 900;
          color: #E8785A;
          letter-spacing: -1px;
          line-height: 1;
        }
        .country-name {
          font-size: 14px;
          font-weight: 700;
          color: #F1F5F9;
          margin-bottom: 2px;
        }
        .country-lbl {
          font-size: 11px;
          color: #64748B;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .country-flag { font-size: 36px; flex-shrink: 0; line-height: 1; }
        .no-data-msg {
          background: rgba(45,212,191,0.06);
          border: 1px solid rgba(45,212,191,0.15);
          border-radius: 12px;
          padding: 20px 24px;
          color: #94A3B8;
          font-size: 14px;
          text-align: center;
          line-height: 1.6;
        }
        @media(max-width:640px){
          .country-grid { grid-template-columns: 1fr !important }
          .total-num { font-size: clamp(40px,12vw,64px) !important }
        }
      `}</style>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
      <section style={{
        background: 'linear-gradient(160deg,#0D1117 60%,#0d1520)',
        padding: '80px 24px 72px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 32,
          }}>
            <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#2DD4BF', display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#2DD4BF', fontWeight:700, letterSpacing:0.5 }}>
              DATOS DIARIOS — {hayDatos ? fmtFecha(ultimaFecha) : 'actualizando…'}
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px,6vw,58px)', fontWeight:900, color:'#F1F5F9',
            lineHeight:1.1, letterSpacing:-2, marginBottom:16,
          }}>
            Pulso Laboral{' '}
            <em style={{ color:'#E8785A', fontStyle:'italic' }}>LatAm</em>
          </h1>

          <p style={{ fontSize:'clamp(15px,2vw,18px)', color:'#94A3B8', maxWidth:500, margin:'0 auto 48px', lineHeight:1.65 }}>
            Cuántos empleos hay disponibles hoy en América Latina.<br />
            Seguimiento diario, país por país.
          </p>

          {/* Total global */}
          {hayDatos ? (
            <div style={{
              background: 'rgba(232,120,90,0.08)', border: '1px solid rgba(232,120,90,0.2)',
              borderRadius: 20, padding: '32px 40px', display: 'inline-block',
            }}>
              <div className="total-num" style={{
                fontSize: 'clamp(48px,9vw,80px)', fontWeight:900, color:'#E8785A',
                letterSpacing:-3, lineHeight:1, marginBottom:8,
              }}>
                {fmtNum(totalGlobal)}
              </div>
              <div style={{ fontSize:14, color:'#94A3B8', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase' }}>
                empleos disponibles en {stats.length} países
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '32px 40px', display: 'inline-block',
            }}>
              <div style={{ fontSize:48, fontWeight:900, color:'#475569', letterSpacing:-2, lineHeight:1, marginBottom:8 }}>—</div>
              <div style={{ fontSize:14, color:'#64748B', fontWeight:600 }}>Datos disponibles mañana</div>
            </div>
          )}
        </div>
      </section>

      {/* GRID DE PAÍSES */}
      <section style={{ background:'#0D1117', padding:'56px 24px 72px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>

          <h2 style={{ fontSize:18, fontWeight:800, color:'#F1F5F9', marginBottom:6, letterSpacing:-0.5 }}>
            Empleos por país
          </h2>
          <p style={{ fontSize:13, color:'#64748B', marginBottom:32 }}>
            {hayDatos
              ? `Datos al ${fmtFecha(ultimaFecha)} — actualizados cada 24 horas`
              : 'El scraper aún no ejecutó. Los datos aparecerán mañana.'}
          </p>

          {hayDatos ? (
            <div className="country-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
              {stats.map(({ pais, total_empleos }) => {
                const meta = PAISES_META[pais] ?? { nombre: pais, bandera: '🌐' }
                return (
                  <div key={pais} className="country-card">
                    <span className="country-flag">{meta.bandera}</span>
                    <div style={{ flex:1 }}>
                      <div className="country-name">{meta.nombre}</div>
                      <div className="country-lbl">empleos activos</div>
                    </div>
                    <div className="country-num">{fmtNum(total_empleos)}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="no-data-msg">
              El scraper de mercado ejecuta una vez al día. Los datos de hoy estarán disponibles en las próximas horas.
            </div>
          )}
        </div>
      </section>

      {/* INFO SECTION */}
      <section style={{ background:'#080D12', padding:'56px 24px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:680, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(20px,3.5vw,30px)', fontWeight:900, color:'#F1F5F9', marginBottom:12, letterSpacing:-0.8 }}>
            ¿Qué mide el Pulso Laboral?
          </h2>
          <p style={{ fontSize:15, color:'#64748B', lineHeight:1.75, marginBottom:32 }}>
            Relevamos la cantidad total de empleos disponibles en los principales mercados de América Latina.
            Los datos se recopilan diariamente y reflejan el estado real del mercado laboral
            en cada país: cuántas oportunidades están activas en un momento dado.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16 }}>
            {[
              { num:'11', lbl:'países monitoreados' },
              { num:'diario', lbl:'frecuencia de actualización' },
              { num:'100%', lbl:'datos públicos' },
            ].map(({ num, lbl }) => (
              <div key={lbl} style={{
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:12, padding:'20px 16px', textAlign:'center',
              }}>
                <div style={{ fontSize:28, fontWeight:900, color:'#2DD4BF', letterSpacing:-1, lineHeight:1, marginBottom:6 }}>{num}</div>
                <div style={{ fontSize:11, color:'#64748B', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background:'linear-gradient(160deg,#0D1117,#0d1a17)', padding:'64px 24px', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(20px,3.5vw,32px)', fontWeight:900, color:'#F1F5F9', marginBottom:12, letterSpacing:-0.8 }}>
            ¿Buscás trabajo en LatAm?
          </h2>
          <p style={{ fontSize:15, color:'#64748B', marginBottom:32, lineHeight:1.65 }}>
            En Nexu encontrás los concursos públicos y vacantes de todos estos países, actualizados diariamente.
          </p>
          <Link href="/empleos" style={{
            display:'inline-block', background:'#E8785A', color:'#fff',
            borderRadius:10, padding:'14px 32px', fontSize:15, fontWeight:800,
            textDecoration:'none', letterSpacing:-0.3,
          }}>
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
