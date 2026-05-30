'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '../../../lib/supabase-browser'

const PAISES = [
  { code: 'UY', label: '🇺🇾 Uruguay', idLabel: null, idPlaceholder: null },
  { code: 'AR', label: '🇦🇷 Argentina', idLabel: 'CUIT', idPlaceholder: 'XX-XXXXXXXX-X' },
  { code: 'BR', label: '🇧🇷 Brasil', idLabel: 'CNPJ', idPlaceholder: 'XX.XXX.XXX/XXXX-XX' },
  { code: 'CL', label: '🇨🇱 Chile', idLabel: null, idPlaceholder: null },
  { code: 'CO', label: '🇨🇴 Colombia', idLabel: null, idPlaceholder: null },
  { code: 'MX', label: '🇲🇽 México', idLabel: null, idPlaceholder: null },
  { code: 'PE', label: '🇵🇪 Perú', idLabel: null, idPlaceholder: null },
  { code: 'ES', label: '🇪🇸 España', idLabel: null, idPlaceholder: null },
  { code: 'US', label: '🇺🇸 Estados Unidos', idLabel: null, idPlaceholder: null },
  { code: 'OTHER', label: '🌎 Otro país', idLabel: null, idPlaceholder: null },
]

export default function EmpleadorLogin() {
  const router = useRouter()
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Campos de registro
  const [empresa, setEmpresa] = useState('')
  const [pais, setPais] = useState('UY')
  const [idFiscal, setIdFiscal] = useState('')
  const [telefono, setTelefono] = useState('')
  const [sitioWeb, setSitioWeb] = useState('')
  const [verificacion, setVerificacion] = useState(null) // { ok, nombre, error, metodo }
  const [verificando, setVerificando] = useState(false)

  const paisConfig = PAISES.find(p => p.code === pais)
  const requiereIdFiscal = ['AR', 'BR'].includes(pais)
  const esUY = pais === 'UY'

  async function verificarEmpresa() {
    setVerificando(true)
    setVerificacion(null)
    const res = await fetch('/api/verificar-empresa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pais, idFiscal, email }),
    })
    const data = await res.json()
    setVerificacion(data)
    setVerificando(false)
    return data
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos.'); setLoading(false); return }
    router.replace('/empleador')
  }

  async function handleRegistro(e) {
    e.preventDefault()
    if (!empresa.trim()) { setError('El nombre de empresa es obligatorio.'); return }
    if (!telefono.trim()) { setError('El teléfono es obligatorio.'); return }
    if (requiereIdFiscal && !idFiscal.trim()) { setError(`El ${paisConfig?.idLabel} es obligatorio.`); return }

    setLoading(true); setError('')

    // Verificar empresa antes de crear cuenta
    const v = await verificarEmpresa()
    if (!v.ok) {
      setError(v.error)
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabaseBrowser.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    if (data.user) {
      await supabaseBrowser.from('profiles').upsert({
        id: data.user.id,
        nombre: v.nombre || empresa.trim(),
        nombre_empresa: empresa.trim(),
        rol: 'employer',
        pais: pais === 'OTHER' ? null : pais,
        telefono: telefono.trim(),
        sitio_web: sitioWeb.trim() || null,
        id_fiscal: idFiscal.trim() || null,
        verificacion_metodo: v.metodo || null,
        activo: true,
      })
    }
    router.replace('/empleador')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dark)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ color: 'var(--coral)', fontWeight: 900, fontSize: 28, letterSpacing: '-1px' }}>Nexu</span>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 14 }}>Panel de empleadores</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: 'var(--sh)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
            {['login', 'registro'].map(m => (
              <button key={m} onClick={() => { setModo(m); setError(''); setVerificacion(null) }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: modo === m ? 'white' : 'transparent', color: modo === m ? 'var(--text)' : 'var(--muted)', boxShadow: modo === m ? 'var(--sh)' : 'none' }}>
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {modo === 'login' ? (
            <form onSubmit={handleLogin}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="empresa@email.com" />
              <Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" minLength={6} />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>{loading ? 'Cargando...' : 'Entrar'}</SubmitBtn>
            </form>
          ) : (
            <form onSubmit={handleRegistro}>
              <Field label="Nombre de la empresa *" value={empresa} onChange={setEmpresa} placeholder="Ej: Constructora ABC S.A." />

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>País *</label>
                <select value={pais} onChange={e => { setPais(e.target.value); setIdFiscal(''); setVerificacion(null) }} style={{ ...inp, cursor: 'pointer' }} required>
                  {PAISES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </div>

              {requiereIdFiscal && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>{paisConfig?.idLabel} *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inp, flex: 1 }} value={idFiscal} onChange={e => { setIdFiscal(e.target.value); setVerificacion(null) }} placeholder={paisConfig?.idPlaceholder} required />
                    <button type="button" onClick={verificarEmpresa} disabled={verificando || !idFiscal.trim()}
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: (!idFiscal.trim() || verificando) ? 0.5 : 1 }}>
                      {verificando ? '...' : 'Verificar'}
                    </button>
                  </div>
                  {verificacion?.ok && (
                    <p style={{ fontSize: 12, color: '#2E9472', marginTop: 6, fontWeight: 600 }}>✅ Empresa verificada: {verificacion.nombre}</p>
                  )}
                  {verificacion && !verificacion.ok && (
                    <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>❌ {verificacion.error}</p>
                  )}
                </div>
              )}

              <Field label="Email corporativo *" type="email" value={email} onChange={e => { setEmail(e); setVerificacion(null) }} placeholder={esUY ? 'contacto@tuempresa.com' : 'empresa@email.com'} />

              {esUY && (
                <div style={{ background: '#FFF8E6', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 12px', marginBottom: 16, marginTop: -8 }}>
                  <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                    ⚠️ <b>Uruguay:</b> Para verificar tu empresa usamos tu email corporativo. No se aceptan Gmail, Hotmail, Yahoo ni similares. Usá el email de tu dominio empresarial (ej: <i>contacto@tuempresa.com</i>).
                  </p>
                </div>
              )}

              <Field label="Contraseña *" type="password" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" minLength={6} />
              <Field label="Teléfono de contacto *" value={telefono} onChange={setTelefono} placeholder="Ej: +598 99 123 456" />
              <Field label="Sitio web" value={sitioWeb} onChange={setSitioWeb} placeholder="https://tuempresa.com" optional />

              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta empresa'}</SubmitBtn>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          ¿Buscás trabajo? <a href="/" style={{ color: 'var(--coral)', fontWeight: 700 }}>Descargá la app</a>
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', minLength, optional }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional)</span>}</label>
      <input style={inp} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} minLength={minLength} required={!optional} />
    </div>
  )
}

function ErrorMsg({ children }) {
  return <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, background: '#FFF5F5', padding: '10px 12px', borderRadius: 8, border: '1px solid #FECACA' }}>{children}</p>
}

function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" disabled={loading} style={{ width: '100%', background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
      {children}
    </button>
  )
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }
