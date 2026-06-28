'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../../../lib/supabase-browser'

function formatFecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function OfertasEmpleador() {
  const [ofertas, setOfertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: { user } } = await supabaseBrowser.auth.getUser()
    if (!user) return
    const { data } = await supabaseBrowser.from('ofertas').select('*').eq('employer_id', user.id).order('created_at', { ascending: false })
    setOfertas(data || [])
    setLoading(false)
  }

  async function toggleActiva(oferta) {
    const nueva = !oferta.activa
    setOfertas(prev => prev.map(o => o.id === oferta.id ? { ...o, activa: nueva } : o))
    const { error } = await supabaseBrowser.from('ofertas').update({ activa: nueva }).eq('id', oferta.id)
    if (error) setOfertas(prev => prev.map(o => o.id === oferta.id ? { ...o, activa: oferta.activa } : o))
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminár esta oferta? Esta acción no se puede deshacer.')) return
    setOfertas(prev => prev.filter(o => o.id !== id))
    const { data } = await supabaseBrowser.auth.getUser()
    const user = data?.user
    if (!user) return
    await supabaseBrowser.from('ofertas').delete().eq('id', id).eq('employer_id', user.id)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>Mis ofertas</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''} publicada{ofertas.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/empleador/ofertas/nueva" style={{ background: 'var(--coral)', color: 'white', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14 }}>
          + Nueva oferta
        </a>
      </div>

      {ofertas.length === 0 ? (
        <div style={{ background: 'white', border: '1.5px dashed var(--border)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Sin ofertas publicadas</p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>Publicá tu primera oferta y llegá a cientos de trabajadores calificados.</p>
          <a href="/empleador/ofertas/nueva" style={{ background: 'var(--coral)', color: 'white', borderRadius: 10, padding: '12px 24px', fontWeight: 700 }}>
            Publicar oferta
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ofertas.map(o => (
            <div key={o.id} style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{o.titulo}</h3>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: o.activa ? '#E6FBF5' : '#F2EDE6', color: o.activa ? 'var(--verde-fuerte)' : '#A898B8' }}>
                      {o.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  {o.cargo && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{o.cargo}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {o.ciudad && <Tag>📍 {o.ciudad}</Tag>}
                    {o.modalidad && <Tag>{o.modalidad === 'remoto' ? '💻' : o.modalidad === 'hibrido' ? '🔄' : '🏢'} {o.modalidad}</Tag>}
                    {o.tipo_contrato && <Tag>📋 {o.tipo_contrato.replace('_', ' ')}</Tag>}
                    {o.fecha_cierre && <Tag>⏳ Cierra {formatFecha(o.fecha_cierre)}</Tag>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 120 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{o.activa ? 'Activa' : 'Pausada'}</span>
                    <div onClick={() => toggleActiva(o)} style={{ width: 40, height: 22, borderRadius: 11, background: o.activa ? 'var(--teal)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: o.activa ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Stat icon="👁" val={o.vistas || 0} label="vistas" />
                  <Stat icon="✉️" val={o.postulaciones || 0} label="contactos" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={`/empleador/ofertas/nueva?id=${o.id}`} style={btnSecondary}>Editar</a>
                  <button onClick={() => eliminar(o.id)} style={{ ...btnSecondary, color: '#EF4444', border: '1.5px solid #FECACA', background: '#FFF5F5', cursor: 'pointer' }}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Tag = ({ children }) => (
  <span style={{ fontSize: 11, color: '#5A4E6A', background: '#F2EDE6', borderRadius: 8, padding: '3px 8px', fontWeight: 600 }}>{children}</span>
)
const Stat = ({ icon, val, label }) => (
  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{icon} <b style={{ color: 'var(--text)' }}>{val}</b> {label}</span>
)
const btnSecondary = { fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', textDecoration: 'none', cursor: 'pointer' }

function LoadingSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
