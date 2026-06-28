'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../../../lib/supabase-browser'

const PAISES = ['UY','AR','BR','CL','CO','PE','MX','PY','BO','EC','VE','GT','HN','NI','PA','SV','DO','CR','CU','ES','PT','IT','DE','FR','GB','SE','NO','US','CA','AU','JP','IN']

function estrellas(r) {
  const n = Math.round(r || 0)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function calcularActividad(updatedAt) {
  if (!updatedAt) return null
  const dias = Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24))
  if (dias === 0) return 'Activo hoy'
  if (dias === 1) return 'Activo ayer'
  if (dias < 7) return `Activo hace ${dias} días`
  if (dias < 30) return `Activo hace ${Math.floor(dias / 7)} semanas`
  return `Activo hace ${Math.floor(dias / 30)} meses`
}

export default function CandidatosEmpleador() {
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [pais, setPais] = useState('UY')
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(new Set())

  useEffect(() => { buscar() }, [pais])

  async function buscar() {
    setLoading(true)
    let q = supabaseBrowser
      .from('perfiles_publicos')
      .select('id, nombre, apellido1, ciudad, pais, bio, servicios, profesiones, anios_experiencia, estrellas, total_calificaciones, updated_at, sueldo_pretension_min, sueldo_pretension_max, sueldo_moneda, disponibilidad, tipos_empleo, vistas, contactos, perfil_visible')
      .eq('rol', 'worker')
      .eq('pais', pais)
      .eq('perfil_activo', true)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (busqueda.trim()) {
      q = q.ilike('servicios', `%${busqueda.trim()}%`)
    }

    const { data } = await q
    setPerfiles(data || [])
    setLoading(false)
  }

  async function enviarInteres(perfil) {
    setEnviando(true)
    const { data } = await supabaseBrowser.auth.getUser()
    const user = data?.user
    if (!user) { setEnviando(false); return }

    const { data: emp } = await supabaseBrowser.from('profiles').select('nombre, apellido1').eq('id', user.id).single()
    const empleadorNombre = emp ? (emp.apellido1 ? `${emp.nombre} ${emp.apellido1[0]}.` : emp.nombre) : 'Empleador'

    const { data: ofertas } = await supabaseBrowser.from('ofertas').select('titulo, empleo, lugar, descripcion').eq('employer_id', user.id).order('created_at', { ascending: false }).limit(1)

    await supabaseBrowser.from('propuestas').insert({
      employer_id: user.id,
      worker_id: perfil.id,
      employer_nombre: empleadorNombre,
      oferta: ofertas?.[0] || null,
      estado: 'pendiente',
    })

    // 'contactos' se incrementa en el servidor (trigger on_propuesta_insert).
    supabaseBrowser.functions.invoke('notificar-propuesta', { body: { worker_id: perfil.id, employer_nombre: empleadorNombre } }).catch(() => {})

    setEnviado(prev => new Set([...prev, perfil.id]))
    setEnviando(false)
    setSelected(null)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>Buscar candidatos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>Explorá perfiles de trabajadores disponibles.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <select value={pais} onChange={e => setPais(e.target.value)} style={sel}>
          {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input style={{ ...sel, flex: 1, minWidth: 200 }} placeholder="Buscar por servicio u oficio..." value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
        <button onClick={buscar} style={{ background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>Buscar</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Buscando...</div>
      ) : perfiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <p>No hay candidatos disponibles en {pais} con ese criterio.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {perfiles.map(p => (
            <div key={p.id} onClick={() => setSelected(p)} style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--sh)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--sh)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D6E4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{p.nombre}{p.apellido1 ? ` ${p.apellido1[0]}.` : ''}</p>
                  {p.ciudad && <p style={{ fontSize: 12, color: 'var(--muted)' }}>📍 {p.ciudad}</p>}
                </div>
              </div>

              {p.total_calificaciones > 0 && (
                <p style={{ fontSize: 13, color: '#F59E0B', marginBottom: 6 }}>{estrellas(p.estrellas)} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({p.total_calificaciones})</span></p>
              )}

              {p.servicios?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {p.servicios.slice(0, 3).map((s, i) => (
                    <span key={i} style={{ fontSize: 11, background: '#F0FDFA', color: 'var(--teal)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              )}

              {p.bio && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.bio}</p>}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{calcularActividad(p.updated_at)}</span>
                {enviado.has(p.id)
                  ? <span style={{ fontSize: 12, color: 'var(--verde-fuerte)', fontWeight: 700 }}>✅ Enviado</span>
                  : <button onClick={e => { e.stopPropagation(); enviarInteres(p) }} disabled={enviando} style={{ background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Contactar
                    </button>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal perfil={selected} onClose={() => setSelected(null)} onContactar={() => enviarInteres(selected)} enviado={enviado.has(selected.id)} enviando={enviando} />
      )}
    </div>
  )
}

function Modal({ perfil, onClose, onContactar, enviado, enviando }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>{perfil.nombre}{perfil.apellido1 ? ` ${perfil.apellido1[0]}.` : ''}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        {perfil.ciudad && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>📍 {perfil.ciudad}</p>}
        {perfil.total_calificaciones > 0 && <p style={{ fontSize: 14, color: '#F59E0B', marginBottom: 12 }}>{estrellas(perfil.estrellas)} {Number(perfil.estrellas || 0).toFixed(1)} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({perfil.total_calificaciones} calificaciones)</span></p>}

        {perfil.disponibilidad && <InfoRow icon="📅" label="Disponibilidad" val={perfil.disponibilidad} />}
        {perfil.anios_experiencia && <InfoRow icon="📊" label="Experiencia" val={`${perfil.anios_experiencia} años`} />}
        {(perfil.sueldo_pretension_min || perfil.sueldo_pretension_max) && (
          <InfoRow icon="💰" label="Pretensión" val={`${perfil.sueldo_moneda || 'USD'} ${perfil.sueldo_pretension_min || ''}${perfil.sueldo_pretension_max ? ` - ${perfil.sueldo_pretension_max}` : ''}`} />
        )}

        {perfil.servicios?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1 }}>SERVICIOS</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {perfil.servicios.map((s, i) => <span key={i} style={{ fontSize: 12, background: '#F0FDFA', color: 'var(--teal)', borderRadius: 20, padding: '4px 10px', fontWeight: 600 }}>{s}</span>)}
            </div>
          </div>
        )}

        {perfil.bio && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1 }}>DESCRIPCIÓN</p>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{perfil.bio}</p>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {enviado
            ? <div style={{ background: '#E6FBF5', borderRadius: 10, padding: 14, textAlign: 'center', color: 'var(--verde-fuerte)', fontWeight: 700 }}>✅ Propuesta enviada — el trabajador recibirá una notificación.</div>
            : <button onClick={onContactar} disabled={enviando} style={{ width: '100%', background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                {enviando ? 'Enviando...' : 'Iniciar contacto'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, val }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 1 }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{val}</p>
      </div>
    </div>
  )
}

const sel = { padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'white', outline: 'none' }
