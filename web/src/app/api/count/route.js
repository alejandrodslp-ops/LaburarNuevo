import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export async function GET() {
  const { data, error } = await db.rpc('count_concursos_activos')
  const total = (!error && data) ? data : 0
  return NextResponse.json({ total }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
