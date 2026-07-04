import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// Route handler (server): usa credenciales de servidor, no las NEXT_PUBLIC,
// que en producción pueden apuntar a un proyecto viejo (contador desfasado).
// El fetch se fuerza a no-store para que el Data Cache de Next/Vercel no
// devuelva un valor viejo (el conteo cambia todo el día y no debe cachearse).
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) } }
)

export async function GET() {
  const { data, error } = await db.rpc('count_concursos_activos')
  const total = (!error && data) ? data : 0
  return NextResponse.json({ total }, { headers: { 'Cache-Control': 'no-store' } })
}
