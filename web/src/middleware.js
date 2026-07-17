import { NextResponse } from 'next/server'

// Redirección de idioma SOLO en la portada: navegador en portugués → /pt.
// Auto-repara los links viejos publicados con konexu.app en grupos de Brasil.
// Bots (Google, Facebook, WhatsApp...) quedan excluidos: indexan y scrapean
// la home en español tal cual — el SEO no cambia.
// matcher '/' = únicamente la raíz; ninguna otra ruta pasa por acá.
export function middleware(req) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  if (/bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slurp/.test(ua)) {
    return NextResponse.next()
  }
  const al = (req.headers.get('accept-language') || '').trim().toLowerCase()
  // 1) EL PAÍS REAL DE LA CONEXIÓN MANDA (geo de Vercel): cada visitante ve
  //    la versión de SU país. El idioma del navegador no es señal de país
  //    (es-ES es el default de Chrome en media LATAM — caso real 2026-07-17).
  const geoPais = req.headers.get('x-vercel-ip-country') || ''
  const GEO_RUTA = {
    ES: '/es-es',
    BR: '/pt', PT: '/pt',
    US: '/en', GB: '/en', IE: '/en', CA: '/en', AU: '/en', NZ: '/en', IN: '/en',
    FR: '/fr', IT: '/it',
    DE: '/de', AT: '/de', CH: '/de',
    SE: '/sv', NO: '/no', JP: '/ja',
  }
  if (GEO_RUTA[geoPais]) {
    const url = req.nextUrl.clone()
    url.pathname = GEO_RUTA[geoPais]
    return NextResponse.redirect(url, 307)
  }
  // 2) Geo sin versión propia (LATAM → home en español) o desconocido:
  //    el idioma del navegador es el mejor plan B (un brasileño en Uruguay
  //    sigue viendo portugués).
  const lang = al.slice(0, 2)
  const LANDINGS = ['pt', 'en', 'fr', 'it', 'de', 'sv', 'no', 'ja']
  if (LANDINGS.includes(lang)) {
    const url = req.nextUrl.clone()
    url.pathname = `/${lang}`
    return NextResponse.redirect(url, 307)
  }
  return NextResponse.next()
}

export const config = { matcher: '/' }
