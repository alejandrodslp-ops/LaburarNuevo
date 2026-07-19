// Filtro de ciudad para la búsqueda web, tolerante a errores humanos.
// Tres capas, en orden (mismo patrón probado en las alertas por email):
//   1. Apodos/abreviaturas comunes (CABA, Bs As, CDMX...) — no son typos,
//      ninguna similitud los resuelve sola.
//   2. Coincidencia exacta sin tildes ("montevideo" encuentra "Montevideo").
//   3. Similitud por trigramas para faltas de ortografía ("Montevdeo",
//      "Guadalajara" mal escrita, etc.).
// Siempre se compara contra la parte de CIUDAD del lugar (antes de la coma):
// "Ribeirão Preto, Estado de São Paulo" no debe matchear con "São Paulo"
// (caso real de las alertas, 2026-07-17).

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Entrada del usuario → variantes que puede tener el aviso (todo normalizado)
const APODOS = {
  'caba': ['caba', 'capital federal', 'ciudad autonoma de buenos aires', 'buenos aires'],
  'capital federal': ['caba', 'capital federal', 'buenos aires'],
  'bs as': ['buenos aires', 'caba'],
  'bsas': ['buenos aires', 'caba'],
  'baires': ['buenos aires', 'caba'],
  'cdmx': ['cdmx', 'ciudad de mexico', 'mexico'],
  'df': ['cdmx', 'ciudad de mexico'],
  'gdl': ['guadalajara'],
  'mty': ['monterrey'],
  'sp': ['sao paulo'],
  'sampa': ['sao paulo'],
  'rj': ['rio de janeiro'],
  'rio': ['rio de janeiro'],
  'bh': ['belo horizonte'],
  'poa': ['porto alegre'],
  'mvd': ['montevideo'],
  'montevideo': ['montevideo'],
  'stgo': ['santiago'],
  'scl': ['santiago'],
  'bogota': ['bogota'],
  'medellin': ['medellin'],
  'sj': ['san jose'],
}

function trigramas(s) {
  const t = new Set()
  const p = `  ${s} `
  for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3))
  return t
}

function similitud(a, b) {
  if (!a || !b) return 0
  const ta = trigramas(a)
  const tb = trigramas(b)
  let inter = 0
  for (const g of ta) if (tb.has(g)) inter++
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

// Parte de ciudad del campo lugar del aviso, normalizada
const ciudadDelLugar = (lugar) => norm(String(lugar || '').split(',')[0])

// Devuelve { resultados, exacto } — exacto=false significa que no hubo nada
// en esa ciudad y los resultados vienen sin filtrar (para avisarlo con
// honestidad, igual que en los emails).
export function filtrarPorCiudad(avisos, ciudadUsuario) {
  const entrada = norm(ciudadUsuario)
  if (entrada.length < 2) return { resultados: avisos, exacto: true, filtrado: false }

  const candidatas = [...new Set([entrada, ...(APODOS[entrada] || [])])]

  // Capa 1 y 2: apodos + coincidencia exacta sin tildes
  let deZona = avisos.filter((a) => {
    const cl = ciudadDelLugar(a.lugar)
    return cl && candidatas.some((c) => cl.includes(c) || c.includes(cl))
  })

  // Capa 3: similitud por trigramas (faltas de ortografía)
  if (deZona.length === 0 && entrada.length >= 5) {
    deZona = avisos.filter((a) => {
      const cl = ciudadDelLugar(a.lugar)
      return cl && similitud(cl, entrada) >= 0.45
    })
  }

  if (deZona.length > 0) return { resultados: deZona, exacto: true, filtrado: true }
  return { resultados: avisos, exacto: false, filtrado: false }
}
