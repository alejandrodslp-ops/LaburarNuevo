'use client'
import { createClient } from '@supabase/supabase-js'

// Cliente para el browser — usa la clave pública (anon), nunca la service key
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
