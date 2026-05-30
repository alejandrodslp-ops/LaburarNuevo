'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const OPCIONES_PAIS = [
  { value: '',   label: 'Todos los países' },
  // Sudamérica
  { value: 'UY', label: '🇺🇾 Uruguay' },
  { value: 'AR', label: '🇦🇷 Argentina' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'CL', label: '🇨🇱 Chile' },
  { value: 'PE', label: '🇵🇪 Perú' },
  { value: 'CO', label: '🇨🇴 Colombia' },
  { value: 'MX', label: '🇲🇽 México' },
  { value: 'EC', label: '🇪🇨 Ecuador' },
  { value: 'BO', label: '🇧🇴 Bolivia' },
  { value: 'PY', label: '🇵🇾 Paraguay' },
  { value: 'VE', label: '🇻🇪 Venezuela' },
  // Centroamérica y Caribe
  { value: 'CU', label: '🇨🇺 Cuba' },
  { value: 'CR', label: '🇨🇷 Costa Rica' },
  { value: 'GT', label: '🇬🇹 Guatemala' },
  { value: 'SV', label: '🇸🇻 El Salvador' },
  { value: 'HN', label: '🇭🇳 Honduras' },
  { value: 'NI', label: '🇳🇮 Nicaragua' },
  { value: 'PA', label: '🇵🇦 Panamá' },
  { value: 'DO', label: '🇩🇴 Rep. Dominicana' },
  // Europa
  { value: 'ES', label: '🇪🇸 España' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'IT', label: '🇮🇹 Italia' },
  { value: 'FR', label: '🇫🇷 Francia' },
  { value: 'DE', label: '🇩🇪 Alemania' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  // Anglosajones
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'CA', label: '🇨🇦 Canadá' },
  { value: 'AU', label: '🇦🇺 Australia' },
]

export default function SearchForm({ defaultPais = '', defaultQ = '' }) {
  const router = useRouter()
  const [pais, setPais] = useState(defaultPais)
  const [q, setQ] = useState(defaultQ)

  function handleSubmit(e) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (pais) p.set('pais', pais)
    if (q.trim()) p.set('q', q.trim())
    router.push(`/empleos${p.toString() ? '?' + p.toString() : ''}`)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="form-group" style={{ flex: 2 }}>
        <label className="form-label">Cargo o profesión</label>
        <input
          className="form-input"
          type="text"
          placeholder="Ej: docente, plomero, contador..."
          value={q}
          onChange={e => setQ(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="form-group" style={{ maxWidth: 200 }}>
        <label className="form-label">País</label>
        <select
          className="form-select"
          value={pais}
          onChange={e => setPais(e.target.value)}
        >
          {OPCIONES_PAIS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-search">
        Buscar
      </button>
    </form>
  )
}
