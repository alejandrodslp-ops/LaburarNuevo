// Formulario nativo (GET → /empleos?q=...&pais=...&ciudad=...). Funciona SIEMPRE, con o sin JS.
// País y ciudad viven ARRIBA junto al cargo: la búsqueda debe ajustarse a la
// persona desde el primer intento, no recién al registrarse.
const PAISES_BUSQUEDA = [
  ['', '🌎 Detectar mi país'],
  ['UY', '🇺🇾 Uruguay'], ['AR', '🇦🇷 Argentina'], ['BR', '🇧🇷 Brasil'],
  ['MX', '🇲🇽 México'], ['CL', '🇨🇱 Chile'], ['CO', '🇨🇴 Colombia'],
  ['PE', '🇵🇪 Perú'], ['EC', '🇪🇨 Ecuador'], ['BO', '🇧🇴 Bolivia'],
  ['PY', '🇵🇾 Paraguay'], ['VE', '🇻🇪 Venezuela'], ['CR', '🇨🇷 Costa Rica'],
  ['GT', '🇬🇹 Guatemala'], ['SV', '🇸🇻 El Salvador'], ['HN', '🇭🇳 Honduras'],
  ['NI', '🇳🇮 Nicaragua'], ['PA', '🇵🇦 Panamá'], ['DO', '🇩🇴 Rep. Dominicana'],
  ['ES', '🇪🇸 España'], ['US', '🇺🇸 Estados Unidos'],
]

export default function SearchForm({ defaultQ = '', defaultPais = '', defaultCiudad = '' }) {
  return (
    <form className="search-form" action="/empleos" method="get">
      <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
        <label className="form-label" htmlFor="q">Cargo o profesión</label>
        <input
          id="q"
          name="q"
          className="form-input"
          type="text"
          placeholder="Ej: docente, plomero, contador..."
          defaultValue={defaultQ}
          maxLength={100}
          autoComplete="off"
        />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
        <label className="form-label" htmlFor="pais">País</label>
        <select id="pais" name="pais" className="form-select" defaultValue={defaultPais}>
          {PAISES_BUSQUEDA.map(([cod, nombre]) => (
            <option key={cod || 'auto'} value={cod}>{nombre}</option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
        <label className="form-label" htmlFor="ciudad">Ciudad (opcional)</label>
        <input
          id="ciudad"
          name="ciudad"
          className="form-input"
          type="text"
          placeholder="Ej: Montevideo"
          defaultValue={defaultCiudad}
          maxLength={60}
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-search">
        Buscar
      </button>
    </form>
  )
}
