export async function POST(req) {
  const { workflow } = await req.json()

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
