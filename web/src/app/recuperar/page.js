'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Cliente solo-navegador. detectSessionInUrl procesa el token de recuperación
// que Supabase agrega al hash de la URL (#access_token=...&type=recovery).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { detectSessionInUrl: true, persistSession: false, autoRefreshToken: false } }
)

export default function RecuperarPage() {
  const [estado, setEstado] = useState('cargando') // cargando | listo | sinToken | guardando | exito
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setEstado('listo')
    })
    // Si a los 2.5s no llegó token válido, mostrar enlace caducado/inválido
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setEstado(prev => (prev === 'cargando' ? (data?.session ? 'listo' : 'sinToken') : prev))
    }, 2500)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function guardar() {
    setError('')
    if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (pass !== pass2) { setError('Las contraseñas no coinciden.'); return }
    setEstado('guardando')
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) {
      setError(err.message || 'No se pudo cambiar la contraseña. Pedí un enlace nuevo desde la app.')
      setEstado('listo')
      return
    }
    await supabase.auth.signOut().catch(() => {})
    setEstado('exito')
  }

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>Konexu</div>

        {estado === 'cargando' && (
          <p style={S.muted}>Verificando enlace…</p>
        )}

        {estado === 'sinToken' && (
          <>
            <h1 style={S.title}>Enlace inválido o vencido</h1>
            <p style={S.muted}>
              Este enlace ya no es válido. Volvé a la app y tocá “Olvidé mi contraseña”
              para recibir uno nuevo.
            </p>
          </>
        )}

        {(estado === 'listo' || estado === 'guardando') && (
          <>
            <h1 style={S.title}>Crear contraseña nueva</h1>

            <label style={S.label}>Nueva contraseña</label>
            <div style={S.inputBox}>
              <input
                style={S.input}
                type={ver ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <button style={S.eye} onClick={() => setVer(v => !v)} type="button">
                {ver ? '🙈' : '👁️'}
              </button>
            </div>

            <label style={S.label}>Repetir contraseña</label>
            <div style={S.inputBox}>
              <input
                style={S.input}
                type={ver ? 'text' : 'password'}
                value={pass2}
                onChange={e => setPass2(e.target.value)}
                placeholder="Repetí la contraseña"
                autoComplete="new-password"
              />
            </div>

            {error && <p style={S.error}>{error}</p>}

            <button
              style={{ ...S.btn, opacity: estado === 'guardando' ? 0.6 : 1 }}
              onClick={guardar}
              disabled={estado === 'guardando'}
              type="button"
            >
              {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}

        {estado === 'exito' && (
          <>
            <div style={S.check}>✅</div>
            <h1 style={S.title}>¡Contraseña actualizada!</h1>
            <p style={S.muted}>
              Ya podés volver a la app e iniciar sesión con tu contraseña nueva.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF8F4', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' },
  card: { width: '100%', maxWidth: 380, background: '#FFFFFF', borderRadius: 20, padding: 32, border: '1px solid #EDE8E2', boxShadow: '0 8px 30px rgba(26,16,32,0.06)' },
  logo: { fontSize: 26, fontWeight: 900, color: '#E8785A', letterSpacing: -1, marginBottom: 20, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 800, color: '#1A1020', margin: '0 0 8px', textAlign: 'center' },
  muted: { fontSize: 14, color: '#A898B8', lineHeight: 1.5, textAlign: 'center', margin: 0 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#5A4E6A', margin: '16px 0 6px' },
  inputBox: { display: 'flex', alignItems: 'center', background: '#FFF', border: '1.5px solid #EDE8E2', borderRadius: 12, padding: '0 14px', height: 52 },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1A1020', background: 'transparent' },
  eye: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' },
  error: { fontSize: 13, color: '#D4614A', margin: '14px 0 0', textAlign: 'center' },
  btn: { width: '100%', marginTop: 24, padding: '15px 0', border: 'none', borderRadius: 14, background: '#E8785A', color: '#FFF', fontSize: 16, fontWeight: 800, cursor: 'pointer' },
  check: { fontSize: 44, textAlign: 'center', marginBottom: 8 },
}
