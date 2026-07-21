'use client'
import { useState } from 'react'
import { T } from '../lib/i18n'

const PAISES = [
  '🇧🇷 Brasil','🇦🇷 Argentina','🇺🇾 Uruguay','🇨🇱 Chile','🇨🇴 Colombia',
  '🇲🇽 México','🇵🇪 Perú','🇪🇨 Ecuador','🇧🇴 Bolivia','🇵🇾 Paraguay',
  '🇻🇪 Venezuela','🇬🇹 Guatemala','🇭🇳 Honduras','🇳🇮 Nicaragua',
  '🇨🇷 Costa Rica','🇵🇦 Panamá','🇨🇺 Cuba','🇩🇴 Rep. Dominicana',
  '🇸🇻 El Salvador','🇵🇹 Portugal','🇪🇸 España','🇮🇹 Italia',
  '🇫🇷 Francia','🇩🇪 Alemania','🇬🇧 Reino Unido','🇺🇸 Estados Unidos',
  '🇨🇦 Canadá','🇦🇺 Australia','🇸🇪 Suecia','🇳🇴 Noruega',
  '🇨🇭 Suiza','🇯🇵 Japón','🇮🇳 India',
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Bloque opcional "reservar cuenta" — solo español por ahora (v1). Nadie
// pierde nada si lo ignora: los campos de arriba siguen siendo lo único
// obligatorio para recibir alertas, igual que siempre.
const DISPONIBILIDAD_OPTS = ['Tiempo completo', 'Medio tiempo', 'Freelance / por proyecto']
const TIPOS_EMPLEO_OPTS = ['Presencial', 'Remoto', 'Híbrido']

export default function WaitlistForm({ lang = 'es', ctaLabel, busqueda = '', paisDefault = '', ciudadDefault = '' }) {
  const tr = T[lang] || T.es
  const [email,    setEmail]    = useState('')
  const [nombre,   setNombre]   = useState('')
  const [queBusca, setQueBusca] = useState(busqueda || '')
  const [pais,     setPais]     = useState(paisDefault)
  const [ciudad,   setCiudad]   = useState(ciudadDefault || '')
  const [estado,   setEstado]   = useState('idle')
  const [posicion, setPosicion] = useState(null)
  const [msg,      setMsg]      = useState('')

  const [mostrarExtra, setMostrarExtra] = useState(false)
  const [telefono,     setTelefono]     = useState('')
  const [aniosExp,     setAniosExp]     = useState('')
  const [profesiones,  setProfesiones]  = useState('')
  const [especialidades, setEspecialidades] = useState('')
  const [idiomas,      setIdiomas]      = useState('')
  const [disponibilidad, setDisponibilidad] = useState('')
  const [tiposEmpleo,  setTiposEmpleo]  = useState([])
  const [sueldoMin,    setSueldoMin]    = useState('')
  const [sueldoMax,    setSueldoMax]    = useState('')
  const [descripcion,  setDescripcion]  = useState('')

  function toggleTipoEmpleo(t) {
    setTiposEmpleo(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  const aCsvArray = (s) => s.split(',').map(x => x.trim()).filter(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setMsg(tr.wl_err_email); return }
    setEstado('loading')
    try {
      const extra = mostrarExtra ? {
        telefono: telefono.trim() || null,
        anios_experiencia: aniosExp ? Number(aniosExp) : null,
        profesiones: profesiones.trim() ? aCsvArray(profesiones) : null,
        especialidades: especialidades.trim() ? aCsvArray(especialidades) : null,
        idiomas: idiomas.trim() ? aCsvArray(idiomas) : null,
        disponibilidad: disponibilidad || null,
        tipos_empleo: tiposEmpleo.length ? tiposEmpleo : null,
        sueldo_pretension_min: sueldoMin ? Number(sueldoMin) : null,
        sueldo_pretension_max: sueldoMax ? Number(sueldoMax) : null,
        descripcion_libre: descripcion.trim() || null,
      } : {}
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
        body:    JSON.stringify({ accion: 'unirse', origen: 'web', email: email.trim().toLowerCase(), nombre: nombre.trim() || null, pais: pais || paisDefault || null, ciudad: ciudad.trim() || null, busqueda: queBusca.trim() || null, ...extra }),
      })
      const data = await res.json()
      if (data.posicion) { setPosicion(data.posicion); setEstado('ok') }
      else if (data.habilitado) { setEstado('ok'); setPosicion(null) }
      else { setEstado('error'); setMsg(data.error ?? tr.wl_err_conn) }
    } catch {
      setEstado('error')
      setMsg(tr.wl_err_conn)
    }
  }

  if (estado === 'ok') {
    // Loop de WhatsApp: el pico de satisfacción (registro recién hecho) es el
    // momento de máxima disposición a compartir — el canal default de LATAM.
    const shareMsg = tr.wl_share_msg || T.es.wl_share_msg
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareMsg)}`
    return (
      <div style={ss.successBox}>
        <div style={ss.successIcon}>✓</div>
        <h3 style={ss.successTit}>{tr.wl_ok_tit}</h3>
        <p style={ss.successSub}>
          {posicion ? tr.wl_ok_sub : tr.wl_ok_hab}
        </p>
        <p style={ss.successEmail}>{email}</p>
        <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={ss.waBtn}>
          <span style={{fontSize:18}}>💬</span> {tr.wl_share_btn || T.es.wl_share_btn}
        </a>
        <p style={ss.waHint}>{tr.wl_share_hint || T.es.wl_share_hint}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={ss.form}>
      <div style={ss.inputGroup}>
        <input
          type="text"
          placeholder={tr.wl_nombre_ph}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
          style={ss.input}
        />
      </div>
      <div style={ss.inputGroup}>
        <input
          type="text"
          placeholder={tr.wl_busca_ph}
          value={queBusca}
          onChange={e => setQueBusca(e.target.value)}
          required
          style={ss.input}
        />
      </div>
      <div style={ss.inputGroup}>
        <input
          type="email"
          placeholder={tr.wl_email_ph}
          value={email}
          onChange={e => { setEmail(e.target.value); setMsg('') }}
          required
          style={ss.input}
        />
      </div>
      <div style={ss.inputGroup}>
        <select
          value={pais}
          onChange={e => setPais(e.target.value)}
          required
          style={{...ss.input, color: pais ? '#1A1020' : '#8c8492'}}
        >
          <option value="">{tr.wl_pais_ph}</option>
          {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={ss.inputGroup}>
        <input
          type="text"
          placeholder={tr.wl_ciudad_ph}
          value={ciudad}
          onChange={e => setCiudad(e.target.value)}
          required
          style={ss.input}
        />
      </div>
      {!mostrarExtra && (
        <button type="button" onClick={() => setMostrarExtra(true)} style={ss.extraToggle}>
          💼 + Ampliar mi perfil (opcional)
        </button>
      )}

      {mostrarExtra && (
        <div style={ss.extraBox}>
          <p style={ss.extraTit}>💼 Ampliá tu perfil laboral</p>
          <p style={ss.extraCopy}>Contanos más sobre tu experiencia y lo que buscás — así afinamos las alertas y sumás posibilidades de matchear con la oportunidad justa. Opcional.</p>

          <input type="tel" placeholder="Teléfono (opcional)" value={telefono} onChange={e => setTelefono(e.target.value)} style={ss.input} />
          <input type="number" min="0" placeholder="Años de experiencia" value={aniosExp} onChange={e => setAniosExp(e.target.value)} style={ss.input} />
          <input type="text" placeholder="Oficios/profesiones (separados por coma)" value={profesiones} onChange={e => setProfesiones(e.target.value)} style={ss.input} />
          <input type="text" placeholder="Especialidades (separadas por coma)" value={especialidades} onChange={e => setEspecialidades(e.target.value)} style={ss.input} />
          <input type="text" placeholder="Idiomas (separados por coma)" value={idiomas} onChange={e => setIdiomas(e.target.value)} style={ss.input} />

          <select value={disponibilidad} onChange={e => setDisponibilidad(e.target.value)} style={{...ss.input, color: disponibilidad ? '#1A1020' : '#8c8492'}}>
            <option value="">Disponibilidad (opcional)</option>
            {DISPONIBILIDAD_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <div style={ss.chipsRow}>
            {TIPOS_EMPLEO_OPTS.map(t => (
              <button key={t} type="button" onClick={() => toggleTipoEmpleo(t)}
                style={{...ss.chip, ...(tiposEmpleo.includes(t) ? ss.chipOn : {})}}>
                {t}
              </button>
            ))}
          </div>

          <div style={ss.sueldoRow}>
            <input type="number" min="0" placeholder="Pretensión mín. (opcional)" value={sueldoMin} onChange={e => setSueldoMin(e.target.value)} style={ss.input} />
            <input type="number" min="0" placeholder="Pretensión máx. (opcional)" value={sueldoMax} onChange={e => setSueldoMax(e.target.value)} style={ss.input} />
          </div>

          <textarea placeholder="Contanos brevemente sobre vos (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{...ss.input, resize:'vertical', fontFamily:'inherit'}} />

          <p style={ss.extraNota}>Esta información es parte de tu perfil y no es accesible para empresas ni otros usuarios.</p>

          <button type="button" onClick={() => setMostrarExtra(false)} style={ss.extraCollapse}>Ocultar — solo quiero las alertas</button>
        </div>
      )}

      {msg && <p style={ss.errorMsg}>{msg}</p>}
      <button type="submit" style={ss.btn} disabled={estado === 'loading'}>
        {estado === 'loading'
          ? <span style={ss.spinner} />
          : (ctaLabel || tr.wl_cta)}
      </button>
      <p style={ss.legal}>{tr.wl_legal}</p>
    </form>
  )
}

const ss = {
  form:        { display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:440 },
  inputGroup:  { width:'100%' },
  input:       { width:'100%', padding:'14px 18px', borderRadius:10, border:'1.5px solid #E4DCD2', background:'#FFFFFF', color:'#1A1020', fontSize:15, outline:'none', boxSizing:'border-box' },
  btn:         { background:'var(--coral-cta)', color:'#fff', border:'none', borderRadius:10, padding:'16px 32px', fontSize:16, fontWeight:800, cursor:'pointer', letterSpacing:-0.3, display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  errorMsg:    { color:'#C0392B', fontSize:13, margin:'-4px 0' },
  legal:       { color:'#8c8492', fontSize:12, textAlign:'center', marginTop:4 },
  successBox:  { background:'#ECFBF6', border:'1.5px solid #2DD4BF', borderRadius:16, padding:'32px 28px', textAlign:'center', maxWidth:440, width:'100%' },
  successIcon: { width:52, height:52, borderRadius:'50%', background:'#2DD4BF', color:'#0D1117', fontSize:26, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' },
  successTit:  { fontSize:22, fontWeight:900, color:'#1A1020', marginBottom:8 },
  successSub:  { fontSize:15, color:'#5A4E6A', lineHeight:1.6, marginBottom:12 },
  successEmail:{ fontSize:13, color:'#0E9E92', fontWeight:700 },
  waBtn:       { display:'inline-flex', alignItems:'center', gap:8, background:'#25D366', color:'#fff', textDecoration:'none', borderRadius:10, padding:'13px 24px', fontSize:15, fontWeight:800, marginTop:20 },
  waHint:      { fontSize:12, color:'#8c8492', marginTop:10 },
  spinner:     { width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' },
  extraToggle: { background:'#FFF7ED', border:'1.5px dashed #F0B573', borderRadius:10, padding:'12px 16px', fontSize:13, fontWeight:700, color:'#9A5B15', cursor:'pointer', textAlign:'center' },
  extraBox:    { display:'flex', flexDirection:'column', gap:10, background:'#FFFBF5', border:'1.5px solid #F0DCC0', borderRadius:12, padding:16 },
  extraTit:    { fontSize:14, fontWeight:800, color:'#1A1020', margin:0 },
  extraCopy:   { fontSize:12, color:'#6B5D4F', lineHeight:1.5, margin:'0 0 4px' },
  chipsRow:    { display:'flex', gap:8, flexWrap:'wrap' },
  chip:        { border:'1.5px solid #E4DCD2', background:'#fff', color:'#5A4E6A', borderRadius:20, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer' },
  chipOn:      { background:'var(--coral-cta)', borderColor:'var(--coral-cta)', color:'#fff' },
  sueldoRow:   { display:'flex', gap:8 },
  extraNota:   { fontSize:11, color:'#8c8492', lineHeight:1.5, margin:'0' },
  extraCollapse:{ background:'none', border:'none', color:'#8c8492', fontSize:12, textDecoration:'underline', cursor:'pointer', alignSelf:'center' },
}
