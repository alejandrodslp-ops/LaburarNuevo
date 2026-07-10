import Link from 'next/link'
import { headers } from 'next/headers'
import PuzzleIcon from '../../components/PuzzleIcon'
import { createClient } from '@supabase/supabase-js'
import WaitlistForm from '../../components/WaitlistForm'
import { getLang } from '../../lib/i18n'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const LANGS = ['es', 'pt', 'en', 'fr', 'it', 'de', 'sv', 'no', 'ja']

// Idioma: ?lang= explícito > geo (país → idioma vía getLang) > español por defecto.
async function pickLang(searchParams) {
  const q = searchParams?.lang
  if (LANGS.includes(q)) return q
  return getLang((await headers()).get('x-vercel-ip-country'))
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
  en: {
    badge:   'FREE · WE ALERT YOU BY EMAIL',
    h1a:     "Don't search for a job every day.",
    h1b:     'Let it find you.',
    p1:      'Leave your email and Konexu alerts you the moment a job for your profile —public or private— appears in your country.',
    p2:      'Free. No daily searching. The job finds you.',
    cta:     'Get free alerts',
    nav:     'View jobs →',
    stat1:   'jobs available today',
    stat2:   'countries covered',
    stat3:   'personalized alerts',
    title:   'Konexu — Free job alerts',
    desc:    'Leave your email and we alert you the moment a job for your profile appears in your country. Free. Jobs and public competitions across Latin America.',
  },
  fr: {
    badge:   'GRATUIT · ON VOUS PRÉVIENT PAR EMAIL',
    h1a:     'Ne cherchez pas un emploi tous les jours.',
    h1b:     'Laissez-le vous trouver.',
    p1:      "Laissez votre email et Konexu vous prévient dès qu'une offre pour votre profil —publique ou privée— paraît dans votre pays.",
    p2:      "Gratuit. Sans chercher tous les jours. L'emploi vous trouve.",
    cta:     'Activer les alertes gratuites',
    nav:     'Voir les offres →',
    stat1:   "offres disponibles aujourd'hui",
    stat2:   'pays couverts',
    stat3:   'alertes personnalisées',
    title:   'Konexu — Alertes emploi gratuites',
    desc:    "Laissez votre email et nous vous prévenons dès qu'une offre pour votre profil paraît dans votre pays. Gratuit. Emplois et concours publics dans toute l'Amérique latine.",
  },
  it: {
    badge:   'GRATIS · TI AVVISIAMO VIA EMAIL',
    h1a:     'Non cercare lavoro tutti i giorni.',
    h1b:     'Lascia che ti trovi.',
    p1:      'Lascia la tua email e Konexu ti avvisa appena appare un lavoro per il tuo profilo —pubblico o privato— nel tuo paese.',
    p2:      'Gratis. Senza cercare ogni giorno. Il lavoro ti trova.',
    cta:     'Attiva avvisi gratis',
    nav:     'Vedi lavori →',
    stat1:   'lavori disponibili oggi',
    stat2:   'paesi coperti',
    stat3:   'avvisi personalizzati',
    title:   'Konexu — Avvisi di lavoro gratis',
    desc:    "Lascia la tua email e ti avvisiamo appena appare un lavoro per il tuo profilo nel tuo paese. Gratis. Lavori e concorsi pubblici in tutta l'America Latina.",
  },
  de: {
    badge:   'KOSTENLOS · WIR BENACHRICHTIGEN DICH PER E-MAIL',
    h1a:     'Such nicht jeden Tag nach einem Job.',
    h1b:     'Lass ihn dich finden.',
    p1:      'Hinterlasse deine E-Mail und Konexu benachrichtigt dich, sobald in deinem Land ein Job für dein Profil —öffentlich oder privat— erscheint.',
    p2:      'Kostenlos. Kein tägliches Suchen. Der Job findet dich.',
    cta:     'Gratis-Alerts aktivieren',
    nav:     'Jobs ansehen →',
    stat1:   'Jobs heute verfügbar',
    stat2:   'abgedeckte Länder',
    stat3:   'personalisierte Alerts',
    title:   'Konexu — Kostenlose Job-Benachrichtigungen',
    desc:    'Hinterlasse deine E-Mail und wir benachrichtigen dich, sobald in deinem Land ein Job für dein Profil erscheint. Kostenlos. Jobs und öffentliche Ausschreibungen in ganz Lateinamerika.',
  },
  sv: {
    badge:   'GRATIS · VI MEDDELAR DIG VIA E-POST',
    h1a:     'Leta inte efter jobb varje dag.',
    h1b:     'Låt det hitta dig.',
    p1:      'Lämna din e-post så meddelar Konexu dig så fort ett jobb för din profil —offentligt eller privat— dyker upp i ditt land.',
    p2:      'Gratis. Inget dagligt sökande. Jobbet hittar dig.',
    cta:     'Aktivera gratis aviseringar',
    nav:     'Se jobb →',
    stat1:   'jobb tillgängliga idag',
    stat2:   'länder som täcks',
    stat3:   'personliga aviseringar',
    title:   'Konexu — Gratis jobbaviseringar',
    desc:    'Lämna din e-post så meddelar vi dig så fort ett jobb för din profil dyker upp i ditt land. Gratis. Jobb och offentliga tjänster i hela Latinamerika.',
  },
  no: {
    badge:   'GRATIS · VI VARSLER DEG PÅ E-POST',
    h1a:     'Ikke let etter jobb hver dag.',
    h1b:     'La den finne deg.',
    p1:      'Legg igjen e-posten din, så varsler Konexu deg så snart en jobb for din profil —offentlig eller privat— dukker opp i landet ditt.',
    p2:      'Gratis. Ingen daglig leting. Jobben finner deg.',
    cta:     'Aktiver gratis varsler',
    nav:     'Se jobber →',
    stat1:   'jobber tilgjengelig i dag',
    stat2:   'land dekket',
    stat3:   'personlige varsler',
    title:   'Konexu — Gratis jobbvarsler',
    desc:    'Legg igjen e-posten din, så varsler vi deg så snart en jobb for din profil dukker opp i landet ditt. Gratis. Jobber og offentlige stillinger i hele Latin-Amerika.',
  },
  ja: {
    badge:   '無料 · メールでお知らせ',
    h1a:     '毎日仕事を探さないで。',
    h1b:     '仕事のほうから見つけてもらおう。',
    p1:      'メールアドレスを登録すれば、あなたのプロフィールに合う求人（公募・民間）が国内に出た瞬間にKonexuがお知らせします。',
    p2:      '無料。毎日探す必要なし。仕事があなたを見つけます。',
    cta:     '無料アラートを有効化',
    nav:     '求人を見る →',
    stat1:   '本日の求人数',
    stat2:   '対象国',
    stat3:   'パーソナライズされたアラート',
    title:   'Konexu — 無料求人アラート',
    desc:    'メールアドレスを登録すれば、あなたのプロフィールに合う求人が国内に出た瞬間にお知らせします。無料。ラテンアメリカ全域の求人と公募。',
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
  const totalStr = total > 0 ? `${total.toLocaleString(lang === 'pt' ? 'pt-BR' : lang)}+` : '100.000+'

  return (
    <>
      <nav style={{
        background: '#0D1117', padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'flex-end', background:'#151c2c', border:'2.5px solid #E8785A', borderRadius:14, padding:'4px 14px', color:'#E8785A', fontSize:22, fontWeight:900, letterSpacing:-0.5, textDecoration:'none' }}><span>Konexu</span><PuzzleIcon style={{marginLeft:'-9px',marginBottom:'3px'}}/></Link>
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
