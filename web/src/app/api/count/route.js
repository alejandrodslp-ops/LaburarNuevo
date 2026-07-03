import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Route handler (server): usa credenciales de servidor, no las NEXT_PUBLIC,
// que en producción pueden apuntar a un proyecto viejo (contador desfasado).
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const { data, error } = await db.rpc('count_concursos_activos')
  const total = (!error && data) ? data : 0
  return NextResponse.json({ total })
}
