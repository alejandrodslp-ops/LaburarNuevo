import { NextResponse } from 'next/server'
import { db } from '../../../lib/supabase'
import { toSlug } from '../../../lib/utils'

export const dynamic = 'force-dynamic'

// Link corto para Telegram/redes: /e/uy-41801 → página del concurso, con UTM.
// El código es <pais>-<fuente_id>. Se muestra como URL visible en los mensajes
// porque Telegram abre las URLs visibles sin popup de confirmación.
export async function GET(request, { params }) {
  const codigo = String(params?.codigo || '')
  const sep = codigo.indexOf('-')
  const pais = sep > 0 ? codigo.slice(0, sep).toUpperCase() : ''
  const fuenteId = sep > 0 ? codigo.slice(sep + 1) : ''
  const fallback = NextResponse.redirect('https://www.konexu.app/empleos', 302)
  if (!pais || !fuenteId) return fallback

  // fuente_id puede repetirse entre fuentes distintas: se toma el más reciente del país
  const { data } = await db
    .from('concursos')
    .select('id, cargo, titulo, pais')
    .eq('pais', pais)
    .eq('fuente_id', fuenteId)
    .order('created_at', { ascending: false })
    .limit(1)

  const c = data?.[0]
  if (!c) return fallback

  const utm = `utm_source=telegram&utm_medium=canal&utm_campaign=concursos_${pais.toLowerCase()}`
  return NextResponse.redirect(`https://www.konexu.app/empleos/${toSlug(c)}?${utm}`, 302)
}
