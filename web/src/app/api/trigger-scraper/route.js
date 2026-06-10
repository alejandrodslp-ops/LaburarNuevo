import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'alejandrodslp@gmail.com'

// Rate limit: máximo 10 disparos por hora desde cualquier IP
const _rl = new Map()
function checkRateLimit(ip) {
  const now = Date.now()
  const reqs = (_rl.get(ip) || []).filter(t => now - t < 3600000)
  if (reqs.length >= 10) return false
  _rl.set(ip, [...reqs, now])
  return true
}

export async function POST(req) {
  // Verificar autenticación: solo el admin puede disparar scrapers
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const userToken = authHeader.slice(7)
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { data: { user }, error: authErr } = await supa.auth.getUser(userToken)
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Rate limit por IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return Response.json({ error: 'Demasiados disparos. Esperá una hora.' }, { status: 429 })
  }

  const body = await req.json()
  const { workflow } = body

  const WORKFLOWS = {
    global:     '281088176',
    sudamerica: '275673144',
    privado:    '275695344',
  }

  const id = WORKFLOWS[workflow]
  if (!id) return Response.json({ error: 'workflow inválido' }, { status: 400 })

  const token = process.env.GITHUB_TOKEN
  if (!token) return Response.json({ error: 'GITHUB_TOKEN no configurado' }, { status: 500 })

  const res = await fetch(
    `https://api.github.com/repos/alejandrodslp-ops/LaburarNuevo/actions/workflows/${id}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )

  if (!res.ok) {
    const txt = await res.text()
    return Response.json({ error: txt }, { status: res.status })
  }

  return Response.json({ ok: true })
}
