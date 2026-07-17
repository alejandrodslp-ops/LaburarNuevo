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

export default function WaitlistForm({ lang = 'es', ctaLabel, busqueda = '', paisDefault = '' }) {
  const tr = T[lang] || T.es
  const [email,    setEmail]    = useState('')
  const [nombre,   setNombre]   = useState('')
  const [queBusca, setQueBusca] = useState(busqueda || '')
  const [pais,     setPais]     = useState(paisDefault)
  const [ciudad,   setCiudad]   = useState('')
  const [estado,   setEstado]   = useState('idle')
  const [posicion, setPosicion] = useState(null)
  const [msg,      setMsg]      = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setMsg(tr.wl_err_email); return }
    setEstado('loading')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
        body:    JSON.stringify({ accion: 'unirse', origen: 'web', email: email.trim().toLowerCase(), nombre: nombre.trim() || null, pais: pais || paisDefault || null, ciudad: ciudad.trim() || null, busqueda: queBusca.trim() || null }),
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
}
