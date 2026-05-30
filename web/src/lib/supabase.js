import { createClient } from '@supabase/supabase-js'

// Solo se usa en server components — la service key nunca llega al cliente
export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
