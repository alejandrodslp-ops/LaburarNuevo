import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../../components/WaitlistForm'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Idioma: ?lang= explícito > geo (Brasil = pt) > español por defecto.
async function pickLang(searchParams) {
  const q = searchParams?.lang
  if (q === 'pt' || q === 'es') return q
  const pais = (await headers()).get('x-vercel-ip-country')
  return pais === 'BR' ? 'pt' : 'es'
}

const T = {
  es: {
    badge:   'GRATIS · TE AVISAMOS POR EMAIL',
    h1a:     'No busques trabajo todos los días.',
    h1b:     'Deja que te encuentre.',
    p1:      'Deja tu email y Konexu te avisa apenas aparece un trabajo para tu perfil —público o privado— en tu país.',
    p2:      'Gratis. Sin buscar todos los días. El trabajo te encuentra a ti.',
    cta:     'Activar alertas gratis',
    nav:     'Ver empleos →',
    stat1:   'empleos disponibles hoy',
    stat2:   'países cubiertos',
    stat3:   'alertas personalizadas',
    title:   'Konexu — Alertas de trabajo gratis',
    desc:    'Deja tu email y te avisamos apenas salga un trabajo para tu perfil, en tu país. Gratis. Empleos y concursos públicos de toda LatAm.',
  },
  pt: {
    badge:   'GRÁTIS · AVISAMOS POR EMAIL',
    h1a:     'Não procure emprego todos os dias.',
    h1b:     'Deixe que ele te encontre.',
    p1:      'Deixe seu email e o Konexu te avisa assim que aparecer uma vaga para o seu perfil —pública ou privada— no seu país.',
    p2:      'Grátis. Sem procurar todos os dias. O trabalho encontra você.',
    cta:     'Ativar alertas grátis',
    nav:     'Ver vagas →',
    stat1:   'vagas disponíveis hoje',
    stat2:   'países cobertos',
    stat3:   'alertas personalizados',
    title:   'Konexu — Alertas de vagas grátis',
    desc:    'Deixe seu email e avisamos assim que sair uma vaga para o seu perfil, no seu país. Grátis. Vagas e concursos públicos de toda a América Latina.',
  },
}

async function getTotal() {
  const { count } = await db.from('concursos').select('*', { count: 'estimated', head: true }).eq('activo', true)
  return count ?? 0
}

export async function generateMetadata({ searchParams }) {
  const t = T[await pickLang(searchParams)]
  return { title: t.title, description: t.desc }
}

export default async function DownloadPage({ searchParams }) {
  const lang = await pickLang(searchParams)
  const t = T[lang]
  const total = await getTotal()
  const totalStr = total > 0 ? `${total.toLocaleString(lang === 'pt' ? 'pt-BR' : 'es')}+` : '100.000+'

  return (
    <>
      <nav style={{
        background: '#0D1117', padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'flex-end', background:'#151c2c', border:'2.5px solid #E8785A', borderRadius:14, padding:'4px 14px', color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-0.5, textDecoration:'none' }}><span>Konexu</span><span style={{fontSize:'0.42em',marginLeft:'-9px',lineHeight:1,marginBottom:'3px'}}>🧩</span></Link>
        <Link href="/empleos" style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>{t.nav}</Link>
      </nav>

      <section style={{
        background: 'linear-gradient(160deg, #0D1117 60%, #1a0a05)',
        color: 'white',
        padding: '80px 24px 88px', textAlign: 'center',
        minHeight: '85vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>

        {/* Badge de demanda */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(232,120,90,0.12)', border: '1px solid rgba(232,120,90,0.3)',
          borderRadius: 100, padding: '7px 18px', marginBottom: 32,
        }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ fontSize: 12, color: '#E8785A', fontWeight: 700, letterSpacing: 0.5 }}>
            {t.badge}
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 58px)', fontWeight: 900,
          lineHeight: 1.08, color: 'white', maxWidth: 580,
          margin: '0 auto 18px', letterSpacing: -2,
        }}>
          {t.h1a}<br />
          <em style={{ color: '#E8785A', fontStyle: 'italic' }}>{t.h1b}</em>
        </h1>

        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', maxWidth: 460, margin: '0 auto 12px', lineHeight: 1.65 }}>
          {t.p1}
        </p>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', maxWidth: 400, margin: '0 auto 44px', lineHeight: 1.6 }}>
          {t.p2}
        </p>

        {/* Waitlist form */}
        <div style={{ width: '100%', maxWidth: 440 }}>
          <WaitlistForm lang={lang} ctaLabel={t.cta} />
        </div>

        {/* Social proof */}
        <div style={{
          display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
          marginTop: 48, paddingTop: 40,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          maxWidth: 500,
        }}>
          {[
            { num: totalStr,  label: t.stat1 },
            { num: '33',      label: t.stat2 },
            { num: '100%',    label: t.stat3 },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#E8785A', letterSpacing: -1 }}>{s.num}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        background: '#0D1117', color: 'rgba(255,255,255,0.3)',
        textAlign: 'center', padding: '24px', fontSize: 13,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p>© {new Date().getFullYear()} Konexu · <Link href="/empleos" style={{ color: 'inherit' }}>{t.nav}</Link></p>
      </footer>
    </>
  )
}
