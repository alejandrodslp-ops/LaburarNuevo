import { NextResponse } from 'next/server'

// Rate limit: 5 verificaciones por IP por minuto
const _rl = new Map()
function checkRateLimit(ip) {
  const now = Date.now()
  const reqs = (_rl.get(ip) || []).filter(t => now - t < 60000)
  if (reqs.length >= 5) return false
  _rl.set(ip, [...reqs, now])
  return true
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com','hotmail.com','yahoo.com','outlook.com','live.com',
  'icloud.com','msn.com','protonmail.com','ymail.com','aol.com',
  'hotmail.es','yahoo.es','gmail.es','hotmail.com.ar','yahoo.com.ar',
  'gmail.com.br','hotmail.com.br','yahoo.com.br','bol.com.br','uol.com.br',
])

function isCorporateEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return !FREE_EMAIL_DOMAINS.has(domain)
}

async function verificarCUIT(cuit) {
  const clean = cuit.replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(clean)) return { ok: false, error: 'CUIT inválido. Debe tener 11 dígitos.' }

  try {
    const res = await fetch(`https://soa.afip.gob.ar/sr-padron/v2/persona/${clean}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return { ok: false, error: 'CUIT no encontrado en AFIP.' }
    if (!res.ok) return { ok: false, error: `AFIP no disponible (${res.status}). Reintentá en un momento.` }
    const data = await res.json()
    const persona = data?.data
    if (!persona) return { ok: false, error: 'CUIT no encontrado en AFIP.' }

    const nombre = persona.razonSocial || `${persona.apellido ?? ''} ${persona.nombre ?? ''}`.trim()
    const activo = persona.estadoClave === 'ACTIVO'
    if (!activo) return { ok: false, error: `CUIT encontrado (${nombre}) pero está inactivo en AFIP.` }

    return { ok: true, nombre, pais: 'AR' }
  } catch {
    return { ok: false, error: 'No se pudo conectar con AFIP. Reintentá en un momento.' }
  }
}

async function verificarCNPJ(cnpj) {
  const clean = cnpj.replace(/[\.\-\/\s]/g, '')
  if (!/^\d{14}$/.test(clean)) return { ok: false, error: 'CNPJ inválido. Debe tener 14 dígitos.' }

  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return { ok: false, error: 'CNPJ no encontrado.' }
    if (res.status === 429) return { ok: false, error: 'Demasiados intentos. Esperá un momento y reintentá.' }
    if (!res.ok) return { ok: false, error: `Error al verificar CNPJ (${res.status}).` }
    const data = await res.json()

    const nombre = data.razao_social || data.nome_fantasia
    if (!nombre) return { ok: false, error: 'CNPJ no encontrado.' }

    const situacao = data.descricao_situacao_cadastral?.toLowerCase()
    if (situacao && situacao !== 'ativa') return { ok: false, error: `CNPJ encontrado (${nombre}) pero situación: ${data.descricao_situacao_cadastral}.` }

    return { ok: true, nombre, pais: 'BR' }
  } catch {
    return { ok: false, error: 'No se pudo conectar con la Receita Federal. Reintentá en un momento.' }
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos. Esperá un minuto.' }, { status: 429 })
  }
  const { pais, idFiscal, email } = await req.json()

  if (pais === 'UY') {
    if (!email) return NextResponse.json({ ok: false, error: 'Email requerido.' })
    const esCorporativo = isCorporateEmail(email)
    if (!esCorporativo) {
      return NextResponse.json({
        ok: false,
        error: 'Para empresas en Uruguay se requiere un email corporativo (ej: contacto@tuempresa.com). No se aceptan Gmail, Hotmail, Yahoo ni similares.',
        tipo: 'email_libre'
      })
    }
    return NextResponse.json({ ok: true, nombre: null, pais: 'UY', metodo: 'email_corporativo' })
  }

  if (pais === 'AR') return NextResponse.json(await verificarCUIT(idFiscal))
  if (pais === 'BR') return NextResponse.json(await verificarCNPJ(idFiscal))

  // Otros países — no hay verificación automática, se acepta
  return NextResponse.json({ ok: true, nombre: null, pais, metodo: 'sin_verificacion' })
}
