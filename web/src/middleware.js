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
  // España: SOLO por el país real del visitante (geo de Vercel). El idioma
  // es-ES NO sirve como señal: es el default de Chrome en media LATAM
  // (caso real 2026-07-17: el usuario, en Uruguay, cayó en /es-es).
  const geoPais = req.headers.get('x-vercel-ip-country') || ''
  if (al.startsWith('es') && geoPais === 'ES') {
    const url = req.nextUrl.clone()
    url.pathname = '/es-es'
    return NextResponse.redirect(url, 307)
  }
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
