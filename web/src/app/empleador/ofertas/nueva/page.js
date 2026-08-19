'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '../../../../lib/supabase-browser'

// Opciones. Los valores se guardan tal cual en la tabla `ofertas`.
const RUBROS = ['Gastronomía / Cocina', 'Producción / Operarios', 'Ventas / Comercial', 'Administración', 'Construcción', 'Logística / Transporte', 'Salud', 'Limpieza / Doméstico', 'Atención al cliente', 'Otros']
const PAISES = [['UY', '🇺🇾 Uruguay'], ['AR', '🇦🇷 Argentina'], ['BR', '🇧🇷 Brasil'], ['MX', '🇲🇽 México'], ['CL', '🇨🇱 Chile'], ['CO', '🇨🇴 Colombia'], ['PE', '🇵🇪 Perú'], ['EC', '🇪🇨 Ecuador'], ['BO', '🇧🇴 Bolivia'], ['PY', '🇵🇾 Paraguay'], ['VE', '🇻🇪 Venezuela'], ['CR', '🇨🇷 Costa Rica'], ['GT', '🇬🇹 Guatemala'], ['SV', '🇸🇻 El Salvador'], ['HN', '🇭🇳 Honduras'], ['NI', '🇳🇮 Nicaragua'], ['PA', '🇵🇦 Panamá'], ['DO', '🇩🇴 Rep. Dominicana']]
const CONTRATOS = ['Tiempo indefinido', 'Plazo determinado', 'Temporal', 'Por obra', 'Pasantía']
const JORNADAS = ['Tiempo completo', 'Medio tiempo', 'Por turnos', 'Fin de semana']
const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']
const MONEDAS = ['USD', 'CRC', 'MXN', 'ARS', 'BRL', 'UYU', 'COP', 'PEN', 'EUR']
const PERIODICIDAD = [['mensual', 'Mensual'], ['quincenal', 'Quincenal'], ['hora', 'Por hora']]
const ESCOLARIDAD = ['Sin requisito', 'Primaria', 'Secundaria', 'Técnico / Profesional', 'Universitario']
const EXPERIENCIA = [['0', 'Sin experiencia'], ['1', '1 año'], ['2', '2 años'], ['3', '3+ años']]

export default function NuevaOferta() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')

  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // El puesto
  const [titulo, setTitulo] = useState('')
  const [rubro, setRubro] = useState('')
  const [pais, setPais] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [provincia, setProvincia] = useState('')
  const [aConvenir, setAConvenir] = useState(true)
  const [sueldoMin, setSueldoMin] = useState('')
  const [sueldoMax, setSueldoMax] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [periodicidad, setPeriodicidad] = useState('mensual')
  const [tipoContrato, setTipoContrato] = useState('')
  const [jornada, setJornada] = useState('')
  const [modalidad, setModalidad] = useState('')
  const [fechaCierre, setFechaCierre] = useState('')
  // El detalle
  const [descripcion, setDescripcion] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [beneficios, setBeneficios] = useState('')
  // Requerimientos
  const [escolaridad, setEscolaridad] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [idiomas, setIdiomas] = useState('')
  // Contacto (el diferencial)
  const [contactoEmail, setContactoEmail] = useState('')
  const [contactoWhatsapp, setContactoWhatsapp] = useState('')
  // Condiciones
  const [condiciones, setCondiciones] = useState(false)

  useEffect(() => { if (editId) cargarOferta() }, [editId])

  async function cargarOferta() {
    setLoading(true)
    const { data } = await supabaseBrowser.from('ofertas').select('*').eq('id', editId).single()
    if (data) {
      setTitulo(data.titulo || '')
      setRubro(data.rubro || '')
      setPais(data.pais || '')
      setCiudad(data.ciudad || '')
      setProvincia(data.lugar || '')
      const conv = !data.sueldo_min && !data.sueldo_max
      setAConvenir(conv)
      setSueldoMin(data.sueldo_min?.toString() || '')
      setSueldoMax(data.sueldo_max?.toString() || '')
      setMoneda(data.moneda || 'USD')
      setPeriodicidad(data.sueldo_tipo && data.sueldo_tipo !== 'a_acordar' ? data.sueldo_tipo : 'mensual')
      setTipoContrato(data.tipo_contrato || '')
      setJornada(data.carga_horaria || '')
      setModalidad(data.modalidad || '')
      setFechaCierre(data.fecha_cierre?.slice(0, 10) || '')
      setDescripcion(data.descripcion || '')
      setRequisitos(data.requisitos || '')
      setBeneficios(data.beneficios || '')
      setEscolaridad(data.escolaridad || '')
      setExperiencia(data.experiencia_min != null ? String(data.experiencia_min) : '')
      setIdiomas(Array.isArray(data.idiomas) ? data.idiomas.join(', ') : '')
      setContactoEmail(data.contacto_email || '')
      setContactoWhatsapp(data.contacto_whatsapp || '')
      setCondiciones(!!data.condiciones_aceptadas)
    }
    setLoading(false)
  }

  const tieneContacto = contactoEmail.trim() || contactoWhatsapp.trim()
  const valido = titulo.trim() && pais && ciudad.trim() && tieneContacto && condiciones

  async function guardar(e) {
    e.preventDefault()
    setMsg('')
    if (!titulo.trim() || !pais || !ciudad.trim()) { setMsg('Completá título, país y ciudad.'); return }
    if (!tieneContacto) { setMsg('Poné al menos un contacto de postulación (email o WhatsApp).'); return }
    if (!condiciones) { setMsg('Tenés que aceptar las condiciones.'); return }

    setGuardando(true)
    const { data: authData } = await supabaseBrowser.auth.getUser()
    const user = authData?.user
    if (!user) { setGuardando(false); setMsg('Tu sesión expiró, volvé a entrar.'); return }

    const payload = {
      employer_id: user.id,
      titulo: titulo.trim(),
      rubro: rubro || null,
      pais: pais || null,
      ciudad: ciudad.trim() || null,
      lugar: provincia.trim() || null,
      sueldo_tipo: aConvenir ? 'a_acordar' : (periodicidad || 'mensual'),
      sueldo_min: aConvenir ? null : (sueldoMin ? Number(sueldoMin) : null),
      sueldo_max: aConvenir ? null : (sueldoMax ? Number(sueldoMax) : null),
      moneda: aConvenir ? null : (moneda || null),
      tipo_contrato: tipoContrato || null,
      carga_horaria: jornada || null,
      modalidad: modalidad || null,
      fecha_cierre: fechaCierre || null,
      descripcion: descripcion.trim() || null,
      requisitos: requisitos.trim() || null,
      beneficios: beneficios.trim() || null,
      escolaridad: escolaridad || null,
      experiencia_min: experiencia ? Number(experiencia) : 0,
      idiomas: idiomas.trim() ? idiomas.split(',').map(s => s.trim()).filter(Boolean) : null,
      contacto_email: contactoEmail.trim() || null,
      contacto_whatsapp: contactoWhatsapp.trim() || null,
      condiciones_aceptadas: true,
      activa: true,
    }

    const { error } = editId
      ? await supabaseBrowser.from('ofertas').update(payload).eq('id', editId).eq('employer_id', user.id)
      : await supabaseBrowser.from('ofertas').insert(payload)

    if (error) { setGuardando(false); setMsg('No se pudo guardar: ' + error.message); return }
    router.replace('/empleador/ofertas')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/empleador/ofertas" style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>← Volver</a>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{editId ? 'Editar oferta' : 'Publicá tu empleo'}</h1>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 22px' }}>Gratis, sin límite. Llegá a trabajadores de tu ciudad.</p>

      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* EL PUESTO */}
        <div style={card}>
          <h2 style={h2}>El puesto</h2>
          <Field label="Título del puesto *" value={titulo} onChange={setTitulo} placeholder="Ej: Cocinero de producción" />
          <Select label="Rubro / categoría" value={rubro} onChange={setRubro} options={RUBROS} placeholder="Elegí un rubro…" optional />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>País *</label>
              <select value={pais} onChange={e => setPais(e.target.value)} style={inp}>
                <option value="">Elegí…</option>
                {PAISES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><Field label="Ciudad *" value={ciudad} onChange={setCiudad} placeholder="Ej: Escazú" /></div>
          </div>
          <Field label="Provincia / Estado" value={provincia} onChange={setProvincia} placeholder="Ej: San José" optional />

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Salario <span style={opt}>(opcional)</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--muted)', marginBottom: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={aConvenir} onChange={e => setAConvenir(e.target.checked)} /> A convenir
            </label>
            {!aConvenir && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ ...inp, width: 90 }}>{MONEDAS.map(m => <option key={m}>{m}</option>)}</select>
                <input style={{ ...inp, flex: 1, minWidth: 90 }} value={sueldoMin} onChange={e => setSueldoMin(e.target.value)} placeholder="Mínimo" type="number" min={0} />
                <input style={{ ...inp, flex: 1, minWidth: 90 }} value={sueldoMax} onChange={e => setSueldoMax(e.target.value)} placeholder="Máximo" type="number" min={0} />
                <select value={periodicidad} onChange={e => setPeriodicidad(e.target.value)} style={{ ...inp, width: 120 }}>{PERIODICIDAD.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label="Tipo de contrato" value={tipoContrato} onChange={setTipoContrato} options={CONTRATOS} placeholder="—" optional /></div>
            <div style={{ flex: 1 }}><Select label="Jornada" value={jornada} onChange={setJornada} options={JORNADAS} placeholder="—" optional /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label="Modalidad" value={modalidad} onChange={setModalidad} options={MODALIDADES} placeholder="—" optional /></div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Fecha de cierre <span style={opt}>(opcional)</span></label>
              <input style={inp} type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
            </div>
          </div>
        </div>

        {/* EL DETALLE */}
        <div style={card}>
          <h2 style={h2}>El detalle</h2>
          <Field label="Responsabilidades / descripción" value={descripcion} onChange={setDescripcion} placeholder="Qué se hace en el puesto…" multi optional />
          <Field label="Requisitos / perfil" value={requisitos} onChange={setRequisitos} placeholder="Qué se pide…" multi optional />
          <Field label="Se ofrece / beneficios" value={beneficios} onChange={setBeneficios} placeholder="Qué ofrecés…" multi optional />
        </div>

        {/* REQUERIMIENTOS */}
        <div style={card}>
          <h2 style={h2}>Requerimientos <span style={opt}>(opcional)</span></h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label="Educación mínima" value={escolaridad} onChange={setEscolaridad} options={ESCOLARIDAD} placeholder="—" optional /></div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Experiencia <span style={opt}>(opcional)</span></label>
              <select value={experiencia} onChange={e => setExperiencia(e.target.value)} style={inp}>
                <option value="">—</option>
                {EXPERIENCIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <Field label="Idiomas" value={idiomas} onChange={setIdiomas} placeholder="Ej: Español, Inglés básico" optional />
        </div>

        {/* CONTACTO — el diferencial */}
        <div style={{ ...card, border: '2px solid var(--coral)', background: '#FFF6F2', position: 'relative' }}>
          <span style={{ position: 'absolute', top: -11, left: 16, background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100 }}>⭐ LO QUE COMPUTRABAJO ESCONDE</span>
          <h2 style={{ ...h2, marginTop: 6 }}>¿Cómo se postula el candidato? *</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>Al menos uno. Esto es lo que le mostramos al trabajador para que te contacte directo.</p>
          <Field label="Email de postulación" value={contactoEmail} onChange={setContactoEmail} placeholder="rrhh@tuempresa.com" optional />
          <Field label="WhatsApp / teléfono" value={contactoWhatsapp} onChange={setContactoWhatsapp} placeholder="+506 …" optional />
        </div>

        {/* CONDICIONES */}
        <div style={card}>
          <h2 style={h2}>Condiciones</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px' }}>Nos protege a los dos. Al publicar, declarás que:</p>
          <ul style={{ fontSize: 12.5, color: '#5A4E6A', lineHeight: 1.55, margin: 0, paddingLeft: 18 }}>
            <li>La oferta es <b>real y veraz</b>, y tenés la facultad de contratar para este puesto.</li>
            <li>Sos el <b>único responsable</b> del proceso de selección, la contratación y el trato con los candidatos. Konexu <b>no es parte</b> de la relación laboral.</li>
            <li><b>No</b> vas a pedir dinero a los candidatos, ni discriminar, ni usar sus datos para otro fin; y cumplís la ley laboral y de protección de datos.</li>
            <li>Konexu solo <b>publica</b> el aviso: no verifica ni garantiza su contenido, no responde por el resultado ni por conflictos entre las partes, y puede dar de baja cualquier aviso.</li>
            <li>Mantenés <b>indemne a Konexu</b> ante cualquier reclamo derivado de tu aviso o de tu selección.</li>
          </ul>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text)', marginTop: 14, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={condiciones} onChange={e => setCondiciones(e.target.checked)} style={{ marginTop: 2 }} />
            Acepto las Condiciones para empleadores y confirmo que la información es verídica.
          </label>
        </div>

        {msg && <p style={{ color: '#C0392B', fontSize: 13.5, margin: 0 }}>{msg}</p>}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <a href="/empleador/ofertas" style={{ padding: '12px 20px', borderRadius: 10, border: '1.5px solid var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 14 }}>Cancelar</a>
          <button type="submit" disabled={guardando || !valido} style={{ background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 26px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: (guardando || !valido) ? 0.5 : 1 }}>
            {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Publicar oferta gratis'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', marginTop: -6 }}>Obligatorios: título, país, ciudad, contacto y aceptar las condiciones.</p>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multi, optional }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={opt}>(opcional)</span>}</label>
      {multi
        ? <textarea style={{ ...inp, height: 84, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={inp} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder, optional }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={opt}>(opcional)</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
        <option value="">{placeholder || '—'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
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

const card = { background: 'white', borderRadius: 16, padding: 22, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }
const h2 = { fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '0 0 14px' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }
const opt = { color: 'var(--muted)', fontWeight: 500 }
const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box', fontFamily: 'inherit' }
