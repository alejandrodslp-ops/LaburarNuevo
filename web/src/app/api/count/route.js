import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  const { data, error } = await db.rpc('count_concursos_activos')
  const total = (!error && data) ? data : 0
  return NextResponse.json({ total })
}
