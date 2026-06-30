'use client'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '../lib/supabase-browser'
import { toSlug, bandPais, nombrePais, fmtFecha } from '../lib/utils'

function JobCard({ c }) {
  const esPublico = c.tipo_vinculo?.toLowerCase() !== 'privado'

  if (!esPublico) {
    // Empleo privado — teaser con candado, no linkea al detalle
    return (
      <div className="job-card" style={{ cursor: 'default', opacity: 0.92 }}>
        <div className="job-icon">🏢</div>
        <div className="job-body">
          <div className="job-title">{c.cargo || c.titulo}</div>
          <div className="job-org">{c.organismo || 'Empresa privada'}</div>
          <div className="job-meta">
            {c.pais && <span className="job-tag">{bandPais(c.pais)} {nombrePais(c.pais)}</span>}
            {c.lugar && <span className="job-tag">{c.lugar}</span>}
          </div>
        </div>
        <a
          href="/download"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--coral-cta)', color: 'white',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
            textDecoration: 'none', flexShrink: 0,
          }}
        >
          Contactar gratis →
        </a>
      </div>
    )
  }

  // Empleo público — linkea al detalle
  return (
    <Link href={`/empleos/${toSlug(c)}`} className="job-card">
      <div className="job-icon">🏛️</div>
      <div className="job-body">
        <div className="job-title">{c.cargo || c.titulo}</div>
        <div className="job-org">{c.organismo || '—'}</div>
        <div className="job-meta">
          {c.lugar && <span className="job-tag">{c.lugar}</span>}
          {c.pais && !c.lugar && <span className="job-tag">{bandPais(c.pais)} {nombrePais(c.pais)}</span>}
          {c.fecha_cierre && <span className="job-tag job-tag-coral">Cierra {fmtFecha(c.fecha_cierre)}</span>}
          {c.puestos > 1 && <span className="job-tag">{c.puestos} puestos</span>}
        </div>
      </div>
      <span className="job-arrow">›</span>
    </Link>
  )
}

function Anzuelo({ q }) {
  return (
    <a href="/download" style={{ display:'block', textDecoration:'none', background:'linear-gradient(120deg,#0D1117,#1a0f0a)', border:'1px solid rgba(232,120,90,0.3)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:28 }}>🔔</span>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', marginBottom:3 }}>
            {q ? `¿No quieres volver a buscar "${q}"?` : '¿No quieres buscar todos los días?'}
          </div>
          <div style={{ fontSize:13, color:'#94A3B8', lineHeight:1.45 }}>Activa alertas y Konexu te avisa apenas aparece una para ti. Gratis, a un clic.</div>
        </div>
        <span style={{ background:'var(--coral-cta)', color:'#fff', borderRadius:10, padding:'11px 18px', fontSize:13, fontWeight:800, whiteSpace:'nowrap' }}>📱 Activar alertas</span>
      </div>
    </a>
  )
}

export default function JobsRealtime({ initialJobs = [], pais = null, mostrarAnzuelo = false, anzueloQ = '' }) {
  const [jobs, setJobs]       = useState(initialJobs)
  const [nuevos, setNuevos]   = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setJobs(initialJobs)
    setNuevos(0)
  }, [initialJobs])

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`concursos-rt-${pais ?? 'all'}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'concursos',
        ...(pais ? { filter: `pais=eq.${pais}` } : {}),
      }, (payload) => {
        const nuevo = payload.new
        if (!nuevo?.activo) return
        setJobs(prev => {
          if (prev.some(j => j.id === nuevo.id)) return prev
          return [nuevo, ...prev]
        })
        setNuevos(prev => prev + 1)
        setVisible(true)
      })
      .subscribe()

    return () => supabaseBrowser.removeChannel(channel)
  }, [pais])

  return (
    <div>
      {nuevos > 0 && visible && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7',
          borderRadius: 10, padding: '12px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 700, color: 'var(--verde-fuerte)',
        }}>
          <span>✨ {nuevos} nuevo{nuevos > 1 ? 's' : ''} empleo{nuevos > 1 ? 's' : ''} en tiempo real</span>
          <button onClick={() => setVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--verde-fuerte)', padding: '0 4px' }}>×</button>
        </div>
      )}

      <div className="jobs-grid">
        {jobs.length === 0 ? (
          <div className="empty-state">
            <p>No hay empleos activos por el momento.</p>
            <Link href="/empleos" style={{ color: 'var(--muted)', fontWeight: 700 }}>Ver todos los empleos →</Link>
          </div>
        ) : (
          jobs.map((c, i) => (
            <Fragment key={c.id}>
              <JobCard c={c} />
              {mostrarAnzuelo && i === 2 && <Anzuelo q={anzueloQ} />}
            </Fragment>
          ))
        )}
      </div>
    </div>
  )
}
