'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '../../../../lib/supabase-browser'

const MODALIDADES = ['presencial', 'remoto', 'hibrido']
const CONTRATOS = ['full_time', 'part_time', 'contrato', 'freelance']
const MONEDAS = ['USD', 'UYU', 'ARS', 'BRL', 'EUR']
const CONTRATO_LBL = { full_time: 'Tiempo completo', part_time: 'Medio tiempo', contrato: 'Contrato', freelance: 'Freelance' }
const MODALIDAD_LBL = { presencial: '🏢 Presencial', remoto: '💻 Remoto', hibrido: '🔄 Híbrido' }

export default function NuevaOferta() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')

  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cargo, setCargo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [modalidad, setModalidad] = useState(null)
  const [tipoContrato, setTipoContrato] = useState(null)
  const [salarioMin, setSalarioMin] = useState('')
  const [salarioMax, setSalarioMax] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [fechaCierre, setFechaCierre] = useState('')

  useEffect(() => {
    if (editId) cargarOferta()
  }, [editId])

  async function cargarOferta() {
    setLoading(true)
    const { data } = await supabaseBrowser.from('ofertas').select('*').eq('id', editId).single()
    if (data) {
      setTitulo(data.titulo || '')
      setCargo(data.cargo || '')
      setDescripcion(data.descripcion || '')
      setRequisitos(data.requisitos || '')
      setCiudad(data.ciudad || '')
      setModalidad(data.modalidad || null)
      setTipoContrato(data.tipo_contrato || null)
      setSalarioMin(data.salario_min?.toString() || '')
      setSalarioMax(data.salario_max?.toString() || '')
      setMoneda(data.moneda || 'USD')
      setFechaCierre(data.fecha_cierre?.slice(0, 10) || '')
    }
    setLoading(false)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    setGuardando(true)
    const { data } = await supabaseBrowser.auth.getUser()
    const user = data?.user
    if (!user) { setGuardando(false); return }

    const payload = {
      employer_id: user.id,
      titulo: titulo.trim(),
      cargo: cargo.trim() || null,
      descripcion: descripcion.trim() || null,
      requisitos: requisitos.trim() || null,
      ciudad: ciudad.trim() || null,
      modalidad: modalidad || null,
      tipo_contrato: tipoContrato || null,
      salario_min: salarioMin ? Number(salarioMin) : null,
      salario_max: salarioMax ? Number(salarioMax) : null,
      moneda,
      fecha_cierre: fechaCierre || null,
      vistas: 0,
      postulaciones: 0,
      activa: true,
    }

    if (editId) {
      await supabaseBrowser.from('ofertas').update(payload).eq('id', editId).eq('employer_id', user.id)
    } else {
      await supabaseBrowser.from('ofertas').insert(payload)
    }
    router.replace('/empleador/ofertas')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <a href="/empleador/ofertas" style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>← Volver</a>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{editId ? 'Editar oferta' : 'Nueva oferta'}</h1>
      </div>

      <form onSubmit={guardar} style={{ background: 'white', borderRadius: 16, padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
        <Field label="Título de la oferta *" value={titulo} onChange={setTitulo} placeholder="Ej: Administrativo contable" />
        <Field label="Cargo / puesto" value={cargo} onChange={setCargo} placeholder="Ej: Contador Junior" optional />

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Modalidad</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MODALIDADES.map(m => (
              <Chip key={m} label={MODALIDAD_LBL[m]} active={modalidad === m} onClick={() => setModalidad(modalidad === m ? null : m)} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Tipo de contrato</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CONTRATOS.map(c => (
              <Chip key={c} label={CONTRATO_LBL[c]} active={tipoContrato === c} onClick={() => setTipoContrato(tipoContrato === c ? null : c)} />
            ))}
          </div>
        </div>

        <Field label="Ciudad / ubicación" value={ciudad} onChange={setCiudad} placeholder="Ej: Montevideo" optional />

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Salario <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(opcional)</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ ...inp, width: 80 }}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
            <input style={{ ...inp, flex: 1 }} value={salarioMin} onChange={e => setSalarioMin(e.target.value)} placeholder="Mínimo" type="number" min={0} />
            <span style={{ color: 'var(--muted)' }}>—</span>
            <input style={{ ...inp, flex: 1 }} value={salarioMax} onChange={e => setSalarioMax(e.target.value)} placeholder="Máximo" type="number" min={0} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Fecha de cierre <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(opcional)</span></label>
          <input style={inp} type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
        </div>

        <Field label="Descripción del puesto" value={descripcion} onChange={setDescripcion} placeholder="Describí las responsabilidades y el contexto del puesto..." multi optional />
        <Field label="Requisitos" value={requisitos} onChange={setRequisitos} placeholder="Formación requerida, experiencia, habilidades..." multi optional />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
          <a href="/empleador/ofertas" style={{ padding: '12px 20px', borderRadius: 10, border: '1.5px solid var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 14 }}>
            Cancelar
          </a>
          <button type="submit" disabled={guardando || !titulo.trim()} style={{ background: 'var(--coral)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: (guardando || !titulo.trim()) ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : editId ? 'Guardar cambios' : 'Publicar oferta'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multi, optional }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={lbl}>{label} {optional && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(opcional)</span>}</label>
      {multi
        ? <textarea style={{ ...inp, height: 90, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={inp} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--teal)' : 'var(--border)'}`, background: active ? '#E6FBF5' : 'white', color: active ? '#2E9472' : 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
      {label}
    </button>
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

const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box', fontFamily: 'inherit' }
