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

// Bloque opcional "ampliar perfil". Nadie pierde nada si lo ignora: los
// campos de arriba siguen siendo lo único obligatorio para recibir alertas,
// igual que siempre. Los valores guardados (no las etiquetas mostradas) son
// los mismos canónicos en español que usa EditarPerfilScreen.js en la app,
// para que el perfil se lea bien ahí después.
const DISPONIBILIDAD_OPTS = ['Inmediata', 'En 1 semana', 'En 2 semanas', 'A convenir']
const TIPOS_EMPLEO_OPTS = ['Permanente', 'Temporal', 'Por tarea', 'Medio horario']
const SEXO_OPTS = ['Masculino', 'Femenino', 'Otros']

// Etiquetas mostradas por idioma para los selects de valor fijo (el valor
// guardado siempre es la clave en español). Mismo criterio que SEXOS_TR /
// DISPS_TR / TIPOS_TR en src/data/oficios.js.
const DISPONIBILIDAD_TR = {
  'Inmediata':    { pt:'Imediata',     en:'Immediate',    fr:'Immédiate',       it:'Immediata',      de:'Sofort',            sv:'Omedelbar',              no:'Umiddelbar',   ja:'即時' },
  'En 1 semana':  { pt:'Em 1 semana',  en:'In 1 week',    fr:'Dans 1 semaine',  it:'In 1 settimana', de:'In 1 Woche',        sv:'Om 1 vecka',             no:'Om 1 uke',     ja:'1週間以内' },
  'En 2 semanas': { pt:'Em 2 semanas', en:'In 2 weeks',   fr:'Dans 2 semaines', it:'In 2 settimane', de:'In 2 Wochen',       sv:'Om 2 veckor',            no:'Om 2 uker',    ja:'2週間以内' },
  'A convenir':   { pt:'A combinar',   en:'To be agreed', fr:'À convenir',      it:'Da concordare',  de:'Nach Vereinbarung', sv:'Enligt överenskommelse', no:'Etter avtale', ja:'要相談' },
}
const TIPOS_EMPLEO_TR = {
  'Permanente':    { pt:'Permanente',   en:'Permanent',  fr:'Permanent',  it:'Permanente',   de:'Dauerhaft',       sv:'Permanent',      no:'Permanent',    ja:'正社員' },
  'Temporal':      { pt:'Temporário',   en:'Temporary',  fr:'Temporaire', it:'Temporaneo',   de:'Vorübergehend',   sv:'Tillfällig',     no:'Midlertidig',  ja:'臨時' },
  'Por tarea':     { pt:'Por tarefa',   en:'Task-based', fr:'Par tâche',  it:'Per progetto', de:'Aufgabenbasiert', sv:'Projektbaserad', no:'Prosjektbasert', ja:'タスク別' },
  'Medio horario': { pt:'Meio período', en:'Part-time',  fr:'Mi-temps',   it:'Part-time',    de:'Teilzeit',        sv:'Deltid',         no:'Deltid',       ja:'パートタイム' },
}
const SEXO_TR = {
  'Masculino': { pt:'Masculino', en:'Male',   fr:'Masculin', it:'Maschio', de:'Männlich', sv:'Man',    no:'Mann',  ja:'男性' },
  'Femenino':  { pt:'Feminino',  en:'Female', fr:'Féminin',  it:'Femmina', de:'Weiblich', sv:'Kvinna', no:'Kvinne', ja:'女性' },
  'Otros':     { pt:'Outros',    en:'Other',  fr:'Autres',   it:'Altri',   de:'Andere',   sv:'Annat',  no:'Annet', ja:'その他' },
}
function trOpt(map, key, lang) {
  if (!lang || lang === 'es') return key
  return map[key]?.[lang] ?? key
}

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
  const [apellido1,    setApellido1]    = useState('')
  const [apellido2,    setApellido2]    = useState('')
  const [telefono,     setTelefono]     = useState('')
  const [fechaNac,     setFechaNac]     = useState('')
  const [sexo,         setSexo]         = useState('')
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
        apellido1: apellido1.trim() || null,
        apellido2: apellido2.trim() || null,
        telefono: telefono.trim() || null,
        fecha_nac: fechaNac || null,
        sexo: sexo || null,
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
          {tr.wl_extra_toggle || T.es.wl_extra_toggle}
        </button>
      )}

      {mostrarExtra && (
        <div style={ss.extraBox}>
          <p style={ss.extraTit}>{tr.wl_extra_tit || T.es.wl_extra_tit}</p>
          <p style={ss.extraCopy}>{tr.wl_extra_copy || T.es.wl_extra_copy}</p>

          <div style={ss.sueldoRow}>
            <input type="text" placeholder={tr.wl_extra_apellido1_ph || T.es.wl_extra_apellido1_ph} value={apellido1} onChange={e => setApellido1(e.target.value)} style={ss.input} />
            <input type="text" placeholder={tr.wl_extra_apellido2_ph || T.es.wl_extra_apellido2_ph} value={apellido2} onChange={e => setApellido2(e.target.value)} style={ss.input} />
          </div>

          <input type="tel" placeholder={tr.wl_extra_whatsapp_ph || T.es.wl_extra_whatsapp_ph} value={telefono} onChange={e => setTelefono(e.target.value)} style={ss.input} />

          <div style={ss.sueldoRow}>
            <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} style={ss.input} />
            <select value={sexo} onChange={e => setSexo(e.target.value)} style={{...ss.input, color: sexo ? '#1A1020' : '#8c8492'}}>
              <option value="">{tr.wl_extra_sexo_ph || T.es.wl_extra_sexo_ph}</option>
              {SEXO_OPTS.map(o => <option key={o} value={o}>{trOpt(SEXO_TR, o, lang)}</option>)}
            </select>
          </div>

          <input type="text" placeholder={tr.wl_extra_profesiones_ph || T.es.wl_extra_profesiones_ph} value={profesiones} onChange={e => setProfesiones(e.target.value)} style={ss.input} />
          <input type="number" min="0" placeholder={tr.wl_extra_anios_ph || T.es.wl_extra_anios_ph} value={aniosExp} onChange={e => setAniosExp(e.target.value)} style={ss.input} />
          <input type="text" placeholder={tr.wl_extra_especialidades_ph || T.es.wl_extra_especialidades_ph} value={especialidades} onChange={e => setEspecialidades(e.target.value)} style={ss.input} />
          <input type="text" placeholder={tr.wl_extra_idiomas_ph || T.es.wl_extra_idiomas_ph} value={idiomas} onChange={e => setIdiomas(e.target.value)} style={ss.input} />

          <select value={disponibilidad} onChange={e => setDisponibilidad(e.target.value)} style={{...ss.input, color: disponibilidad ? '#1A1020' : '#8c8492'}}>
            <option value="">{tr.wl_extra_disponibilidad_ph || T.es.wl_extra_disponibilidad_ph}</option>
            {DISPONIBILIDAD_OPTS.map(o => <option key={o} value={o}>{trOpt(DISPONIBILIDAD_TR, o, lang)}</option>)}
          </select>

          <div style={ss.chipsRow}>
            {TIPOS_EMPLEO_OPTS.map(t => (
              <button key={t} type="button" onClick={() => toggleTipoEmpleo(t)}
                style={{...ss.chip, ...(tiposEmpleo.includes(t) ? ss.chipOn : {})}}>
                {trOpt(TIPOS_EMPLEO_TR, t, lang)}
              </button>
            ))}
          </div>

          <div style={ss.sueldoRow}>
            <input type="number" min="0" placeholder={tr.wl_extra_sueldomin_ph || T.es.wl_extra_sueldomin_ph} value={sueldoMin} onChange={e => setSueldoMin(e.target.value)} style={ss.input} />
            <input type="number" min="0" placeholder={tr.wl_extra_sueldomax_ph || T.es.wl_extra_sueldomax_ph} value={sueldoMax} onChange={e => setSueldoMax(e.target.value)} style={ss.input} />
          </div>

          <textarea placeholder={tr.wl_extra_descripcion_ph || T.es.wl_extra_descripcion_ph} value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{...ss.input, resize:'vertical', fontFamily:'inherit'}} />

          <p style={ss.extraNota}>{tr.wl_extra_nota || T.es.wl_extra_nota}</p>

          <button type="button" onClick={() => setMostrarExtra(false)} style={ss.extraCollapse}>{tr.wl_extra_ocultar || T.es.wl_extra_ocultar}</button>
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
