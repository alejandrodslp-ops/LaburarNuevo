'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../../lib/supabase-browser'

export default function EmpleadorDashboard() {
  const [stats, setStats] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [ofertas, setOfertas] = useState([])
  const [comprobantes, setComprobantes] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data: { user } } = await supabaseBrowser.auth.getUser()
    if (!user) return

    const [{ data: p }, { data: o }, { data: comps }] = await Promise.all([
      supabaseBrowser.from('profiles').select('nombre, pais').eq('id', user.id).single(),
      supabaseBrowser.from('ofertas').select('id, activa, vistas, postulaciones').eq('employer_id', user.id),
      supabaseBrowser.from('comprobantes').select('id, numero, fecha, monto, moneda, metodo, concepto, html_url').eq('employer_id', user.id).order('fecha', { ascending: false }).limit(20),
    ])
    setComprobantes(comps || [])

    setPerfil(p)
    setOfertas(o || [])
    setStats({
      totalOfertas: o?.length ?? 0,
      ofertasActivas: o?.filter(x => x.activa).length ?? 0,
      totalVistas: o?.reduce((s, x) => s + (x.vistas || 0), 0) ?? 0,
      totalContactos: o?.reduce((s, x) => s + (x.postulaciones || 0), 0) ?? 0,
    })
  }

  if (!stats) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
          Bienvenido{perfil?.nombre ? `, ${perfil.nombre}` : ''}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 14 }}>Aquí podés gestionar tus ofertas y encontrar candidatos.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Ofertas publicadas" value={stats.totalOfertas} icon="📋" />
        <StatCard label="Ofertas activas" value={stats.ofertasActivas} icon="✅" color="var(--teal)" />
        <StatCard label="Vistas totales" value={stats.totalVistas} icon="👁" />
        <StatCard label="Contactos enviados" value={stats.totalContactos} icon="✉️" color="var(--coral)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ActionCard
          icon="📋"
          title="Mis ofertas"
          desc="Publicá, editá y activá tus búsquedas laborales."
          href="/empleador/ofertas"
          btnLabel="Ver ofertas"
        />
        <ActionCard
          icon="🔍"
          title="Buscar candidatos"
          desc="Explorá perfiles de trabajadores disponibles en tu país."
          href="/empleador/candidatos"
          btnLabel="Buscar ahora"
          accent
        />
      </div>

      {ofertas.length === 0 && (
        <div style={{ marginTop: 24, background: 'white', border: '1.5px dashed var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Todavía no publicaste ninguna oferta</p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Creá tu primera oferta y llegá a trabajadores calificados.</p>
          <a href="/empleador/ofertas/nueva" style={{ background: 'var(--coral)', color: 'white', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14 }}>
            + Publicar oferta
          </a>
        </div>
      )}
      <ComprobantesSection comprobantes={comprobantes} />
    </div>
  )
}

function ComprobantesSection({ comprobantes }) {
  if (!comprobantes.length) return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', marginTop: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>🧾 Comprobantes de pago</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>No hay comprobantes aún. Se generan automáticamente cuando realizás un pago.</p>
    </div>
  )
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', marginTop: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>🧾 Comprobantes de pago</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>N°</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>Fecha</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>Concepto</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>Importe</th>
            <th style={{ padding: '8px 12px' }}></th>
          </tr>
        </thead>
        <tbody>
          {comprobantes.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{c.numero}</td>
              <td style={{ padding: '10px 12px' }}>{new Date(c.fecha).toLocaleDateString('es-UY')}</td>
              <td style={{ padding: '10px 12px', maxWidth: 200 }}>{c.concepto}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                {new Intl.NumberFormat('es-UY', { style: 'currency', currency: c.moneda ?? 'USD' }).format(c.monto)}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {c.html_url && (
                  <a href={c.html_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700, textDecoration: 'none' }}>
                    ↓ Descargar
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value, icon, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ActionCard({ icon, title, desc, href, btnLabel, accent }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>{desc}</p>
      <a href={href} style={{ display: 'inline-block', background: accent ? 'var(--coral)' : 'var(--bg)', color: accent ? 'white' : 'var(--text)', border: accent ? 'none' : '1.5px solid var(--border)', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14 }}>
        {btnLabel}
      </a>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
