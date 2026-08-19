'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../../lib/supabase-browser'
import { useLang } from '../../lib/useLang'

const TXT = {
  es: {
    bienvenido: (n) => `Bienvenido${n ? `, ${n}` : ''}`,
    sub: 'Aquí podés gestionar tus ofertas y encontrar candidatos.',
    statOfertas: 'Ofertas publicadas',
    statActivas: 'Ofertas activas',
    statVistas: 'Vistas totales',
    statContactos: 'Contactos enviados',
    accMisTit: 'Mis ofertas',
    accMisDesc: 'Publicá, editá y activá tus búsquedas laborales.',
    accMisBtn: 'Ver ofertas',
    accBuscarTit: 'Buscar candidatos',
    accBuscarDesc: 'Explorá perfiles de trabajadores disponibles en tu país.',
    accBuscarBtn: 'Buscar ahora',
    emptyTit: 'Todavía no publicaste ninguna oferta',
    emptyDesc: 'Creá tu primera oferta y llegá a trabajadores calificados.',
    emptyBtn: '+ Publicar oferta',
    compTit: '🧾 Comprobantes de pago',
    compVacio: 'No hay comprobantes aún. Se generan automáticamente cuando realizás un pago.',
    thNum: 'N°', thFecha: 'Fecha', thConcepto: 'Concepto', thImporte: 'Importe',
    descargar: '↓ Descargar',
    locale: 'es-UY',
  },
  pt: {
    bienvenido: (n) => `Bem-vindo${n ? `, ${n}` : ''}`,
    sub: 'Aqui você gerencia suas vagas e encontra candidatos.',
    statOfertas: 'Vagas publicadas',
    statActivas: 'Vagas ativas',
    statVistas: 'Visualizações totais',
    statContactos: 'Contatos enviados',
    accMisTit: 'Minhas vagas',
    accMisDesc: 'Publique, edite e ative suas vagas.',
    accMisBtn: 'Ver vagas',
    accBuscarTit: 'Buscar candidatos',
    accBuscarDesc: 'Explore perfis de trabalhadores disponíveis no seu país.',
    accBuscarBtn: 'Buscar agora',
    emptyTit: 'Você ainda não publicou nenhuma vaga',
    emptyDesc: 'Crie sua primeira vaga e alcance trabalhadores qualificados.',
    emptyBtn: '+ Publicar vaga',
    compTit: '🧾 Comprovantes de pagamento',
    compVacio: 'Ainda não há comprovantes. São gerados automaticamente quando você faz um pagamento.',
    thNum: 'Nº', thFecha: 'Data', thConcepto: 'Descrição', thImporte: 'Valor',
    descargar: '↓ Baixar',
    locale: 'pt-BR',
  },
}

export default function EmpleadorDashboard() {
  const lang = useLang()
  const L = TXT[lang]
  const [stats, setStats] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [ofertas, setOfertas] = useState([])
  const [comprobantes, setComprobantes] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data: { user } } = await supabaseBrowser.auth.getUser()
    if (!user) return

    const [{ data: p }, { data: o }, { data: comps }] = await Promise.all([
      supabaseBrowser.from('profiles').select('nombre, pais').eq('id', user.id).single(),
      supabaseBrowser.from('ofertas').select('id, activa, vistas, postulaciones').eq('employer_id', user.id),
      supabaseBrowser.from('comprobantes').select('id, numero, fecha, monto, moneda, metodo, concepto, html_url').eq('employer_id', user.id).order('fecha', { ascending: false }).limit(20),
    ])
    setComprobantes(comps || [])

    setPerfil(p)
    setOfertas(o || [])
    setStats({
      totalOfertas: o?.length ?? 0,
      ofertasActivas: o?.filter(x => x.activa).length ?? 0,
      totalVistas: o?.reduce((s, x) => s + (x.vistas || 0), 0) ?? 0,
      totalContactos: o?.reduce((s, x) => s + (x.postulaciones || 0), 0) ?? 0,
    })
  }

  if (!stats) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
          {L.bienvenido(perfil?.nombre)}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 14 }}>{L.sub}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label={L.statOfertas} value={stats.totalOfertas} icon="📋" />
        <StatCard label={L.statActivas} value={stats.ofertasActivas} icon="✅" color="var(--teal)" />
        <StatCard label={L.statVistas} value={stats.totalVistas} icon="👁" />
        <StatCard label={L.statContactos} value={stats.totalContactos} icon="✉️" color="var(--coral)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ActionCard
          icon="📋"
          title={L.accMisTit}
          desc={L.accMisDesc}
          href="/empleador/ofertas"
          btnLabel={L.accMisBtn}
        />
        <ActionCard
          icon="🔍"
          title={L.accBuscarTit}
          desc={L.accBuscarDesc}
          href="/empleador/candidatos"
          btnLabel={L.accBuscarBtn}
          accent
        />
      </div>

      {ofertas.length === 0 && (
        <div style={{ marginTop: 24, background: 'white', border: '1.5px dashed var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{L.emptyTit}</p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>{L.emptyDesc}</p>
          <a href="/empleador/ofertas/nueva" style={{ background: 'var(--coral)', color: 'white', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14 }}>
            {L.emptyBtn}
          </a>
        </div>
      )}
      <ComprobantesSection comprobantes={comprobantes} L={L} />
    </div>
  )
}

function ComprobantesSection({ comprobantes, L }) {
  if (!comprobantes.length) return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', marginTop: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{L.compTit}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>{L.compVacio}</p>
    </div>
  )
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', marginTop: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>{L.compTit}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>{L.thNum}</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>{L.thFecha}</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>{L.thConcepto}</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>{L.thImporte}</th>
            <th style={{ padding: '8px 12px' }}></th>
          </tr>
        </thead>
        <tbody>
          {comprobantes.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{c.numero}</td>
              <td style={{ padding: '10px 12px' }}>{new Date(c.fecha).toLocaleDateString(L.locale)}</td>
              <td style={{ padding: '10px 12px', maxWidth: 200 }}>{c.concepto}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                {new Intl.NumberFormat(L.locale, { style: 'currency', currency: c.moneda ?? 'USD' }).format(c.monto)}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {c.html_url && (
                  <a href={c.html_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 700, textDecoration: 'none' }}>
                    {L.descargar}
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value, icon, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ActionCard({ icon, title, desc, href, btnLabel, accent }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--sh)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>{desc}</p>
      <a href={href} style={{ display: 'inline-block', background: accent ? 'var(--coral)' : 'var(--bg)', color: accent ? 'white' : 'var(--text)', border: accent ? 'none' : '1.5px solid var(--border)', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14 }}>
        {btnLabel}
      </a>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
