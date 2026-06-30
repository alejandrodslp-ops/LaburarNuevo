import Link from 'next/link'
import { db } from '../../lib/supabase'

import SearchForm from './SearchForm'
import JobsRealtime from '../JobsRealtime'
import { headers } from 'next/headers'
import { nombrePais } from '../../lib/utils'

const LATAM = ['UY','AR','BR','MX','CL','CO','PE','EC','BO','PY','VE','CR','GT','SV','HN','NI','PA','DO','CU']

// Dinámico por request: el filtro por país (geo) NO puede cachearse por URL,
// o un visitante recibiría los resultados de otro país.
export const dynamic = 'force-dynamic'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://konexu.app'

export async function generateMetadata({ searchParams }) {
  const q = (searchParams?.q || '').slice(0, 60)
  const titulo = q
    ? `Empleos de ${q} en LatAm y el mundo`
    : 'Empleos y concursos públicos en Uruguay, Argentina y toda LatAm'
  return {
    title: titulo,
    description: 'Todos los concursos públicos, llamados de trabajo y vacantes de Uruguay, Argentina, Brasil y 30 países más. Actualizados diariamente. Gratis.',
    alternates: { canonical: `${SITE}/empleos` },
    keywords: ['concursos públicos Uruguay','empleos Uruguay','trabajos Argentina','vacantes LatAm','llamados ONSC','empleo público','trabajo América Latina'],
  }
}

async function getConcursos(q, pais) {
  const safe = (q || '').replace(/[%_'"\\;]/g, c => `\\${c}`).slice(0, 100)

  let query = db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)

  if (pais) query = query.eq('pais', pais)

  query = query.order('created_at', { ascending: false }).limit(360)

  if (safe) query = query.or(`titulo.ilike.%${safe}%,cargo.ilike.%${safe}%,organismo.ilike.%${safe}%`)

  const { data } = await query
  return data ?? []
}

export default async function EmpleosPage({ searchParams }) {
  const q    = searchParams?.q || ''
  const override = (searchParams?.pais || '').toUpperCase()
  const h = await headers()
  const geo = (h.get('x-vercel-ip-country') || '').toUpperCase()
  const detected = override || geo
  const pais = LATAM.includes(detected) ? detected : null
  const concursos = await getConcursos(q, pais)

  const enPais = pais ? ` en ${nombrePais(pais)}` : ''
  const titulo = (q ? `Resultados para "${q}"` : 'Todos los empleos') + enPais

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo"><span>Konexu</span><span style={{fontSize:"0.42em",marginLeft:"-9px",lineHeight:1,marginBottom:"3px"}}>🧩</span></Link>
        <a href="/download" className="nav-btn">Descargar gratis</a>
      </nav>

      <div className="container">
        <SearchForm defaultQ={q} />

        <div className="section-header">
          <span className="section-title">{titulo}</span>
          <span className="section-count">Más recientes primero</span>
        </div>

        <JobsRealtime
          key={q}
          initialJobs={concursos}
          pais={null}
        />
      </div>

      <div className="bottom-cta">
        <p>Deja de buscar. El trabajo te encuentra.</p>
        <p>Arma tu perfil y Konexu te avisa apenas aparece un llamado para ti —público o privado—, a tiempo para postularte. Gratis.</p>
        <a href="/download" className="btn-primary">📱 Descargar Konexu — Gratis</a>
      </div>

      {/* Contenido SEO — palabras clave para Google */}
      <section style={{ background: '#f8fafc', padding: '48px 24px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a3a5c', marginBottom: 12 }}>
            Concursos públicos y empleos en Uruguay, Argentina y toda América Latina
          </h2>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            Konexu reúne diariamente miles de <strong>concursos públicos</strong>, <strong>llamados de trabajo</strong> y <strong>vacantes</strong> de Uruguay (ONSC, Uruguay Concursa), Argentina, Brasil, Chile, Colombia, México y 27 países más. Tanto empleo público como privado, actualizados dos veces por día.
          </p>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            Buscá por cargo o profesión para filtrar los resultados. Desde <strong>docentes y enfermeros</strong> hasta <strong>administrativos, ingenieros, plomeros y operarios</strong> — todos los rubros en un solo lugar.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['Uruguay','uruguay'], ['Argentina','argentina'], ['Brasil','brasil'],
              ['Chile','chile'], ['Colombia','colombia'], ['México','mexico'],
              ['España','espana'], ['Estados Unidos','estados-unidos'],
            ].map(([nombre, slug]) => (
              <Link
                key={slug}
                href={`/empleos/pais/${slug}`}
                style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
              >
                Empleos en {nombre}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Konexu · konexu.app</p>
      </footer>
    </>
  )
}
