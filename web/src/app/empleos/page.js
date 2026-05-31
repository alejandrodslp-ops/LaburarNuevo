import Link from 'next/link'
import { db } from '../../lib/supabase'
import { nombrePais } from '../../lib/utils'
import SearchForm from './SearchForm'
import JobsRealtime from '../JobsRealtime'

export const revalidate = 600

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.app'

export async function generateMetadata({ searchParams }) {
  const pais = searchParams?.pais || ''
  const q    = (searchParams?.q || '').slice(0, 60)
  const loc  = pais ? `en ${nombrePais(pais)}` : 'en LatAm'
  const titulo = q
    ? `Empleos de ${q} ${loc}`
    : pais ? `Empleos ${loc}` : 'Empleos y concursos en LatAm'
  return {
    title: titulo,
    description: `Concursos y llamados de trabajo ${loc}. Registrate gratis en Nexu y recibí alertas personalizadas.`,
    alternates: { canonical: `${SITE}/empleos` },
  }
}

async function getConcursos(pais, q) {
  const safe = (q || '').replace(/[%_'"\\;]/g, c => `\\${c}`).slice(0, 100)

  let query = db
    .from('concursos')
    .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(360)

  if (pais) query = query.eq('pais', pais.toUpperCase().slice(0, 2))
  if (safe) query = query.or(`titulo.ilike.%${safe}%,cargo.ilike.%${safe}%,organismo.ilike.%${safe}%`)

  const { data } = await query
  return data ?? []
}

export default async function EmpleosPage({ searchParams }) {
  const pais = searchParams?.pais || ''
  const q    = searchParams?.q    || ''
  const concursos = await getConcursos(pais, q)

  const titulo = q
    ? `Resultados para "${q}"`
    : pais ? `Empleos en ${nombrePais(pais)}` : 'Todos los empleos'

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu</Link>
        <a href="/download" className="nav-btn">Descargar gratis</a>
      </nav>

      <div className="container">
        <SearchForm defaultPais={pais} defaultQ={q} />

        <div className="section-header">
          <span className="section-title">{titulo}</span>
          <span className="section-count">Más recientes primero</span>
        </div>

        {/* key fuerza re-mount al cambiar filtros */}
        <JobsRealtime
          key={`${pais}-${q}`}
          initialJobs={concursos}
          pais={pais ? pais.toUpperCase().slice(0, 2) : null}
        />
      </div>

      <div className="bottom-cta">
        <p>¿Querés recibir alertas automáticas?</p>
        <p>Registrate gratis en Nexu y te avisamos cuando salgan concursos para tu perfil.</p>
        <a href="/download" className="btn-primary">📱 Descargar Nexu — Gratis</a>
      </div>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Nexu · nexu.app</p>
      </footer>
    </>
  )
}
