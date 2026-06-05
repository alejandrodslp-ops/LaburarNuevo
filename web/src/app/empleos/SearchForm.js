'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SearchForm({ defaultQ = '' }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultQ)

  function handleSubmit(e) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    router.push(`/empleos${p.toString() ? '?' + p.toString() : ''}`)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="form-group" style={{ flex: 1 }}>
        <label className="form-label">Cargo o profesión</label>
        <input
          className="form-input"
          type="text"
          placeholder="Ej: docente, plomero, contador, enfermero..."
          value={q}
          onChange={e => setQ(e.target.value)}
          maxLength={100}
        />
      </div>
      <button type="submit" className="btn-search">
        Buscar
      </button>
    </form>
  )
}
