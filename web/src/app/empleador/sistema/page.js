'use client'
import { useState, useEffect } from 'react'
import { supabaseBrowser } from '../../../lib/supabase-browser'

const ADMIN_EMAIL = 'alejandrodslp@gmail.com'

const SCRAPERS = [
  {
    key: 'global',
    nombre: 'Scraper Global',
    desc: '33 países — Uruguay, Argentina, Brasil, LatAm, Europa, EEUU, Asia',
    icon: '🌍',
  },
  {
    key: 'sudamerica',
    nombre: 'Scraper Sudamérica',
    desc: 'Foco en Argentina, Chile, Perú, Colombia y región',
    icon: '🌎',
  },
  {
    key: 'privado',
    nombre: 'Scraper Privados',
    desc: 'Ofertas del sector privado y portales de empleo',
    icon: '🏢',
  },
]

export default function SistemaPage() {
  const [email, setEmail]     = useState(null)
  const [estados, setEstados] = useState({})
  const [logs, setLogs]       = useState([])

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  if (email === null) return <div style={s.center}><Spinner /></div>
  if (email !== ADMIN_EMAIL) return (
    <div style={s.center}>
      <p style={{ color: '#64748B', fontSize: 14 }}>Acceso restringido.</p>
    </div>
  )

  async function disparar(key, nombre) {
    setEstados(p => ({ ...p, [key]: 'loading' }))
    addLog(`Disparando ${nombre}...`)
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      const res = await fetch('/api/trigger-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ workflow: key }),
      })
      const json = await res.json()
      if (json.ok) {
        setEstados(p => ({ ...p, [key]: 'ok' }))
        addLog(`✅ ${nombre} iniciado — verás los resultados en ~5 min.`)
        setTimeout(() => setEstados(p => ({ ...p, [key]: null })), 4000)
      } else {
        setEstados(p => ({ ...p, [key]: 'error' }))
        addLog(`❌ Error: ${json.error}`)
      }
    } catch (e) {
      setEstados(p => ({ ...p, [key]: 'error' }))
      addLog(`❌ Error de red: ${e.message}`)
    }
  }

  function addLog(msg) {
    const hora = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(p => [`[${hora}] ${msg}`, ...p].slice(0, 20))
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>⚙️ Sistema</h1>
      <p style={s.sub}>Disparadores manuales — úsalos si los datos están desactualizados o hay una falla.</p>

      <div style={s.grid}>
        {SCRAPERS.map(sc => {
          const est = estados[sc.key]
          return (
            <div key={sc.key} style={s.card}>
              <div style={s.cardIcon}>{sc.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={s.cardNombre}>{sc.nombre}</div>
                <div style={s.cardDesc}>{sc.desc}</div>
              </div>
              <button
                style={{ ...s.btn, ...(est === 'ok' ? s.btnOk : est === 'error' ? s.btnErr : {}) }}
                onClick={() => disparar(sc.key, sc.nombre)}
                disabled={est === 'loading'}
              >
                {est === 'loading' ? <Spinner small /> : est === 'ok' ? '✓ Iniciado' : est === 'error' ? '✗ Error' : '▶ Correr ahora'}
              </button>
            </div>
          )
        })}
      </div>

      {logs.length > 0 && (
        <div style={s.logBox}>
          <div style={s.logTit}>Actividad</div>
          {logs.map((l, i) => <div key={i} style={s.logLine}>{l}</div>)}
        </div>
      )}
    </div>
  )
}

function Spinner({ small }) {
  return (
    <div style={{
      width: small ? 14 : 28, height: small ? 14 : 28,
      border: `${small ? 2 : 3}px solid rgba(255,255,255,0.3)`,
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', display: 'inline-block',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const s = {
  page:     { maxWidth: 760, margin: '0 auto', padding: '32px 20px' },
  h1:       { fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 6 },
  sub:      { fontSize: 13, color: '#64748B', marginBottom: 28 },
  grid:     { display: 'flex', flexDirection: 'column', gap: 12 },
  card:     { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  cardIcon: { fontSize: 28, flexShrink: 0 },
  cardNombre: { fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 3 },
  cardDesc:   { fontSize: 12, color: '#64748B' },
  btn:      { background: '#0F172A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnOk:    { background: '#059669' },
  btnErr:   { background: '#DC2626' },
  logBox:   { marginTop: 28, background: '#0F172A', borderRadius: 12, padding: '16px 20px' },
  logTit:   { fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  logLine:  { fontSize: 12, color: '#94A3B8', fontFamily: 'monospace', marginBottom: 4, lineHeight: 1.5 },
  center:   { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
}
