export const PAIS = {
  // Sudamérica
  UY: { nombre: 'Uruguay',              bandera: '🇺🇾' },
  AR: { nombre: 'Argentina',            bandera: '🇦🇷' },
  CL: { nombre: 'Chile',                bandera: '🇨🇱' },
  PE: { nombre: 'Perú',                 bandera: '🇵🇪' },
  CO: { nombre: 'Colombia',             bandera: '🇨🇴' },
  MX: { nombre: 'México',               bandera: '🇲🇽' },
  EC: { nombre: 'Ecuador',              bandera: '🇪🇨' },
  BO: { nombre: 'Bolivia',              bandera: '🇧🇴' },
  PY: { nombre: 'Paraguay',             bandera: '🇵🇾' },
  VE: { nombre: 'Venezuela',            bandera: '🇻🇪' },
  BR: { nombre: 'Brasil',               bandera: '🇧🇷' },
  // Centroamérica y Caribe
  CU: { nombre: 'Cuba',                 bandera: '🇨🇺' },
  CR: { nombre: 'Costa Rica',           bandera: '🇨🇷' },
  GT: { nombre: 'Guatemala',            bandera: '🇬🇹' },
  SV: { nombre: 'El Salvador',          bandera: '🇸🇻' },
  HN: { nombre: 'Honduras',             bandera: '🇭🇳' },
  NI: { nombre: 'Nicaragua',            bandera: '🇳🇮' },
  PA: { nombre: 'Panamá',               bandera: '🇵🇦' },
  DO: { nombre: 'República Dominicana', bandera: '🇩🇴' },
  // Europa
  ES: { nombre: 'España',               bandera: '🇪🇸' },
  PT: { nombre: 'Portugal',             bandera: '🇵🇹' },
  IT: { nombre: 'Italia',               bandera: '🇮🇹' },
  FR: { nombre: 'Francia',              bandera: '🇫🇷' },
  DE: { nombre: 'Alemania',             bandera: '🇩🇪' },
  // Anglosajones
  GB: { nombre: 'Reino Unido',          bandera: '🇬🇧' },
  US: { nombre: 'Estados Unidos',       bandera: '🇺🇸' },
  CA: { nombre: 'Canadá',               bandera: '🇨🇦' },
  AU: { nombre: 'Australia',            bandera: '🇦🇺' },
  // Resto del mundo
  SE: { nombre: 'Suecia',               bandera: '🇸🇪' },
  NO: { nombre: 'Noruega',              bandera: '🇳🇴' },
  CH: { nombre: 'Suiza',               bandera: '🇨🇭' },
  JP: { nombre: 'Japón',                bandera: '🇯🇵' },
  IN: { nombre: 'India',                bandera: '🇮🇳' },
}

export function nombrePais(codigo) {
  return PAIS[codigo]?.nombre ?? codigo
}

export function bandPais(codigo) {
  return PAIS[codigo]?.bandera ?? '🌍'
}

// Genera la URL del concurso. El UUID (36 chars) va siempre al final
// para poder extraerlo de forma confiable.
export function toSlug(c) {
  const parte = (c.cargo || c.titulo || 'empleo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  const pais = (c.pais || 'latam').toLowerCase().replace(/[^a-z]/g, '')
  return `${parte}-${pais}-${c.id}`
}

// El UUID siempre ocupa los últimos 36 caracteres del slug
export function idFromSlug(slug) {
  return typeof slug === 'string' ? slug.slice(-36) : null
}

export function fmtFecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-UY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Convierte código ISO → slug usado en las rutas /empleos/pais/[pais]
const CODIGO_A_SLUG = {
  UY: 'uruguay',    AR: 'argentina',  CL: 'chile',       PE: 'peru',
  CO: 'colombia',   EC: 'ecuador',    BO: 'bolivia',     PY: 'paraguay',
  BR: 'brasil',     MX: 'mexico',     VE: 'venezuela',
  CU: 'cuba',       CR: 'costa-rica', GT: 'guatemala',   SV: 'el-salvador',
  HN: 'honduras',   NI: 'nicaragua',  PA: 'panama',      DO: 'republica-dominicana',
  ES: 'espana',     PT: 'portugal',   IT: 'italia',      FR: 'francia',
  DE: 'alemania',   GB: 'reino-unido', US: 'estados-unidos',
  CA: 'canada',     AU: 'australia',
  SE: 'suecia',     NO: 'noruega',    CH: 'suiza',       JP: 'japon',       IN: 'india',
}
export function paisSlug(codigo) {
  return CODIGO_A_SLUG[codigo] ?? codigo?.toLowerCase() ?? 'latam'
}

// Mapea tipo_vinculo al valor que acepta Google for Jobs
export function employmentType(tipo) {
  if (!tipo) return 'FULL_TIME'
  const t = tipo.toLowerCase()
  if (t.includes('contrat')) return 'CONTRACTOR'
  if (t.includes('part') || t.includes('medio')) return 'PART_TIME'
  if (t.includes('temp')) return 'TEMPORARY'
  if (t.includes('pasant') || t.includes('intern')) return 'INTERN'
  return 'FULL_TIME'
}
