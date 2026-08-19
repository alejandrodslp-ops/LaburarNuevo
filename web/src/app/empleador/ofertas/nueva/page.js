'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '../../../../lib/supabase-browser'

// Compartidos (no dependen del idioma): país (bandera + nombre) y monedas (códigos).
const PAISES = [['UY', '🇺🇾 Uruguay'], ['AR', '🇦🇷 Argentina'], ['BR', '🇧🇷 Brasil'], ['MX', '🇲🇽 México'], ['CL', '🇨🇱 Chile'], ['CO', '🇨🇴 Colombia'], ['PE', '🇵🇪 Perú'], ['EC', '🇪🇨 Ecuador'], ['BO', '🇧🇴 Bolivia'], ['PY', '🇵🇾 Paraguay'], ['VE', '🇻🇪 Venezuela'], ['CR', '🇨🇷 Costa Rica'], ['GT', '🇬🇹 Guatemala'], ['SV', '🇸🇻 El Salvador'], ['HN', '🇭🇳 Honduras'], ['NI', '🇳🇮 Nicaragua'], ['PA', '🇵🇦 Panamá'], ['DO', '🇩🇴 Rep. Dominicana']]
const MONEDAS = ['USD', 'CRC', 'MXN', 'ARS', 'BRL', 'UYU', 'COP', 'PEN', 'EUR']

// Textos ES/PT. Idioma auto por navegador (navigator.language pt-* → pt, resto → es).
// Requisito del usuario: el sitio debe estar disponible al menos en español y portugués.
// Los valores de RUBROS/CONTRATOS/JORNADAS/MODALIDADES/ESCOLARIDAD se guardan tal cual
// en `ofertas`; como cada país es de un solo idioma (BR=pt, resto=es), cada aviso queda
// coherente en su idioma. PERIODICIDAD/EXPERIENCIA guardan un código (no el label).
const TXT = {
  es: {
    RUBROS: ['Gastronomía / Cocina', 'Producción / Operarios', 'Ventas / Comercial', 'Administración', 'Construcción', 'Logística / Transporte', 'Salud', 'Limpieza / Doméstico', 'Atención al cliente', 'Otros'],
    CONTRATOS: ['Tiempo indefinido', 'Plazo determinado', 'Temporal', 'Por obra', 'Pasantía'],
    JORNADAS: ['Tiempo completo', 'Medio tiempo', 'Por turnos', 'Fin de semana'],
    MODALIDADES: ['Presencial', 'Remoto', 'Híbrido'],
    ESCOLARIDAD: ['Sin requisito', 'Primaria', 'Secundaria', 'Técnico / Profesional', 'Universitario'],
    PERIODICIDAD: [['mensual', 'Mensual'], ['quincenal', 'Quincenal'], ['hora', 'Por hora']],
    EXPERIENCIA: [['0', 'Sin experiencia'], ['1', '1 año'], ['2', '2 años'], ['3', '3+ años']],
    volver: '← Volver',
    editar: 'Editar oferta',
    publicar: 'Publicá tu empleo',
    intro: 'Gratis, sin límite. Llegá a trabajadores de tu ciudad.',
    gPuesto: 'El puesto',
    gDetalle: 'El detalle',
    gReq: 'Requerimientos',
    gCond: 'Condiciones',
    opcional: '(opcional)',
    lTitulo: 'Título del puesto *',
    phTitulo: 'Ej: Cocinero de producción',
    lRubro: 'Rubro / categoría',
    phRubro: 'Elegí un rubro…',
    lPais: 'País *',
    phPais: 'Elegí…',
    lCiudad: 'Ciudad *',
    phCiudad: 'Ej: Escazú',
    lProvincia: 'Provincia / Estado',
    phProvincia: 'Ej: San José',
    lSalario: 'Salario',
    aConvenir: 'A convenir',
    phMin: 'Mínimo',
    phMax: 'Máximo',
    lContrato: 'Tipo de contrato',
    lJornada: 'Jornada',
    lModalidad: 'Modalidad',
    lCierre: 'Fecha de cierre',
    lResp: 'Responsabilidades / descripción',
    phResp: 'Qué se hace en el puesto…',
    lReqPerfil: 'Requisitos / perfil',
    phReqPerfil: 'Qué se pide…',
    lBeneficios: 'Se ofrece / beneficios',
    phBeneficios: 'Qué ofrecés…',
    lEscolaridad: 'Educación mínima',
    lExperiencia: 'Experiencia',
    lIdiomas: 'Idiomas',
    phIdiomas: 'Ej: Español, Inglés básico',
    dash: '—',
    badgeContacto: '⭐ LO QUE COMPUTRABAJO ESCONDE',
    contactoTit: '¿Cómo se postula el candidato? *',
    contactoSub: 'Al menos uno. Esto es lo que le mostramos al trabajador para que te contacte directo.',
    lEmail: 'Email de postulación',
    phEmail: 'rrhh@tuempresa.com',
    lWhatsapp: 'WhatsApp / teléfono',
    phWhatsapp: '+506 …',
    condIntro: 'Nos protege a los dos. Al publicar, declarás que:',
    cond: [
      <>La oferta es <b>real y veraz</b>, y tenés la facultad de contratar para este puesto.</>,
      <>Sos el <b>único responsable</b> del proceso de selección, la contratación y el trato con los candidatos. Konexu <b>no es parte</b> de la relación laboral.</>,
      <><b>No</b> vas a pedir dinero a los candidatos, ni discriminar, ni usar sus datos para otro fin; y cumplís la ley laboral y de protección de datos.</>,
      <>Konexu solo <b>publica</b> el aviso: no verifica ni garantiza su contenido, no responde por el resultado ni por conflictos entre las partes, y puede dar de baja cualquier aviso.</>,
      <>Mantenés <b>indemne a Konexu</b> ante cualquier reclamo derivado de tu aviso o de tu selección.</>,
    ],
    aceptar: 'Acepto las Condiciones para empleadores y confirmo que la información es verídica.',
    cancelar: 'Cancelar',
    guardando: 'Guardando…',
    guardarCambios: 'Guardar cambios',
    publicarBtn: 'Publicar oferta gratis',
    obligatorios: 'Obligatorios: título, país, ciudad, contacto y aceptar las condiciones.',
    errCampos: 'Completá título, país y ciudad.',
    errContacto: 'Poné al menos un contacto de postulación (email o WhatsApp).',
    errCond: 'Tenés que aceptar las condiciones.',
    errSesion: 'Tu sesión expiró, volvé a entrar.',
    errGuardar: 'No se pudo guardar: ',
  },
  pt: {
    RUBROS: ['Gastronomia / Cozinha', 'Produção / Operários', 'Vendas / Comercial', 'Administração', 'Construção', 'Logística / Transporte', 'Saúde', 'Limpeza / Doméstico', 'Atendimento ao cliente', 'Outros'],
    CONTRATOS: ['Tempo indeterminado', 'Prazo determinado', 'Temporário', 'Por obra', 'Estágio'],
    JORNADAS: ['Tempo integral', 'Meio período', 'Por turnos', 'Fim de semana'],
    MODALIDADES: ['Presencial', 'Remoto', 'Híbrido'],
    ESCOLARIDAD: ['Sem requisito', 'Fundamental', 'Médio', 'Técnico / Profissional', 'Superior'],
    PERIODICIDAD: [['mensual', 'Mensal'], ['quincenal', 'Quinzenal'], ['hora', 'Por hora']],
    EXPERIENCIA: [['0', 'Sem experiência'], ['1', '1 ano'], ['2', '2 anos'], ['3', '3+ anos']],
    volver: '← Voltar',
    editar: 'Editar vaga',
    publicar: 'Publique sua vaga',
    intro: 'Grátis, sem limite. Alcance trabalhadores da sua cidade.',
    gPuesto: 'A vaga',
    gDetalle: 'Os detalhes',
    gReq: 'Requisitos',
    gCond: 'Condições',
    opcional: '(opcional)',
    lTitulo: 'Título da vaga *',
    phTitulo: 'Ex: Cozinheiro de produção',
    lRubro: 'Área / categoria',
    phRubro: 'Escolha uma área…',
    lPais: 'País *',
    phPais: 'Escolha…',
    lCiudad: 'Cidade *',
    phCiudad: 'Ex: São Paulo',
    lProvincia: 'Estado / Província',
    phProvincia: 'Ex: SP',
    lSalario: 'Salário',
    aConvenir: 'A combinar',
    phMin: 'Mínimo',
    phMax: 'Máximo',
    lContrato: 'Tipo de contrato',
    lJornada: 'Jornada',
    lModalidad: 'Modalidade',
    lCierre: 'Data de encerramento',
    lResp: 'Responsabilidades / descrição',
    phResp: 'O que se faz na vaga…',
    lReqPerfil: 'Requisitos / perfil',
    phReqPerfil: 'O que se pede…',
    lBeneficios: 'Oferece / benefícios',
    phBeneficios: 'O que você oferece…',
    lEscolaridad: 'Escolaridade mínima',
    lExperiencia: 'Experiência',
    lIdiomas: 'Idiomas',
    phIdiomas: 'Ex: Português, Inglês básico',
    dash: '—',
    badgeContacto: '⭐ O QUE O COMPUTRABAJO ESCONDE',
    contactoTit: 'Como o candidato se candidata? *',
    contactoSub: 'Pelo menos um. É isto que mostramos ao trabalhador para que ele entre em contato direto com você.',
    lEmail: 'E-mail para candidaturas',
    phEmail: 'rh@suaempresa.com',
    lWhatsapp: 'WhatsApp / telefone',
    phWhatsapp: '+55 …',
    condIntro: 'Protege os dois. Ao publicar, você declara que:',
    cond: [
      <>A vaga é <b>real e verdadeira</b>, e você tem autoridade para contratar para ela.</>,
      <>Você é o <b>único responsável</b> pelo processo seletivo, pela contratação e pelo trato com os candidatos. A Konexu <b>não faz parte</b> da relação de trabalho.</>,
      <><b>Não</b> vai pedir dinheiro aos candidatos, nem discriminar, nem usar os dados deles para outro fim; e cumpre a legislação trabalhista e de proteção de dados.</>,
      <>A Konexu apenas <b>publica</b> o anúncio: não verifica nem garante seu conteúdo, não responde pelo resultado nem por conflitos entre as partes, e pode remover qualquer anúncio.</>,
      <>Você mantém a <b>Konexu isenta</b> de qualquer reclamação decorrente do seu anúncio ou da sua seleção.</>,
    ],
    aceptar: 'Aceito as Condições para empregadores e confirmo que as informações são verdadeiras.',
    cancelar: 'Cancelar',
    guardando: 'Salvando…',
    guardarCambios: 'Salvar alterações',
    publicarBtn: 'Publicar vaga grátis',
    obligatorios: 'Obrigatórios: título, país, cidade, contato e aceitar as condições.',
    errCampos: 'Preencha título, país e cidade.',
    errContacto: 'Informe pelo menos um contato para candidaturas (e-mail ou WhatsApp).',
    errCond: 'Você precisa aceitar as condições.',
    errSesion: 'Sua sessão expirou, entre novamente.',
    errGuardar: 'Não foi possível salvar: ',
  },
}

export default function NuevaOferta() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')

  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // Idioma auto por navegador (SSR arranca en es; si el navegador es pt-*, pasa a pt).
  const [lang, setLang] = useState('es')
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pt')) setLang('pt')
  }, [])
  const L = TXT[lang]

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
    if (!titulo.trim() || !pais || !ciudad.trim()) { setMsg(L.errCampos); return }
    if (!tieneContacto) { setMsg(L.errContacto); return }
    if (!condiciones) { setMsg(L.errCond); return }

    setGuardando(true)
    const { data: authData } = await supabaseBrowser.auth.getUser()
    const user = authData?.user
    if (!user) { setGuardando(false); setMsg(L.errSesion); return }

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

    if (error) { setGuardando(false); setMsg(L.errGuardar + error.message); return }
    router.replace('/empleador/ofertas')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/empleador/ofertas" style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>{L.volver}</a>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{editId ? L.editar : L.publicar}</h1>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 22px' }}>{L.intro}</p>

      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* EL PUESTO */}
        <div style={card}>
          <h2 style={h2}>{L.gPuesto}</h2>
          <Field label={L.lTitulo} value={titulo} onChange={setTitulo} placeholder={L.phTitulo} />
          <Select label={L.lRubro} value={rubro} onChange={setRubro} options={L.RUBROS} placeholder={L.phRubro} optional txt={L} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>{L.lPais}</label>
              <select value={pais} onChange={e => setPais(e.target.value)} style={inp}>
                <option value="">{L.phPais}</option>
                {PAISES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><Field label={L.lCiudad} value={ciudad} onChange={setCiudad} placeholder={L.phCiudad} /></div>
          </div>
          <Field label={L.lProvincia} value={provincia} onChange={setProvincia} placeholder={L.phProvincia} optional txt={L} />

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>{L.lSalario} <span style={opt}>{L.opcional}</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--muted)', marginBottom: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={aConvenir} onChange={e => setAConvenir(e.target.checked)} /> {L.aConvenir}
            </label>
            {!aConvenir && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ ...inp, width: 90 }}>{MONEDAS.map(m => <option key={m}>{m}</option>)}</select>
                <input style={{ ...inp, flex: 1, minWidth: 90 }} value={sueldoMin} onChange={e => setSueldoMin(e.target.value)} placeholder={L.phMin} type="number" min={0} />
                <input style={{ ...inp, flex: 1, minWidth: 90 }} value={sueldoMax} onChange={e => setSueldoMax(e.target.value)} placeholder={L.phMax} type="number" min={0} />
                <select value={periodicidad} onChange={e => setPeriodicidad(e.target.value)} style={{ ...inp, width: 120 }}>{L.PERIODICIDAD.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label={L.lContrato} value={tipoContrato} onChange={setTipoContrato} options={L.CONTRATOS} placeholder={L.dash} optional txt={L} /></div>
            <div style={{ flex: 1 }}><Select label={L.lJornada} value={jornada} onChange={setJornada} options={L.JORNADAS} placeholder={L.dash} optional txt={L} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label={L.lModalidad} value={modalidad} onChange={setModalidad} options={L.MODALIDADES} placeholder={L.dash} optional txt={L} /></div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>{L.lCierre} <span style={opt}>{L.opcional}</span></label>
              <input style={inp} type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
            </div>
          </div>
        </div>

        {/* EL DETALLE */}
        <div style={card}>
          <h2 style={h2}>{L.gDetalle}</h2>
          <Field label={L.lResp} value={descripcion} onChange={setDescripcion} placeholder={L.phResp} multi optional txt={L} />
          <Field label={L.lReqPerfil} value={requisitos} onChange={setRequisitos} placeholder={L.phReqPerfil} multi optional txt={L} />
          <Field label={L.lBeneficios} value={beneficios} onChange={setBeneficios} placeholder={L.phBeneficios} multi optional txt={L} />
        </div>

        {/* REQUERIMIENTOS */}
        <div style={card}>
          <h2 style={h2}>{L.gReq} <span style={opt}>{L.opcional}</span></h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Select label={L.lEscolaridad} value={escolaridad} onChange={setEscolaridad} options={L.ESCOLARIDAD} placeholder={L.dash} optional txt={L} /></div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>{L.lExperiencia} <span style={opt}>{L.opcional}</span></label>
              <select value={experiencia} onChange={e => setExperiencia(e.target.value)} style={inp}>
                <option value="">{L.dash}</option>
                {L.EXPERIENCIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <Field label={L.lIdiomas} value={idiomas} onChange={setIdiomas} placeholder={L.phIdiomas} optional txt={L} />
        </div>

        {/* CONTACTO — el diferencial */}
        <div style={{ ...card, border: '2px solid var(--coral)', background: '#FFF6F2', position: 'relative' }}>
          <span style={{ position: 'absolute', top: -11, left: 16, background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100 }}>{L.badgeContacto}</span>
          <h2 style={{ ...h2, marginTop: 6 }}>{L.contactoTit}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>{L.contactoSub}</p>
          <Field label={L.lEmail} value={contactoEmail} onChange={setContactoEmail} placeholder={L.phEmail} optional txt={L} />
          <Field label={L.lWhatsapp} value={contactoWhatsapp} onChange={setContactoWhatsapp} placeholder={L.phWhatsapp} optional txt={L} />
        </div>

        {/* CONDICIONES */}
        <div style={card}>
          <h2 style={h2}>{L.gCond}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px' }}>{L.condIntro}</p>
          <ul style={{ fontSize: 12.5, color: '#5A4E6A', lineHeight: 1.55, margin: 0, paddingLeft: 18 }}>
            {L.cond.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text)', marginTop: 14, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={condiciones} onChange={e => setCondiciones(e.target.checked)} style={{ marginTop: 2 }} />
            {L.aceptar}
          </label>
        </div>

        {msg && <p style={{ color: '#C0392B', fontSize: 13.5, margin: 0 }}>{msg}</p>}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <a href="/empleador/ofertas" style={{ padding: '12px 20px', borderRadius: 10, border: '1.5px solid var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 14 }}>{L.cancelar}</a>
          <button type="submit" disabled={guardando || !valido} style={{ background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 26px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: (guardando || !valido) ? 0.5 : 1 }}>
            {guardando ? L.guardando : editId ? L.guardarCambios : L.publicarBtn}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', marginTop: -6 }}>{L.obligatorios}</p>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multi, optional, txt }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={opt}>{txt?.opcional ?? '(opcional)'}</span>}</label>
      {multi
        ? <textarea style={{ ...inp, height: 84, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={inp} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder, optional, txt }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label} {optional && <span style={opt}>{txt?.opcional ?? '(opcional)'}</span>}</label>
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
