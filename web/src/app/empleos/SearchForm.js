// Formulario nativo (GET → /empleos?q=...). Funciona SIEMPRE, con o sin JS.
export default function SearchForm({ defaultQ = '' }) {
  return (
    <form className="search-form" action="/empleos" method="get">
      <div className="form-group" style={{ flex: 1 }}>
        <label className="form-label" htmlFor="q">Cargo o profesión</label>
        <input
          id="q"
          name="q"
          className="form-input"
          type="text"
          placeholder="Ej: docente, plomero, contador, enfermero..."
          defaultValue={defaultQ}
          maxLength={100}
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-search">
        Buscar
      </button>
    </form>
  )
}
