'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '../../../lib/supabase-browser'
import { useLang } from '../../../lib/useLang'

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

const TXT = {
  es: {
    panelSub: 'Panel de empleadores',
    tabLogin: 'Iniciar sesión',
    tabRegistro: 'Crear cuenta',
    lEmail: 'Email',
    lPassword: 'Contraseña',
    errLogin: 'Email o contraseña incorrectos.',
    btnCargando: 'Cargando...',
    btnEntrar: 'Entrar',
    lEmpresa: 'Nombre de la empresa *',
    phEmpresa: 'Ej: Constructora ABC S.A.',
    lPais: 'País *',
    verificar: 'Verificar',
    empVerificada: (n) => `✅ Empresa verificada: ${n}`,
    lEmailCorp: 'Email corporativo *',
    phEmailCorpUY: 'contacto@tuempresa.com',
    phEmailCorp: 'empresa@email.com',
    uyWarn: <>⚠️ <b>Uruguay:</b> Para verificar tu empresa usamos tu email corporativo. No se aceptan Gmail, Hotmail, Yahoo ni similares. Usá el email de tu dominio empresarial (ej: <i>contacto@tuempresa.com</i>).</>,
    lPasswordReg: 'Contraseña *',
    phPassword: 'Mínimo 6 caracteres',
    lTelefono: 'Teléfono de contacto *',
    phTelefono: 'Ej: +598 99 123 456',
    lSitio: 'Sitio web',
    phSitio: 'https://tuempresa.com',
    errEmpresa: 'El nombre de empresa es obligatorio.',
    errTelefono: 'El teléfono es obligatorio.',
    errIdFiscal: (id) => `El ${id} es obligatorio.`,
    btnCreando: 'Creando cuenta...',
    btnCrear: 'Crear cuenta empresa',
    footerPre: '¿Buscás trabajo? ',
    footerLink: 'Descargá la app',
    opcional: '(opcional)',
  },
  pt: {
    panelSub: 'Painel de empregadores',
    tabLogin: 'Entrar',
    tabRegistro: 'Criar conta',
    lEmail: 'E-mail',
    lPassword: 'Senha',
    errLogin: 'E-mail ou senha incorretos.',
    btnCargando: 'Carregando...',
    btnEntrar: 'Entrar',
    lEmpresa: 'Nome da empresa *',
    phEmpresa: 'Ex: Construtora ABC Ltda.',
    lPais: 'País *',
    verificar: 'Verificar',
    empVerificada: (n) => `✅ Empresa verificada: ${n}`,
    lEmailCorp: 'E-mail corporativo *',
    phEmailCorpUY: 'contato@suaempresa.com',
    phEmailCorp: 'empresa@email.com',
    uyWarn: <>⚠️ <b>Uruguai:</b> Para verificar sua empresa usamos seu e-mail corporativo. Não aceitamos Gmail, Hotmail, Yahoo nem similares. Use o e-mail do seu domínio empresarial (ex: <i>contato@suaempresa.com</i>).</>,
    lPasswordReg: 'Senha *',
    phPassword: 'Mínimo 6 caracteres',
    lTelefono: 'Telefone de contato *',
    phTelefono: 'Ex: +55 11 91234 5678',
    lSitio: 'Site',
    phSitio: 'https://suaempresa.com',
    errEmpresa: 'O nome da empresa é obrigatório.',
    errTelefono: 'O telefone é obrigatório.',
    errIdFiscal: (id) => `O ${id} é obrigatório.`,
    btnCreando: 'Criando conta...',
    btnCrear: 'Criar conta empresa',
    footerPre: 'Procurando emprego? ',
    footerLink: 'Baixe o app',
    opcional: '(opcional)',
  },
}

export default function EmpleadorLogin() {
  const router = useRouter()
  const lang = useLang()
  const L = TXT[lang]
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
    if (error) { setError(L.errLogin); setLoading(false); return }
    router.replace('/empleador')
  }

  async function handleRegistro(e) {
    e.preventDefault()
    if (!empresa.trim()) { setError(L.errEmpresa); return }
    if (!telefono.trim()) { setError(L.errTelefono); return }
    if (requiereIdFiscal && !idFiscal.trim()) { setError(L.errIdFiscal(paisConfig?.idLabel)); return }

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
          <span style={{ color: 'var(--coral)', fontWeight: 900, fontSize: 28, letterSpacing: '-1px' }}>Konexu🧩</span>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 14 }}>{L.panelSub}</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: 'var(--sh)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
            {['login', 'registro'].map(m => (
              <button key={m} onClick={() => { setModo(m); setError(''); setVerificacion(null) }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: modo === m ? 'white' : 'transparent', color: modo === m ? 'var(--text)' : 'var(--muted)', boxShadow: modo === m ? 'var(--sh)' : 'none' }}>
                {m === 'login' ? L.tabLogin : L.tabRegistro}
              </button>
            ))}
          </div>

          {modo === 'login' ? (
            <form onSubmit={handleLogin}>
              <Field label={L.lEmail} type="email" value={email} onChange={setEmail} placeholder="empresa@email.com" L={L} />
              <Field label={L.lPassword} type="password" value={password} onChange={setPassword} placeholder="••••••••" minLength={6} L={L} />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>{loading ? L.btnCargando : L.btnEntrar}</SubmitBtn>
            </form>
          ) : (
            <form onSubmit={handleRegistro}>
              <Field label={L.lEmpresa} value={empresa} onChange={setEmpresa} placeholder={L.phEmpresa} L={L} />

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>{L.lPais}</label>
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
                      {verificando ? '...' : L.verificar}
                    </button>
                  </div>
                  {verificacion?.ok && (
                    <p style={{ fontSize: 12, color: 'var(--verde-fuerte)', marginTop: 6, fontWeight: 600 }}>{L.empVerificada(verificacion.nombre)}</p>
                  )}
                  {verificacion && !verificacion.ok && (
                    <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>❌ {verificacion.error}</p>
                  )}
                </div>
              )}

              <Field label={L.lEmailCorp} type="email" value={email} onChange={e => { setEmail(e); setVerificacion(null) }} placeholder={esUY ? L.phEmailCorpUY : L.phEmailCorp} L={L} />

              {esUY && (
                <div style={{ background: '#FFF8E6', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 12px', marginBottom: 16, marginTop: -8 }}>
                  <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                    {L.uyWarn}
                  </p>
                </div>
              )}

              <Field label={L.lPasswordReg} type="password" value={password} onChange={setPassword} placeholder={L.phPassword} minLength={6} L={L} />
              <Field label={L.lTelefono} value={telefono} onChange={setTelefono} placeholder={L.phTelefono} L={L} />
              <Field label={L.lSitio} value={sitioWeb} onChange={setSitioWeb} placeholder={L.phSitio} optional L={L} />

              {error && <ErrorMsg>{error}</ErrorMsg>}
              <SubmitBtn loading={loading}>{loading ? L.btnCreando : L.btnCrear}</SubmitBtn>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {L.footerPre}<a href="/" style={{ color: 'var(--coral)', fontWeight: 700 }}>{L.footerLink}</a>
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', minLength, optional, L }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{L?.opcional ?? '(opcional)'}</span>}</label>
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
